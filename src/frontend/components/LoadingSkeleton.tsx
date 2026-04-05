export default function LoadingSkeleton() {
  return (
    <div data-testid="loading-skeleton" role="status" aria-label="正在加载诊断结果" className="space-y-4">
      {/* Diagnosis card skeleton */}
      <div className="p-5 rounded-xl bg-[var(--color-surface-bright)]">
        <div className="animate-pulse space-y-3">
          <div className="h-3 w-20 rounded bg-[var(--color-surface-container-high)]" />
          <div className="h-6 w-48 rounded bg-[var(--color-surface-container-high)]" />
          <div className="h-4 w-16 rounded-full bg-[var(--color-surface-container-high)]" />
          <div className="space-y-2 pt-2">
            <div className="h-4 w-full rounded bg-[var(--color-surface-container-high)]" />
            <div className="h-4 w-3/4 rounded bg-[var(--color-surface-container-high)]" />
          </div>
        </div>
      </div>

      {/* Prevention skeleton */}
      <div className="p-5 rounded-xl bg-[var(--color-surface-bright)]">
        <div className="animate-pulse space-y-3">
          <div className="h-5 w-24 rounded bg-[var(--color-surface-container-high)]" />
          <div className="h-4 w-full rounded bg-[var(--color-surface-container-high)]" />
          <div className="h-4 w-5/6 rounded bg-[var(--color-surface-container-high)]" />
          <div className="h-4 w-2/3 rounded bg-[var(--color-surface-container-high)]" />
        </div>
      </div>

      {/* Intervention skeleton */}
      <div className="p-5 rounded-xl bg-[var(--color-surface-bright)]">
        <div className="animate-pulse space-y-3">
          <div className="h-5 w-24 rounded bg-[var(--color-surface-container-high)]" />
          <div className="h-4 w-40 rounded bg-[var(--color-surface-container-high)]" />
          <div className="h-4 w-full rounded bg-[var(--color-surface-container-high)]" />
          <div className="h-4 w-5/6 rounded bg-[var(--color-surface-container-high)]" />
        </div>
      </div>
    </div>
  );
}
