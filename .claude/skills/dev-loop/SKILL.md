---
name: dev-loop
description: "开发测试闭环：从 feature_list.json 取任务，实现→构建→测试→审查→评估，自动迭代直到验收通过。"
---

# 开发测试闭环

## 流程

### 1. 选取 Feature

运行 `python3 scripts/feature_claim.py` 原子领取下一个可用 feature（自动跳过已完成和 in_progress 的）。
领取成功后展示给用户确认。如果无可用 feature，提示用户等待。

### 2. 规划（medium/complex 跳过 simple）

用 Plan Mode 基于 feature 的 `steps` 和 `acceptance_criteria` 制定实现计划。

### 3. 迭代循环（最多 3 轮）

每轮执行：

1. **实现**：第 1 轮编写代码（TDD，委托 `tdd-guide` agent）；后续轮根据评估反馈修复
2. **构建**：运行构建命令，失败时委托 `build-error-resolver` agent
3. **测试**：运行 pytest / npm test，失败则修复后重新构建
4. **审查**：委托 `code-reviewer` agent；backend 额外委托 `python-reviewer`，frontend 额外委托 `typescript-reviewer`
5. **评估**：按 `acceptance_criteria` 逐条检查，计算得分（详见 `references/evaluation-rubric.md`）

得分 ≥ 7/10 → 跳出循环。否则将未通过项作为反馈进入下一轮。

### 4. 安全扫描

委托 `security-reviewer` agent，CRITICAL 问题必须修复。

### 5. 收尾

1. 更新 `feature_list.json`（`passes: true`，写入 `score`）
2. 更新 `claude-progress.txt`
3. git commit
4. 输出总结：完成内容、得分、下一个 feature 建议

## Agent 委托规则

详见 `references/agent-map.md`。

## 退出条件

- score ≥ 7/10：通过，提交
- 3 轮后仍 < 7：停止，输出未解决清单，建议架构师介入
- 用户随时可中断

## 文件权限

**可改**：src/、tests/、feature_list.json、claude-progress.txt
**不可改**：CLAUDE.md、app_spec.md
