import { describe, it, expect, afterEach } from "vitest";
import { render, within, cleanup } from "@testing-library/react";
import ProductCard from "../components/ProductCard";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const product = {
  keyword: "三唑酮",
  name: "农用三唑酮可湿性粉剂 25%",
  image_url: "https://example.com/product.jpg",
  price: 18.5,
  sales: 320,
  buy_url: "https://example.com/buy/1",
};

// ---------------------------------------------------------------------------
// ProductCard component
// ---------------------------------------------------------------------------

describe("ProductCard component", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders the product name", () => {
    const { container } = render(<ProductCard product={product} />);
    expect(within(container).getByText(/三唑酮可湿性粉剂/)).toBeInTheDocument();
  });

  it("renders the product price with currency symbol and two decimals", () => {
    const { container } = render(<ProductCard product={product} />);
    expect(within(container).getByText(/18\.50/)).toBeInTheDocument();
    expect(within(container).getByText(/¥/)).toBeInTheDocument();
  });

  it("renders the sales count", () => {
    const { container } = render(<ProductCard product={product} />);
    expect(within(container).getByText(/320/)).toBeInTheDocument();
  });

  it("renders the product image with alt text", () => {
    const { container } = render(<ProductCard product={product} />);
    const img = container.querySelector("img");
    expect(img).not.toBeNull();
    expect(img!.getAttribute("src")).toBe(product.image_url);
    expect(img!.getAttribute("alt")).toBeTruthy();
  });

  it("links to buy_url in a new tab", () => {
    const { container } = render(<ProductCard product={product} />);
    const link = container.querySelector("a[href]");
    expect(link).not.toBeNull();
    expect(link!.getAttribute("href")).toBe(product.buy_url);
    expect(link!.getAttribute("target")).toBe("_blank");
    expect(link!.getAttribute("rel")).toMatch(/noopener/);
  });

  it("sanitizes javascript: URLs to '#'", () => {
    const malicious = { ...product, buy_url: "javascript:alert(1)" };
    const { container } = render(<ProductCard product={malicious} />);
    const link = container.querySelector("a[href]");
    expect(link!.getAttribute("href")).toBe("#");
  });

  it("has aria-label with product name and price", () => {
    const { container } = render(<ProductCard product={product} />);
    const link = container.querySelector("a");
    expect(link!.getAttribute("aria-label")).toMatch(/三唑酮/);
    expect(link!.getAttribute("aria-label")).toMatch(/¥18\.50/);
  });
});
