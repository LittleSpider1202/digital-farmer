# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: feature-010.spec.ts >> Feature #10 — UI 视觉优化 >> 诊断结果卡片层次 + 置信度进度条 + 关键词锚点
- Location: tests/feature-010.spec.ts:135:7

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
  49  |           },
  50  |         ],
  51  |       },
  52  |     ],
  53  |   },
  54  | };
  55  | 
  56  | test.describe("Feature #10 — UI 视觉优化", () => {
  57  |   test("固定5坑位网格：空状态显示虚线边框+相机图标", async ({ page }) => {
  58  |     await page.goto("/");
  59  |     await expect(page.locator("h1")).toBeVisible();
  60  | 
  61  |     // Fixed 5-slot grid always visible
  62  |     const grid = page.locator('[data-testid="image-previews"]');
  63  |     await expect(grid).toBeVisible();
  64  |     // 5 children: 1 main slot (col-span-2 row-span-2) + 4 small
  65  |     await expect(grid.locator("> div")).toHaveCount(5);
  66  | 
  67  |     // Main slot has camera icon
  68  |     const cameraPath = grid.locator('svg path[d*="6.827"]');
  69  |     await expect(cameraPath).toHaveCount(1);
  70  | 
  71  |     // All empty slots have dashed borders
  72  |     const dashedSlots = grid.locator("div.border-dashed");
  73  |     await expect(dashedSlots).toHaveCount(5);
  74  | 
  75  |     await page.screenshot({
  76  |       path: "verification/feature-010-empty-state.png",
  77  |       fullPage: true,
  78  |     });
  79  |   });
  80  | 
  81  |   test("5张图填满坑位，无空坑", async ({ page }) => {
  82  |     await page.goto("/");
  83  | 
  84  |     const fileInput = page.locator('input[type="file"]');
  85  |     await fileInput.setInputFiles([
  86  |       makeTestImage("img1.jpg"),
  87  |       makeTestImage("img2.jpg"),
  88  |       makeTestImage("img3.jpg"),
  89  |       makeTestImage("img4.jpg"),
  90  |       makeTestImage("img5.jpg"),
  91  |     ]);
  92  | 
  93  |     const grid = page.locator('[data-testid="image-previews"]');
  94  |     await expect(grid).toBeVisible();
  95  |     await expect(grid.locator("img")).toHaveCount(5);
  96  | 
  97  |     // No empty dashed slots remain
  98  |     await expect(grid.locator("div.border-dashed")).toHaveCount(0);
  99  | 
  100 |     // Delete buttons should be ≥32px
  101 |     const deleteBtn = grid.locator('button[aria-label*="移除"]').first();
  102 |     const box = await deleteBtn.boundingBox();
  103 |     expect(box).toBeTruthy();
  104 |     expect(box!.width).toBeGreaterThanOrEqual(32);
  105 |     expect(box!.height).toBeGreaterThanOrEqual(32);
  106 | 
  107 |     // First image has "主图" label
  108 |     await expect(page.locator("text=主图")).toBeVisible();
  109 | 
  110 |     await page.screenshot({
  111 |       path: "verification/feature-010-multi-grid.png",
  112 |       fullPage: true,
  113 |     });
  114 |   });
  115 | 
  116 |   test("单张图填入主坑位，其余坑位保持空", async ({ page }) => {
  117 |     await page.goto("/");
  118 | 
  119 |     const fileInput = page.locator('input[type="file"]');
  120 |     await fileInput.setInputFiles([makeTestImage("single.jpg")]);
  121 | 
  122 |     const grid = page.locator('[data-testid="image-previews"]');
  123 |     await expect(grid).toBeVisible();
  124 |     await expect(grid.locator("img")).toHaveCount(1);
  125 | 
  126 |     // 4 empty dashed slots remain
  127 |     await expect(grid.locator("div.border-dashed")).toHaveCount(4);
  128 | 
  129 |     await page.screenshot({
  130 |       path: "verification/feature-010-single-image.png",
  131 |       fullPage: true,
  132 |     });
  133 |   });
  134 | 
  135 |   test("诊断结果卡片层次 + 置信度进度条 + 关键词锚点", async ({ page }) => {
  136 |     await page.route("**/api/diagnose", async (route) => {
  137 |       await route.fulfill({
  138 |         status: 200,
  139 |         contentType: "application/json",
  140 |         body: JSON.stringify(MOCK_RESULT),
  141 |       });
  142 |     });
  143 | 
  144 |     await page.goto("/");
  145 | 
  146 |     // Upload and submit
  147 |     const fileInput = page.locator('input[type="file"]');
  148 |     await fileInput.setInputFiles([makeTestImage("tomato.jpg")]);
> 149 |     await page.click('button:has-text("开始诊断")');
      |                ^ Error: page.click: Test timeout of 30000ms exceeded.
  150 | 
  151 |     // Wait for result
  152 |     await expect(page.locator("text=番茄晚疫病")).toBeVisible({ timeout: 10_000 });
  153 | 
  154 |     // Confidence progress bar
  155 |     const confBar = page.locator('[data-testid="confidence-bar"]');
  156 |     await expect(confBar).toBeVisible();
  157 | 
  158 |     // Diagnosis card has green left border (border-l-4 border-green-600)
  159 |     const diagnosisCard = page.locator("section").filter({ hasText: "AI 智能识别" });
  160 |     await expect(diagnosisCard).toBeVisible();
  161 | 
  162 |     // Prevention card has blue left border
  163 |     const preventionCard = page.locator("section").filter({ hasText: "预防措施" });
  164 |     await expect(preventionCard).toBeVisible();
  165 | 
  166 |     // Intervention card has orange left border
  167 |     const interventionCard = page.locator("section").filter({ hasText: "干预措施" });
  168 |     await expect(interventionCard).toBeVisible();
  169 | 
  170 |     // {{关键词}} rendered as clickable links
  171 |     const kwLink = page.locator('a[data-keyword-link="代森锰锌"]');
  172 |     await expect(kwLink).toBeVisible();
  173 |     await expect(kwLink).toHaveText("代森锰锌");
  174 | 
  175 |     const kwLink2 = page.locator('a[data-keyword-link="甲霜灵"]');
  176 |     await expect(kwLink2).toBeVisible();
  177 | 
  178 |     // Product card has anchor id for scroll target (keyword is URI-encoded)
  179 |     const encodedId = `product-${encodeURIComponent("代森锰锌")}`;
  180 |     const productAnchor = page.locator(`[id="${encodedId}"]`);
  181 |     await expect(productAnchor).toBeVisible();
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
```