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

test("record submit flash", async ({ page, context }) => {
  // Start video recording
  await context.tracing.start({ screenshots: true, snapshots: true });

  await page.goto("/");
  await page.waitForTimeout(1000);

  // Upload image
  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles({ name: "test.jpg", mimeType: "image/jpeg", buffer: JPEG_BYTES });
  await page.waitForTimeout(500);

  // Screenshot before click
  await page.screenshot({ path: "verification/debug-before-submit.png" });

  // Click submit
  await page.locator('button[aria-label="开始诊断"]').click();

  // Take rapid screenshots to catch the flash
  for (let i = 0; i < 10; i++) {
    await page.waitForTimeout(50);
    await page.screenshot({ path: `verification/debug-flash-${i}.png` });
  }

  // Wait for response
  await page.waitForTimeout(2000);
  await page.screenshot({ path: "verification/debug-after-submit.png" });

  // Save trace
  await context.tracing.stop({ path: "verification/debug-trace.zip" });
});
