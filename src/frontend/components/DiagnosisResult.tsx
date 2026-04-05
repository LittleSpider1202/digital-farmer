import type { DiagnosisResult as DiagnosisResultType } from "../lib/api";

interface DiagnosisResultProps {
  result: DiagnosisResultType;
}

function confidenceBadgeClass(confidence: number): string {
  if (confidence >= 0.8) return "bg-green-100 text-green-800";
  if (confidence >= 0.5) return "bg-yellow-100 text-yellow-800";
  return "bg-red-100 text-red-800";
}

export default function DiagnosisResult({ result }: DiagnosisResultProps) {
  const { diagnosis, prevention, intervention } = result;
  const rawPct = Math.round(diagnosis.confidence * 100);
  const pct = Math.min(100, Math.max(0, rawPct));

  return (
    <div className="space-y-4">
      {/* Diagnosis card */}
      <section aria-labelledby="diagnosis-disease-name" className="p-5 rounded-xl bg-[var(--color-surface-bright)]">
        <p className="text-xs text-[var(--color-text-muted)] mb-1">
          AI 智能识别
        </p>
        <h3 id="diagnosis-disease-name" className="text-xl font-bold text-[var(--color-on-surface)] mb-2">
          {diagnosis.disease_name}
        </h3>
        <span
          data-testid="confidence-badge"
          className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${confidenceBadgeClass(diagnosis.confidence)}`}
        >
          置信度 {pct}%
        </span>
        <p className="mt-3 text-sm text-[var(--color-on-surface-variant)] leading-relaxed">
          {diagnosis.description}
        </p>
      </section>

      {/* Prevention */}
      <section aria-labelledby="prevention-heading" className="p-5 rounded-xl bg-[var(--color-surface-bright)]">
        <h4 id="prevention-heading" className="text-base font-bold text-[var(--color-on-surface)] mb-3">
          预防措施
        </h4>
        <ol data-testid="prevention-list" className="space-y-2">
          {prevention.map((item, i) => (
            <li
              key={`prevention-${i}`}
              className="flex items-start gap-3 text-sm text-[var(--color-on-surface-variant)]"
            >
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[var(--color-primary-container)] text-white text-xs flex items-center justify-center font-medium">
                {i + 1}
              </span>
              <span className="leading-relaxed pt-0.5">{item}</span>
            </li>
          ))}
        </ol>
      </section>

      {/* Intervention */}
      <section aria-labelledby="intervention-heading" className="p-5 rounded-xl bg-[var(--color-surface-bright)]">
        <h4 id="intervention-heading" className="text-base font-bold text-[var(--color-on-surface)] mb-3">
          ���预措施
        </h4>
        <ul data-testid="intervention-list" className="space-y-4">
          {intervention.map((item) => (
            <li
              key={item.action}
              className="p-4 rounded-lg bg-[var(--color-surface-container-low)] border border-[var(--color-outline-variant)]/15"
            >
              <p className="text-sm text-[var(--color-on-surface)] mb-1">
                <strong>{item.action}</strong>
              </p>
              <p className="text-sm text-[var(--color-on-surface-variant)] leading-relaxed">
                {item.details}
              </p>
              {/* Products area — Feature #7 will render ProductCard here */}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
