# 架构决策记录

## AD-001：前端选择 Next.js + React

**日期**：2026-04-04
**决策**：前端使用 React + Next.js（TypeScript）
**原因**：生态丰富，SSR 支持好，适合快速出 demo
**替代方案**：Vue + Nuxt（中文社区活跃）、纯静态 HTML（最轻量）

## AD-002：后端选择 Python FastAPI

**日期**：2026-04-04
**决策**：后端使用 Python FastAPI
**原因**：复用评测模块的 Python 经验，FastAPI 异步性能好，自带 OpenAPI 文档

## AD-003：AI 模型选择 Claude Opus 4.6 国内中转

**日期**：2026-04-04
**决策**：使用 Claude Opus 4.6，通过国内中转 API（OpenAI 兼容格式）调用
**原因**：评测结果 Claude Opus 4.6 得分最高（80.3%），远超国内模型

## AD-004：商品数据分阶段实现

**日期**：2026-04-04
**决策**：Phase 1 用 mock 数据，Phase 2 对接电商 API
**原因**：先验证诊断+推荐的完整流程，再投入爬取开发
