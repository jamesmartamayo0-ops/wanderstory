import type { MediaType } from "@/app/generated/prisma/enums";
import type {
  CloudinaryProviderProof,
  CloudinaryResourceType,
  MediaUploadAuthorization,
  MediaUploadErrorCode,
} from "@/lib/validation/media-upload.schema";

export type UploadOptions = {
  fileName: string;
  mimeType: string;
  folder?: string;
};

export type UploadResult = {
  url: string;
  providerId: string;
  thumbnailUrl?: string;
  blurDataUrl?: string;
  width?: number;
  height?: number;
  format?: string;
  duration?: number;
};

export type CloudinarySignedUploadParameters = {
  timestamp: number;
  public_id: string;
  asset_folder: "wanderstory";
  use_asset_folder_as_public_id_prefix: false;
  overwrite: false;
  unique_filename: false;
  use_filename: false;
  allowed_formats: string;
  context: string;
  type: "upload";
};

export type MediaUploadAuthorizationBundle = {
  cloudName: string;
  apiKey: string;
  uploadUrl: string;
  resourceType: CloudinaryResourceType;
  providerParams: CloudinarySignedUploadParameters;
  providerSignature: string;
  authorization: MediaUploadAuthorization;
  applicationProof: string;
};

export type AuthoritativeProviderResource = {
  publicId: string;
  resourceType: CloudinaryResourceType;
  deliveryType: string | null;
  format: string;
  bytes: number;
  secureUrl: string;
  originalFilename: string | null;
  width: number | null;
  height: number | null;
  duration: number | null;
  context: Record<string, string>;
};

export type MediaUploadError = {
  code: MediaUploadErrorCode;
  message: string;
  retryAfterSeconds?: number;
};

export type MediaUploadActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: MediaUploadError };

export type MediaUploadFinalizationRequest = {
  authorization: MediaUploadAuthorization;
  applicationProof: string;
  providerProof: CloudinaryProviderProof;
};

export interface StorageProvider {
  /** Retained for the non-interactive destination ingestion CLI only. */
  upload(file: Buffer, options: UploadOptions): Promise<UploadResult>;
  authorizeUpload(
    authorization: MediaUploadAuthorization,
    allowedFormats: string,
  ): MediaUploadAuthorizationBundle;
  verifyResponseSignature(proof: CloudinaryProviderProof): boolean;
  getAuthoritativeResource(
    publicId: string,
    resourceType: CloudinaryResourceType,
  ): Promise<AuthoritativeProviderResource>;
  delete(providerId: string, mediaType: MediaType): Promise<boolean>;
  getUrl(providerId: string): string;
  getImageDerivativeUrls(providerId: string): {
    thumbnailUrl: string;
    blurDataUrl: string;
  };
}
