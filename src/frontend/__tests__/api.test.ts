import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { diagnose, ApiError } from "../lib/api";

describe("api client", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  const mockFetch = () => vi.mocked(globalThis.fetch);

  function createFile(name: string): File {
    return new File(["pixels"], name, { type: "image/jpeg" });
  }

  it("sends image and description as FormData", async () => {
    mockFetch().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: true,
          data: {
            diagnosis: { disease_name: "test", confidence: 0.9, description: "d" },
            prevention: [],
            intervention: [],
          },
        }),
      ),
    );

    const file = createFile("photo.jpg");
    await diagnose(file, "叶子发黄");

    const [url, options] = mockFetch().mock.calls[0];
    expect(url).toBe("http://localhost:8000/api/diagnose");
    expect(options?.method).toBe("POST");
    expect(options?.body).toBeInstanceOf(FormData);

    const formData = options?.body as FormData;
    expect(formData.get("image")).toBe(file);
    expect(formData.get("description")).toBe("叶子发黄");
  });

  it("omits description when empty", async () => {
    mockFetch().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: true,
          data: {
            diagnosis: { disease_name: "test", confidence: 0.9, description: "d" },
            prevention: [],
            intervention: [],
          },
        }),
      ),
    );

    const file = createFile("photo.jpg");
    await diagnose(file, "  ");

    const formData = mockFetch().mock.calls[0][1]?.body as FormData;
    expect(formData.get("description")).toBeNull();
  });

  it("throws ApiError on error response", async () => {
    mockFetch().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: false,
          error_code: "IMAGE_TOO_LARGE",
          message: "上传图片超过10MB限制",
        }),
      ),
    );

    const file = createFile("photo.jpg");
    await expect(diagnose(file, "")).rejects.toThrow(ApiError);
    await expect(diagnose(file, "")).rejects.toThrow(); // fetch called again
  });

  it("returns DiagnosisResult on success", async () => {
    const mockData = {
      diagnosis: { disease_name: "小麦白粉病", confidence: 0.85, description: "描述" },
      prevention: ["预防1"],
      intervention: [{ action: "喷药", details: "详情", products: [] }],
    };

    mockFetch().mockResolvedValueOnce(
      new Response(JSON.stringify({ success: true, data: mockData })),
    );

    const file = createFile("photo.jpg");
    const result = await diagnose(file, "");
    expect(result).toEqual(mockData);
  });

  it("throws ApiError on non-JSON response body", async () => {
    mockFetch().mockResolvedValueOnce(
      new Response("Bad Gateway", { status: 502 }),
    );

    const file = createFile("photo.jpg");
    await expect(diagnose(file, "")).rejects.toThrow(ApiError);
    try {
      await diagnose(file, "");
    } catch (e) {
      // second call also returns 502
      mockFetch().mockResolvedValueOnce(
        new Response("Bad Gateway", { status: 502 }),
      );
    }
  });

  it("throws ApiError with TIMEOUT on AbortError", async () => {
    mockFetch().mockImplementationOnce(() => {
      const err = new DOMException("The operation was aborted.", "AbortError");
      return Promise.reject(err);
    });

    const file = createFile("photo.jpg");
    try {
      await diagnose(file, "");
      expect.unreachable("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      expect((e as ApiError).code).toBe("TIMEOUT");
    }
  });

  it("includes abort signal in fetch request", async () => {
    mockFetch().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: true,
          data: {
            diagnosis: { disease_name: "test", confidence: 0.9, description: "d" },
            prevention: [],
            intervention: [],
          },
        }),
      ),
    );

    const file = createFile("photo.jpg");
    await diagnose(file, "");

    const options = mockFetch().mock.calls[0][1];
    expect(options?.signal).toBeInstanceOf(AbortSignal);
  });
});
