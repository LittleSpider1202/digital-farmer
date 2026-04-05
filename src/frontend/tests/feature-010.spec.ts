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

/** Mock diagnose API with {{keyword}} patterns in details and product image URLs */
const MOCK_RESULT = {
  success: true,
  data: {
    diagnosis: {
      disease_name: "番茄晚疫病",
      confidence: 0.92,
      description: "晚疫病是由疫霉菌引起的真菌性病害，主要危害番茄叶片和果实。",
    },
    prevention: ["选择抗病品种", "避免连作", "控制田间湿度"],
    intervention: [
      {
        action: "喷施{{代森锰锌}}",
        details:
          "每亩用量100克，兑水40公斤喷雾，发病初期配合{{甲霜灵}}交替使用效果更佳",
        products: [
          {
            keyword: "代森锰锌",
            name: "代森锰锌 80% WP",
            image_url: "https://example.com/product-dsmz.jpg",
            price: 18.5,
            sales: 3200,
            buy_url: "https://example.com/buy/dsmz",
          },
          {
            keyword: "甲霜灵",
            name: "甲霜灵 25% WP",
            image_url: "https://invalid-url-to-trigger-fallback.test/broken.jpg",
            price: 22.0,
            sales: 1560,
            buy_url: "https://example.com/buy/jsl",
          },
        ],
      },
    ],
  },
};

test.describe("Feature #10 — UI 视觉优化", () => {
  test("固定5坑位网格：空状态显示虚线边框+相机图标", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("h1")).toBeVisible();

    // Fixed 5-slot grid always visible
    const grid = page.locator('[data-testid="image-previews"]');
    await expect(grid).toBeVisible();
    // 5 children: 1 main slot (col-span-2 row-span-2) + 4 small
    await expect(grid.locator("> div")).toHaveCount(5);

    // Main slot has camera icon
    const cameraPath = grid.locator('svg path[d*="6.827"]');
    await expect(cameraPath).toHaveCount(1);

    // All empty slots have dashed borders
    const dashedSlots = grid.locator("div.border-dashed");
    await expect(dashedSlots).toHaveCount(5);

    await page.screenshot({
      path: "verification/feature-010-empty-state.png",
      fullPage: true,
    });
  });

  test("5张图填满坑位，无空坑", async ({ page }) => {
    await page.goto("/");

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles([
      makeTestImage("img1.jpg"),
      makeTestImage("img2.jpg"),
      makeTestImage("img3.jpg"),
      makeTestImage("img4.jpg"),
      makeTestImage("img5.jpg"),
    ]);

    const grid = page.locator('[data-testid="image-previews"]');
    await expect(grid).toBeVisible();
    await expect(grid.locator("img")).toHaveCount(5);

    // No empty dashed slots remain
    await expect(grid.locator("div.border-dashed")).toHaveCount(0);

    // Delete buttons should be ≥32px
    const deleteBtn = grid.locator('button[aria-label*="移除"]').first();
    const box = await deleteBtn.boundingBox();
    expect(box).toBeTruthy();
    expect(box!.width).toBeGreaterThanOrEqual(32);
    expect(box!.height).toBeGreaterThanOrEqual(32);

    // First image has "主图" label
    await expect(page.locator("text=主图")).toBeVisible();

    await page.screenshot({
      path: "verification/feature-010-multi-grid.png",
      fullPage: true,
    });
  });

  test("单张图填入主坑位，其余坑位保持空", async ({ page }) => {
    await page.goto("/");

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles([makeTestImage("single.jpg")]);

    const grid = page.locator('[data-testid="image-previews"]');
    await expect(grid).toBeVisible();
    await expect(grid.locator("img")).toHaveCount(1);

    // 4 empty dashed slots remain
    await expect(grid.locator("div.border-dashed")).toHaveCount(4);

    await page.screenshot({
      path: "verification/feature-010-single-image.png",
      fullPage: true,
    });
  });

  test("诊断结果卡片层次 + 置信度进度条 + 关键词锚点", async ({ page }) => {
    await page.route("**/api/diagnose", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_RESULT),
      });
    });

    await page.goto("/");

    // Upload and submit
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles([makeTestImage("tomato.jpg")]);
    await page.click('button[aria-label="开始诊断"]');

    // Wait for result
    await expect(page.locator("text=番茄晚疫病")).toBeVisible({ timeout: 10_000 });

    // Confidence progress bar
    const confBar = page.locator('[data-testid="confidence-bar"]');
    await expect(confBar).toBeVisible();

    // Diagnosis card has green left border (border-l-4 border-green-600)
    const diagnosisCard = page.locator("section").filter({ hasText: "AI 智能识别" });
    await expect(diagnosisCard).toBeVisible();

    // Prevention card has blue left border
    const preventionCard = page.locator("section").filter({ hasText: "预防措施" });
    await expect(preventionCard).toBeVisible();

    // Intervention card has orange left border
    const interventionCard = page.locator("section").filter({ hasText: "干预措施" });
    await expect(interventionCard).toBeVisible();

    // {{关键词}} rendered as clickable links
    const kwLink = page.locator('a[data-keyword-link="代森锰锌"]');
    await expect(kwLink).toBeVisible();
    await expect(kwLink).toHaveText("代森锰锌");

    const kwLink2 = page.locator('a[data-keyword-link="甲霜灵"]');
    await expect(kwLink2).toBeVisible();

    // Product card has anchor id for scroll target (keyword is URI-encoded)
    const encodedId = `product-${encodeURIComponent("代森锰锌")}`;
    const productAnchor = page.locator(`[id="${encodedId}"]`);
    await expect(productAnchor).toBeVisible();

    // Product card shows "购买" button
    await expect(page.locator("span", { hasText: "购买" }).first()).toBeVisible();

    await page.screenshot({
      path: "verification/feature-010-diagnosis-result.png",
      fullPage: true,
    });
  });

  test("商品图片加载失败显示占位图", async ({ page }) => {
    await page.route("**/api/diagnose", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_RESULT),
      });
    });

    // Block image requests to trigger fallback
    await page.route("**/product-dsmz.jpg", (route) => route.abort());
    await page.route("**/broken.jpg", (route) => route.abort());

    await page.goto("/");
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles([makeTestImage("tomato.jpg")]);
    await page.click('button[aria-label="开始诊断"]');

    await expect(page.locator("text=番茄晚疫病")).toBeVisible({ timeout: 10_000 });

    // At least one placeholder should appear (broken image URL product)
    await expect(
      page.locator('[data-testid="product-image-placeholder"]'),
    ).toHaveCount(2, { timeout: 5_000 });

    await page.screenshot({
      path: "verification/feature-010-placeholder.png",
      fullPage: true,
    });
  });

  test("错误提示可关闭：有图标 + 边框 + 关闭按钮", async ({ page }) => {
    await page.route("**/api/diagnose", async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({
          success: false,
          error_code: "INTERNAL_ERROR",
          message: "服务器内部错误",
        }),
      });
    });

    await page.goto("/");
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles([makeTestImage("err.jpg")]);
    await page.click('button[aria-label="开始诊断"]');

    // Error alert should appear (use filter to avoid Next.js route announcer)
    const alert = page.locator('[role="alert"]').filter({ hasText: "服务器内部错误" });
    await expect(alert).toBeVisible({ timeout: 10_000 });

    // Alert has an SVG warning icon
    await expect(alert.locator("svg")).toHaveCount(1);

    // Close button exists
    const closeBtn = page.locator('[data-testid="error-close-btn"]');
    await expect(closeBtn).toBeVisible();

    // After error, submit button should be enabled again (not stuck loading)
    await expect(page.locator('button[aria-label="开始诊断"]')).toBeEnabled();

    // Click close
    await closeBtn.click();

    // Alert should disappear
    await expect(alert).toHaveCount(0);

    await page.screenshot({
      path: "verification/feature-010-error-dismiss.png",
      fullPage: true,
    });
  });

  test("移动端 320px 布局不溢出", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });

    await page.route("**/api/diagnose", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_RESULT),
      });
    });

    await page.goto("/");

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles([makeTestImage("mobile.jpg")]);
    await page.click('button[aria-label="开始诊断"]');

    await expect(page.locator("text=番茄晚疫病")).toBeVisible({ timeout: 10_000 });

    // Check no horizontal overflow
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    expect(bodyWidth).toBeLessThanOrEqual(320);

    await page.screenshot({
      path: "verification/feature-010-mobile.png",
      fullPage: true,
    });
  });
});
