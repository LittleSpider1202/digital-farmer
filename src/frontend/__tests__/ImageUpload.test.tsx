import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, within, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ImageUpload from "../components/ImageUpload";

function createFile(name: string, size: number, type: string): File {
  const buffer = new ArrayBuffer(size);
  return new File([buffer], name, { type });
}

describe("ImageUpload", () => {
  const onImagesChange = vi.fn();
  let container: HTMLElement;

  function renderUpload() {
    const result = render(
      <ImageUpload onImagesChange={onImagesChange} />,
    );
    container = result.container;
    return result;
  }

  function getFileInput(): HTMLInputElement {
    return container.querySelector('input[type="file"]') as HTMLInputElement;
  }

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

  it("renders fixed 5-slot grid with prompt text", () => {
    renderUpload();
    expect(within(container).getByText("点击拍照或上传")).toBeInTheDocument();
    // All 5 slots rendered (1 main + 4 small)
    const grid = within(container).getByTestId("image-previews");
    expect(grid.children).toHaveLength(5);
  });

  it("accepts valid image via click upload", async () => {
    renderUpload();
    const file = createFile("photo.jpg", 1024, "image/jpeg");
    await userEvent.upload(getFileInput(), file);
    expect(onImagesChange).toHaveBeenCalledWith([file]);
  });

  it("shows preview after selecting an image", async () => {
    renderUpload();
    const file = createFile("photo.png", 1024, "image/png");
    await userEvent.upload(getFileInput(), file);

    const preview = within(container).getByAltText("预览 1");
    expect(preview).toBeInTheDocument();
    expect(preview).toHaveAttribute("src", "blob:mock-url");
  });

  it("shows '主图' label on first image", async () => {
    renderUpload();
    const file = createFile("photo.jpg", 1024, "image/jpeg");
    await userEvent.upload(getFileInput(), file);
    expect(within(container).getByText("主图")).toBeInTheDocument();
  });

  it("rejects non-image file types", async () => {
    renderUpload();
    const file = createFile("doc.pdf", 1024, "application/pdf");
    const input = getFileInput();
    Object.defineProperty(input, "files", { value: [file], writable: true });
    input.dispatchEvent(new Event("change", { bubbles: true }));

    expect(within(container).getByText("仅支持 JPG、PNG、WebP 格式")).toBeInTheDocument();
    expect(onImagesChange).not.toHaveBeenCalled();
  });

  it("rejects files exceeding 10MB", async () => {
    renderUpload();
    const file = createFile("huge.jpg", 11 * 1024 * 1024, "image/jpeg");
    const input = getFileInput();
    Object.defineProperty(input, "files", { value: [file], writable: true });
    input.dispatchEvent(new Event("change", { bubbles: true }));

    expect(within(container).getByText(/图片大小不能超过 10MB/)).toBeInTheDocument();
    expect(onImagesChange).not.toHaveBeenCalled();
  });

  it("removes single image when clear button is clicked", async () => {
    renderUpload();
    const file = createFile("photo.jpg", 1024, "image/jpeg");
    await userEvent.upload(getFileInput(), file);

    const clearBtn = within(container).getByLabelText("移除第1张图片");
    await userEvent.click(clearBtn);

    expect(onImagesChange).toHaveBeenLastCalledWith([]);
    // Back to empty — main slot shows prompt
    expect(within(container).getByText("点击拍照或上传")).toBeInTheDocument();
  });

  it("accepts webp format", async () => {
    renderUpload();
    const file = createFile("photo.webp", 2048, "image/webp");
    await userEvent.upload(getFileInput(), file);
    expect(onImagesChange).toHaveBeenCalledWith([file]);
  });

  it("supports drag and drop", async () => {
    renderUpload();
    const grid = within(container).getByTestId("image-previews").parentElement!;
    const file = createFile("photo.jpg", 1024, "image/jpeg");

    const dragOverEvent = new Event("dragover", { bubbles: true });
    Object.defineProperty(dragOverEvent, "preventDefault", { value: vi.fn() });
    grid.dispatchEvent(dragOverEvent);

    const dropEvent = new Event("drop", { bubbles: true });
    Object.defineProperty(dropEvent, "preventDefault", { value: vi.fn() });
    Object.defineProperty(dropEvent, "dataTransfer", {
      value: { files: [file] },
    });
    grid.dispatchEvent(dropEvent);

    await waitFor(() => {
      expect(onImagesChange).toHaveBeenCalledWith([file]);
    });
  });

  // --- 多图测试 ---

  it("supports selecting multiple images", async () => {
    renderUpload();
    const file1 = createFile("a.jpg", 1024, "image/jpeg");
    const file2 = createFile("b.png", 1024, "image/png");
    await userEvent.upload(getFileInput(), [file1, file2]);

    expect(onImagesChange).toHaveBeenCalledWith([file1, file2]);
    expect(within(container).getByAltText("预览 1")).toBeInTheDocument();
    expect(within(container).getByAltText("预览 2")).toBeInTheDocument();
  });

  it("allows adding more images incrementally", async () => {
    renderUpload();
    const file1 = createFile("a.jpg", 1024, "image/jpeg");
    await userEvent.upload(getFileInput(), file1);
    expect(onImagesChange).toHaveBeenLastCalledWith([file1]);

    // Grid still has 5 slots, empty ones show "+"
    const grid = within(container).getByTestId("image-previews");
    expect(grid.children).toHaveLength(5);

    const file2 = createFile("b.jpg", 1024, "image/jpeg");
    await userEvent.upload(getFileInput(), file2);
    expect(onImagesChange).toHaveBeenLastCalledWith([file1, file2]);
  });

  it("removes specific image from multiple", async () => {
    renderUpload();
    const file1 = createFile("a.jpg", 1024, "image/jpeg");
    const file2 = createFile("b.jpg", 1024, "image/jpeg");
    const file3 = createFile("c.jpg", 1024, "image/jpeg");
    await userEvent.upload(getFileInput(), [file1, file2, file3]);

    // 删除第 2 张
    const clearBtn = within(container).getByLabelText("移除第2张图片");
    await userEvent.click(clearBtn);

    expect(onImagesChange).toHaveBeenLastCalledWith([file1, file3]);
  });

  it("fills all 5 slots when uploading max images", async () => {
    renderUpload();
    const files = Array.from({ length: 5 }, (_, i) =>
      createFile(`img${i}.jpg`, 1024, "image/jpeg"),
    );
    await userEvent.upload(getFileInput(), files);

    expect(onImagesChange).toHaveBeenLastCalledWith(files);
    // All 5 slots filled — no empty "+" slots remain
    expect(within(container).getAllByAltText(/预览/)).toHaveLength(5);
  });

  it("shows error when trying to add beyond limit", async () => {
    renderUpload();
    const files = Array.from({ length: 6 }, (_, i) =>
      createFile(`img${i}.jpg`, 1024, "image/jpeg"),
    );
    await userEvent.upload(getFileInput(), files);

    // 只接受 5 张
    expect(onImagesChange).toHaveBeenCalledTimes(1);
    const lastCall = onImagesChange.mock.calls[0][0];
    expect(lastCall.length).toBe(5);
    expect(within(container).getByText(/最多上传 5 张/)).toBeInTheDocument();
  });

  it("has multiple attribute on file input", () => {
    renderUpload();
    const input = getFileInput();
    expect(input).toHaveAttribute("multiple");
  });

  it("supports drag and drop multiple files", async () => {
    renderUpload();
    const grid = within(container).getByTestId("image-previews").parentElement!;
    const file1 = createFile("a.jpg", 1024, "image/jpeg");
    const file2 = createFile("b.png", 1024, "image/png");

    const dragOverEvent = new Event("dragover", { bubbles: true });
    Object.defineProperty(dragOverEvent, "preventDefault", { value: vi.fn() });
    grid.dispatchEvent(dragOverEvent);

    const dropEvent = new Event("drop", { bubbles: true });
    Object.defineProperty(dropEvent, "preventDefault", { value: vi.fn() });
    Object.defineProperty(dropEvent, "dataTransfer", {
      value: { files: [file1, file2] },
    });
    grid.dispatchEvent(dropEvent);

    await waitFor(() => {
      expect(onImagesChange).toHaveBeenCalledWith([file1, file2]);
    });
  });
});
