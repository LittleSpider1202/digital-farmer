"use client";

import type { ReactNode } from "react";
import type { DiagnosisResult as DiagnosisResultType } from "../lib/api";
import ProductCard from "./ProductCard";

type Product = DiagnosisResultType["intervention"][number]["products"][number];

interface DiagnosisResultProps {
  result: DiagnosisResultType;
}

function confidenceColor(confidence: number): { badge: string; bar: string } {
  if (confidence >= 0.8) return { badge: "bg-emerald-500/15 text-emerald-400", bar: "bg-emerald-500" };
  if (confidence >= 0.5) return { badge: "bg-amber-500/15 text-amber-400", bar: "bg-amber-500" };
  return { badge: "bg-red-500/15 text-red-400", bar: "bg-red-500" };
}

function keywordToId(keyword: string): string {
  return `product-group-${keyword}`;
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
          const target = document.getElementById(anchorId);
          if (!target) return;
          target.scrollIntoView({ behavior: "smooth", block: "center" });
          target.classList.add("highlight-flash");
          setTimeout(() => target.classList.remove("highlight-flash"), 1500);
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

/** Collect all products from interventions, grouped by keyword (preserving order). */
function groupProductsByKeyword(intervention: DiagnosisResultType["intervention"]): Map<string, Product[]> {
  const groups = new Map<string, Product[]>();
  for (const item of intervention) {
    for (const product of item.products) {
      const key = product.keyword;
      const existing = groups.get(key);
      if (existing) {
        // dedupe by buy_url (immutable)
        if (!existing.some((p) => p.buy_url && p.buy_url === product.buy_url)) {
          groups.set(key, [...existing, product]);
        }
      } else {
        groups.set(key, [product]);
      }
    }
  }
  return groups;
}

export default function DiagnosisResult({ result }: DiagnosisResultProps) {
  const { diagnosis, prevention, intervention } = result;
  const rawPct = Math.round(diagnosis.confidence * 100);
  const pct = Math.min(100, Math.max(0, rawPct));
  const colors = confidenceColor(diagnosis.confidence);
  const productGroups = groupProductsByKeyword(intervention);

  return (
    <div className="space-y-10">
      {/* Diagnosis */}
      <section aria-labelledby="diagnosis-disease-name" className="p-6 rounded-2xl bg-[var(--color-bg-elevated)] border border-[var(--color-border-light)]">
        <p className="text-xs text-[var(--color-text-muted)] mb-1.5">AI 智能识别</p>
        <h3 id="diagnosis-disease-name" className="text-xl font-bold text-[var(--color-text)] mb-2.5">
          {diagnosis.disease_name}
        </h3>
        <span data-testid="confidence-badge" className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${colors.badge}`}>
          置信度 {pct}%
        </span>
        <div className="mt-2.5 h-1 w-full rounded-full bg-[var(--color-border)] overflow-hidden" data-testid="confidence-bar">
          <div className={`h-full rounded-full ${colors.bar} transition-all duration-500`} style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-4 text-sm text-[var(--color-text-secondary)] leading-relaxed">{diagnosis.description}</p>
      </section>

      {/* Prevention */}
      <section aria-labelledby="prevention-heading" className="p-6 rounded-2xl bg-[var(--color-bg-elevated)] border border-[var(--color-border-light)]">
        <h4 id="prevention-heading" className="text-base font-bold text-[var(--color-text)] mb-4">预防措施</h4>
        <ol data-testid="prevention-list" className="space-y-3">
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

      {/* Intervention — text only, no product cards */}
      <section aria-labelledby="intervention-heading" className="p-6 rounded-2xl bg-[var(--color-bg-elevated)] border border-[var(--color-border-light)]">
        <h4 id="intervention-heading" className="text-base font-bold text-[var(--color-text)] mb-4">干预措施</h4>
        <ul data-testid="intervention-list" className="space-y-5">
          {intervention.map((item, i) => (
            <li key={`${item.action}-${i}`} className="p-5 rounded-xl bg-[var(--color-bg)]/50 border border-[var(--color-border-light)]">
              <p className="text-sm text-[var(--color-text)] mb-2">
                <strong>{renderDetailsWithKeywords(item.action)}</strong>
              </p>
              <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
                {renderDetailsWithKeywords(item.details)}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <style>{`
        .highlight-flash {
          animation: flash-bg 1.5s ease-out;
        }
        @keyframes flash-bg {
          0% { background-color: rgba(74,222,128,0.2); }
          100% { background-color: transparent; }
        }
      `}</style>

      {/* Recommended Products — independent section, grouped by keyword */}
      {productGroups.size > 0 && (
        <section aria-labelledby="products-heading" data-testid="products-section" className="p-6 rounded-2xl bg-[var(--color-bg-elevated)] border border-[var(--color-border-light)]">
          <h4 id="products-heading" className="text-base font-bold text-[var(--color-text)] mb-5">推荐商品</h4>
          <div className="space-y-6">
            {[...productGroups.entries()].map(([keyword, products]) => (
              <div key={keyword} id={keywordToId(keyword)} data-testid={`product-group-${keyword}`} className="rounded-xl p-3 -m-3 transition-colors duration-500">
                <h5 className="text-sm font-semibold text-[var(--color-text-secondary)] mb-3">{keyword}</h5>
                <div role="region" aria-label={`${keyword} 推荐商品列表`} className="flex gap-3 overflow-x-auto" data-testid="product-list">
                  {products.map((p) => (
                    <div key={p.buy_url} className="flex-shrink-0 w-64">
                      <ProductCard product={p} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
