# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: feature-010.spec.ts >> Feature #10 — UI 视觉优化 >> 移动端 320px 布局不溢出
- Location: tests/feature-010.spec.ts:267:7

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: page.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for locator('button:has-text("开始诊断")')

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - main [ref=e2]:
    - generic [ref=e3]:
      - generic [ref=e4]:
        - heading "AI 农作物病害诊断" [level=1] [ref=e5]
        - paragraph [ref=e6]: 上传病害图片，AI 为你诊断并推荐方案
      - generic [ref=e7]:
        - generic [ref=e9]:
          - img "预览 1" [ref=e10]
          - button "移除第1张图片" [ref=e11] [cursor=pointer]: ✕
        - generic [ref=e12]:
          - button "添加图片" [ref=e13] [cursor=pointer]:
            - img [ref=e14]
          - textbox "描述症状（可选）…" [ref=e16]
          - button "开始诊断" [ref=e17] [cursor=pointer]:
            - img [ref=e18]
        - paragraph [ref=e21]: 1/5 张 · JPG/PNG/WebP · 单张≤10MB
  - button "Open Next.js Dev Tools" [ref=e28] [cursor=pointer]:
    - img [ref=e29]
  - alert [ref=e32]
```

# Test source

```ts
  182 | 
  183 |     // Product card shows "购买" button
  184 |     await expect(page.locator("span", { hasText: "购买" }).first()).toBeVisible();
  185 | 
  186 |     await page.screenshot({
  187 |       path: "verification/feature-010-diagnosis-result.png",
  188 |       fullPage: true,
  189 |     });
  190 |   });
  191 | 
  192 |   test("商品图片加载失败显示占位图", async ({ page }) => {
  193 |     await page.route("**/api/diagnose", async (route) => {
  194 |       await route.fulfill({
  195 |         status: 200,
  196 |         contentType: "application/json",
  197 |         body: JSON.stringify(MOCK_RESULT),
  198 |       });
  199 |     });
  200 | 
  201 |     // Block image requests to trigger fallback
  202 |     await page.route("**/product-dsmz.jpg", (route) => route.abort());
  203 |     await page.route("**/broken.jpg", (route) => route.abort());
  204 | 
  205 |     await page.goto("/");
  206 |     const fileInput = page.locator('input[type="file"]');
  207 |     await fileInput.setInputFiles([makeTestImage("tomato.jpg")]);
  208 |     await page.click('button:has-text("开始诊断")');
  209 | 
  210 |     await expect(page.locator("text=番茄晚疫病")).toBeVisible({ timeout: 10_000 });
  211 | 
  212 |     // At least one placeholder should appear (broken image URL product)
  213 |     await expect(
  214 |       page.locator('[data-testid="product-image-placeholder"]'),
  215 |     ).toHaveCount(2, { timeout: 5_000 });
  216 | 
  217 |     await page.screenshot({
  218 |       path: "verification/feature-010-placeholder.png",
  219 |       fullPage: true,
  220 |     });
  221 |   });
  222 | 
  223 |   test("错误提示可关闭：有图标 + 边框 + 关闭按钮", async ({ page }) => {
  224 |     await page.route("**/api/diagnose", async (route) => {
  225 |       await route.fulfill({
  226 |         status: 500,
  227 |         contentType: "application/json",
  228 |         body: JSON.stringify({
  229 |           success: false,
  230 |           error_code: "INTERNAL_ERROR",
  231 |           message: "服务器内部错误",
  232 |         }),
  233 |       });
  234 |     });
  235 | 
  236 |     await page.goto("/");
  237 |     const fileInput = page.locator('input[type="file"]');
  238 |     await fileInput.setInputFiles([makeTestImage("err.jpg")]);
  239 |     await page.click('button:has-text("开始诊断")');
  240 | 
  241 |     // Error alert should appear (use filter to avoid Next.js route announcer)
  242 |     const alert = page.locator('[role="alert"]').filter({ hasText: "服务器内部错误" });
  243 |     await expect(alert).toBeVisible({ timeout: 10_000 });
  244 | 
  245 |     // Alert has an SVG warning icon
  246 |     await expect(alert.locator("svg")).toHaveCount(1);
  247 | 
  248 |     // Close button exists
  249 |     const closeBtn = page.locator('[data-testid="error-close-btn"]');
  250 |     await expect(closeBtn).toBeVisible();
  251 | 
  252 |     // After error, submit button should be enabled again (not stuck loading)
  253 |     await expect(page.locator('button:has-text("开始诊断")')).toBeEnabled();
  254 | 
  255 |     // Click close
  256 |     await closeBtn.click();
  257 | 
  258 |     // Alert should disappear
  259 |     await expect(alert).toHaveCount(0);
  260 | 
  261 |     await page.screenshot({
  262 |       path: "verification/feature-010-error-dismiss.png",
  263 |       fullPage: true,
  264 |     });
  265 |   });
  266 | 
  267 |   test("移动端 320px 布局不溢出", async ({ page }) => {
  268 |     await page.setViewportSize({ width: 320, height: 568 });
  269 | 
  270 |     await page.route("**/api/diagnose", async (route) => {
  271 |       await route.fulfill({
  272 |         status: 200,
  273 |         contentType: "application/json",
  274 |         body: JSON.stringify(MOCK_RESULT),
  275 |       });
  276 |     });
  277 | 
  278 |     await page.goto("/");
  279 | 
  280 |     const fileInput = page.locator('input[type="file"]');
  281 |     await fileInput.setInputFiles([makeTestImage("mobile.jpg")]);
> 282 |     await page.click('button:has-text("开始诊断")');
      |                ^ Error: page.click: Test timeout of 30000ms exceeded.
  283 | 
  284 |     await expect(page.locator("text=番茄晚疫病")).toBeVisible({ timeout: 10_000 });
  285 | 
  286 |     // Check no horizontal overflow
  287 |     const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
  288 |     expect(bodyWidth).toBeLessThanOrEqual(320);
  289 | 
  290 |     await page.screenshot({
  291 |       path: "verification/feature-010-mobile.png",
  292 |       fullPage: true,
  293 |     });
  294 |   });
  295 | });
  296 | 
```