"use client";

import type { ReactNode } from "react";
import type { DiagnosisResult as DiagnosisResultType } from "../lib/api";
import ProductCard from "./ProductCard";

interface DiagnosisResultProps {
  result: DiagnosisResultType;
}

function confidenceColor(confidence: number): { badge: string; bar: string } {
  if (confidence >= 0.8) return { badge: "bg-emerald-500/15 text-emerald-400", bar: "bg-emerald-500" };
  if (confidence >= 0.5) return { badge: "bg-amber-500/15 text-amber-400", bar: "bg-amber-500" };
  return { badge: "bg-red-500/15 text-red-400", bar: "bg-red-500" };
}

function keywordToId(keyword: string): string {
  return `product-${encodeURIComponent(keyword)}`;
}

function renderDetailsWithKeywords(details: string): ReactNode[] {
  const parts: ReactNode[] = [];
  const regex = /\{\{(.+?)\}\}/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(details)) !== null) {
    if (match.index > lastIndex) parts.push(details.slice(lastIndex, match.index));
    const keyword = match[1];
    const anchorId = keywordToId(keyword);
    parts.push(
      <a
        key={`kw-${keyword}-${match.index}`}
        href={`#${anchorId}`}
        data-keyword-link={keyword}
        onClick={(e) => {
          e.preventDefault();
          document.getElementById(anchorId)?.scrollIntoView({ behavior: "smooth", block: "center" });
        }}
        className="text-[var(--color-accent)] font-medium underline underline-offset-2 decoration-[var(--color-accent)]/30 hover:decoration-[var(--color-accent)] transition-colors cursor-pointer"
      >
        {keyword}
      </a>
    );
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < details.length) parts.push(details.slice(lastIndex));
  return parts.length > 0 ? parts : [details];
}

export default function DiagnosisResult({ result }: DiagnosisResultProps) {
  const { diagnosis, prevention, intervention } = result;
  const rawPct = Math.round(diagnosis.confidence * 100);
  const pct = Math.min(100, Math.max(0, rawPct));
  const colors = confidenceColor(diagnosis.confidence);

  return (
    <div className="space-y-4">
      {/* Diagnosis */}
      <section aria-labelledby="diagnosis-disease-name" className="p-5 rounded-2xl bg-[var(--color-bg-elevated)] border border-[var(--color-border-light)]">
        <p className="text-xs text-[var(--color-text-muted)] mb-1">AI 智能识别</p>
        <h3 id="diagnosis-disease-name" className="text-xl font-bold text-[var(--color-text)] mb-2">
          {diagnosis.disease_name}
        </h3>
        <span data-testid="confidence-badge" className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${colors.badge}`}>
          置信度 {pct}%
        </span>
        <div className="mt-2 h-1 w-full rounded-full bg-[var(--color-border)] overflow-hidden" data-testid="confidence-bar">
          <div className={`h-full rounded-full ${colors.bar} transition-all duration-500`} style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-3 text-sm text-[var(--color-text-secondary)] leading-relaxed">{diagnosis.description}</p>
      </section>

      {/* Prevention */}
      <section aria-labelledby="prevention-heading" className="p-5 rounded-2xl bg-[var(--color-bg-elevated)] border border-[var(--color-border-light)]">
        <h4 id="prevention-heading" className="text-base font-bold text-[var(--color-text)] mb-3">预防措施</h4>
        <ol data-testid="prevention-list" className="space-y-2">
          {prevention.map((item, i) => (
            <li key={`prevention-${i}`} className="flex items-start gap-3 text-sm text-[var(--color-text-secondary)]">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[var(--color-accent)] text-white text-xs flex items-center justify-center font-medium">
                {i + 1}
              </span>
              <span className="leading-relaxed pt-0.5">{item}</span>
            </li>
          ))}
        </ol>
      </section>

      {/* Intervention */}
      <section aria-labelledby="intervention-heading" className="p-5 rounded-2xl bg-[var(--color-bg-elevated)] border border-[var(--color-border-light)]">
        <h4 id="intervention-heading" className="text-base font-bold text-[var(--color-text)] mb-3">干预措施</h4>
        <ul data-testid="intervention-list" className="space-y-4">
          {intervention.map((item, i) => (
            <li key={`${item.action}-${i}`} className="p-4 rounded-xl bg-[var(--color-bg)]/50 border border-[var(--color-border-light)]">
              <p className="text-sm text-[var(--color-text)] mb-1">
                <strong>{renderDetailsWithKeywords(item.action)}</strong>
              </p>
              <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
                {renderDetailsWithKeywords(item.details)}
              </p>
              {item.products.length > 0 && (
                <div className="mt-3 space-y-2" data-testid="product-list">
                  {item.products.map((p) => (
                    <ProductCard key={`${p.buy_url}-${i}`} product={p} />
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
