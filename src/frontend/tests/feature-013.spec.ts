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

/** Mock with products under different keywords in treatment.chemical */
const MOCK_RESULT = {
  success: true,
  data: {
    diagnosis: {
      disease_name: "水稻稻瘟病",
      confidence: 0.88,
      description: "稻瘟病是由梨孢菌引起的真菌性病害。",
      pathogen: "稻梨孢 (Magnaporthe oryzae)",
    },
    conditions: { climate: "高温高湿", variety: "感病品种", cultivation: "偏施氮肥" },
    symptoms: { initial: "叶片褐点", typical: "梭形病斑", late: "穗颈变褐" },
    treatment: {
      agricultural: "选择抗病品种，合理施肥",
      seed_treatment: "拌种处理",
      chemical: "每亩用{{三环唑}}75克，兑水30公斤，配合{{稻瘟灵}}交替使用",
      products: [
        {
          keyword: "三环唑",
          name: "三环唑 75% WP",
          image_url: "https://example.com/sanhz.jpg",
          price: 16.0,
          sales: 2100,
          buy_url: "https://example.com/buy/sanhz",
        },
        {
          keyword: "稻瘟灵",
          name: "稻瘟灵 40% EC",
          image_url: "https://example.com/dwl.jpg",
          price: 28.5,
          sales: 980,
          buy_url: "https://example.com/buy/dwl",
        },
      ],
    },
  },
};

/** Mock with zero products */
const MOCK_NO_PRODUCTS = {
  success: true,
  data: {
    diagnosis: {
      disease_name: "健康植株",
      confidence: 0.95,
      description: "未检测到明显病害。",
      pathogen: "无",
    },
    conditions: { climate: "正常", variety: "健康品种", cultivation: "管理良好" },
    symptoms: { initial: "无", typical: "无", late: "无" },
    treatment: {
      agricultural: "加强田间管理，定期巡查",
      seed_treatment: "常规拌种",
      chemical: "无需药剂防治",
      products: [],
    },
  },
};

test.describe("Feature #13 — 诊断结果布局重构", () => {
  test("防治方案区域无商品卡片，推荐商品独立 section", async ({ page }) => {
    await page.route("**/api/diagnose", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_RESULT),
      });
    });

    await page.goto("/");
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles([makeTestImage("rice.jpg")]);
    await page.click('button[aria-label="开始诊断"]');

    await expect(page.locator("text=水稻稻瘟病")).toBeVisible({ timeout: 10_000 });

    // Treatment section has no product cards
    const treatmentSection = page.locator("section").filter({ hasText: "防治方案" });
    await expect(treatmentSection).toBeVisible();
    await expect(treatmentSection.locator('[data-testid="product-list"]')).toHaveCount(0);

    // Keyword links present in treatment chemical
    await expect(page.locator('a[data-keyword-link="三环唑"]')).toBeVisible();
    await expect(page.locator('a[data-keyword-link="稻瘟灵"]')).toBeVisible();

    // Recommended products section exists as independent section
    const productsSection = page.locator('[data-testid="products-section"]');
    await expect(productsSection).toBeVisible();
    await expect(productsSection.locator("text=推荐商品")).toBeVisible();

    // Products grouped by keyword
    const group1 = page.locator('[data-testid="product-group-三环唑"]');
    await expect(group1).toBeVisible();
    await expect(group1.locator("text=三环唑 75% WP")).toBeVisible();

    const group2 = page.locator('[data-testid="product-group-稻瘟灵"]');
    await expect(group2).toBeVisible();
    await expect(group2.locator("text=稻瘟灵 40% EC")).toBeVisible();

    // Cards are horizontal (flex row) within each group
    const productList = group1.locator('[data-testid="product-list"]');
    await expect(productList).toBeVisible();

    await page.screenshot({
      path: "verification/feature-013-layout.png",
      fullPage: true,
    });
  });

  test("无商品推荐时不显示推荐商品 section", async ({ page }) => {
    await page.route("**/api/diagnose", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_NO_PRODUCTS),
      });
    });

    await page.goto("/");
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles([makeTestImage("healthy.jpg")]);
    await page.click('button[aria-label="开始诊断"]');

    await expect(page.locator("text=健康植株")).toBeVisible({ timeout: 10_000 });

    // No products section
    await expect(page.locator('[data-testid="products-section"]')).toHaveCount(0);

    await page.screenshot({
      path: "verification/feature-013-no-products.png",
      fullPage: true,
    });
  });

  test("关键词超链接点击滚动到对应商品分组", async ({ page }) => {
    await page.route("**/api/diagnose", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_RESULT),
      });
    });

    await page.goto("/");
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles([makeTestImage("rice2.jpg")]);
    await page.click('button[aria-label="开始诊断"]');

    await expect(page.locator("text=水稻稻瘟病")).toBeVisible({ timeout: 10_000 });

    // Click keyword link
    const kwLink = page.locator('a[data-keyword-link="稻瘟灵"]');
    await kwLink.click();

    // The target group should be in view
    const group = page.locator('[data-testid="product-group-稻瘟灵"]');
    await expect(group).toBeVisible();

    // Verify the group is scrolled into view (y coordinate should be within viewport)
    const box = await group.boundingBox();
    expect(box).not.toBeNull();
    const viewport = page.viewportSize();
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.y).toBeLessThan(viewport!.height);
  });

  test("五个 section 都可见且布局正确", async ({ page }) => {
    await page.route("**/api/diagnose", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_RESULT),
      });
    });

    await page.goto("/");
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles([makeTestImage("rice3.jpg")]);
    await page.click('button[aria-label="开始诊断"]');

    await expect(page.locator("text=水稻稻瘟病")).toBeVisible({ timeout: 10_000 });

    // All 5 sections visible: diagnosis, conditions, symptoms, treatment, products
    const diagSection = page.locator("section").filter({ hasText: "AI 智能识别" });
    const condSection = page.locator("section").filter({ hasText: "发病条件" });
    const sympSection = page.locator("section").filter({ hasText: "症状识别" });
    const treatSection = page.locator("section").filter({ hasText: "防治方案" });
    const prodSection = page.locator('[data-testid="products-section"]');

    await expect(diagSection).toBeVisible();
    await expect(condSection).toBeVisible();
    await expect(sympSection).toBeVisible();
    await expect(treatSection).toBeVisible();
    await expect(prodSection).toBeVisible();

    // Sections appear in correct vertical order
    const diagBox = await diagSection.boundingBox();
    const condBox = await condSection.boundingBox();
    const sympBox = await sympSection.boundingBox();
    const treatBox = await treatSection.boundingBox();
    const prodBox = await prodSection.boundingBox();

    expect(diagBox!.y).toBeLessThan(condBox!.y);
    expect(condBox!.y).toBeLessThan(sympBox!.y);
    expect(sympBox!.y).toBeLessThan(treatBox!.y);
    expect(treatBox!.y).toBeLessThan(prodBox!.y);

    await page.screenshot({
      path: "verification/feature-013-sections.png",
      fullPage: true,
    });
  });
});
