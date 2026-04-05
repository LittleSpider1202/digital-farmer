export default function LoadingSkeleton() {
  return (
    <div data-testid="loading-skeleton" role="status" aria-label="正在加载诊断结果" className="space-y-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="p-5 rounded-2xl bg-[var(--color-bg-elevated)] border border-[var(--color-border-light)]">
          <div className="animate-pulse space-y-3">
            <div className="h-3 w-20 rounded bg-[var(--color-bg-hover)]" />
            <div className="h-5 w-48 rounded bg-[var(--color-bg-hover)]" />
            <div className="space-y-2 pt-1">
              <div className="h-3.5 w-full rounded bg-[var(--color-bg-hover)]" />
              <div className="h-3.5 w-3/4 rounded bg-[var(--color-bg-hover)]" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
