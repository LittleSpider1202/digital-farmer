# 产品规格 — 数字农人 Web Demo

## 产品定位

面向农业从业者的 AI 农作物病害诊断工具。用户上传病害图片并描述问题，AI 给出诊断结果、预防措施、干预措施，并在干预措施涉及农药化肥时推荐相关商品。

本阶段目标：可演示的 Web demo，验证核心诊断流程和商品推荐能力。

---

## 技术架构

```text
用户浏览器（Next.js）
  ├── 上传图片 + 描述问题
  ├── 展示诊断结果（诊断/预防/干预）
  └── 展示商品推荐卡片（图片/价格/销量/链接）

Python FastAPI 后端
  ├── 接收图片 + 描述
  ├── 调用 Claude Opus 4.6（国内中转 API，OpenAI 兼容格式）
  ├── 解析 AI 返回的结构化诊断结果
  ├── 根据干预措施中的农药/化肥关键词匹配商品
  └── 返回完整结果给前端
```

**技术栈**：
- 前端：React + Next.js（TypeScript）
- 后端：Python FastAPI
- AI 模型：Claude Opus 4.6，国内中转 API，OpenAI 兼容格式
- 商品数据：CLI 爬取电商平台农资商品（京东/淘宝）
- 测试：pytest（后端）、Playwright（E2E）

---

## 目录结构

```text
src/
├── frontend/                    # Next.js 项目根
│   ├── package.json
│   ├── next.config.ts
│   ├── app/                     # App Router
│   │   ├── page.tsx             # 首页（上传+诊断）
│   │   └── layout.tsx
│   └── components/
│       ├── ImageUpload.tsx
│       ├── DiagnosisResult.tsx
│       └── ProductCard.tsx
│
└── backend/                     # FastAPI 项目根
    ├── requirements.txt
    ├── main.py                  # FastAPI 入口 + uvicorn
    ├── api/
    │   ├── diagnose.py          # POST /api/diagnose
    │   └── health.py            # GET /health
    ├── services/
    │   ├── claude_api/          # Claude API 服务
    │   │   ├── client.py        # OpenAI 兼容格式的 API 封装
    │   │   └── prompts/         # prompt 模板
    │   │       └── diagnosis.py # 诊断 prompt（system prompt + 结构化输出引导）
    │   ├── diagnosis.py         # 诊断编排（调 AI + 匹配商品）
    │   └── product_match.py     # 关键词 → 商品匹配逻辑
    └── dao/
        ├── http/                # HTTP 调用封装
        │   └── client.py        # 通用 HTTP 客户端（httpx，超时/重试/日志）
        ├── cli/                 # CLI 爬取工具
        │   ├── base.py          # 爬取基类（参考 ecom_agent_v3 scraping 模式）
        │   ├── jd_agri.py       # 京东农资商品爬取
        │   └── taobao_agri.py   # 淘宝农资商品爬取
        ├── models.py            # 数据模型（商品、诊断结果）
        └── product_store.py     # 商品数据读写（JSON/SQLite）
```

**分层职责**：
- **api/** — 路由入口，参数校验，调用 service
- **services/** — 业务逻辑编排（AI 诊断、商品匹配）
- **services/claude_api/** — Claude API 封装 + prompt 模板管理
- **dao/http/** — 通用 HTTP 客户端封装（httpx，超时/重试/日志）
- **dao/cli/** — CLI 爬取电商平台农资商品
- **dao/** — 数据模型和持久化（商品存储和查询）

---

## 核心用户流程

```text
1. 用户打开首页
2. 上传 1 张农作物病害图片（jpg/png/webp，≤10MB）
3. 在输入框中描述问题（可选，如"叶子发黄有斑点"）
4. 点击"开始诊断"
5. 等待 AI 分析（显示加载动画）
6. 展示诊断结果：
   ├── 诊断结果：病害名称、置信度、病害描述
   ├── 预防措施：列表形式
   └── 干预措施：列表形式
       └── 如果涉及农药/化肥 → 展示商品推荐卡片
7. 商品卡片包含：商品图片、名称、价格、销量、购买链接
```

---

## API 设计

### POST /api/diagnose

**请求**：
- `image`: 图片文件（multipart/form-data）
- `description`: 问题描述（可选，string）

**响应**：
```json
{
  "success": true,
  "data": {
    "diagnosis": {
      "disease_name": "小麦白粉病",
      "confidence": 0.85,
      "description": "白粉病是由真菌引起的..."
    },
    "prevention": [
      "选择抗病品种",
      "合理密植，保持通风"
    ],
    "intervention": [
      {
        "action": "喷施{{三唑酮可湿性粉剂}}",
        "details": "每亩用量50-75克，兑水30公斤喷雾，也可配合{{多菌灵}}交替使用",
        "products": [
          {
            "keyword": "三唑酮可湿性粉剂",
            "name": "三唑酮可湿性粉剂 25%",
            "image_url": "https://...",
            "price": 15.80,
            "sales": 2340,
            "buy_url": "https://..."
          },
          {
            "keyword": "多菌灵",
            "name": "多菌灵 50% WP",
            "image_url": "https://...",
            "price": 12.50,
            "sales": 1890,
            "buy_url": "https://..."
          }
        ]
      }
    ]
  }
}
```

**错误响应**：
```json
{"success": false, "error_code": "IMAGE_TOO_LARGE", "message": "上传图片超过10MB限制"}
{"success": false, "error_code": "INVALID_IMAGE_FORMAT", "message": "仅支持 jpg/png/webp 格式"}
{"success": false, "error_code": "AI_TIMEOUT", "message": "AI 诊断超时，请稍后重试"}
{"success": false, "error_code": "INTERNAL_ERROR", "message": "服务器内部错误"}
```

**Response Header**：
```
X-Trace-Id: image=wheat.jpg|desc=叶子发黄|disease=小麦白粉病|a3f8b2
```

---

## Trace ID 与日志规范

### Trace ID

格式：`业务字段=值|业务字段=值|随机6位hex`

- 请求进入时由 middleware 生成，包含已知字段 + 6 位随机 hex（末尾）
- 业务处理过程中按需追加字段（如 disease）
- 写入 Response Header `X-Trace-Id`
- 同一请求的所有日志共享同一 trace_id

### 日志格式

```
时间 [级别] trace_id 消息内容
```

示例：
```
2026-04-05 10:00:00 [INFO] image=wheat.jpg|desc=叶子发黄|a3f8b2 诊断请求
2026-04-05 10:00:05 [INFO] image=wheat.jpg|desc=叶子发黄|disease=小麦白粉病|a3f8b2 诊断完成 confidence=0.85 cost=3.2s
2026-04-05 10:00:05 [ERROR] image=wheat.jpg|desc=叶子发黄|a3f8b2 Claude API 超时 elapsed=30s
```

### 实现方式

- FastAPI middleware 统一生成 trace_id，注入到 request.state
- 各 service 通过 request.state 获取并追加业务字段
- Python `logging` 基础配置，不引入第三方日志库

---

## 商品数据

### Phase 1：Mock 数据
- 准备 20-30 个常见农药/化肥的 mock 商品数据
- 存储为 JSON 文件，按关键词匹配

### Phase 2：电商对接
- 爬取京东/淘宝农资商品数据
- 建立关键词 → 商品的映射关系
- 定期更新价格和销量

---

## 非目标

- 不做用户注册/登录
- 不做历史记录存储
- 不做多图同时诊断
- 不做移动端 App
- 不做农药使用安全警告（demo 阶段）
