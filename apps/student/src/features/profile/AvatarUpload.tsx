import { errorMessage } from "@cbpupsis/shared/api";
import { useRef, useState } from "react";

import { AVATAR_PLACEHOLDER } from "./useAvatar";

const MAX_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB
const ACCEPTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

/** What the uploader takes: said only when a chosen file breaks the rule, never beforehand. */
const AVATAR_REQUIREMENTS = "JPEG, PNG, or WebP, up to 2 MB.";

function CameraIcon() {
  return (
    <svg
      className="size-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}

/**
 * Center-crops a File to a square JPEG using the Canvas API. Re-encoding also turns a WebP into
 * a JPEG, which is what the API accepts.
 */
function cropToSquare(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const side = Math.min(img.naturalWidth, img.naturalHeight);
      const canvas = document.createElement("canvas");
      canvas.width = side;
      canvas.height = side;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(objectUrl);
        reject(new Error("Canvas unavailable"));
        return;
      }
      ctx.drawImage(
        img,
        (img.naturalWidth - side) / 2,
        (img.naturalHeight - side) / 2,
        side,
        side,
        0,
        0,
        side,
        side,
      );
      URL.revokeObjectURL(objectUrl);
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Image could not be encoded"))),
        "image/jpeg",
        0.85,
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Image failed to load"));
    };
    img.src = objectUrl;
  });
}

interface AvatarUploadProps {
  /** Current saved avatar URL; null falls back to the placeholder. */
  avatarUrl: string | null;
  /** Uploads the cropped picture; rejects with the API's error, which is shown here. */
  onConfirm: (image: Blob) => Promise<void>;
}

export function AvatarUpload({ avatarUrl, onConfirm }: AvatarUploadProps) {
  const fileRef = useRef<HTMLInputElement>(null);

  // Object URL for the live preview (shown before the student confirms).
  const [previewObjectUrl, setPreviewObjectUrl] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isCropping, setIsCropping] = useState(false);

  const errorId = "avatar-upload-error";
  const displaySrc = previewObjectUrl ?? avatarUrl ?? AVATAR_PLACEHOLDER;

  function openPicker() {
    setValidationError(null);
    fileRef.current?.click();
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Reset so the same file can be re-selected after a cancel.
    event.target.value = "";

    if (!file) return;

    if (!ACCEPTED_TYPES.has(file.type)) {
      setValidationError(AVATAR_REQUIREMENTS);
      return;
    }
    if (file.size > MAX_SIZE_BYTES) {
      setValidationError(AVATAR_REQUIREMENTS);
      return;
    }

    // Revoke any previous pending preview before creating a new one.
    if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl);

    setPreviewObjectUrl(URL.createObjectURL(file));
    setValidationError(null);

    // Stash the file reference so we can crop it on confirm.
    pendingFileRef.current = file;
  }

  // Keep the pending File in a ref so we don't need to store it in state.
  const pendingFileRef = useRef<File | null>(null);

  async function handleConfirm() {
    const file = pendingFileRef.current;
    if (!file) return;
    setIsCropping(true);
    let image: Blob;
    try {
      image = await cropToSquare(file);
    } catch {
      setValidationError("Failed to process the image. Please try another file.");
      setIsCropping(false);
      return;
    }
    try {
      await onConfirm(image);
      if (previewObjectUrl) {
        URL.revokeObjectURL(previewObjectUrl);
        setPreviewObjectUrl(null);
      }
      pendingFileRef.current = null;
    } catch (error) {
      setValidationError(errorMessage(error));
    } finally {
      setIsCropping(false);
    }
  }

  function handleCancel() {
    if (previewObjectUrl) {
      URL.revokeObjectURL(previewObjectUrl);
      setPreviewObjectUrl(null);
    }
    pendingFileRef.current = null;
    setValidationError(null);
  }

  const isPreviewing = previewObjectUrl !== null;

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Square avatar container */}
      <div className="relative aspect-square w-44 overflow-hidden rounded-2xl border-2 border-red-950/30 md:w-52">
        <img src={displaySrc} alt="Your profile avatar" className="h-full w-full object-cover" />

        {/* Confirm / Cancel overlay when a preview is pending */}
        {isPreviewing && (
          <div
            className="absolute inset-x-0 bottom-0 flex gap-2 bg-black/60 p-2"
            role="group"
            aria-label="Confirm or cancel photo upload"
          >
            <button
              type="button"
              className="bg-brand-maroon hover:bg-brand-maroon-dark focus-visible:outline-brand-gold flex-1 rounded-lg py-1.5 text-xs font-semibold text-white transition-colors disabled:opacity-60"
              onClick={() => void handleConfirm()}
              disabled={isCropping}
            >
              {isCropping ? "Saving…" : "Use this photo"}
            </button>
            <button
              type="button"
              className="focus-visible:outline-brand-gold rounded-lg border border-white/40 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-white/10"
              onClick={handleCancel}
              disabled={isCropping}
            >
              Cancel
            </button>
          </div>
        )}

        {/* Camera badge — always visible so keyboard users can reach it */}
        <button
          type="button"
          aria-label="Upload profile photo"
          aria-describedby={validationError ? errorId : undefined}
          className="bg-brand-maroon hover:bg-brand-maroon-dark focus-visible:outline-brand-gold absolute right-2 bottom-2 grid size-9 place-items-center rounded-full text-white shadow-md transition-colors focus-visible:outline-3 focus-visible:outline-offset-2"
          style={{ display: isPreviewing ? "none" : undefined }}
          onClick={openPicker}
        >
          <CameraIcon />
        </button>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        aria-hidden="true"
        tabIndex={-1}
        onChange={handleFileChange}
      />

      {/* Inline validation error — announced immediately as an alert */}
      {validationError && (
        <p id={errorId} role="alert" className="max-w-[13rem] text-center text-xs text-red-700">
          {validationError}
        </p>
      )}
    </div>
  );
}
