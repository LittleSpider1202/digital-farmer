import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, within, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ImageUpload from "../components/ImageUpload";

function createFile(
  name: string,
  size: number,
  type: string,
): File {
  const buffer = new ArrayBuffer(size);
  return new File([buffer], name, { type });
}

describe("ImageUpload", () => {
  const onImageSelect = vi.fn();
  const onImageClear = vi.fn();
  let container: HTMLElement;

  function renderUpload() {
    const result = render(
      <ImageUpload onImageSelect={onImageSelect} onImageClear={onImageClear} />,
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

  it("renders upload area with prompt text", () => {
    renderUpload();
    expect(within(container).getByText("点击拍照或上传")).toBeInTheDocument();
    expect(within(container).getByText(/支持 JPG、PNG、WebP/)).toBeInTheDocument();
  });

  it("accepts valid image via click upload", async () => {
    renderUpload();
    const file = createFile("photo.jpg", 1024, "image/jpeg");
    await userEvent.upload(getFileInput(), file);
    expect(onImageSelect).toHaveBeenCalledWith(file);
  });

  it("shows preview after selecting an image", async () => {
    renderUpload();
    const file = createFile("photo.png", 1024, "image/png");
    await userEvent.upload(getFileInput(), file);

    const preview = within(container).getByAltText("上传预览");
    expect(preview).toBeInTheDocument();
    expect(preview).toHaveAttribute("src", "blob:mock-url");
  });

  it("rejects non-image file types", async () => {
    renderUpload();
    const file = createFile("doc.pdf", 1024, "application/pdf");
    // userEvent.upload won't fire change if accept doesn't match; use fireEvent instead
    const input = getFileInput();
    // Directly call the onChange by setting files
    Object.defineProperty(input, "files", { value: [file], writable: true });
    input.dispatchEvent(new Event("change", { bubbles: true }));

    expect(within(container).getByText("仅支持 JPG、PNG、WebP 格式")).toBeInTheDocument();
    expect(onImageSelect).not.toHaveBeenCalled();
  });

  it("rejects files exceeding 10MB", async () => {
    renderUpload();
    const file = createFile("huge.jpg", 11 * 1024 * 1024, "image/jpeg");
    const input = getFileInput();
    Object.defineProperty(input, "files", { value: [file], writable: true });
    input.dispatchEvent(new Event("change", { bubbles: true }));

    expect(within(container).getByText(/图片大小不能超过 10MB/)).toBeInTheDocument();
    expect(onImageSelect).not.toHaveBeenCalled();
  });

  it("clears image when clear button is clicked", async () => {
    renderUpload();
    const file = createFile("photo.jpg", 1024, "image/jpeg");
    await userEvent.upload(getFileInput(), file);

    const clearBtn = within(container).getByLabelText("移除图片");
    await userEvent.click(clearBtn);

    expect(onImageClear).toHaveBeenCalled();
    const prompts = within(container).queryAllByText("点击拍照或上传");
    expect(prompts.length).toBeGreaterThan(0);
  });

  it("accepts webp format", async () => {
    renderUpload();
    const file = createFile("photo.webp", 2048, "image/webp");
    await userEvent.upload(getFileInput(), file);
    expect(onImageSelect).toHaveBeenCalledWith(file);
  });

  it("supports drag and drop", () => {
    renderUpload();
    const dropZone = within(container).getAllByText("点击拍照或上传")[0].closest("div")!;
    const file = createFile("photo.jpg", 1024, "image/jpeg");

    const dragOverEvent = new Event("dragover", { bubbles: true });
    Object.defineProperty(dragOverEvent, "preventDefault", { value: vi.fn() });
    dropZone.dispatchEvent(dragOverEvent);

    const dropEvent = new Event("drop", { bubbles: true });
    Object.defineProperty(dropEvent, "preventDefault", { value: vi.fn() });
    Object.defineProperty(dropEvent, "dataTransfer", {
      value: { files: [file] },
    });
    dropZone.dispatchEvent(dropEvent);

    expect(onImageSelect).toHaveBeenCalledWith(file);
  });
});
