"use client";

import { useCallback, useRef, useState } from "react";

interface ImageUploadProps {
  onImageSelect: (file: File) => void;
  onImageClear: () => void;
}

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE_MB = 10;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

function validateFile(file: File): string | null {
  if (!ACCEPTED_TYPES.includes(file.type)) {
    return "仅支持 JPG、PNG、WebP 格式";
  }
  if (file.size > MAX_SIZE_BYTES) {
    return `图片大小不能超过 ${MAX_SIZE_MB}MB`;
  }
  return null;
}

export default function ImageUpload({
  onImageSelect,
  onImageClear,
}: ImageUploadProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    (file: File) => {
      setError(null);
      const err = validateFile(file);
      if (err) {
        setError(err);
        return;
      }
      setPreview((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(file);
      });
      onImageSelect(file);
    },
    [onImageSelect],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const handleClear = useCallback(() => {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
    onImageClear();
  }, [preview, onImageClear]);

  return (
    <div className="w-full">
      {!preview ? (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => inputRef.current?.click()}
          className={`
            relative flex flex-col items-center justify-center
            w-full aspect-[4/3] rounded-2xl cursor-pointer
            transition-colors duration-200
            border border-[var(--color-outline-variant)]/30
            ${
              isDragOver
                ? "bg-[var(--color-surface-container-high)] border-[var(--color-primary)]/40"
                : "bg-[var(--color-surface-container)] hover:border-[var(--color-primary)]/30"
            }
          `}
        >
          {/* Corner brackets */}
          <CornerBrackets active={isDragOver} />

          {/* Camera icon */}
          <div
            className={`
              w-16 h-16 rounded-full flex items-center justify-center mb-4
              transition-colors duration-200
              ${isDragOver ? "bg-[var(--color-primary)]" : "bg-[var(--color-primary-container)]"}
            `}
          >
            <svg
              className="w-7 h-7 text-white"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z"
              />
            </svg>
          </div>

          <p className="text-sm font-semibold text-[var(--color-on-surface)]">
            点击拍照或上传
          </p>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">
            支持 JPG、PNG、WebP，最大 {MAX_SIZE_MB}MB
          </p>
        </div>
      ) : (
        <div className="relative w-full rounded-2xl overflow-hidden bg-[var(--color-surface-container-low)]">
          <img
            src={preview}
            alt="上传预览"
            className="w-full max-h-80 object-contain"
          />
          <button
            type="button"
            onClick={handleClear}
            className="
              absolute top-3 right-3
              w-9 h-9 rounded-full
              bg-[var(--color-on-surface)]/50 text-white
              flex items-center justify-center
              hover:bg-[var(--color-on-surface)]/70
              transition-colors text-sm cursor-pointer
            "
            aria-label="移除图片"
          >
            ✕
          </button>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept=".jpg,.jpeg,.png,.webp"
        onChange={handleInputChange}
        className="hidden"
      />

      {error && (
        <p className="mt-3 text-sm text-[var(--color-error)]">{error}</p>
      )}
    </div>
  );
}

/** Corner bracket decoration matching the prototype */
function CornerBrackets({ active }: { active: boolean }) {
  const color = active ? "var(--color-primary)" : "var(--color-primary-container)";
  const size = 28;
  const stroke = 3;

  const cornerStyle = (
    position: React.CSSProperties,
    rotate: number,
  ): React.CSSProperties => ({
    position: "absolute",
    ...position,
    width: size,
    height: size,
    transform: `rotate(${rotate}deg)`,
  });

  return (
    <>
      {[
        { pos: { top: 20, left: 20 }, rot: 0, id: "tl" },
        { pos: { top: 20, right: 20 }, rot: 90, id: "tr" },
        { pos: { bottom: 20, right: 20 }, rot: 180, id: "br" },
        { pos: { bottom: 20, left: 20 }, rot: 270, id: "bl" },
      ].map(({ pos, rot, id }) => (
        <svg
          key={id}
          style={cornerStyle(pos, rot)}
          viewBox="0 0 28 28"
          fill="none"
        >
          <path
            d={`M${stroke / 2} ${size} V${stroke / 2} H${size}`}
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ))}
    </>
  );
}
