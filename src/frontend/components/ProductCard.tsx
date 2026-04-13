"use client";

import { useState } from "react";
import type { Product } from "../lib/api";

interface ProductCardProps {
  product: Product;
}

function safeUrl(url: string): string {
  try {
    const { protocol } = new URL(url);
    return protocol === "https:" || protocol === "http:" ? url : "#";
  } catch {
    return "#";
  }
}

function ImagePlaceholder() {
  return (
    <div className="w-12 h-12 rounded-lg flex-shrink-0 bg-[var(--color-bg-hover)] flex items-center justify-center" data-testid="product-image-placeholder">
      <svg className="w-5 h-5 text-[var(--color-text-muted)]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" />
      </svg>
    </div>
  );
}

export default function ProductCard({ product }: ProductCardProps) {
  const [imgError, setImgError] = useState(false);
  const imageUrl = safeUrl(product.image_url);
  const showImage = imageUrl !== "#" && !imgError;

  return (
    <a
      href={safeUrl(product.buy_url)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`购买 ${product.name}，¥${product.price.toFixed(2)}`}
      className="
        flex items-center gap-3 p-3 rounded-xl
        bg-[var(--color-bg)]
        border border-[var(--color-border-light)]
        hover:border-[var(--color-accent)]/40
        hover:bg-[var(--color-bg-hover)]
        transition-all duration-150
        no-underline
      "
    >
      {showImage ? (
        <img
          src={imageUrl}
          alt={product.name}
          width={48}
          height={48}
          onError={() => setImgError(true)}
          className="w-12 h-12 rounded-lg object-cover flex-shrink-0 bg-[var(--color-bg-hover)]"
        />
      ) : (
        <ImagePlaceholder />
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-[var(--color-text)] font-medium truncate">{product.name}</p>
        <div className="flex items-baseline gap-2 mt-0.5">
          <span className="text-sm font-bold text-[var(--color-error)]">¥{product.price.toFixed(2)}</span>
          <span className="text-xs text-[var(--color-text-muted)]">{product.sales}人已购</span>
        </div>
      </div>
      <span aria-hidden="true" className="flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium text-white bg-[var(--color-accent)] transition-colors">
        购买
      </span>
    </a>
  );
}
