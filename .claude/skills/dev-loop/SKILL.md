---
name: dev-loop
description: "开发测试闭环：从 feature_list.json 取任务，实现→构建→测试→审查→评估，自动迭代直到验收通过。"
---

# 开发测试闭环

## 流程

### 1. 选取 Feature

运行 `python3 scripts/feature_claim.py` 原子领取下一个可用 feature（自动跳过已完成和 in_progress 的）。
领取成功后展示给用户确认。如果无可用 feature，提示用户等待。

### 2. 规划（强制，medium/complex 不可跳过）

**必须进入 Plan Mode**，基于 feature 的 `steps` 和 `acceptance_criteria` 制定实现计划。
simple 级别可跳过。

### 3. 实现 + 构建 + 测试（Codex 阶段）

将实现任务委托给 Codex，提供 Plan Mode 的规划结果 + acceptance_criteria 作为上下文：

```bash
/codex:rescue --write --effort high \
  实现 Feature #N: {feature描述}。\
  规划：{步骤摘要}。\
  验收标准：{acceptance_criteria}。\
  要求：TDD，先写测试再实现，构建通过，pytest/vitest 全绿。
```

Codex 完成后 Claude 验证：
1. **构建**：运行构建命令，失败时委托 `build-error-resolver` agent
2. **测试**：运行 pytest / npm test，确认全绿
3. **UI 截图验证**（frontend/联调类 feature）：
   - 编写 Playwright E2E 测试：`tests/feature-NNN.spec.ts`
   - 测试末尾截图存入 `verification/` 目录

### 4. Codex 审查（强制，不可跳过）

**不论任务大小，必须执行。** 跳过必须在总结中说明原因并获得用户确认。

```bash
# 第一步：代码审查
/codex:review --wait

# 第二步：对抗性审查（simple 级别可跳过）
/codex:adversarial-review --wait
```

### 5. Codex 修 bug（有 HIGH/CRITICAL 时触发）

审查发现 HIGH/CRITICAL 问题时，Codex 负责修复：

```bash
/codex:rescue --write --effort high 修复以下审查问题：{问题清单}
```

Codex 只修 bug，不做评估和安全扫描。修完后 Claude 重新跑测试验证。

如果审查无 HIGH/CRITICAL → 跳过此步。

### 6. Claude 评估 + 安全扫描

**评估和安全扫描由 Claude 执行**（Claude 有完整上下文，比 Codex 更适合打分）。

1. **评估**：按 `references/evaluation-rubric.md` 逐条检查 acceptance_criteria，计算 D1/D2 得分
2. **安全扫描**：委托 `security-reviewer` agent，检查 D3

得分 ≥ 7/10 且无 Hard Threshold → 进入收尾。
未通过 → 回到步骤 3 修复（最多 3 轮）。

### 7. 收尾

1. 验证所有测试绿灯
2. 更新 `feature_list.json`（`passes: true`，`status: "done"`，写入 `score`）
3. 更新 `claude-progress.txt`
4. git commit
5. **输出总结（必须包含以下字段）**：
   - 完成内容
   - 得分
   - **Codex 参与记录**：执行了哪些 Codex 命令、审查发现摘要、是否触发修复
   - 下一个 feature 建议

## Agent / Codex 委托规则

详见 `references/agent-map.md`。

## 退出条件

- score ≥ 7/10：通过，提交
- 3 轮后仍 < 7：停止，输出未解决清单，建议架构师介入
- 用户随时可中断

## 文件权限

**可改**：src/、tests/、feature_list.json、claude-progress.txt
**不可改**：CLAUDE.md、app_spec.md
