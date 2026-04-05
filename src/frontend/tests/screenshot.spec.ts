import { test } from "@playwright/test";

test("screenshot homepage", async ({ page }) => {
  await page.goto("/");
  await page.waitForTimeout(1000);
  await page.screenshot({ path: "verification/debug-homepage.png", fullPage: true });
});
