"use client";

import type { ReactNode } from "react";
import type { DiagnosisResult as DiagnosisResultType, Product } from "../lib/api";
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
  return `product-group-${keyword}`;
}

function renderTextWithKeywords(text: string): ReactNode[] {
  const parts: ReactNode[] = [];
  const regex = /\{\{(.+?)\}\}/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
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

  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts.length > 0 ? parts : [text];
}

/** Group products by keyword, preserving order and deduping by buy_url. */
function groupProductsByKeyword(products: Product[]): Map<string, Product[]> {
  const groups = new Map<string, Product[]>();
  for (const product of products) {
    const key = product.keyword;
    const existing = groups.get(key);
    if (existing) {
      if (!existing.some((p) => p.buy_url && p.buy_url === product.buy_url)) {
        groups.set(key, [...existing, product]);
      }
    } else {
      groups.set(key, [product]);
    }
  }
  return groups;
}

const sectionCls = "p-6 rounded-2xl bg-[var(--color-bg-elevated)] border border-[var(--color-border-light)]";
const headingCls = "text-base font-bold text-[var(--color-text)] mb-4";
const subHeadingCls = "text-sm font-semibold text-[var(--color-text)] mb-1.5";
const bodyCls = "text-sm text-[var(--color-text-secondary)] leading-relaxed";

export default function DiagnosisResult({ result }: DiagnosisResultProps) {
  const { diagnosis, conditions, symptoms, treatment } = result;
  const rawPct = Math.round(diagnosis.confidence * 100);
  const pct = Math.min(100, Math.max(0, rawPct));
  const colors = confidenceColor(diagnosis.confidence);
  const products = treatment.products ?? [];
  const productGroups = groupProductsByKeyword(products);

  return (
    <div className="space-y-10">
      {/* Section 1: 诊断概览 */}
      <section aria-labelledby="diagnosis-disease-name" className={sectionCls}>
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
        {diagnosis.pathogen && (
          <p className="mt-2 text-xs text-[var(--color-text-muted)]" data-testid="pathogen">
            病原：{diagnosis.pathogen}
          </p>
        )}
      </section>

      {/* Section 2: 发病条件 */}
      <section aria-labelledby="conditions-heading" className={sectionCls}>
        <h4 id="conditions-heading" className={headingCls}>发病条件</h4>
        <div data-testid="conditions-list" className="space-y-4">
          <div>
            <p className={subHeadingCls}>气候条件</p>
            <p className={bodyCls}>{conditions.climate}</p>
          </div>
          <div>
            <p className={subHeadingCls}>易感品种</p>
            <p className={bodyCls}>{conditions.variety}</p>
          </div>
          <div>
            <p className={subHeadingCls}>栽培管理</p>
            <p className={bodyCls}>{conditions.cultivation}</p>
          </div>
        </div>
      </section>

      {/* Section 3: 症状识别 */}
      <section aria-labelledby="symptoms-heading" className={sectionCls}>
        <h4 id="symptoms-heading" className={headingCls}>症状识别</h4>
        <div data-testid="symptoms-list" className="space-y-4">
          <div className="flex items-start gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-yellow-500/15 text-yellow-400 text-xs flex items-center justify-center font-medium">初</span>
            <div>
              <p className={subHeadingCls}>发病初期</p>
              <p className={bodyCls}>{symptoms.initial}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-orange-500/15 text-orange-400 text-xs flex items-center justify-center font-medium">盛</span>
            <div>
              <p className={subHeadingCls}>典型期</p>
              <p className={bodyCls}>{symptoms.typical}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-red-500/15 text-red-400 text-xs flex items-center justify-center font-medium">晚</span>
            <div>
              <p className={subHeadingCls}>发病后期</p>
              <p className={bodyCls}>{symptoms.late}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Section 4: 防治方案 */}
      <section aria-labelledby="treatment-heading" className={sectionCls}>
        <h4 id="treatment-heading" className={headingCls}>防治方案</h4>
        <div data-testid="treatment-list" className="space-y-5">
          <div className="p-5 rounded-xl bg-[var(--color-bg)]/50 border border-[var(--color-border-light)]">
            <p className="text-sm text-[var(--color-text)] mb-2"><strong>农业防治</strong></p>
            <p className={bodyCls}>{renderTextWithKeywords(treatment.agricultural)}</p>
          </div>
          <div className="p-5 rounded-xl bg-[var(--color-bg)]/50 border border-[var(--color-border-light)]">
            <p className="text-sm text-[var(--color-text)] mb-2"><strong>种子处理</strong></p>
            <p className={bodyCls}>{renderTextWithKeywords(treatment.seed_treatment)}</p>
          </div>
          <div className="p-5 rounded-xl bg-[var(--color-bg)]/50 border border-[var(--color-border-light)]">
            <p className="text-sm text-[var(--color-text)] mb-2"><strong>药剂防治</strong></p>
            <p className={bodyCls}>{renderTextWithKeywords(treatment.chemical)}</p>
          </div>
        </div>
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

      {/* Section 5: 推荐商品 */}
      {productGroups.size > 0 && (
        <section aria-labelledby="products-heading" data-testid="products-section" className={sectionCls}>
          <h4 id="products-heading" className={headingCls}>推荐商品</h4>
          <div className="space-y-6">
            {[...productGroups.entries()].map(([keyword, prods]) => (
              <div key={keyword} id={keywordToId(keyword)} data-testid={`product-group-${keyword}`} className="rounded-xl p-3 -m-3 transition-colors duration-500">
                <h5 className="text-sm font-semibold text-[var(--color-text-secondary)] mb-3">{keyword}</h5>
                <div role="region" aria-label={`${keyword} 推荐商品列表`} className="flex gap-3 overflow-x-auto" data-testid="product-list">
                  {prods.map((p) => (
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
