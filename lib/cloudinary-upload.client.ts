import { cloudinaryProviderProofSchema } from "@/lib/validation/media-upload.schema";
import type { MediaUploadErrorCode } from "@/lib/validation/media-upload.schema";
import type {
  CloudinaryProviderProof,
} from "@/lib/validation/media-upload.schema";
import type { MediaUploadAuthorizationBundle } from "@/services/storage/storage.types";

export class DirectUploadError extends Error {
  readonly code: MediaUploadErrorCode;
  readonly ambiguous: boolean;

  constructor(code: MediaUploadErrorCode, message: string, ambiguous = false) {
    super(message);
    this.name = "DirectUploadError";
    this.code = code;
    this.ambiguous = ambiguous;
  }
}

function providerErrorMessage(status: number): string {
  if (status === 413) return "Cloudinary rejected the file because it is too large";
  if (status >= 400 && status < 500) return "Cloudinary rejected the upload";
  return "Cloudinary could not complete the upload";
}

export function parseCloudinaryUploadProof(responseText: string): CloudinaryProviderProof {
  let response: unknown;
  try {
    response = JSON.parse(responseText);
  } catch {
    throw new DirectUploadError("PROVIDER_REJECTED", "Cloudinary returned an invalid response");
  }

  if (!response || typeof response !== "object" || Array.isArray(response)) {
    throw new DirectUploadError("PROVIDER_REJECTED", "Cloudinary returned an invalid response");
  }
  const provider = response as Record<string, unknown>;
  const parsed = cloudinaryProviderProofSchema.safeParse({
    public_id: provider.public_id,
    version: provider.version,
    signature: provider.signature,
  });
  if (!parsed.success) {
    throw new DirectUploadError("PROVIDER_REJECTED", "Cloudinary did not return a verifiable upload proof");
  }
  return parsed.data;
}

export function uploadDirectlyToCloudinary(
  file: File,
  bundle: MediaUploadAuthorizationBundle,
  options: {
    signal: AbortSignal;
    onProgress: (percentage: number) => void;
  },
): Promise<CloudinaryProviderProof> {
  return new Promise((resolve, reject) => {
    let endpoint: URL;
    try {
      endpoint = new URL(bundle.uploadUrl);
    } catch {
      reject(new DirectUploadError("UPLOAD_AUTHORIZATION_FAILED", "The upload endpoint is invalid"));
      return;
    }
    if (endpoint.protocol !== "https:" || endpoint.hostname !== "api.cloudinary.com") {
      reject(new DirectUploadError("UPLOAD_AUTHORIZATION_FAILED", "The upload endpoint is not trusted"));
      return;
    }

    const formData = new FormData();
    formData.append("file", file, file.name);
    for (const [key, value] of Object.entries(bundle.providerParams)) {
      formData.append(key, String(value));
    }
    formData.append("api_key", bundle.apiKey);
    formData.append("signature", bundle.providerSignature);

    const request = new XMLHttpRequest();
    let settled = false;

    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      options.signal.removeEventListener("abort", abortRequest);
      callback();
    };
    const abortRequest = () => request.abort();

    request.open("POST", endpoint.toString());
    request.upload.onprogress = (event) => {
      if (!event.lengthComputable || event.total <= 0) return;
      options.onProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)));
    };
    request.onload = () => {
      if (request.status < 200 || request.status >= 300) {
        finish(() => reject(
          new DirectUploadError("PROVIDER_REJECTED", providerErrorMessage(request.status)),
        ));
        return;
      }
      try {
        const proof = parseCloudinaryUploadProof(request.responseText);
        finish(() => resolve(proof));
      } catch (error) {
        finish(() => reject(error));
      }
    };
    request.onerror = () => finish(() => reject(
      new DirectUploadError(
        "NETWORK_ERROR",
        "The upload result is unknown. Check the Media Library before explicitly retrying",
        true,
      ),
    ));
    request.ontimeout = () => finish(() => reject(
      new DirectUploadError(
        "NETWORK_ERROR",
        "The upload timed out and its result is unknown. Check the Media Library before explicitly retrying",
        true,
      ),
    ));
    request.onabort = () => finish(() => reject(
      new DirectUploadError("NETWORK_ERROR", "Upload cancelled"),
    ));

    options.signal.addEventListener("abort", abortRequest, { once: true });
    if (options.signal.aborted) {
      abortRequest();
      return;
    }
    request.send(formData);
  });
}
