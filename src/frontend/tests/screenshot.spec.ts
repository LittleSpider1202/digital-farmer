import { test } from "@playwright/test";

const JPEG_BYTES = Buffer.from(
  "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoH" +
    "BwYIDAoMCwsKCwsKDA4PDAsMDgsKCw0PDg0MEhATExILEBkSEhAQEf/2wBDAQME" +
    "BAUEBQkGBgkRCwsLERERERERERERERERERERERERERERERERERERERERERERERER" +
    "ERERERERERERERERERET/wAARCAABAAEDAREAAhEBAxEB/8QAFAABAAAAAAAAAAAA" +
    "AAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/xAAUAQEAAAAAAAAAAAAAAAAA" +
    "AAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AKwA//9k=",
  "base64",
);

test("screenshot empty", async ({ page }) => {
  await page.goto("/");
  await page.waitForTimeout(500);
  await page.screenshot({ path: "verification/debug-empty.png", fullPage: true });
});

test("screenshot with image", async ({ page }) => {
  await page.goto("/");
  await page.waitForTimeout(500);
  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles({ name: "test.jpg", mimeType: "image/jpeg", buffer: JPEG_BYTES });
  await page.waitForTimeout(500);
  await page.screenshot({ path: "verification/debug-with-image.png", fullPage: true });
});
