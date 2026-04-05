# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: feature-007.spec.ts >> Feature #7 — 商品推荐卡片 >> 使用 mock 数据验证商品卡片��染
- Location: tests/feature-007.spec.ts:49:7

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
  115 |     });
  116 | 
  117 |     // Click diagnose
> 118 |     await page.click('button:has-text("开始诊断")');
      |                ^ Error: page.click: Test timeout of 30000ms exceeded.
  119 | 
  120 |     // Wait for result
  121 |     await page.waitForSelector('[data-testid="intervention-list"]', {
  122 |       timeout: 10_000,
  123 |     });
  124 | 
  125 |     // Verify product cards rendered
  126 |     const productList = page.locator('[data-testid="product-list"]');
  127 |     await expect(productList).toBeVisible();
  128 | 
  129 |     // First intervention has 2 product cards
  130 |     const cards = productList.first().locator("a");
  131 |     await expect(cards).toHaveCount(2);
  132 | 
  133 |     // Card 1: check name, price, link
  134 |     const firstCard = cards.first();
  135 |     await expect(firstCard).toContainText("三唑酮可湿性粉剂");
  136 |     await expect(firstCard).toContainText("¥15.80");
  137 |     await expect(firstCard).toContainText("2340人已购");
  138 |     await expect(firstCard).toHaveAttribute("target", "_blank");
  139 |     await expect(firstCard).toHaveAttribute("href", "https://example.com/buy/1");
  140 | 
  141 |     // Card 2
  142 |     const secondCard = cards.nth(1);
  143 |     await expect(secondCard).toContainText("多菌灵");
  144 |     await expect(secondCard).toContainText("¥12.50");
  145 | 
  146 |     // Second intervention has no products — no product-list
  147 |     const interventionItems = page.locator('[data-testid="intervention-list"] > li');
  148 |     const secondItem = interventionItems.nth(1);
  149 |     await expect(secondItem.locator('[data-testid="product-list"]')).toHaveCount(0);
  150 | 
  151 |     // Screenshot
  152 |     await page.screenshot({
  153 |       path: "verification/feature-007.png",
  154 |       fullPage: true,
  155 |     });
  156 |   });
  157 | });
  158 | 
```