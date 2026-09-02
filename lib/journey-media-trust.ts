const TRUSTED_MEDIA_PROVIDER = "CLOUDINARY";
const TRUSTED_CLOUDINARY_HOSTNAME = "res.cloudinary.com";
const TRUSTED_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export interface JourneyMediaTrustFields {
  provider: string;
  type: "IMAGE" | "VIDEO" | "DOCUMENT";
  url: string;
  mimeType: string | null;
}

export function isTrustedJourneyImageMedia(
  media: JourneyMediaTrustFields | null | undefined,
): boolean {
  if (
    !media ||
    media.provider !== TRUSTED_MEDIA_PROVIDER ||
    media.type !== "IMAGE" ||
    !media.mimeType ||
    !TRUSTED_IMAGE_MIME_TYPES.has(media.mimeType)
  ) {
    return false;
  }

  try {
    const mediaUrl = new URL(media.url);

    return (
      mediaUrl.protocol === "https:" &&
      mediaUrl.hostname === TRUSTED_CLOUDINARY_HOSTNAME &&
      mediaUrl.port === "" &&
      mediaUrl.username === "" &&
      mediaUrl.password === ""
    );
  } catch {
    return false;
  }
}
