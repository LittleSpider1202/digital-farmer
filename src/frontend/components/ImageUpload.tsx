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

      for (const file of newFiles) {
        const err = validateFile(file);
        if (err) {
          setError(err);
          return;
        }
      }

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

  const canAddMore = items.length < MAX_IMAGES;

  // Build fixed 5-slot grid: filled slots + empty slots
  const slots = Array.from({ length: MAX_IMAGES }, (_, i) => items[i] ?? null);

  return (
    <div
      className="w-full"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      {/* Fixed 5-slot grid — always the same size */}
      <div className="grid grid-cols-3 gap-2.5" data-testid="image-previews">
        {/* First slot is larger (spans 2 cols + 2 rows) = main image */}
        <div
          className="col-span-2 row-span-2 aspect-square rounded-xl overflow-hidden"
        >
          {slots[0] ? (
            <FilledSlot item={slots[0]} index={0} onRemove={removeFile} />
          ) : (
            <EmptySlot
              isMain
              isDragOver={isDragOver}
              onClick={() => inputRef.current?.click()}
            />
          )}
        </div>

        {/* Remaining 4 smaller slots */}
        {slots.slice(1).map((slot, i) => {
          const index = i + 1;
          return (
            <div key={index} className="aspect-square rounded-xl overflow-hidden">
              {slot ? (
                <FilledSlot item={slot} index={index} onRemove={removeFile} />
              ) : (
                <EmptySlot
                  isMain={false}
                  isDragOver={isDragOver}
                  onClick={canAddMore ? () => inputRef.current?.click() : undefined}
                  disabled={index > items.length}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Format hint below grid */}
      <p className="mt-2 text-xs text-[var(--color-text-muted)] text-center">
        支持 JPG、PNG、WebP，单张最大 {MAX_SIZE_MB}MB
      </p>

      <input
        ref={inputRef}
        type="file"
        accept=".jpg,.jpeg,.png,.webp"
        multiple
        onChange={handleInputChange}
        className="hidden"
      />

      {error && (
        <p className="mt-2 text-sm text-[var(--color-error)]">{error}</p>
      )}
    </div>
  );
}

/** Slot with an uploaded image */
function FilledSlot({
  item,
  index,
  onRemove,
}: {
  item: ImageItem;
  index: number;
  onRemove: (i: number) => void;
}) {
  return (
    <div className="relative w-full h-full group">
      <img
        src={item.preview}
        alt={`预览 ${index + 1}`}
        className="w-full h-full object-cover"
      />
      {index === 0 && (
        <span className="absolute bottom-1.5 left-1.5 px-2 py-0.5 rounded text-[10px] font-medium text-white bg-black/40 backdrop-blur-sm">
          主图
        </span>
      )}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onRemove(index); }}
        className="
          absolute top-1.5 right-1.5
          w-8 h-8 rounded-full
          bg-black/50 text-white
          flex items-center justify-center
          hover:bg-black/70
          transition-colors text-sm cursor-pointer
          backdrop-blur-sm
        "
        aria-label={`移除第${index + 1}张图片`}
      >
        ✕
      </button>
    </div>
  );
}

/** Empty upload slot */
function EmptySlot({
  isMain,
  isDragOver,
  onClick,
  disabled,
}: {
  isMain: boolean;
  isDragOver: boolean;
  onClick?: () => void;
  disabled?: boolean;
}) {
  const isClickable = onClick && !disabled;

  return (
    <div
      onClick={isClickable ? onClick : undefined}
      className={`
        w-full h-full flex flex-col items-center justify-center
        border-2 border-dashed rounded-xl
        transition-all duration-200
        ${isClickable ? "cursor-pointer" : "cursor-default"}
        ${disabled
          ? "border-[var(--color-outline-variant)]/20 bg-[var(--color-surface-container)]/50 opacity-40"
          : isDragOver
            ? "border-[var(--color-primary)] bg-[var(--color-primary)]/5"
            : "border-[var(--color-outline-variant)]/40 bg-[var(--color-surface-container)] hover:border-[var(--color-primary)]/40"
        }
      `}
    >
      {isMain ? (
        <>
          <svg className={`${isDragOver ? "text-[var(--color-primary)]" : "text-[var(--color-text-muted)]"} w-10 h-10 mb-2`} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Z" />
          </svg>
          <p className="text-sm font-medium text-[var(--color-on-surface)]">点击拍照或上传</p>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">最多 {MAX_IMAGES} 张</p>
        </>
      ) : (
        <svg className={`w-6 h-6 ${disabled ? "text-[var(--color-outline-variant)]/40" : "text-[var(--color-text-muted)]"}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
      )}
    </div>
  );
}
