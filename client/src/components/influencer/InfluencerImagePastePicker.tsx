import {
  useRef,
  type ClipboardEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import {
  createClipboardImageFile,
  extractClipboardImageFiles,
} from "../../../../shared/clipboardImages";

export type InfluencerImagePasteError =
  | "no-image"
  | "unsupported-image"
  | "file-too-large"
  | "too-many-files";

export type InfluencerImageFileSource = "picker" | "paste";

type InfluencerImagePastePickerProps = {
  accept: string;
  ariaLabel: string;
  children: ReactNode;
  className?: string;
  currentFileCount?: number;
  disabled?: boolean;
  imagesOnly?: boolean;
  maxFileBytes: number;
  maxFiles: number;
  multiple?: boolean;
  pasteFilePrefix: string;
  onError: (error: InfluencerImagePasteError) => void;
  onFiles: (files: File[], source: InfluencerImageFileSource) => void | Promise<void>;
};

const SUPPORTED_CLIPBOARD_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export function InfluencerImagePastePicker({
  accept,
  ariaLabel,
  children,
  className = "",
  currentFileCount = 0,
  disabled = false,
  imagesOnly = false,
  maxFileBytes,
  maxFiles,
  multiple = false,
  pasteFilePrefix,
  onError,
  onFiles,
}: InfluencerImagePastePickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const remainingSlots = () => Math.max(0, maxFiles - currentFileCount);

  const deliverFiles = async (files: File[], source: InfluencerImageFileSource) => {
    const available = remainingSlots();
    if (available <= 0) {
      onError("too-many-files");
      return;
    }

    const supportedFiles = files.filter(file => {
      if (!imagesOnly || SUPPORTED_CLIPBOARD_IMAGE_TYPES.has(file.type.toLowerCase())) return true;
      onError("unsupported-image");
      return false;
    });
    const withinSize = supportedFiles.filter(file => {
      if (file.size <= maxFileBytes) return true;
      onError("file-too-large");
      return false;
    });
    if (!withinSize.length) return;

    if (withinSize.length > available) onError("too-many-files");
    await onFiles(withinSize.slice(0, available), source);
  };

  const handlePaste = async (event: ClipboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    const clipboardImages = extractClipboardImageFiles(event.clipboardData);
    if (!clipboardImages.length) {
      onError("no-image");
      return;
    }
    event.preventDefault();

    const now = Date.now();
    const normalized = clipboardImages
      .map((file, index) => {
        if (!SUPPORTED_CLIPBOARD_IMAGE_TYPES.has(file.type.toLowerCase())) return null;
        return createClipboardImageFile(file, `${pasteFilePrefix}-${index + 1}`, now + index);
      })
      .filter((file): file is File => Boolean(file));

    if (normalized.length !== clipboardImages.length) onError("unsupported-image");
    await deliverFiles(normalized, "paste");
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (disabled || (event.key !== "Enter" && event.key !== " ")) return;
    event.preventDefault();
    inputRef.current?.click();
  };

  return (
    <div
      aria-disabled={disabled}
      aria-label={ariaLabel}
      className={`${className} outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 ${disabled ? "pointer-events-none opacity-60" : ""}`}
      onClick={() => !disabled && inputRef.current?.click()}
      onKeyDown={handleKeyDown}
      onPaste={event => void handlePaste(event)}
      role="button"
      tabIndex={disabled ? -1 : 0}
    >
      {children}
      <input
        ref={inputRef}
        className="hidden"
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        onClick={event => event.stopPropagation()}
        onChange={event => {
          const files = Array.from(event.currentTarget.files || []);
          event.currentTarget.value = "";
          if (files.length) void deliverFiles(files, "picker");
        }}
      />
    </div>
  );
}
