import { createHmac, hkdfSync, randomUUID, timingSafeEqual } from "node:crypto";
import { v2 as cloudinary } from "cloudinary";
import type { MediaType } from "@/app/generated/prisma/enums";
import {
  MEDIA_UPLOAD_ASSET_FOLDER,
  canonicalizeMediaUploadAuthorization,
  cloudinaryAuthoritativeResourceSchema,
  type CloudinaryProviderProof,
  type CloudinaryResourceType,
  type MediaUploadAuthorization,
} from "@/lib/validation/media-upload.schema";
import type {
  AuthoritativeProviderResource,
  CloudinarySignedUploadParameters,
  MediaUploadAuthorizationBundle,
  StorageProvider,
  UploadOptions,
  UploadResult,
} from "./storage.types";

const APPLICATION_PROOF_INFO = "wanderstory:media-upload-proof:v1";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

function getConfiguration(): {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
} {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error("Cloudinary is not configured");
  }

  return { cloudName, apiKey, apiSecret };
}

function deriveApplicationProofKey(apiSecret: string): Buffer {
  return Buffer.from(
    hkdfSync(
      "sha256",
      Buffer.from(apiSecret, "utf8"),
      Buffer.alloc(0),
      Buffer.from(APPLICATION_PROOF_INFO, "utf8"),
      32,
    ),
  );
}

export function createApplicationUploadProof(
  authorization: MediaUploadAuthorization,
): string {
  const { apiSecret } = getConfiguration();
  const key = deriveApplicationProofKey(apiSecret);
  return createHmac("sha256", key)
    .update(canonicalizeMediaUploadAuthorization(authorization), "utf8")
    .digest("hex");
}

export function verifyApplicationUploadProof(
  authorization: MediaUploadAuthorization,
  suppliedProof: string,
): boolean {
  if (!/^[a-f0-9]{64}$/.test(suppliedProof)) return false;

  try {
    const expectedProof = createApplicationUploadProof(authorization);
    const expected = Buffer.from(expectedProof, "hex");
    const supplied = Buffer.from(suppliedProof, "hex");
    return expected.length === supplied.length && timingSafeEqual(expected, supplied);
  } catch {
    return false;
  }
}

function normalizeContext(context: Record<string, unknown>): Record<string, string> {
  const candidate = context.custom;
  const source = candidate && typeof candidate === "object" && !Array.isArray(candidate)
    ? candidate as Record<string, unknown>
    : context;

  return Object.fromEntries(
    Object.entries(source).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
}

function requireCloudinaryDeliveryUrl(value: string): string {
  const parsed = new URL(value);
  if (parsed.protocol !== "https:" || parsed.hostname !== "res.cloudinary.com") {
    throw new Error("Unexpected Cloudinary delivery URL");
  }
  return value;
}

function mediaTypeToResourceType(mediaType: MediaType): CloudinaryResourceType {
  return mediaType === "VIDEO" ? "video" : "image";
}

export const cloudinaryProvider: StorageProvider = {
  async upload(file: Buffer, options: UploadOptions): Promise<UploadResult> {
    getConfiguration();
    const isVideo = options.mimeType.startsWith("video/");
    const isImage = options.mimeType.startsWith("image/");
    const resourceType = isVideo ? "video" : "image";
    const result = await cloudinary.uploader.upload(
      `data:${options.mimeType};base64,${file.toString("base64")}`,
      {
        asset_folder: options.folder ?? MEDIA_UPLOAD_ASSET_FOLDER,
        public_id: randomUUID(),
        resource_type: resourceType,
        use_asset_folder_as_public_id_prefix: false,
        overwrite: false,
        unique_filename: false,
        use_filename: false,
        type: "upload",
      },
    );
    const uploadResult: UploadResult = {
      url: result.secure_url,
      providerId: result.public_id,
      width: result.width,
      height: result.height,
      format: result.format,
    };
    if (isImage) {
      const derivatives = this.getImageDerivativeUrls(result.public_id);
      uploadResult.thumbnailUrl = derivatives.thumbnailUrl;
      uploadResult.blurDataUrl = derivatives.blurDataUrl;
    }
    if (isVideo && result.duration) uploadResult.duration = Math.round(result.duration);
    return uploadResult;
  },

  authorizeUpload(
    authorization: MediaUploadAuthorization,
    allowedFormats: string,
  ): MediaUploadAuthorizationBundle {
    const { cloudName, apiKey, apiSecret } = getConfiguration();
    if (!allowedFormats) {
      throw new Error("No allowed Cloudinary formats were selected");
    }

    const providerParams: CloudinarySignedUploadParameters = {
      timestamp: authorization.issuedAt,
      public_id: authorization.expectedPublicId,
      asset_folder: MEDIA_UPLOAD_ASSET_FOLDER,
      use_asset_folder_as_public_id_prefix: false,
      overwrite: false,
      unique_filename: false,
      use_filename: false,
      allowed_formats: allowedFormats,
      context: `wsid=${authorization.uploadId}|wsp=${authorization.purpose}`,
      type: "upload",
    };

    const providerSignature = cloudinary.utils.api_sign_request(
      providerParams,
      apiSecret,
    );

    return {
      cloudName,
      apiKey,
      uploadUrl: `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/${authorization.resourceType}/upload`,
      resourceType: authorization.resourceType,
      providerParams,
      providerSignature,
      authorization,
      applicationProof: createApplicationUploadProof(authorization),
    };
  },

  verifyResponseSignature(proof: CloudinaryProviderProof): boolean {
    try {
      getConfiguration();
      return cloudinary.utils.verify_api_response_signature(
        proof.public_id,
        proof.version,
        proof.signature,
      );
    } catch {
      return false;
    }
  },

  async getAuthoritativeResource(
    publicId: string,
    resourceType: CloudinaryResourceType,
  ): Promise<AuthoritativeProviderResource> {
    getConfiguration();
    const response: unknown = await cloudinary.api.resource(publicId, {
      resource_type: resourceType,
      type: "upload",
      context: true,
      media_metadata: true,
    });
    const parsed = cloudinaryAuthoritativeResourceSchema.parse(response);

    return {
      publicId: parsed.public_id,
      resourceType: parsed.resource_type,
      deliveryType: parsed.type ?? null,
      format: parsed.format.toLowerCase(),
      bytes: parsed.bytes,
      secureUrl: requireCloudinaryDeliveryUrl(parsed.secure_url),
      originalFilename: parsed.original_filename ?? null,
      width: parsed.width ?? null,
      height: parsed.height ?? null,
      duration: parsed.duration ?? null,
      context: normalizeContext(parsed.context),
    };
  },

  async delete(providerId: string, mediaType: MediaType): Promise<boolean> {
    try {
      getConfiguration();
      const result = await cloudinary.uploader.destroy(providerId, {
        invalidate: true,
        resource_type: mediaTypeToResourceType(mediaType),
        type: "upload",
      });
      return result.result === "ok" || result.result === "not found";
    } catch (error) {
      console.error("Cloudinary delete failed:", error);
      return false;
    }
  },

  getUrl(providerId: string): string {
    return cloudinary.url(providerId, { secure: true, type: "upload" });
  },

  getImageDerivativeUrls(providerId: string) {
    return {
      thumbnailUrl: cloudinary.url(providerId, {
        secure: true,
        resource_type: "image",
        type: "upload",
        width: 400,
        height: 300,
        crop: "fill",
        quality: "auto",
      }),
      blurDataUrl: cloudinary.url(providerId, {
        secure: true,
        resource_type: "image",
        type: "upload",
        effect: "blur:1000",
        width: 20,
        crop: "scale",
        quality: "auto",
      }),
    };
  },
};
