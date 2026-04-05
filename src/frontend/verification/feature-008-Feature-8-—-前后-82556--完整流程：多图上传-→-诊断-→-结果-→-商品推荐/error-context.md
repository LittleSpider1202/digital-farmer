# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: feature-008.spec.ts >> Feature #8 — 前后端联调 + 完整流程 >> 完整流程：多图上传 → 诊断 → 结果 → 商品推荐
- Location: tests/feature-008.spec.ts:57:7

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
- generic [ref=e1]:
  - main [ref=e2]:
    - generic [ref=e3]:
      - generic [ref=e4]:
        - heading "AI 农作物病害诊断" [level=1] [ref=e5]
        - paragraph [ref=e6]: 上传病害图片，AI 为你诊断并推荐方案
      - generic [ref=e7]:
        - generic [ref=e8]:
          - generic [ref=e9]:
            - img "预览 1" [ref=e10]
            - button "移除第1张图片" [ref=e11] [cursor=pointer]: ✕
          - generic [ref=e12]:
            - img "预览 2" [ref=e13]
            - button "移除第2张图片" [ref=e14] [cursor=pointer]: ✕
        - generic [ref=e15]:
          - button "添加图片" [ref=e16] [cursor=pointer]:
            - img [ref=e17]
          - textbox "描述症状（可选）…" [active] [ref=e19]: 叶子上有白色粉末状物质
          - button "开始诊断" [ref=e20] [cursor=pointer]:
            - img [ref=e21]
        - paragraph [ref=e24]: 2/5 张 · JPG/PNG/WebP · 单张≤10MB
  - button "Open Next.js Dev Tools" [ref=e31] [cursor=pointer]:
    - img [ref=e32]
  - alert [ref=e35]
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
  18  | /** Mock diagnose API returning a full result with products. */
  19  | const MOCK_FULL_RESULT = {
  20  |   success: true,
  21  |   data: {
  22  |     diagnosis: {
  23  |       disease_name: "小麦白粉病",
  24  |       confidence: 0.85,
  25  |       description: "白粉病是由真菌引起的常见小麦病害，主要危害叶片。",
  26  |     },
  27  |     prevention: ["选择抗病品种", "合理密植，保持通风", "适当控制氮肥用量"],
  28  |     intervention: [
  29  |       {
  30  |         action: "喷施{{三唑酮可湿性粉剂}}",
  31  |         details:
  32  |           "每亩用量50-75克，兑水30公斤喷雾，也可配合{{多菌灵}}交替使用",
  33  |         products: [
  34  |           {
  35  |             keyword: "三唑酮可湿性粉剂",
  36  |             name: "三唑酮可湿性粉剂 25%",
  37  |             image_url: "https://example.com/product1.jpg",
  38  |             price: 15.8,
  39  |             sales: 2340,
  40  |             buy_url: "https://example.com/buy/1",
  41  |           },
  42  |           {
  43  |             keyword: "多菌灵",
  44  |             name: "多菌灵 50% WP",
  45  |             image_url: "https://example.com/product2.jpg",
  46  |             price: 12.5,
  47  |             sales: 1890,
  48  |             buy_url: "https://example.com/buy/2",
  49  |           },
  50  |         ],
  51  |       },
  52  |     ],
  53  |   },
  54  | };
  55  | 
  56  | test.describe("Feature #8 — 前后端联调 + 完整流程", () => {
  57  |   test("完整流程：多图上传 → 诊断 → 结果 → 商品推荐", async ({ page }) => {
  58  |     // Mock API
  59  |     await page.route("**/api/diagnose", async (route) => {
  60  |       await route.fulfill({
  61  |         status: 200,
  62  |         contentType: "application/json",
  63  |         body: JSON.stringify(MOCK_FULL_RESULT),
  64  |       });
  65  |     });
  66  | 
  67  |     await page.goto("/");
  68  |     await expect(page.locator("h1")).toBeVisible();
  69  | 
  70  |     // Upload 2 images
  71  |     const fileInput = page.locator('input[type="file"]');
  72  |     await fileInput.setInputFiles([
  73  |       makeTestImage("wheat1.jpg"),
  74  |       makeTestImage("wheat2.jpg"),
  75  |     ]);
  76  |     await expect(
  77  |       page.locator('[data-testid="image-previews"] img'),
  78  |     ).toHaveCount(2);
  79  | 
  80  |     // Enter description
  81  |     await page.fill("textarea", "叶子上有白色粉末状物质");
  82  | 
  83  |     // Submit
> 84  |     await page.click('button:has-text("开始诊断")');
      |                ^ Error: page.click: Test timeout of 30000ms exceeded.
  85  | 
  86  |     // Loading state
  87  |     await expect(page.locator('text=诊断中...')).toBeVisible();
  88  | 
  89  |     // Wait for result
  90  |     await expect(page.locator("text=小麦白粉病")).toBeVisible({
  91  |       timeout: 10_000,
  92  |     });
  93  | 
  94  |     // Diagnosis details
  95  |     await expect(page.locator("text=85%")).toBeVisible();
  96  |     await expect(page.locator("text=白粉病是由真菌引起")).toBeVisible();
  97  | 
  98  |     // Prevention list
  99  |     await expect(page.locator("text=选择抗病品种")).toBeVisible();
  100 |     await expect(page.locator("text=合理密植，保持通风")).toBeVisible();
  101 | 
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
```