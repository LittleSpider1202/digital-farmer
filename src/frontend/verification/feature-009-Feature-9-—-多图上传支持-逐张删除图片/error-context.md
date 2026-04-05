# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: feature-009.spec.ts >> Feature #9 — 多图上传支持 >> 逐张删除图片
- Location: tests/feature-009.spec.ts:57:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('text=点击拍照或上传')
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for locator('text=点击拍照或上传')

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
  3   | const JPEG_BYTES = Buffer.from(
  4   |   "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoH" +
  5   |     "BwYIDAoMCwsKCwsKDA4PDAsMDgsKCw0PDg0MEhATExILEBkSEhAQEf/2wBDAQME" +
  6   |     "BAUEBQkGBgkRCwsLERERERERERERERERERERERERERERERERERERERERERERERER" +
  7   |     "ERERERERERERERERERET/wAARCAABAAEDAREAAhEBAxEB/8QAFAABAAAAAAAAAAAA" +
  8   |     "AAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/xAAUAQEAAAAAAAAAAAAAAAAA" +
  9   |     "AAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AKwA//9k=",
  10  |   "base64",
  11  | );
  12  | 
  13  | function makeTestImage(name: string) {
  14  |   return { name, mimeType: "image/jpeg", buffer: JPEG_BYTES };
  15  | }
  16  | 
  17  | test.describe("Feature #9 — 多图上传支持", () => {
  18  |   test("上传多张图片并显示预览", async ({ page }) => {
  19  |     const errors: string[] = [];
  20  |     page.on("console", (msg) => {
  21  |       if (msg.type() === "error") errors.push(msg.text());
  22  |     });
  23  | 
  24  |     await page.goto("/");
  25  |     await expect(page.locator("h1")).toBeVisible();
  26  | 
  27  |     const fileInput = page.locator('input[type="file"]');
  28  | 
  29  |     // Upload 3 images
  30  |     await fileInput.setInputFiles([
  31  |       makeTestImage("crop1.jpg"),
  32  |       makeTestImage("crop2.jpg"),
  33  |       makeTestImage("crop3.jpg"),
  34  |     ]);
  35  | 
  36  |     // Should show 3 previews
  37  |     const previews = page.locator('[data-testid="image-previews"] img');
  38  |     await expect(previews).toHaveCount(3);
  39  | 
  40  |     // Grid always has 5 slots — 2 remaining empty slots have dashed borders
  41  |     const grid = page.locator('[data-testid="image-previews"]');
  42  |     await expect(grid.locator("div.border-dashed")).toHaveCount(2);
  43  | 
  44  |     // Submit button should be enabled
  45  |     await expect(page.locator('button:has-text("开始诊断")')).toBeEnabled();
  46  | 
  47  |     // Screenshot
  48  |     await page.screenshot({
  49  |       path: "verification/feature-009-multi-upload.png",
  50  |       fullPage: true,
  51  |     });
  52  | 
  53  |     // No console errors
  54  |     expect(errors.filter((e) => !e.includes("favicon"))).toHaveLength(0);
  55  |   });
  56  | 
  57  |   test("逐张删除图片", async ({ page }) => {
  58  |     await page.goto("/");
  59  | 
  60  |     const fileInput = page.locator('input[type="file"]');
  61  |     await fileInput.setInputFiles([
  62  |       makeTestImage("a.jpg"),
  63  |       makeTestImage("b.jpg"),
  64  |     ]);
  65  | 
  66  |     // 2 previews
  67  |     const previews = page.locator('[data-testid="image-previews"] img');
  68  |     await expect(previews).toHaveCount(2);
  69  | 
  70  |     // Delete first image
  71  |     await page.locator('[aria-label="移除第1张图片"]').click();
  72  |     await expect(previews).toHaveCount(1);
  73  | 
  74  |     // Delete last remaining
  75  |     await page.locator('[aria-label="移除第1张图片"]').click();
  76  |     await expect(previews).toHaveCount(0);
  77  | 
  78  |     // All slots now empty — main slot shows upload prompt
> 79  |     await expect(page.locator('text=点击拍照或上传')).toBeVisible();
      |                                                ^ Error: expect(locator).toBeVisible() failed
  80  |   });
  81  | 
  82  |   test("多图上传 → mock 诊断 → 结果展示", async ({ page }) => {
  83  |     // Mock diagnose API
  84  |     await page.route("**/api/diagnose", async (route) => {
  85  |       await route.fulfill({
  86  |         status: 200,
  87  |         contentType: "application/json",
  88  |         body: JSON.stringify({
  89  |           success: true,
  90  |           data: {
  91  |             diagnosis: {
  92  |               disease_name: "水稻稻瘟病",
  93  |               confidence: 0.92,
  94  |               description: "稻瘟病由稻瘟菌引起，危害叶片和穗部。",
  95  |             },
  96  |             prevention: ["使用抗病品种", "避免偏施氮肥"],
  97  |             intervention: [
  98  |               {
  99  |                 action: "喷施{{三环唑}}",
  100 |                 details: "发病初期喷施",
  101 |                 products: [],
  102 |               },
  103 |             ],
  104 |           },
  105 |         }),
  106 |       });
  107 |     });
  108 | 
  109 |     await page.goto("/");
  110 | 
  111 |     // Upload 2 images
  112 |     const fileInput = page.locator('input[type="file"]');
  113 |     await fileInput.setInputFiles([
  114 |       makeTestImage("rice1.jpg"),
  115 |       makeTestImage("rice2.jpg"),
  116 |     ]);
  117 | 
  118 |     // Click diagnose
  119 |     await page.click('button:has-text("开始诊断")');
  120 | 
  121 |     // Wait for result
  122 |     await expect(page.locator('text=水稻稻瘟病')).toBeVisible({ timeout: 10_000 });
  123 |     await expect(page.locator('text=92%')).toBeVisible();
  124 | 
  125 |     // Screenshot
  126 |     await page.screenshot({
  127 |       path: "verification/feature-009.png",
  128 |       fullPage: true,
  129 |     });
  130 |   });
  131 | });
  132 | 
```