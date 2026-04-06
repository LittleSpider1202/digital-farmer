"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import DiagnosisResultView from "../components/DiagnosisResult";
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

  const images = useMemo(() => items.map((item) => item.file), [items]);

  const handleSubmit = useCallback(async () => {
    if (items.length === 0 || loading) return;
    const files = items.map((item) => item.file);
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await diagnose(files, description);
      setResult(data);
    } catch (e) {
      setResult(null);
      if (e instanceof ApiError) setError(e.message);
      else if (e instanceof TypeError) setError("无法连接到服务器，请确认后端已启动");
      else setError(e instanceof Error ? e.message : "诊断失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  }, [items, description, loading]);

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
    <main className="min-h-screen flex flex-col items-center px-4" style={{ paddingTop: "30vh" }}>
      <div className="w-full max-w-2xl">
        {/* Title — centered like ChatGPT */}
        <h1 className="text-[28px] font-semibold text-center text-[#e3e3e3] leading-snug" style={{ marginBottom: "40px", transform: "translateZ(0)" }}>
          拍一拍，AI 帮你诊断
        </h1>

        {/* === Input box === */}
        <div
          className="bg-[#303030] shadow-[0_2px_6px_rgba(0,0,0,0.15)]"
          style={{ borderRadius: "28px", transform: "translateZ(0)" }}
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
        >
          {/* Image thumbnails */}
          {hasImages && (
            <div className="flex gap-2.5 overflow-x-auto" style={{ padding: "14px 14px 0" }} data-testid="image-previews">
              {items.map((item, idx) => (
                <div
                  key={`${item.file.name}-${item.preview}`}
                  className="relative flex-shrink-0 rounded-xl bg-[#1a1a1a]"
                  style={{ width: "80px", height: "80px" }}
                >
                  <img
                    src={item.preview}
                    alt={`预览 ${idx + 1}`}
                    className="rounded-xl object-cover"
                    style={{ width: "80px", height: "80px" }}
                  />
                  <button
                    type="button"
                    onClick={() => removeFile(idx)}
                    className="
                      absolute rounded-full
                      bg-white text-[#212121]
                      flex items-center justify-center
                      hover:bg-[#e0e0e0]
                      transition-colors cursor-pointer
                      text-[10px] leading-none font-bold
                    "
                    style={{ top: "-6px", right: "-6px", width: "22px", height: "22px" }}
                    aria-label={`移除第${idx + 1}张图片`}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Input row */}
          <div className="flex items-end gap-3" style={{ padding: "16px 10px" }}>
            {/* + button */}
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={items.length >= MAX_IMAGES}
              className="
                flex-shrink-0 w-9 h-9 rounded-full mb-0.5
                flex items-center justify-center
                hover:bg-[#3a3a3a]
                disabled:opacity-30 disabled:cursor-not-allowed
                transition-colors cursor-pointer
              "
              aria-label="添加图片"
            >
              <svg className="w-5 h-5 text-[#b4b4b4]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
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
                flex-1 min-w-0 max-h-32 py-2.5 text-base leading-normal
                bg-transparent text-[#ececec]
                placeholder:text-[#8e8e8e]
                focus:outline-none resize-none
              "
            />

            {/* Send button */}
            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className={`
                flex-shrink-0 w-9 h-9 rounded-full mb-0.5
                flex items-center justify-center
                transition-all duration-150 cursor-pointer
                disabled:cursor-not-allowed
                bg-white text-[#212121]
                ${canSubmit ? "hover:bg-[#e0e0e0]" : ""}

              `}
              aria-label="开始诊断"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5 12 3m0 0 7.5 7.5M12 3v18" />
              </svg>
            </button>
          </div>
        </div>

        {/* Capacity hint */}
        {hasImages && (
          <p className="mt-2 text-center text-xs text-[#7a7a7a]">
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

        {/* Error */}
        {error && (
          <div role="alert" style={{ marginTop: "12px", padding: "10px 16px", borderRadius: "12px", backgroundColor: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", display: "flex", alignItems: "center", gap: "10px" }}>
            <svg style={{ width: "16px", height: "16px", color: "#f87171", flexShrink: 0 }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
            </svg>
            <p style={{ fontSize: "14px", color: "#f87171", flex: 1 }}>{error}</p>
            <button
              type="button"
              onClick={() => setError(null)}
              style={{ color: "#f87171", fontSize: "12px", cursor: "pointer", background: "none", border: "none" }}
              aria-label="关闭错误提示"
              data-testid="error-close-btn"
            >
              ✕
            </button>
          </div>
        )}

        {/* Loading pulse card */}
        {loading && !result && (
          <div
            style={{
              marginTop: "24px",
              padding: "32px 24px",
              borderRadius: "16px",
              backgroundColor: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.06)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "16px",
            }}
          >
            {/* Pulsing leaf icon */}
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "50%",
                backgroundColor: "rgba(74,222,128,0.1)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                animation: "pulse-glow 2s ease-in-out infinite",
              }}
            >
              <svg
                style={{ width: "24px", height: "24px", color: "#4ade80" }}
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M20.893 13.393l-1.135-1.135a2.252 2.252 0 01-.421-.585l-1.08-2.16a.414.414 0 00-.663-.107.827.827 0 01-.812.21l-1.273-.363a.89.89 0 00-.738 1.595l.587.39c.59.395.674 1.23.172 1.732l-.2.2c-.212.212-.33.498-.33.796v.41c0 .409-.11.809-.32 1.158l-1.315 2.191a2.11 2.11 0 01-1.81 1.025 1.055 1.055 0 01-1.055-1.055v-1.172c0-.92-.56-1.747-1.414-2.089l-.655-.261a2.25 2.25 0 01-1.383-2.46l.007-.042a2.25 2.25 0 01.29-.787l.09-.15a2.25 2.25 0 012.37-1.048l1.178.236a1.125 1.125 0 001.302-.795l.208-.73a1.125 1.125 0 00-.578-1.315l-.665-.332-.091.091a2.25 2.25 0 01-1.591.659h-.18c-.249 0-.487.1-.662.274a.931.931 0 01-1.458-1.137l1.411-2.353a2.25 2.25 0 00.286-.76M11.25 1.5c.218 0 .434.003.65.01"
                />
              </svg>
            </div>
            <p style={{ fontSize: "15px", color: "#b4b4b4", fontWeight: 500 }}>
              AI 正在分析您的图片...
            </p>
            <p style={{ fontSize: "13px", color: "#6b6b6b" }}>
              请稍候，通常需要 10-20 秒
            </p>
            <style>{`
              @keyframes pulse-glow {
                0%, 100% { transform: scale(1); opacity: 0.7; box-shadow: 0 0 0 0 rgba(74,222,128,0.15); }
                50% { transform: scale(1.08); opacity: 1; box-shadow: 0 0 20px 4px rgba(74,222,128,0.12); }
              }
            `}</style>
          </div>
        )}

        {/* Diagnosis result */}
        {result && (
          <div style={{ marginTop: "32px" }}>
            <DiagnosisResultView result={result} />
          </div>
        )}
      </div>
    </main>
  );
}
