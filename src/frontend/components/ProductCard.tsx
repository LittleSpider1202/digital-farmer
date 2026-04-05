import type { DiagnosisResult } from "../lib/api";

type Product = DiagnosisResult["intervention"][number]["products"][number];

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

export default function ProductCard({ product }: ProductCardProps) {
  return (
    <a
      href={safeUrl(product.buy_url)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`购买 ${product.name}，¥${product.price.toFixed(2)}`}
      className="
        flex items-center gap-3 p-3 rounded-lg
        bg-[var(--color-surface-container-low)]
        border border-[var(--color-outline-variant)]/10
        hover:border-[var(--color-primary)]/25
        transition-colors duration-150
        no-underline
      "
    >
      <img
        src={safeUrl(product.image_url)}
        alt={product.name}
        width={56}
        height={56}
        className="w-14 h-14 rounded-md object-cover flex-shrink-0 bg-[var(--color-surface-container-high)]"
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-[var(--color-on-surface)] font-medium truncate">
          {product.name}
        </p>
        <div className="flex items-baseline gap-2 mt-1">
          <span className="text-sm font-bold text-[var(--color-error)]">
            <span>¥</span>{product.price.toFixed(2)}
          </span>
          <span className="text-xs text-[var(--color-text-muted)]">
            {product.sales}人已购
          </span>
        </div>
      </div>
    </a>
  );
}
