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

export interface StorageProvider {
  upload(file: Buffer, options: UploadOptions): Promise<UploadResult>;
  delete(providerId: string): Promise<boolean>;
  getUrl(providerId: string): string;
}