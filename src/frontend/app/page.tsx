"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import DiagnosisResultView from "../components/DiagnosisResult";
import LoadingSkeleton from "../components/LoadingSkeleton";
import { type DiagnosisResult, ApiError, diagnose } from "../lib/api";

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE_MB = 10;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;
const MAX_IMAGES = 5;

interface ImageItem {
  file: File;
  preview: string;
}

function validateFile(file: File): string | null {
  if (!ACCEPTED_TYPES.includes(file.type)) {
    return "仅支持 JPG、PNG、WebP 格式";
  }
  if (file.size > MAX_SIZE_BYTES) {
    return `图片大小不能超过 ${MAX_SIZE_MB}MB`;
  }
  return null;
}

export default function Home() {
  const [items, setItems] = useState<ImageItem[]>([]);
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DiagnosisResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const prevUrlsRef = useRef<string[]>([]);
  useEffect(() => {
    const currentUrls = items.map((item) => item.preview);
    for (const url of prevUrlsRef.current) {
      if (!currentUrls.includes(url)) URL.revokeObjectURL(url);
    }
    prevUrlsRef.current = currentUrls;
    return () => { for (const url of currentUrls) URL.revokeObjectURL(url); };
  }, [items]);

  const addFiles = useCallback((newFiles: File[]) => {
    setError(null);
    for (const file of newFiles) {
      const err = validateFile(file);
      if (err) { setError(err); return; }
    }
    setItems((prev) => {
      const available = MAX_IMAGES - prev.length;
      if (available <= 0) { setError(`最多上传 ${MAX_IMAGES} 张图片`); return prev; }
      const toAdd = newFiles.slice(0, available);
      if (toAdd.length < newFiles.length) setError(`最多上传 ${MAX_IMAGES} 张图片，已忽略多余图片`);
      return [...prev, ...toAdd.map((f) => ({ file: f, preview: URL.createObjectURL(f) }))];
    });
  }, []);

  const removeFile = useCallback((index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  }, []);

  const images = items.map((item) => item.file);

  const handleSubmit = useCallback(async () => {
    if (images.length === 0) return;
    setError(null);
    setResult(null);
    setLoading(true);
    try {
      const data = await diagnose(images, description);
      setResult(data);
    } catch (e) {
      if (e instanceof ApiError) setError(e.message);
      else if (e instanceof TypeError) setError("无法连接到服务器，请确认后端已启动");
      else setError(e instanceof Error ? e.message : "诊断失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  }, [images, description]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const dropped = Array.from(e.dataTransfer.files);
    if (dropped.length > 0) addFiles(dropped);
  }, [addFiles]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? []);
    if (selected.length > 0) addFiles(selected);
    if (inputRef.current) inputRef.current.value = "";
  }, [addFiles]);

  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (el) { el.style.height = "auto"; el.style.height = `${el.scrollHeight}px`; }
  }, []);

  const hasImages = items.length > 0;
  const canSubmit = hasImages && !loading;

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-2xl">
        {/* Title — centered like ChatGPT */}
        {!result && !loading && (
          <h1 className="text-3xl font-semibold text-center mb-10 text-[var(--color-text)]">
            拍一拍，AI 帮你诊断
          </h1>
        )}

        {/* Error */}
        {error && (
          <div role="alert" className="mb-4 px-4 py-3 rounded-xl bg-[var(--color-error-bg)] border border-[var(--color-error)]/20 flex items-center gap-2.5">
            <svg className="w-4 h-4 text-[var(--color-error)] flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
            </svg>
            <p className="text-sm text-[var(--color-error)] flex-1">{error}</p>
            <button
              type="button"
              onClick={() => setError(null)}
              className="flex-shrink-0 text-[var(--color-error)] hover:text-[var(--color-text)] transition-colors cursor-pointer text-xs"
              aria-label="关闭错误提示"
              data-testid="error-close-btn"
            >
              ✕
            </button>
          </div>
        )}

        {/* === Input box === */}
        <div
          className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] overflow-hidden"
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
        >
          {/* Image thumbnails */}
          {hasImages && (
            <div className="flex gap-2 px-4 pt-4 overflow-x-auto" data-testid="image-previews">
              {items.map((item, idx) => (
                <div
                  key={`${item.file.name}-${item.preview}`}
                  className="relative flex-shrink-0 w-16 h-16 rounded-xl overflow-hidden border border-[var(--color-border-light)] bg-[var(--color-bg)]"
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
                      absolute -top-1 -right-1
                      w-5 h-5 rounded-full
                      bg-[var(--color-text)] text-[var(--color-bg)]
                      flex items-center justify-center
                      hover:bg-white
                      transition-colors cursor-pointer
                      text-[10px] leading-none font-bold
                    "
                    aria-label={`移除第${idx + 1}张图片`}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Input row */}
          <div className="flex items-end gap-3 px-4 py-3">
            {/* + button */}
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={items.length >= MAX_IMAGES}
              className="
                flex-shrink-0 w-9 h-9 rounded-full
                flex items-center justify-center
                border border-[var(--color-border)]
                hover:bg-[var(--color-bg-hover)]
                disabled:opacity-30 disabled:cursor-not-allowed
                transition-colors cursor-pointer
              "
              aria-label="添加图片"
            >
              <svg className="w-5 h-5 text-[var(--color-text-secondary)]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </button>

            {/* Textarea */}
            <textarea
              ref={textareaRef}
              value={description}
              onChange={(e) => { setDescription(e.target.value); autoResize(); }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && canSubmit) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              placeholder={hasImages ? "描述症状（可选）…" : "上传病害图片，描述症状…"}
              rows={1}
              className="
                flex-1 min-w-0 max-h-32 py-2 text-sm leading-relaxed
                bg-transparent text-[var(--color-text)]
                placeholder:text-[var(--color-text-placeholder)]
                focus:outline-none resize-none
              "
            />

            {/* Send button */}
            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className={`
                flex-shrink-0 w-9 h-9 rounded-full
                flex items-center justify-center
                transition-all duration-150 cursor-pointer
                disabled:cursor-not-allowed
                ${canSubmit
                  ? "bg-white text-[var(--color-bg)] hover:bg-[var(--color-text-secondary)]"
                  : "bg-[var(--color-bg-hover)] text-[var(--color-text-muted)]"
                }
              `}
              aria-label="开始诊断"
            >
              {loading ? (
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5 12 3m0 0 7.5 7.5M12 3v18" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Capacity hint */}
        {hasImages && (
          <p className="mt-2 text-center text-xs text-[var(--color-text-muted)]">
            {items.length}/{MAX_IMAGES} 张 · JPG/PNG/WebP · 单张≤{MAX_SIZE_MB}MB
          </p>
        )}

        <input
          ref={inputRef}
          type="file"
          accept=".jpg,.jpeg,.png,.webp"
          multiple
          onChange={handleInputChange}
          className="hidden"
        />

        {/* Loading skeleton */}
        {loading && !result && (
          <div className="mt-8">
            <LoadingSkeleton />
          </div>
        )}

        {/* Diagnosis result */}
        {result && (
          <div className="mt-8">
            <DiagnosisResultView result={result} />
          </div>
        )}
      </div>
    </main>
  );
}
