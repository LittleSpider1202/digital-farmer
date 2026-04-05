# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: feature-008.spec.ts >> Feature #8 — 前后端联调 + 完整流程 >> 异常：后端超时显示超时提示
- Location: tests/feature-008.spec.ts:182:7

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
  102 |     // Intervention action text
  103 |     await expect(page.locator("strong", { hasText: "三唑酮可湿性粉剂" })).toBeVisible();
  104 | 
  105 |     // Product cards
  106 |     await expect(page.locator("text=三唑酮可湿性粉剂 25%")).toBeVisible();
  107 |     await expect(page.locator("text=多菌灵 50% WP")).toBeVisible();
  108 |     await expect(page.locator("text=¥15.80")).toBeVisible();
  109 | 
  110 |     // Screenshot
  111 |     await page.screenshot({
  112 |       path: "verification/feature-008-full-flow.png",
  113 |       fullPage: true,
  114 |     });
  115 |   });
  116 | 
  117 |   test("空描述提交可正常工作", async ({ page }) => {
  118 |     let requestBody = "";
  119 |     await page.route("**/api/diagnose", async (route) => {
  120 |       requestBody = route.request().postData() ?? "";
  121 |       await route.fulfill({
  122 |         status: 200,
  123 |         contentType: "application/json",
  124 |         body: JSON.stringify(MOCK_FULL_RESULT),
  125 |       });
  126 |     });
  127 | 
  128 |     await page.goto("/");
  129 | 
  130 |     // Upload image without description
  131 |     const fileInput = page.locator('input[type="file"]');
  132 |     await fileInput.setInputFiles([makeTestImage("crop.jpg")]);
  133 | 
  134 |     // Leave description empty
  135 |     const textarea = page.locator("textarea");
  136 |     await expect(textarea).toHaveValue("");
  137 | 
  138 |     // Submit
  139 |     await page.click('button:has-text("开始诊断")');
  140 | 
  141 |     // Should succeed
  142 |     await expect(page.locator("text=小麦白粉病")).toBeVisible({
  143 |       timeout: 10_000,
  144 |     });
  145 | 
  146 |     // Verify description was not sent in the multipart body
  147 |     expect(requestBody).not.toContain('name="description"');
  148 |   });
  149 | 
  150 |   test("异常：非图片文件上传显示友好错误", async ({ page }) => {
  151 |     await page.goto("/");
  152 |     await expect(page.locator("h1")).toBeVisible();
  153 | 
  154 |     // Upload a non-image file (text file disguised)
  155 |     const fileInput = page.locator('input[type="file"]');
  156 |     await fileInput.setInputFiles({
  157 |       name: "readme.txt",
  158 |       mimeType: "text/plain",
  159 |       buffer: Buffer.from("this is not an image"),
  160 |     });
  161 | 
  162 |     // Should show error message from frontend validation
  163 |     await expect(page.locator("text=仅支持 JPG、PNG、WebP 格式")).toBeVisible();
  164 | 
  165 |     // No image preview should appear (grid exists but all slots empty)
  166 |     await expect(
  167 |       page.locator('[data-testid="image-previews"] img'),
  168 |     ).toHaveCount(0);
  169 | 
  170 |     // Submit button should be disabled (no images)
  171 |     await expect(
  172 |       page.locator('button:has-text("开始诊断")'),
  173 |     ).toBeDisabled();
  174 | 
  175 |     // Screenshot
  176 |     await page.screenshot({
  177 |       path: "verification/feature-008-invalid-file.png",
  178 |       fullPage: true,
  179 |     });
  180 |   });
  181 | 
  182 |   test("异常：后端超时显示超时提示", async ({ page }) => {
  183 |     // Simulates the backend returning a 500 with AI_TIMEOUT error_code
  184 |     // (not a frontend AbortController timeout — that path is separate)
  185 |     await page.route("**/api/diagnose", async (route) => {
  186 |       await route.fulfill({
  187 |         status: 500,
  188 |         contentType: "application/json",
  189 |         body: JSON.stringify({
  190 |           success: false,
  191 |           error_code: "AI_TIMEOUT",
  192 |           message: "AI 诊断超时，请稍后重试",
  193 |         }),
  194 |       });
  195 |     });
  196 | 
  197 |     await page.goto("/");
  198 | 
  199 |     const fileInput = page.locator('input[type="file"]');
  200 |     await fileInput.setInputFiles([makeTestImage("slow.jpg")]);
  201 | 
> 202 |     await page.click('button:has-text("开始诊断")');
      |                ^ Error: page.click: Test timeout of 30000ms exceeded.
  203 | 
  204 |     // Should show timeout error
  205 |     await expect(page.locator("text=AI 诊断超时，请稍后重试")).toBeVisible({
  206 |       timeout: 10_000,
  207 |     });
  208 | 
  209 |     // Error should be in an alert region
  210 |     await expect(
  211 |       page.locator('[role="alert"]').filter({ hasText: "超时" }),
  212 |     ).toBeVisible();
  213 | 
  214 |     // No result should be shown — check specific data-testid not just text
  215 |     await expect(page.locator('[data-testid="intervention-list"]')).toHaveCount(0);
  216 |     await expect(page.locator('[data-testid="prevention-list"]')).toHaveCount(0);
  217 | 
  218 |     // Screenshot
  219 |     await page.screenshot({
  220 |       path: "verification/feature-008-timeout.png",
  221 |       fullPage: true,
  222 |     });
  223 |   });
  224 | 
  225 |   test("异常：超过5张图片显示上限提示", async ({ page }) => {
  226 |     await page.goto("/");
  227 | 
  228 |     const fileInput = page.locator('input[type="file"]');
  229 | 
  230 |     // Upload 5 images first
  231 |     await fileInput.setInputFiles([
  232 |       makeTestImage("img1.jpg"),
  233 |       makeTestImage("img2.jpg"),
  234 |       makeTestImage("img3.jpg"),
  235 |       makeTestImage("img4.jpg"),
  236 |       makeTestImage("img5.jpg"),
  237 |     ]);
  238 | 
  239 |     await expect(
  240 |       page.locator('[data-testid="image-previews"] img'),
  241 |     ).toHaveCount(5);
  242 | 
  243 |     // Upload zone should be hidden when at max
  244 |     await expect(page.locator("text=继续添加")).toHaveCount(0);
  245 | 
  246 |     // Try to add one more via file input (force set)
  247 |     await fileInput.setInputFiles([makeTestImage("img6.jpg")]);
  248 | 
  249 |     // Should show limit error
  250 |     await expect(page.locator("text=最多上传 5 张图片")).toBeVisible();
  251 | 
  252 |     // Still only 5 previews
  253 |     await expect(
  254 |       page.locator('[data-testid="image-previews"] img'),
  255 |     ).toHaveCount(5);
  256 |   });
  257 | 
  258 |   test("异常：后端返回 400 错误显示错误信息", async ({ page }) => {
  259 |     await page.route("**/api/diagnose", async (route) => {
  260 |       await route.fulfill({
  261 |         status: 400,
  262 |         contentType: "application/json",
  263 |         body: JSON.stringify({
  264 |           success: false,
  265 |           error_code: "INVALID_IMAGE_FORMAT",
  266 |           message: "第1张图片格式不支持，仅支持 jpg/png/webp",
  267 |         }),
  268 |       });
  269 |     });
  270 | 
  271 |     await page.goto("/");
  272 | 
  273 |     const fileInput = page.locator('input[type="file"]');
  274 |     await fileInput.setInputFiles([makeTestImage("bad.jpg")]);
  275 | 
  276 |     await page.click('button:has-text("开始诊断")');
  277 | 
  278 |     // Should show backend error
  279 |     await expect(
  280 |       page.locator("text=第1张图片格式不支持，仅支持 jpg/png/webp"),
  281 |     ).toBeVisible({ timeout: 10_000 });
  282 | 
  283 |     await expect(
  284 |       page.locator('[role="alert"]').filter({ hasText: "格式不支持" }),
  285 |     ).toBeVisible();
  286 |   });
  287 | });
  288 | 
```