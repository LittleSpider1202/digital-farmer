import { test, expect } from "@playwright/test";

/** Minimal valid JPEG for file input. */
const JPEG_BYTES = Buffer.from(
  "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoH" +
    "BwYIDAoMCwsKCwsKDA4PDAsMDgsKCw0PDg0MEhATExILEBkSEhAQEf/2wBDAQME" +
    "BAUEBQkGBgkRCwsLERERERERERERERERERERERERERERERERERERERERERERERER" +
    "ERERERERERERERERERET/wAARCAABAAEDAREAAhEBAxEB/8QAFAABAAAAAAAAAAAA" +
    "AAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/xAAUAQEAAAAAAAAAAAAAAAAA" +
    "AAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AKwA//9k=",
  "base64",
);

function makeTestImage(name: string) {
  return { name, mimeType: "image/jpeg", buffer: JPEG_BYTES };
}

/** Mock diagnose API returning a full result with products. */
const MOCK_FULL_RESULT = {
  success: true,
  data: {
    diagnosis: {
      disease_name: "小麦白粉病",
      confidence: 0.85,
      description: "白粉病是由真菌引起的常见小麦病害，主要危害叶片。",
    },
    prevention: ["选择抗病品种", "合理密植，保持通风", "适当控制氮肥用量"],
    intervention: [
      {
        action: "喷施{{三唑酮可湿性粉剂}}",
        details:
          "每亩用量50-75克，兑水30公斤喷雾，也可配合{{多菌灵}}交替使用",
        products: [
          {
            keyword: "三唑酮可湿性粉剂",
            name: "三唑酮可湿性粉剂 25%",
            image_url: "https://example.com/product1.jpg",
            price: 15.8,
            sales: 2340,
            buy_url: "https://example.com/buy/1",
          },
          {
            keyword: "多菌灵",
            name: "多菌灵 50% WP",
            image_url: "https://example.com/product2.jpg",
            price: 12.5,
            sales: 1890,
            buy_url: "https://example.com/buy/2",
          },
        ],
      },
    ],
  },
};

test.describe("Feature #8 — 前后端联调 + 完整流程", () => {
  test("完整流程：多图上传 → 诊断 → 结果 → 商品推荐", async ({ page }) => {
    // Mock API
    await page.route("**/api/diagnose", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_FULL_RESULT),
      });
    });

    await page.goto("/");
    await expect(page.locator("h1")).toBeVisible();

    // Upload 2 images
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles([
      makeTestImage("wheat1.jpg"),
      makeTestImage("wheat2.jpg"),
    ]);
    await expect(
      page.locator('[data-testid="image-previews"] img'),
    ).toHaveCount(2);

    // Enter description
    await page.fill("textarea", "叶子上有白色粉末状物质");

    // Submit
    await page.click('button:has-text("开始诊断")');

    // Loading state
    await expect(page.locator('text=诊断中...')).toBeVisible();

    // Wait for result
    await expect(page.locator("text=小麦白粉病")).toBeVisible({
      timeout: 10_000,
    });

    // Diagnosis details
    await expect(page.locator("text=85%")).toBeVisible();
    await expect(page.locator("text=白粉病是由真菌引起")).toBeVisible();

    // Prevention list
    await expect(page.locator("text=选择抗病品种")).toBeVisible();
    await expect(page.locator("text=合理密植，保持通风")).toBeVisible();

    // Intervention action text
    await expect(page.locator("strong", { hasText: "三唑酮可湿性粉剂" })).toBeVisible();

    // Product cards
    await expect(page.locator("text=三唑酮可湿性粉剂 25%")).toBeVisible();
    await expect(page.locator("text=多菌灵 50% WP")).toBeVisible();
    await expect(page.locator("text=¥15.80")).toBeVisible();

    // Screenshot
    await page.screenshot({
      path: "verification/feature-008-full-flow.png",
      fullPage: true,
    });
  });

  test("空描述提交可正常工作", async ({ page }) => {
    let requestBody = "";
    await page.route("**/api/diagnose", async (route) => {
      requestBody = route.request().postData() ?? "";
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_FULL_RESULT),
      });
    });

    await page.goto("/");

    // Upload image without description
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles([makeTestImage("crop.jpg")]);

    // Leave description empty
    const textarea = page.locator("textarea");
    await expect(textarea).toHaveValue("");

    // Submit
    await page.click('button:has-text("开始诊断")');

    // Should succeed
    await expect(page.locator("text=小麦白粉病")).toBeVisible({
      timeout: 10_000,
    });

    // Verify description was not sent in the multipart body
    expect(requestBody).not.toContain('name="description"');
  });

  test("异常：非图片文件上传显示友好错误", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("h1")).toBeVisible();

    // Upload a non-image file (text file disguised)
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: "readme.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("this is not an image"),
    });

    // Should show error message from frontend validation
    await expect(page.locator("text=仅支持 JPG、PNG、WebP 格式")).toBeVisible();

    // No image preview should appear (grid exists but all slots empty)
    await expect(
      page.locator('[data-testid="image-previews"] img'),
    ).toHaveCount(0);

    // Submit button should be disabled (no images)
    await expect(
      page.locator('button:has-text("开始诊断")'),
    ).toBeDisabled();

    // Screenshot
    await page.screenshot({
      path: "verification/feature-008-invalid-file.png",
      fullPage: true,
    });
  });

  test("异常：后端超时显示超时提示", async ({ page }) => {
    // Simulates the backend returning a 500 with AI_TIMEOUT error_code
    // (not a frontend AbortController timeout — that path is separate)
    await page.route("**/api/diagnose", async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({
          success: false,
          error_code: "AI_TIMEOUT",
          message: "AI 诊断超时，请稍后重试",
        }),
      });
    });

    await page.goto("/");

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles([makeTestImage("slow.jpg")]);

    await page.click('button:has-text("开始诊断")');

    // Should show timeout error
    await expect(page.locator("text=AI 诊断超时，请稍后重试")).toBeVisible({
      timeout: 10_000,
    });

    // Error should be in an alert region
    await expect(
      page.locator('[role="alert"]').filter({ hasText: "超时" }),
    ).toBeVisible();

    // No result should be shown — check specific data-testid not just text
    await expect(page.locator('[data-testid="intervention-list"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="prevention-list"]')).toHaveCount(0);

    // Screenshot
    await page.screenshot({
      path: "verification/feature-008-timeout.png",
      fullPage: true,
    });
  });

  test("异常：超过5张图片显示上限提示", async ({ page }) => {
    await page.goto("/");

    const fileInput = page.locator('input[type="file"]');

    // Upload 5 images first
    await fileInput.setInputFiles([
      makeTestImage("img1.jpg"),
      makeTestImage("img2.jpg"),
      makeTestImage("img3.jpg"),
      makeTestImage("img4.jpg"),
      makeTestImage("img5.jpg"),
    ]);

    await expect(
      page.locator('[data-testid="image-previews"] img'),
    ).toHaveCount(5);

    // Upload zone should be hidden when at max
    await expect(page.locator("text=继续添加")).toHaveCount(0);

    // Try to add one more via file input (force set)
    await fileInput.setInputFiles([makeTestImage("img6.jpg")]);

    // Should show limit error
    await expect(page.locator("text=最多上传 5 张图片")).toBeVisible();

    // Still only 5 previews
    await expect(
      page.locator('[data-testid="image-previews"] img'),
    ).toHaveCount(5);
  });

  test("异常：后端返回 400 错误显示错误信息", async ({ page }) => {
    await page.route("**/api/diagnose", async (route) => {
      await route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({
          success: false,
          error_code: "INVALID_IMAGE_FORMAT",
          message: "第1张图片格式不支持，仅支持 jpg/png/webp",
        }),
      });
    });

    await page.goto("/");

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles([makeTestImage("bad.jpg")]);

    await page.click('button:has-text("开始诊断")');

    // Should show backend error
    await expect(
      page.locator("text=第1张图片格式不支持，仅支持 jpg/png/webp"),
    ).toBeVisible({ timeout: 10_000 });

    await expect(
      page.locator('[role="alert"]').filter({ hasText: "格式不支持" }),
    ).toBeVisible();
  });
});
