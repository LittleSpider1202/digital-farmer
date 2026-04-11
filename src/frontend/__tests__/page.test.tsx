import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, waitFor, within, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Home from "../app/page";

// Mock the api module
vi.mock("../lib/api", () => ({
  ApiError: class ApiError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
      this.name = "ApiError";
    }
  },
  diagnose: vi.fn(),
}));

import { diagnose } from "../lib/api";

const mockDiagnose = vi.mocked(diagnose);

function createFile(name: string, size: number, type: string): File {
  const buffer = new ArrayBuffer(size);
  return new File([buffer], name, { type });
}

describe("Home page", () => {
  let container: HTMLElement;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      "URL",
      Object.assign(globalThis.URL, {
        createObjectURL: vi.fn(() => "blob:mock-url"),
        revokeObjectURL: vi.fn(),
      }),
    );
  });

  afterEach(() => {
    cleanup();
  });

  function renderPage() {
    const result = render(<Home />);
    container = result.container;
    return result;
  }

  function getFileInput(): HTMLInputElement {
    return container.querySelector('input[type="file"]') as HTMLInputElement;
  }

  it("renders the page header", () => {
    renderPage();
    expect(within(container).getByText(/AI 帮你诊断/)).toBeInTheDocument();
  });

  it("renders the description textarea", () => {
    renderPage();
    expect(
      within(container).getByPlaceholderText(/上传病害图片/),
    ).toBeInTheDocument();
  });

  it("renders the submit button disabled when no image", () => {
    renderPage();
    const btn = within(container).getByRole("button", { name: "开始诊断" });
    expect(btn).toBeDisabled();
  });

  it("enables button after image selection", async () => {
    renderPage();
    const file = createFile("photo.jpg", 1024, "image/jpeg");
    await userEvent.upload(getFileInput(), file);

    const btn = within(container).getByRole("button", { name: "开始诊断" });
    expect(btn).toBeEnabled();
  });

  it("disables submit button while diagnosing", async () => {
    mockDiagnose.mockImplementation(
      () => new Promise(() => {}), // never resolves
    );

    renderPage();
    const file = createFile("photo.jpg", 1024, "image/jpeg");
    await userEvent.upload(getFileInput(), file);

    const btn = within(container).getByRole("button", { name: "开始诊断" });
    await userEvent.click(btn);

    // Button should be disabled during loading (prevents double-click)
    expect(btn).toBeDisabled();
  });

  it("displays diagnosis result on success", async () => {
    mockDiagnose.mockResolvedValueOnce({
      diagnosis: {
        disease_name: "小麦白粉病",
        confidence: 0.85,
        description: "白粉病是由真菌引起的常见病害",
        pathogen: "白粉菌",
      },
      conditions: { climate: "温暖", variety: "感病", cultivation: "密植" },
      symptoms: { initial: "白点", typical: "霉层", late: "灰褐" },
      treatment: { agricultural: "轮作", seed_treatment: "拌种", chemical: "喷药", products: [] },
    });

    renderPage();
    const file = createFile("photo.jpg", 1024, "image/jpeg");
    await userEvent.upload(getFileInput(), file);

    const btn = within(container).getByRole("button", { name: "开始诊断" });
    await userEvent.click(btn);

    await waitFor(() => {
      expect(within(container).getByText(/小麦白粉病/)).toBeInTheDocument();
    });
    expect(within(container).getByText(/85%/)).toBeInTheDocument();
  });

  it("shows conditions, symptoms and treatment sections on success", async () => {
    mockDiagnose.mockResolvedValueOnce({
      diagnosis: {
        disease_name: "水稻稻瘟病",
        confidence: 0.72,
        description: "稻瘟病由稻瘟菌引起，危害叶片和穗部。",
        pathogen: "稻瘟菌 (Magnaporthe oryzae)",
      },
      conditions: { climate: "高温高湿", variety: "感病品种", cultivation: "偏施氮肥" },
      symptoms: { initial: "叶片出现褐点", typical: "梭形病斑", late: "穗颈变褐" },
      treatment: {
        agricultural: "使用抗病品种，合理施肥",
        seed_treatment: "拌种处理",
        chemical: "发病初期喷施{{三环唑}}，间隔7天重复",
        products: [],
      },
    });

    renderPage();
    const file = createFile("photo.jpg", 1024, "image/jpeg");
    await userEvent.upload(getFileInput(), file);

    const btn = within(container).getByRole("button", { name: "开始诊断" });
    await userEvent.click(btn);

    await waitFor(() => {
      expect(within(container).getByText(/水稻稻瘟病/)).toBeInTheDocument();
    });

    // Conditions section
    expect(within(container).getByText(/高温高湿/)).toBeInTheDocument();

    // Symptoms section
    expect(within(container).getByText(/叶片出现褐点/)).toBeInTheDocument();

    // Treatment section
    expect(within(container).getByText("农业防治")).toBeInTheDocument();
    expect(within(container).getByText("药剂防治")).toBeInTheDocument();
  });

  it("shows result directly after loading completes", async () => {
    mockDiagnose.mockResolvedValueOnce({
      diagnosis: {
        disease_name: "玉米大斑病",
        confidence: 0.9,
        description: "由突脐蠕孢菌引起，形成大型椭圆病斑。",
        pathogen: "突脐蠕孢菌",
      },
      conditions: { climate: "高温", variety: "感病", cultivation: "连作" },
      symptoms: { initial: "褐点", typical: "大斑", late: "枯死" },
      treatment: { agricultural: "轮作换茬", seed_treatment: "拌种", chemical: "喷药", products: [] },
    });

    renderPage();
    const file = createFile("photo.jpg", 1024, "image/jpeg");
    await userEvent.upload(getFileInput(), file);

    const btn = within(container).getByRole("button", { name: "开始诊断" });
    await userEvent.click(btn);

    await waitFor(() => {
      expect(within(container).getByText(/玉米大斑病/)).toBeInTheDocument();
    });
  });

  it("displays error on API failure", async () => {
    const { ApiError: MockApiError } = await import("../lib/api");
    mockDiagnose.mockRejectedValueOnce(
      new MockApiError("AI_TIMEOUT", "AI 诊断超时，请稍后重试"),
    );

    renderPage();
    const file = createFile("photo.jpg", 1024, "image/jpeg");
    await userEvent.upload(getFileInput(), file);

    const btn = within(container).getByRole("button", { name: "开始诊断" });
    await userEvent.click(btn);

    await waitFor(() => {
      expect(within(container).getByText(/AI 诊断超时/)).toBeInTheDocument();
    });
  });

  it("displays network error message", async () => {
    mockDiagnose.mockRejectedValueOnce(new TypeError("Failed to fetch"));

    renderPage();
    const file = createFile("photo.jpg", 1024, "image/jpeg");
    await userEvent.upload(getFileInput(), file);

    const btn = within(container).getByRole("button", { name: "开始诊断" });
    await userEvent.click(btn);

    await waitFor(() => {
      expect(within(container).getByText(/无法连接到服务器/)).toBeInTheDocument();
    });
  });

  it("sends description along with image", async () => {
    mockDiagnose.mockResolvedValueOnce({
      diagnosis: {
        disease_name: "测试病害",
        confidence: 0.9,
        description: "测试描述",
        pathogen: "测试病原",
      },
      conditions: { climate: "c", variety: "v", cultivation: "cu" },
      symptoms: { initial: "i", typical: "t", late: "l" },
      treatment: { agricultural: "a", seed_treatment: "s", chemical: "ch", products: [] },
    });

    renderPage();
    const file = createFile("photo.jpg", 1024, "image/jpeg");
    await userEvent.upload(getFileInput(), file);

    const textarea = within(container).getByPlaceholderText(/描述症状/);
    await userEvent.type(textarea, "叶子发黄有斑点");

    const btn = within(container).getByRole("button", { name: "开始诊断" });
    await userEvent.click(btn);

    await waitFor(() => {
      expect(mockDiagnose).toHaveBeenCalledWith([file], "叶子发黄有斑点");
    });
  });
});
