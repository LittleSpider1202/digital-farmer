import { describe, it, expect, afterEach } from "vitest";
import { render, within, cleanup } from "@testing-library/react";
import DiagnosisResult from "../components/DiagnosisResult";
import LoadingSkeleton from "../components/LoadingSkeleton";
import type { DiagnosisResult as DiagnosisResultType } from "../lib/api";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const baseResult: DiagnosisResultType = {
  diagnosis: {
    disease_name: "小麦白粉病",
    confidence: 0.85,
    description: "白粉病是由真菌引起的常见小麦病害，叶面出现白色粉状物。",
  },
  prevention: ["选择抗病品种", "合理密植，保持通风", "避免偏施氮肥"],
  intervention: [
    {
      action: "喷施杀菌剂",
      details: "每亩用三唑酮 50g，兑水 30kg，均匀喷雾",
      products: [
        {
          keyword: "三唑酮",
          name: "农用三唑酮可湿性粉剂",
          image_url: "https://example.com/product.jpg",
          price: 18.5,
          sales: 320,
          buy_url: "https://example.com/buy/1",
        },
      ],
    },
    {
      action: "清除病残体",
      details: "及时收集并销毁田间病叶，减少菌源",
      products: [],
    },
  ],
};

const lowConfidenceResult: DiagnosisResultType = {
  ...baseResult,
  diagnosis: { ...baseResult.diagnosis, confidence: 0.45 },
};

const midConfidenceResult: DiagnosisResultType = {
  ...baseResult,
  diagnosis: { ...baseResult.diagnosis, confidence: 0.65 },
};

// ---------------------------------------------------------------------------
// DiagnosisResult component
// ---------------------------------------------------------------------------

describe("DiagnosisResult component", () => {
  afterEach(() => {
    cleanup();
  });

  // --- Core diagnosis info ---

  it("renders the disease name", () => {
    const { container } = render(<DiagnosisResult result={baseResult} />);
    expect(within(container).getByText(/小麦白粉病/)).toBeInTheDocument();
  });

  it("renders the confidence as a percentage", () => {
    const { container } = render(<DiagnosisResult result={baseResult} />);
    // 0.85 → "85%"
    expect(within(container).getByText(/85%/)).toBeInTheDocument();
  });

  it("renders the description text", () => {
    const { container } = render(<DiagnosisResult result={baseResult} />);
    expect(
      within(container).getByText(/白粉病是由真菌引起的常见小麦病害/),
    ).toBeInTheDocument();
  });

  // --- Confidence badge colour classes ---

  it("applies green styling for high confidence (>=80%)", () => {
    const { container } = render(<DiagnosisResult result={baseResult} />);
    const badge = within(container).getByTestId("confidence-badge");
    expect(badge.className).toMatch(/emerald/);
  });

  it("applies yellow styling for medium confidence (>=50% and <80%)", () => {
    const { container } = render(
      <DiagnosisResult result={midConfidenceResult} />,
    );
    const badge = within(container).getByTestId("confidence-badge");
    expect(badge.className).toMatch(/amber/);
  });

  it("applies red styling for low confidence (<50%)", () => {
    const { container } = render(
      <DiagnosisResult result={lowConfidenceResult} />,
    );
    const badge = within(container).getByTestId("confidence-badge");
    expect(badge.className).toMatch(/red/);
  });

  // --- Prevention section ---

  it("renders all prevention items as a list", () => {
    const { container } = render(<DiagnosisResult result={baseResult} />);
    expect(within(container).getByText("选择抗病品种")).toBeInTheDocument();
    expect(
      within(container).getByText("合理密植，保持通风"),
    ).toBeInTheDocument();
    expect(within(container).getByText("避免偏施氮肥")).toBeInTheDocument();
  });

  it("renders the correct number of prevention list items", () => {
    const { container } = render(<DiagnosisResult result={baseResult} />);
    const preventionList = within(container).getByTestId("prevention-list");
    const items = within(preventionList).getAllByRole("listitem");
    expect(items).toHaveLength(3);
  });

  it("handles an empty prevention array without crashing", () => {
    const result: DiagnosisResultType = { ...baseResult, prevention: [] };
    expect(() => render(<DiagnosisResult result={result} />)).not.toThrow();
  });

  it("shows no prevention items when the array is empty", () => {
    const result: DiagnosisResultType = { ...baseResult, prevention: [] };
    const { container } = render(<DiagnosisResult result={result} />);
    const preventionList = within(container).getByTestId("prevention-list");
    expect(within(preventionList).queryAllByRole("listitem")).toHaveLength(0);
  });

  // --- Intervention section ---

  it("renders intervention action text", () => {
    const { container } = render(<DiagnosisResult result={baseResult} />);
    expect(within(container).getByText(/喷施杀菌剂/)).toBeInTheDocument();
    expect(within(container).getByText(/清除病残体/)).toBeInTheDocument();
  });

  it("renders intervention details text", () => {
    const { container } = render(<DiagnosisResult result={baseResult} />);
    expect(within(container).getByText(/每亩用三唑酮 50g/)).toBeInTheDocument();
    expect(within(container).getByText(/及时收集并销毁/)).toBeInTheDocument();
  });

  it("renders intervention action in bold", () => {
    const { container } = render(<DiagnosisResult result={baseResult} />);
    const list = within(container).getByTestId("intervention-list");
    const firstItem = within(list).getAllByRole("listitem")[0];
    // The bold element must contain the action text
    const bold = firstItem.querySelector("strong, b, [data-bold]");
    expect(bold).not.toBeNull();
    expect(bold!.textContent).toMatch(/喷施杀菌剂/);
  });

  it("renders the correct number of intervention items", () => {
    const { container } = render(<DiagnosisResult result={baseResult} />);
    const list = within(container).getByTestId("intervention-list");
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(2);
  });

  it("handles an empty intervention array without crashing", () => {
    const result: DiagnosisResultType = { ...baseResult, intervention: [] };
    expect(() => render(<DiagnosisResult result={result} />)).not.toThrow();
  });

  it("shows no intervention items when the array is empty", () => {
    const result: DiagnosisResultType = { ...baseResult, intervention: [] };
    const { container } = render(<DiagnosisResult result={result} />);
    const list = within(container).getByTestId("intervention-list");
    expect(within(list).queryAllByRole("listitem")).toHaveLength(0);
  });

  // --- Product cards within interventions (Feature #7) ---

  it("renders product cards under intervention items with products", () => {
    const { container } = render(<DiagnosisResult result={baseResult} />);
    // The first intervention has 1 product
    const list = within(container).getByTestId("intervention-list");
    const items = within(list).getAllByRole("listitem");
    // First item should contain product info
    expect(within(items[0]).getByText(/三唑酮可湿性粉剂/)).toBeInTheDocument();
    expect(within(items[0]).getByText(/18\.50/)).toBeInTheDocument();
  });

  it("does not render product area when products array is empty", () => {
    const { container } = render(<DiagnosisResult result={baseResult} />);
    const list = within(container).getByTestId("intervention-list");
    const items = within(list).getAllByRole("listitem");
    // Second intervention has no products — no product card area
    expect(within(items[1]).queryByText(/¥/)).toBeNull();
    expect(within(items[1]).queryByRole("link")).toBeNull();
  });

  it("renders buy links targeting new tab with noopener", () => {
    const { container } = render(<DiagnosisResult result={baseResult} />);
    const links = container.querySelectorAll('a[target="_blank"]');
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      expect(link.getAttribute("rel")).toMatch(/noopener/);
    }
  });
});

// ---------------------------------------------------------------------------
// LoadingSkeleton component
// ---------------------------------------------------------------------------

describe("LoadingSkeleton component", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders without throwing", () => {
    expect(() => render(<LoadingSkeleton />)).not.toThrow();
  });

  it("mounts a non-empty DOM subtree", () => {
    const { container } = render(<LoadingSkeleton />);
    expect(container.firstChild).not.toBeNull();
  });

  it("contains at least one animated pulse element", () => {
    const { container } = render(<LoadingSkeleton />);
    // Convention: pulse animation elements carry the CSS class "animate-pulse"
    const pulseElements = container.querySelectorAll(".animate-pulse");
    expect(pulseElements.length).toBeGreaterThan(0);
  });

  it("exposes a testid so the page can assert on loading state", () => {
    const { container } = render(<LoadingSkeleton />);
    expect(
      within(container).getByTestId("loading-skeleton"),
    ).toBeInTheDocument();
  });
});
