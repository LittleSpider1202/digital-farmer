# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: feature-007.spec.ts >> Feature #7 — 商品推荐卡片 >> 首页加载无报错，UI 结构完��
- Location: tests/feature-007.spec.ts:4:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('button:has-text("开始诊断")')
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
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
  3   | test.describe("Feature #7 — 商品推荐卡片", () => {
  4   |   test("首页加载无报错，UI 结构完��", async ({ page }) => {
  5   |     const errors: string[] = [];
  6   |     page.on("console", (msg) => {
  7   |       if (msg.type() === "error") errors.push(msg.text());
  8   |     });
  9   | 
  10  |     await page.goto("/");
  11  | 
  12  |     // Page loads without crash
  13  |     await expect(page.locator("h1")).toBeVisible();
> 14  |     await expect(page.locator('button:has-text("开始诊断")')).toBeVisible();
      |                                                           ^ Error: expect(locator).toBeVisible() failed
  15  | 
  16  |     // Upload a test image to enable the button
  17  |     const fileInput = page.locator('input[type="file"]');
  18  |     const jpegBytes = Buffer.from(
  19  |       "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoH" +
  20  |         "BwYIDAoMCwsKCwsKDA4PDAsMDgsKCw0PDg0MEhATExILEBkSEhAQEf/2wBDAQME" +
  21  |         "BAUEBQkGBgkRCwsLERERERERERERERERERERERERERERERERERERERERERERERER" +
  22  |         "ERERERERERERERERERET/wAARCAABAAEDAREAAhEBAxEB/8QAFAABAAAAAAAAAAAA" +
  23  |         "AAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/xAAUAQEAAAAAAAAAAAAAAAAA" +
  24  |         "AAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AKwA//9k=",
  25  |       "base64",
  26  |     );
  27  |     await fileInput.setInputFiles({
  28  |       name: "test-crop.jpg",
  29  |       mimeType: "image/jpeg",
  30  |       buffer: jpegBytes,
  31  |     });
  32  | 
  33  |     // Image preview should appear
  34  |     const preview = page.locator('img[alt*="预览"], img[alt*="preview"], img[alt*="上传"]');
  35  |     // The button should now be enabled
  36  |     const submitBtn = page.locator('button:has-text("开始诊断")');
  37  |     await expect(submitBtn).toBeEnabled();
  38  | 
  39  |     // Take screenshot of the page ready to diagnose
  40  |     await page.screenshot({
  41  |       path: "verification/feature-007-ready.png",
  42  |       fullPage: true,
  43  |     });
  44  | 
  45  |     // No console errors
  46  |     expect(errors.filter((e) => !e.includes("favicon"))).toHaveLength(0);
  47  |   });
  48  | 
  49  |   test("使用 mock 数据验证商品卡片��染", async ({ page }) => {
  50  |     // Intercept the diagnose API and return mock data with products
  51  |     await page.route("**/api/diagnose", async (route) => {
  52  |       await route.fulfill({
  53  |         status: 200,
  54  |         contentType: "application/json",
  55  |         body: JSON.stringify({
  56  |           success: true,
  57  |           data: {
  58  |             diagnosis: {
  59  |               disease_name: "小麦白粉病",
  60  |               confidence: 0.85,
  61  |               description: "白粉病是由真菌引起的常见小麦病害。",
  62  |             },
  63  |             prevention: ["选择抗病品种", "合理密植"],
  64  |             intervention: [
  65  |               {
  66  |                 action: "喷施三唑酮",
  67  |                 details: "每亩用量50-75克",
  68  |                 products: [
  69  |                   {
  70  |                     keyword: "三唑��",
  71  |                     name: "三唑酮可湿性粉剂 25%",
  72  |                     image_url: "https://placehold.co/112x112?text=三唑酮",
  73  |                     price: 15.8,
  74  |                     sales: 2340,
  75  |                     buy_url: "https://example.com/buy/1",
  76  |                   },
  77  |                   {
  78  |                     keyword: "多菌灵",
  79  |                     name: "多菌灵 50% WP",
  80  |                     image_url: "https://placehold.co/112x112?text=多菌灵",
  81  |                     price: 12.5,
  82  |                     sales: 1890,
  83  |                     buy_url: "https://example.com/buy/2",
  84  |                   },
  85  |                 ],
  86  |               },
  87  |               {
  88  |                 action: "清除病残体",
  89  |                 details: "及时收集并销毁田间病叶",
  90  |                 products: [],
  91  |               },
  92  |             ],
  93  |           },
  94  |         }),
  95  |       });
  96  |     });
  97  | 
  98  |     await page.goto("/");
  99  | 
  100 |     // Upload image
  101 |     const fileInput = page.locator('input[type="file"]');
  102 |     const jpegBytes = Buffer.from(
  103 |       "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoH" +
  104 |         "BwYIDAoMCwsKCwsKDA4PDAsMDgsKCw0PDg0MEhATExILEBkSEhAQEf/2wBDAQME" +
  105 |         "BAUEBQkGBgkRCwsLERERERERERERERERERERERERERERERERERERERERERERERER" +
  106 |         "ERERERERERERERERERET/wAARCAABAAEDAREAAhEBAxEB/8QAFAABAAAAAAAAAAAA" +
  107 |         "AAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/xAAUAQEAAAAAAAAAAAAAAAAA" +
  108 |         "AAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AKwA//9k=",
  109 |       "base64",
  110 |     );
  111 |     await fileInput.setInputFiles({
  112 |       name: "test-crop.jpg",
  113 |       mimeType: "image/jpeg",
  114 |       buffer: jpegBytes,
```