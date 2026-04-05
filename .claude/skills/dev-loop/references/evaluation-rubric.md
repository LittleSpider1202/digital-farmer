# 评估标准

基于 Anthropic 官方评估方法论设计（参考 Demystifying evals for AI agents + Harness design paper）。

## 三个评估维度（独立打分）

每个维度由独立的 grader 评估，避免单一 judge 评所有维度导致偏差。

### D1. 功能正确性（Hard Threshold）

**Grader 类型**：Code-based（确定性，优先级最高）

逐条验证 `feature_list.json` 中的 `acceptance_criteria`：
- 每条标记 pass / fail
- **得分** = 通过条数 / 总条数 * 10
- **Hard Threshold：功能分 < 6 直接触发迭代，不看其他维度**

验证方法：
- 能跑命令的 → 跑命令（pytest、curl、npm test、启动服务）
- 有 UI 的 → 委托 `e2e-runner` agent 用 Playwright 验证活应用
- 代码层面的 → 直接读文件检查

### D2. 代码质量

**Grader 类型**：Model-based（委托 code-reviewer agent）

按优先级只报告 >80% 确信的问题：

| 级别 | 类型 | 处理方式 |
|------|------|---------|
| CRITICAL | 安全漏洞、数据丢失风险 | 必须修复才能通过 |
| HIGH | 逻辑错误、边界条件、类型不匹配 | 必须修复 |
| MEDIUM | 重复代码、命名不清、缺类型注解 | 建议修复，不阻塞 |

**得分规则**：
- 0 个 CRITICAL/HIGH → 10 分
- 有 CRITICAL → 0 分（Hard Threshold，直接迭代）
- 有 HIGH，无 CRITICAL → 5 分
- 只有 MEDIUM → 8 分

backend feature 额外委托 `python-reviewer`，frontend 额外委托 `typescript-reviewer`。

### D3. 安全性

**Grader 类型**：Code-based + Model-based（委托 security-reviewer agent）

在循环通过后、commit 前执行一次：
- CRITICAL 发现 → 必须修复，打回重新评估
- HIGH 发现 → 必须修复
- MEDIUM/LOW → 记录，不阻塞

安全性不参与总分计算，但 CRITICAL 一票否决。

## 总分计算

```
总分 = D1 功能正确性 × 0.7 + D2 代码质量 × 0.3
```

功能正确性权重高，因为这是 demo 项目，能跑 > 代码完美。

## 通过条件

以下全部满足才算通过：
1. 总分 ≥ 7/10
2. D1 功能正确性 ≥ 6/10（Hard Threshold）
3. D2 无 CRITICAL 问题
4. D3 安全扫描无 CRITICAL

## Few-shot 评估示例

### 示例 A：Feature 1 骨架搭建 — 通过

```
## 第 1 轮评估结果

### D1 功能正确性：10/10（6/6 条通过）
- [x] npm run dev 启动前端无报错，localhost:3000 可访问
- [x] uvicorn 启动后端无报错，localhost:8000/docs 可访问
- [x] GET /health 返回 {"status": "ok"}
- [x] 前端能成功调用后端 /health 端点（CORS 已配置）
- [x] .gitignore 覆盖 node_modules、__pycache__、.env
- [x] .env.example 包含所有必要环境变量占位

### D2 代码质量：8/10
- [MEDIUM] src/backend/main.py:12 — CORS allow_origins 用了 "*"，生产环境需收窄

### D3 安全性：通过
- 无 CRITICAL/HIGH 发现

### 总分：10 × 0.7 + 8 × 0.3 = 9.4 ✅ 通过
```

### 示例 B：Feature 3 诊断端点 — 未通过

```
## 第 1 轮评估结果

### D1 功能正确性：5/10（3/6 条通过）
- [x] POST /api/diagnose 接收 image 文件 + description 字段
- [ ] 拒绝非 jpg/png/webp 文件，返回 400 → 实际返回 500，未做格式校验
- [ ] 拒绝 >10MB 文件，返回 400 → 未实现大小限制
- [x] description 为空时仍能正常诊断
- [x] 返回 JSON 符合 app_spec.md 定义的响应格式
- [ ] pytest 测试覆盖 → 缺少格式错误和超大文件的测试用例

### D2 代码质量：5/10
- [HIGH] src/backend/api/diagnose.py:34 — 裸 except 吞掉了 Claude API 异常

### 总分：5 × 0.7 + 5 × 0.3 = 5.0 ❌ 未通过（D1 < 6 触发 Hard Threshold）

### 下一轮修复重点
1. 添加图片格式校验（检查 content-type 和文件头）
2. 添加文件大小限制（UploadFile 读取前检查 content-length）
3. 捕获具体异常类型替代裸 except
4. 补充 pytest 测试用例
```

## 迭代反馈格式

每轮评估必须输出以下格式：

```
## 第 N 轮评估结果

### D1 功能正确性：X/10（M/N 条通过）
- [x/空格] criteria：通过/失败原因

### D2 代码质量：X/10
- [severity] 文件:行号 — 问题描述

### D3 安全性：通过/未通过
- [severity] 描述

### 总分：计算过程 = X.X ✅/❌

### 下一轮修复重点（未通过时）
1. 具体修复项
```
