# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: feature-010.spec.ts >> Feature #10 — UI 视觉优化 >> 固定5坑位网格：空状态显示虚线边框+相机图标
- Location: tests/feature-010.spec.ts:57:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('[data-testid="image-previews"]')
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for locator('[data-testid="image-previews"]')

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - main [ref=e2]:
    - generic [ref=e3]:
      - generic [ref=e4]:
        - heading "AI 农作物病害诊断" [level=1] [ref=e5]
        - paragraph [ref=e6]: 上传病害图片，AI 为你诊断并推荐方案
      - generic [ref=e8]:
        - button "添加图片" [ref=e9] [cursor=pointer]:
          - img [ref=e10]
        - textbox "先添加图片，再描述症状…" [ref=e12]
        - button "开始诊断" [disabled] [ref=e13]:
          - img [ref=e14]
  - button "Open Next.js Dev Tools" [ref=e22] [cursor=pointer]:
    - img [ref=e23]
  - alert [ref=e26]
```

# Test source

```ts
  1   | import { test, expect } from "@playwright/test";
  2   | 
  3   | /** Minimal valid JPEG for file input. */
  4   | const JPEG_BYTES = Buffer.from(
  5   |   "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoH" +
  6   |     "BwYIDAoMCwsKCwsKDA4PDAsMDgsKCw0PDg0MEhATExILEBkSEhAQEf/2wBDAQME" +
  7   |     "BAUEBQkGBgkRCwsLERERERERERERERERERERERERERERERERERERERERERERERER" +
  8   |     "ERERERERERERERERERET/wAARCAABAAEDAREAAhEBAxEB/8QAFAABAAAAAAAAAAAA" +
  9   |     "AAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/xAAUAQEAAAAAAAAAAAAAAAAA" +
  10  |     "AAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AKwA//9k=",
  11  |   "base64",
  12  | );
  13  | 
  14  | function makeTestImage(name: string) {
  15  |   return { name, mimeType: "image/jpeg", buffer: JPEG_BYTES };
  16  | }
  17  | 
  18  | /** Mock diagnose API with {{keyword}} patterns in details and product image URLs */
  19  | const MOCK_RESULT = {
  20  |   success: true,
  21  |   data: {
  22  |     diagnosis: {
  23  |       disease_name: "番茄晚疫病",
  24  |       confidence: 0.92,
  25  |       description: "晚疫病是由疫霉菌引起的真菌性病害，主要危害番茄叶片和果实。",
  26  |     },
  27  |     prevention: ["选择抗病品种", "避免连作", "控制田间湿度"],
  28  |     intervention: [
  29  |       {
  30  |         action: "喷施{{代森锰锌}}",
  31  |         details:
  32  |           "每亩用量100克，兑水40公斤喷雾，发病初期配合{{甲霜灵}}交替使用效果更佳",
  33  |         products: [
  34  |           {
  35  |             keyword: "代森锰锌",
  36  |             name: "代森锰锌 80% WP",
  37  |             image_url: "https://example.com/product-dsmz.jpg",
  38  |             price: 18.5,
  39  |             sales: 3200,
  40  |             buy_url: "https://example.com/buy/dsmz",
  41  |           },
  42  |           {
  43  |             keyword: "甲霜灵",
  44  |             name: "甲霜灵 25% WP",
  45  |             image_url: "https://invalid-url-to-trigger-fallback.test/broken.jpg",
  46  |             price: 22.0,
  47  |             sales: 1560,
  48  |             buy_url: "https://example.com/buy/jsl",
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
> 63  |     await expect(grid).toBeVisible();
      |                        ^ Error: expect(locator).toBeVisible() failed
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
  149 |     await page.click('button:has-text("开始诊断")');
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
```