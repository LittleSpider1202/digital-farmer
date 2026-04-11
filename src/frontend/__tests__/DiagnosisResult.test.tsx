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
    pathogen: "白粉菌 (Blumeria graminis f. sp. tritici)",
  },
  conditions: {
    climate: "温暖潮湿，春季多雨，日均温15-20℃",
    variety: "矮秆、大穗型品种较易感病",
    cultivation: "偏施氮肥、密植、通风不良",
  },
  symptoms: {
    initial: "叶片出现小白点，近圆形",
    typical: "白色粉状霉层扩展，覆盖叶面",
    late: "霉层变灰褐色，出现黑色小点",
  },
  treatment: {
    agricultural: "清除病残体，合理轮作，避免偏施氮肥",
    seed_treatment: "播种前用{{三唑酮}}拌种处理",
    chemical: "发病初期喷施{{三唑酮可湿性粉剂}}，每亩50g，兑水30kg",
    products: [
      {
        keyword: "三唑酮可湿性粉剂",
        name: "农用三唑酮可湿性粉剂",
        image_url: "https://example.com/product.jpg",
        price: 18.5,
        sales: 320,
        buy_url: "https://example.com/buy/1",
      },
    ],
  },
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
    expect(within(container).getByText(/85%/)).toBeInTheDocument();
  });

  it("renders the description text", () => {
    const { container } = render(<DiagnosisResult result={baseResult} />);
    expect(
      within(container).getByText(/白粉病是由真菌引起的常见小麦病害/),
    ).toBeInTheDocument();
  });

  it("renders the pathogen", () => {
    const { container } = render(<DiagnosisResult result={baseResult} />);
    expect(within(container).getByTestId("pathogen")).toBeInTheDocument();
    expect(within(container).getByText(/Blumeria graminis/)).toBeInTheDocument();
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

  // --- Conditions section ---

  it("renders conditions section with three sub-items", () => {
    const { container } = render(<DiagnosisResult result={baseResult} />);
    const conditionsList = within(container).getByTestId("conditions-list");
    expect(within(conditionsList).getByText(/温暖潮湿/)).toBeInTheDocument();
    expect(within(conditionsList).getByText(/矮秆/)).toBeInTheDocument();
    expect(within(conditionsList).getByText(/偏施氮肥/)).toBeInTheDocument();
  });

  it("renders conditions headings", () => {
    const { container } = render(<DiagnosisResult result={baseResult} />);
    expect(within(container).getByText("气候条件")).toBeInTheDocument();
    expect(within(container).getByText("易感品种")).toBeInTheDocument();
    expect(within(container).getByText("栽培管理")).toBeInTheDocument();
  });

  // --- Symptoms section ---

  it("renders symptoms section with three stages", () => {
    const { container } = render(<DiagnosisResult result={baseResult} />);
    const symptomsList = within(container).getByTestId("symptoms-list");
    expect(within(symptomsList).getByText(/叶片出现小白点/)).toBeInTheDocument();
    expect(within(symptomsList).getByText(/白色粉状霉层扩展/)).toBeInTheDocument();
    expect(within(symptomsList).getByText(/霉层变灰褐色/)).toBeInTheDocument();
  });

  it("renders symptom stage labels", () => {
    const { container } = render(<DiagnosisResult result={baseResult} />);
    expect(within(container).getByText("发病初期")).toBeInTheDocument();
    expect(within(container).getByText("典型期")).toBeInTheDocument();
    expect(within(container).getByText("发病后期")).toBeInTheDocument();
  });

  // --- Treatment section ---

  it("renders treatment section with three sub-items", () => {
    const { container } = render(<DiagnosisResult result={baseResult} />);
    const treatmentList = within(container).getByTestId("treatment-list");
    expect(within(treatmentList).getByText("农业防治")).toBeInTheDocument();
    expect(within(treatmentList).getByText("种子处理")).toBeInTheDocument();
    expect(within(treatmentList).getByText("药剂防治")).toBeInTheDocument();
  });

  it("renders treatment agricultural text", () => {
    const { container } = render(<DiagnosisResult result={baseResult} />);
    expect(within(container).getByText(/清除病残体/)).toBeInTheDocument();
  });

  it("renders keyword links in chemical treatment", () => {
    const { container } = render(<DiagnosisResult result={baseResult} />);
    const links = container.querySelectorAll("a[data-keyword-link]");
    expect(links.length).toBeGreaterThan(0);
    const keywords = Array.from(links).map((l) => l.getAttribute("data-keyword-link"));
    expect(keywords).toContain("三唑酮可湿性粉剂");
  });

  // --- Recommended Products section ---

  it("renders products section separate from treatment", () => {
    const { container } = render(<DiagnosisResult result={baseResult} />);
    const productsSection = within(container).getByTestId("products-section");
    expect(within(productsSection).getByText("推荐商品")).toBeInTheDocument();
    // Product name appears in the product card
    expect(within(productsSection).getAllByText(/三唑酮可湿性粉剂/).length).toBeGreaterThan(0);
  });

  it("groups products by keyword with heading", () => {
    const { container } = render(<DiagnosisResult result={baseResult} />);
    const group = within(container).getByTestId("product-group-三唑酮可湿性粉剂");
    expect(group).toBeInTheDocument();
    expect(within(group).getByText("三唑酮可湿性粉剂")).toBeInTheDocument();
  });

  it("does not render products section when no products exist", () => {
    const noProductResult: DiagnosisResultType = {
      ...baseResult,
      treatment: { ...baseResult.treatment, products: [] },
    };
    const { container } = render(<DiagnosisResult result={noProductResult} />);
    expect(within(container).queryByTestId("products-section")).toBeNull();
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
