"use client";

import { useCallback, useState } from "react";
import ImageUpload from "../components/ImageUpload";
import DiagnosisResultView from "../components/DiagnosisResult";
import LoadingSkeleton from "../components/LoadingSkeleton";
import { type DiagnosisResult, ApiError, diagnose } from "../lib/api";

export default function Home() {
  const [images, setImages] = useState<File[]>([]);
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DiagnosisResult | null>(null);

  const handleSubmit = useCallback(async () => {
    if (images.length === 0) return;

    setError(null);
    setResult(null);
    setLoading(true);

    try {
      const data = await diagnose(images, description);
      setResult(data);
    } catch (e) {
      if (e instanceof ApiError) {
        setError(e.message);
      } else if (e instanceof TypeError) {
        setError("无法连接到服务器，请确认后端已启动");
      } else {
        setError(e instanceof Error ? e.message : "诊断失败，请稍后重试");
      }
    } finally {
      setLoading(false);
    }
  }, [images, description]);

  const handleImagesChange = useCallback((files: File[]) => {
    setImages(files);
    if (files.length === 0) {
      setResult(null);
      setError(null);
    }
  }, []);

  return (
    <main className="min-h-screen flex flex-col items-center px-5 py-8">
      <div className="w-full max-w-md">
        {/* Header */}
        <header className="mb-8">
          <h1 className="text-2xl font-bold text-[var(--color-on-surface)]">
            拍摄病害部位
          </h1>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            请确保光线充足，对焦清晰
          </p>
        </header>

        {/* Upload */}
        <section className="mb-8">
          <ImageUpload onImagesChange={handleImagesChange} />
        </section>

        {/* Description */}
        <section className="mb-8">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-lg font-bold text-[var(--color-on-surface)]">
              问题描述
            </h2>
            <span className="text-xs text-[var(--color-text-muted)]">
              可选
            </span>
          </div>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="请描述作物的异常表现，如叶片发黄、枯萎或虫害情况..."
            rows={4}
            className="
              w-full rounded-xl px-4 py-3 text-sm leading-relaxed
              bg-[var(--color-surface-container-low)]
              text-[var(--color-on-surface)]
              placeholder:text-[var(--color-text-muted)]
              focus:outline-none
              focus:ring-2 focus:ring-[var(--color-primary)]/20
              border border-[var(--color-outline-variant)]/15
              focus:border-[var(--color-primary)]/30
              transition-all resize-none
            "
          />
        </section>

        {/* Error */}
        {error && (
          <div role="alert" className="mb-6 p-4 rounded-xl bg-[var(--color-error-container)]">
            <p className="text-sm text-[var(--color-error)]">{error}</p>
          </div>
        )}

        {/* Loading skeleton */}
        {loading && !result && (
          <div className="mb-6">
            <LoadingSkeleton />
          </div>
        )}

        {/* Diagnosis result */}
        {result && (
          <div className="mb-6">
            <DiagnosisResultView result={result} />
          </div>
        )}

        {/* Submit button — gradient, 56px height */}
        <button
          onClick={handleSubmit}
          disabled={images.length === 0 || loading}
          className="
            w-full h-14 rounded-xl text-base font-semibold
            text-white cursor-pointer
            transition-all duration-200
            disabled:opacity-40 disabled:cursor-not-allowed
          "
          style={{
            background:
              images.length === 0 || loading
                ? "var(--color-surface-container-high)"
                : "linear-gradient(135deg, var(--color-primary), var(--color-primary-container))",
            color: images.length === 0 || loading ? "var(--color-text-muted)" : "#fff",
          }}
        >
          {loading ? (
            <span className="inline-flex items-center gap-2">
              <svg
                className="animate-spin h-5 w-5"
                viewBox="0 0 24 24"
                fill="none"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              诊断中...
            </span>
          ) : (
            "开始诊断"
          )}
        </button>

        {/* Bottom spacing for thumb zone */}
        <div className="h-20" />
      </div>
    </main>
  );
}
