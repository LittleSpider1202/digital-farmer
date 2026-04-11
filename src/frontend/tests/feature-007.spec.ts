import { test, expect } from "@playwright/test";

test.describe("Feature #7 — 商品推荐卡片", () => {
  test("首页加载无报错，UI 结构完��", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });

    await page.goto("/");

    // Page loads without crash
    await expect(page.locator("h1")).toBeVisible();
    await expect(page.locator('button[aria-label="开始诊断"]')).toBeVisible();

    // Upload a test image to enable the button
    const fileInput = page.locator('input[type="file"]');
    const jpegBytes = Buffer.from(
      "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoH" +
        "BwYIDAoMCwsKCwsKDA4PDAsMDgsKCw0PDg0MEhATExILEBkSEhAQEf/2wBDAQME" +
        "BAUEBQkGBgkRCwsLERERERERERERERERERERERERERERERERERERERERERERERER" +
        "ERERERERERERERERERET/wAARCAABAAEDAREAAhEBAxEB/8QAFAABAAAAAAAAAAAA" +
        "AAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/xAAUAQEAAAAAAAAAAAAAAAAA" +
        "AAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AKwA//9k=",
      "base64",
    );
    await fileInput.setInputFiles({
      name: "test-crop.jpg",
      mimeType: "image/jpeg",
      buffer: jpegBytes,
    });

    // Image preview should appear
    const preview = page.locator('img[alt*="预览"], img[alt*="preview"], img[alt*="上传"]');
    // The button should now be enabled
    const submitBtn = page.locator('button[aria-label="开始诊断"]');
    await expect(submitBtn).toBeEnabled();

    // Take screenshot of the page ready to diagnose
    await page.screenshot({
      path: "verification/feature-007-ready.png",
      fullPage: true,
    });

    // No console errors
    expect(errors.filter((e) => !e.includes("favicon"))).toHaveLength(0);
  });

  test("使用 mock 数据验证商品卡片��染", async ({ page }) => {
    // Intercept the diagnose API and return mock data with products
    await page.route("**/api/diagnose", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            diagnosis: {
              disease_name: "小麦白粉病",
              confidence: 0.85,
              description: "白粉病是由真菌引起的常见小麦病害。",
              pathogen: "白粉菌 (Blumeria graminis)",
            },
            conditions: { climate: "温暖潮湿", variety: "感病品种", cultivation: "密植" },
            symptoms: { initial: "白点", typical: "霉层", late: "灰褐色" },
            treatment: {
              agricultural: "清除病残体，及时收集并销毁田间病叶",
              seed_treatment: "拌种处理",
              chemical: "喷施{{三唑酮}}，每亩50-75克，配合{{多菌灵}}交替使用",
              products: [
                {
                    keyword: "三唑��",
                    name: "三唑酮可湿性粉剂 25%",
                    image_url: "https://placehold.co/112x112?text=三唑酮",
                    price: 15.8,
                    sales: 2340,
                    buy_url: "https://example.com/buy/1",
                  },
                  {
                    keyword: "多菌灵",
                    name: "多菌灵 50% WP",
                    image_url: "https://placehold.co/112x112?text=多菌灵",
                    price: 12.5,
                    sales: 1890,
                    buy_url: "https://example.com/buy/2",
                  },
                ],
              },
          },
        }),
      });
    });

    await page.goto("/");

    // Upload image
    const fileInput = page.locator('input[type="file"]');
    const jpegBytes = Buffer.from(
      "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoH" +
        "BwYIDAoMCwsKCwsKDA4PDAsMDgsKCw0PDg0MEhATExILEBkSEhAQEf/2wBDAQME" +
        "BAUEBQkGBgkRCwsLERERERERERERERERERERERERERERERERERERERERERERERER" +
        "ERERERERERERERERERET/wAARCAABAAEDAREAAhEBAxEB/8QAFAABAAAAAAAAAAAA" +
        "AAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/xAAUAQEAAAAAAAAAAAAAAAAA" +
        "AAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AKwA//9k=",
      "base64",
    );
    await fileInput.setInputFiles({
      name: "test-crop.jpg",
      mimeType: "image/jpeg",
      buffer: jpegBytes,
    });

    // Click diagnose
    await page.click('button[aria-label="开始诊断"]');

    // Wait for result
    await page.waitForSelector('[data-testid="treatment-list"]', {
      timeout: 10_000,
    });

    // Recommended Products section exists as independent section
    const productsSection = page.locator('[data-testid="products-section"]');
    await expect(productsSection).toBeVisible();
    await expect(productsSection.locator("text=推荐商品")).toBeVisible();

    // Product cards rendered in products section (2 products across 2 keyword groups)
    const productCards = productsSection.locator("a");
    await expect(productCards).toHaveCount(2);

    // Card 1: check name, price, link
    const firstCard = productCards.first();
    await expect(firstCard).toContainText("三唑酮可湿性粉剂");
    await expect(firstCard).toContainText("¥15.80");
    await expect(firstCard).toContainText("2340人已购");
    await expect(firstCard).toHaveAttribute("target", "_blank");
    await expect(firstCard).toHaveAttribute("href", "https://example.com/buy/1");

    // Card 2
    const secondCard = productCards.nth(1);
    await expect(secondCard).toContainText("多菌灵");
    await expect(secondCard).toContainText("¥12.50");

    // Treatment list has NO product cards (they are in products section)
    const treatmentList = page.locator('[data-testid="treatment-list"]');
    await expect(treatmentList.locator('[data-testid="product-list"]')).toHaveCount(0);

    // Screenshot
    await page.screenshot({
      path: "verification/feature-007.png",
      fullPage: true,
    });
  });
});
