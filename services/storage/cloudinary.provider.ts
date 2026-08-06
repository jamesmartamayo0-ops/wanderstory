import { randomUUID } from "node:crypto";
import { v2 as cloudinary } from "cloudinary";
import type { StorageProvider, UploadOptions, UploadResult } from "./storage.types";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

function isConfigured(): boolean {
  return !!(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);
}

export const cloudinaryProvider: StorageProvider = {
  async upload(file: Buffer, options: UploadOptions): Promise<UploadResult> {
    if (!isConfigured()) {
      throw new Error("Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.");
    }

    const isVideo = options.mimeType.startsWith("video/");
    const isImage = options.mimeType.startsWith("image/");
    const resourceType = isVideo ? "video" : "image";

    const base64 = file.toString("base64");
    const dataUri = `data:${options.mimeType};base64,${base64}`;

    const result = await cloudinary.uploader.upload(dataUri, {
      folder: options.folder ?? "wanderstory",
      public_id: randomUUID(),
      resource_type: resourceType,
    });

    const uploadResult: UploadResult = {
      url: result.secure_url,
      providerId: result.public_id,
      width: result.width,
      height: result.height,
      format: result.format,
    };

    if (isImage) {
      uploadResult.thumbnailUrl = cloudinary.url(result.public_id, {
        width: 400,
        height: 300,
        crop: "fill",
        quality: "auto",
      });

      try {
        const blurResult = await cloudinary.api.resource(result.public_id, {
          transformation: [
            { effect: "blur:1000", width: 20, crop: "scale" },
          ],
        });
        uploadResult.blurDataUrl = blurResult.secure_url;
      } catch {
        // blur fallback is optional
      }
    }

    if (isVideo && result.duration) {
      uploadResult.duration = Math.round(result.duration);
    }

    return uploadResult;
  },

  async delete(providerId: string): Promise<boolean> {
    if (!isConfigured()) {
      return false;
    }

    try {
      const result = await cloudinary.uploader.destroy(providerId, { invalidate: true });
      return result.result === "ok";
    } catch (error) {
      console.error("Cloudinary delete failed:", error);
      return false;
    }
  },

  getUrl(providerId: string): string {
    return cloudinary.url(providerId);
  },
};