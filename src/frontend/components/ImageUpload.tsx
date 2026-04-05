"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface ImageUploadProps {
  onImagesChange: (files: File[]) => void;
}

interface ImageItem {
  file: File;
  preview: string;
}

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE_MB = 10;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;
const MAX_IMAGES = 5;

function validateFile(file: File): string | null {
  if (!ACCEPTED_TYPES.includes(file.type)) {
    return "仅支持 JPG、PNG、WebP 格式";
  }
  if (file.size > MAX_SIZE_BYTES) {
    return `图片大小不能超过 ${MAX_SIZE_MB}MB`;
  }
  return null;
}

export default function ImageUpload({ onImagesChange }: ImageUploadProps) {
  const [items, setItems] = useState<ImageItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Cleanup Object URLs on unmount or items change
  const prevUrlsRef = useRef<string[]>([]);
  useEffect(() => {
    const currentUrls = items.map((item) => item.preview);
    // Revoke any URLs that are no longer in the current set
    for (const url of prevUrlsRef.current) {
      if (!currentUrls.includes(url)) {
        URL.revokeObjectURL(url);
      }
    }
    prevUrlsRef.current = currentUrls;
    return () => {
      for (const url of currentUrls) {
        URL.revokeObjectURL(url);
      }
    };
  }, [items]);

  const addFiles = useCallback(
    (newFiles: File[]) => {
      setError(null);

      // Validate all files first
      for (const file of newFiles) {
        const err = validateFile(file);
        if (err) {
          setError(err);
          return;
        }
      }

      // Use functional updater to avoid stale closure
      setItems((prev) => {
        const available = MAX_IMAGES - prev.length;
        if (available <= 0) {
          setError(`最多上传 ${MAX_IMAGES} 张图片`);
          return prev;
        }

        const toAdd = newFiles.slice(0, available);
        if (toAdd.length < newFiles.length) {
          setError(`最多上传 ${MAX_IMAGES} 张图片，已忽略多余图片`);
        }

        const newItems = toAdd.map((file) => ({
          file,
          preview: URL.createObjectURL(file),
        }));
        const updated = [...prev, ...newItems];
        // Schedule callback outside setState
        queueMicrotask(() =>
          onImagesChange(updated.map((item) => item.file)),
        );
        return updated;
      });
    },
    [onImagesChange],
  );

  const removeFile = useCallback(
    (index: number) => {
      setItems((prev) => {
        const updated = prev.filter((_, i) => i !== index);
        queueMicrotask(() =>
          onImagesChange(updated.map((item) => item.file)),
        );
        return updated;
      });
      setError(null);
      if (inputRef.current) inputRef.current.value = "";
    },
    [onImagesChange],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const dropped = Array.from(e.dataTransfer.files);
      if (dropped.length > 0) addFiles(dropped);
    },
    [addFiles],
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
      const selected = Array.from(e.target.files ?? []);
      if (selected.length > 0) addFiles(selected);
      if (inputRef.current) inputRef.current.value = "";
    },
    [addFiles],
  );

  const hasImages = items.length > 0;
  const canAddMore = items.length < MAX_IMAGES;

  return (
    <div className="w-full">
      {/* Upload zone — shown when no images or can still add more */}
      {(!hasImages || canAddMore) && (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => inputRef.current?.click()}
          className={`
            relative flex flex-col items-center justify-center
            w-full rounded-2xl cursor-pointer
            transition-colors duration-200
            border border-[var(--color-outline-variant)]/30
            ${hasImages ? "py-6" : "aspect-[4/3]"}
            ${
              isDragOver
                ? "bg-[var(--color-surface-container-high)] border-[var(--color-primary)]/40"
                : "bg-[var(--color-surface-container)] hover:border-[var(--color-primary)]/30"
            }
          `}
        >
          {!hasImages && <CornerBrackets active={isDragOver} />}

          {/* Plus icon */}
          <div
            className={`
              ${hasImages ? "w-10 h-10 mb-2" : "w-16 h-16 mb-4"} rounded-full flex items-center justify-center
              transition-colors duration-200
              ${isDragOver ? "bg-[var(--color-primary)]" : "bg-[var(--color-primary-container)]"}
            `}
          >
            <svg
              className={`${hasImages ? "w-5 h-5" : "w-7 h-7"} text-white`}
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 4.5v15m7.5-7.5h-15"
              />
            </svg>
          </div>

          <p className="text-sm font-semibold text-[var(--color-on-surface)]">
            {hasImages ? "继续添加" : "点击拍照或上传"}
          </p>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">
            {hasImages
              ? `还可添加 ${MAX_IMAGES - items.length} 张`
              : `支持 JPG、PNG、WebP，最大 ${MAX_SIZE_MB}MB，最多 ${MAX_IMAGES} 张`}
          </p>
        </div>
      )}

      {/* Image previews grid */}
      {hasImages && (
        <div className="grid grid-cols-3 gap-3 mt-3" data-testid="image-previews">
          {items.map((item, idx) => (
            <div
              key={`${item.file.name}-${item.preview}`}
              className="relative rounded-xl overflow-hidden bg-[var(--color-surface-container-low)] aspect-square"
            >
              <img
                src={item.preview}
                alt={`预览 ${idx + 1}`}
                className="w-full h-full object-cover"
              />
              <button
                type="button"
                onClick={() => removeFile(idx)}
                className="
                  absolute top-1.5 right-1.5
                  w-6 h-6 rounded-full
                  bg-[var(--color-on-surface)]/50 text-white
                  flex items-center justify-center
                  hover:bg-[var(--color-on-surface)]/70
                  transition-colors text-xs cursor-pointer
                "
                aria-label={`移除第${idx + 1}张图片`}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept=".jpg,.jpeg,.png,.webp"
        multiple
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
