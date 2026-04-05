# Agent 委托映射

本项目使用 everything-claude-code (ECC) 中的 agent。以下为各环节委托规则。

## 委托表

| 环节 | Agent | 模型 | 触发条件 |
|------|-------|------|---------|
| 测试指导 | `tdd-guide` | sonnet | 第 1 轮实现时，先写测试再写代码 |
| 构建修复 | `build-error-resolver` | sonnet | 构建失败时 |
| 代码审查 | `code-reviewer` | sonnet | 每轮实现后 |
| Python 审查 | `python-reviewer` | sonnet | feature category 为 backend 时 |
| TS 审查 | `typescript-reviewer` | sonnet | feature category 为 frontend 时 |
| E2E 测试 | `e2e-runner` | sonnet | 有 UI 的 feature 评估时 |
| 安全扫描 | `security-reviewer` | sonnet | 循环通过后、commit 前 |

## 委托方式

使用 Claude Code 的 Agent 工具：

```
委托 [agent-name] agent：[具体任务描述]
```

## 成本控制

- 主流程（实现代码）由当前 session 的模型执行
- 所有委托的 sub-agent 使用 sonnet 模型（在 agent 定义中已配置）
- 避免不必要的委托：simple 级别 feature 的审查可跳过语言专项 reviewer

## 注意事项

- `code-reviewer` 只报告 >80% 确信的问题，不做风格偏好建议
- `build-error-resolver` 只做最小改动修复构建，不做架构调整
- `tdd-guide` 确保测试覆盖率 ≥ 80%
- `security-reviewer` 的 CRITICAL 发现必须在 commit 前修复
