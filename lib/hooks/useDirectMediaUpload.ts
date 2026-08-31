"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  DirectUploadError,
  uploadDirectlyToCloudinary,
} from "@/lib/cloudinary-upload.client";
import {
  getClientFileValidationError,
  type CloudinaryProviderProof,
  type MediaUploadErrorCode,
  type MediaUploadPurpose,
} from "@/lib/validation/media-upload.schema";
import type {
  MediaUploadActionResult,
  MediaUploadAuthorizationBundle,
  MediaUploadFinalizationRequest,
} from "@/services/storage/storage.types";

export type DirectMediaUploadStatus =
  | "idle"
  | "selected"
  | "authorizing"
  | "uploading"
  | "finalizing"
  | "success"
  | "error";

type SignAction = (
  declaration: { fileName: string; mimeType: string; size: number },
) => Promise<MediaUploadActionResult<MediaUploadAuthorizationBundle>>;

type FinalizeAction = (
  request: MediaUploadFinalizationRequest,
) => Promise<MediaUploadActionResult<{ mediaId: string; created: boolean }>>;

type UploadErrorState = {
  code: MediaUploadErrorCode;
  message: string;
  retryAfterSeconds?: number;
  ambiguous?: boolean;
};

export function useDirectMediaUpload({
  purpose,
  signAction,
  finalizeAction,
  onSuccess,
}: {
  purpose: MediaUploadPurpose;
  signAction: SignAction;
  finalizeAction: FinalizeAction;
  onSuccess?: (mediaId: string) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<DirectMediaUploadStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<UploadErrorState | null>(null);
  const inFlight = useRef(false);
  const abortController = useRef<AbortController | null>(null);
  const bundle = useRef<MediaUploadAuthorizationBundle | null>(null);
  const providerProof = useRef<CloudinaryProviderProof | null>(null);

  const clearAfterSuccess = useCallback((mediaId: string) => {
    setStatus("success");
    setProgress(100);
    setError(null);
    setFile(null);
    bundle.current = null;
    providerProof.current = null;
    onSuccess?.(mediaId);
  }, [onSuccess]);

  const finalize = useCallback(async (
    authorizationBundle: MediaUploadAuthorizationBundle,
    proof: CloudinaryProviderProof,
  ) => {
    setStatus("finalizing");
    const request: MediaUploadFinalizationRequest = {
      authorization: authorizationBundle.authorization,
      applicationProof: authorizationBundle.applicationProof,
      providerProof: proof,
    };
    const result = await finalizeAction(request);
    if (!result.success) {
      setStatus("error");
      setError(result.error);
      return false;
    }
    clearAfterSuccess(result.data.mediaId);
    return true;
  }, [clearAfterSuccess, finalizeAction]);

  const selectFile = useCallback((selected: File | null) => {
    if (inFlight.current) return;
    setError(null);
    setProgress(0);
    bundle.current = null;
    providerProof.current = null;

    if (!selected) {
      setFile(null);
      setStatus("idle");
      return;
    }
    const validationError = getClientFileValidationError(selected, purpose);
    if (validationError) {
      setFile(null);
      setStatus("error");
      setError(validationError);
      return;
    }
    setFile(selected);
    setStatus("selected");
  }, [purpose]);

  const start = useCallback(async () => {
    if (inFlight.current) return;
    if (bundle.current && providerProof.current) {
      inFlight.current = true;
      setError(null);
      try {
        await finalize(bundle.current, providerProof.current);
      } catch (caught) {
        console.error("Media finalization request failed:", caught);
        setStatus("error");
        setError({
          code: "NETWORK_ERROR",
          message: "Finalization could not be reached. Retry finalization without uploading again",
        });
      } finally {
        inFlight.current = false;
      }
      return;
    }
    if (!file) {
      setStatus("error");
      setError({ code: "INVALID_TYPE", message: "Select a file to upload" });
      return;
    }

    inFlight.current = true;
    setError(null);
    setProgress(0);
    const controller = new AbortController();
    abortController.current = controller;

    try {
      setStatus("authorizing");
      const authorizationResult = await signAction({
        fileName: file.name,
        mimeType: file.type,
        size: file.size,
      });
      if (!authorizationResult.success) {
        setStatus("error");
        setError(authorizationResult.error);
        return;
      }

      bundle.current = authorizationResult.data;
      setStatus("uploading");
      const proof = await uploadDirectlyToCloudinary(file, authorizationResult.data, {
        signal: controller.signal,
        onProgress: setProgress,
      });
      providerProof.current = proof;
      await finalize(authorizationResult.data, proof);
    } catch (caught) {
      setStatus("error");
      if (providerProof.current) {
        console.error("Media finalization request failed:", caught);
        setError({
          code: "NETWORK_ERROR",
          message: "Finalization could not be reached. Retry finalization without uploading again",
        });
      } else if (caught instanceof DirectUploadError) {
        setError({
          code: caught.code,
          message: caught.message,
          ambiguous: caught.ambiguous,
        });
      } else {
        console.error("Direct media upload failed:", caught);
        setError({ code: "UNEXPECTED", message: "The upload could not be completed" });
      }
    } finally {
      inFlight.current = false;
      abortController.current = null;
    }
  }, [file, finalize, signAction]);

  const cancel = useCallback(() => {
    abortController.current?.abort();
  }, []);

  const reset = useCallback(() => {
    abortController.current?.abort();
    setFile(null);
    setStatus("idle");
    setProgress(0);
    setError(null);
    bundle.current = null;
    providerProof.current = null;
  }, []);

  useEffect(() => () => {
    abortController.current?.abort();
  }, []);

  const active = status === "authorizing" || status === "uploading" || status === "finalizing";
  return {
    file,
    status,
    progress,
    error,
    active,
    canRetryFinalization: status === "error" && bundle.current !== null && providerProof.current !== null,
    selectFile,
    start,
    cancel,
    reset,
  };
}
