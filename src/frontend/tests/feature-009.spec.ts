import { test, expect } from "@playwright/test";

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

test.describe("Feature #9 — 多图上传支持", () => {
  test("上传多张图片并显示预览", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });

    await page.goto("/");
    await expect(page.locator("h1")).toBeVisible();

    const fileInput = page.locator('input[type="file"]');

    // Upload 3 images
    await fileInput.setInputFiles([
      makeTestImage("crop1.jpg"),
      makeTestImage("crop2.jpg"),
      makeTestImage("crop3.jpg"),
    ]);

    // Should show 3 previews
    const previews = page.locator('[data-testid="image-previews"] img');
    await expect(previews).toHaveCount(3);

    // Thumbnails visible inside input box
    await expect(page.locator('[data-testid="image-previews"]')).toBeVisible();

    // Submit button should be enabled
    await expect(page.locator('button[aria-label="开始诊断"]')).toBeEnabled();

    // Screenshot
    await page.screenshot({
      path: "verification/feature-009-multi-upload.png",
      fullPage: true,
    });

    // No console errors
    expect(errors.filter((e) => !e.includes("favicon"))).toHaveLength(0);
  });

  test("逐张删除图片", async ({ page }) => {
    await page.goto("/");

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles([
      makeTestImage("a.jpg"),
      makeTestImage("b.jpg"),
    ]);

    // 2 previews
    const previews = page.locator('[data-testid="image-previews"] img');
    await expect(previews).toHaveCount(2);

    // Delete first image
    await page.locator('[aria-label="移除第1张图片"]').click();
    await expect(previews).toHaveCount(1);

    // Delete last remaining
    await page.locator('[aria-label="移除第1张图片"]').click();
    await expect(previews).toHaveCount(0);

    // No thumbnails area when empty
    await expect(page.locator('[data-testid="image-previews"]')).toHaveCount(0);
  });

  test("多图上传 → mock 诊断 → 结果展示", async ({ page }) => {
    // Mock diagnose API
    await page.route("**/api/diagnose", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            diagnosis: {
              disease_name: "水稻稻瘟病",
              confidence: 0.92,
              description: "稻瘟病由稻瘟菌引起，危害叶片和穗部。",
              pathogen: "稻瘟菌 (Magnaporthe oryzae)",
            },
            conditions: { climate: "高温高湿", variety: "感病品种", cultivation: "偏施氮肥" },
            symptoms: { initial: "褐点", typical: "梭形病斑", late: "穗颈变褐" },
            treatment: {
              agricultural: "使用抗病品种，避免偏施氮肥",
              seed_treatment: "拌种处理",
              chemical: "发病初期喷施{{三环唑}}",
              products: [],
            },
          },
        }),
      });
    });

    await page.goto("/");

    // Upload 2 images
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles([
      makeTestImage("rice1.jpg"),
      makeTestImage("rice2.jpg"),
    ]);

    // Click diagnose
    await page.click('button[aria-label="开始诊断"]');

    // Wait for result
    await expect(page.locator('text=水稻稻瘟病')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('text=92%')).toBeVisible();

    // Screenshot
    await page.screenshot({
      path: "verification/feature-009.png",
      fullPage: true,
    });
  });
});
