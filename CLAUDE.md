# CLAUDE.md — 数字农人

## 项目简介

农作物病害 AI 诊断 Web demo。用户上传图片+描述问题，AI 给出诊断、预防、干预措施，干预涉及农药化肥时推荐商品。

**技术栈**：Next.js（前端）+ Python FastAPI（后端）+ Claude Opus 4.6（国内中转 API）

---

## Session 启动（强制）

**第一步（静默）**：读取本文件 → `app_spec.md` → `feature_list.json` → `claude-progress.txt` → `git log --oneline -10`

**第二步**：用 AskUserQuestion 让用户选角色：

### 架构师

> 需求分析、方案设计、任务拆解。不写业务代码。

委托 `planner`/`architect`/`gan-planner` agent 工作。产出写入 `app_spec.md`、`feature_list.json`、`docs/`。
**不可修改**：src/ 下的业务代码。

### 开发测试

> 功能实现 + 测试 + 审查，闭环迭代。每次做一个 feature。

按 `dev-loop` skill 定义的流程工作（详见 `.claude/skills/dev-loop/SKILL.md`）：
1. 运行 `python3 scripts/feature_claim.py` 原子领取 feature（自动跳过已完成和 in_progress 的，防并发冲突）
2. medium/complex 任务先用 Plan Mode 规划
3. 实现（委托 `tdd-guide`）→ 构建（失败委托 `build-error-resolver`）→ 测试 → 审查（委托 `code-reviewer` + `python-reviewer`/`typescript-reviewer`）→ 评估
4. 三维度独立评分：D1 功能正确性(0.7) + D2 代码质量(0.3)，D3 安全性一票否��
5. 总分 ≥ 7/10 且无 Hard Threshold 触发 → 通过；否则迭代（最多 3 轮）
6. 通过后委托 `security-reviewer` 安全扫描 → commit → 更新进度

评估标准详见 `references/evaluation-rubric.md`，agent 委托规则详见 `references/agent-map.md`。

**不可修改**：app_spec.md、CLAUDE.md。

### 测评

> 模型横评：运行评测、评分、生成报告。工作目录切换到 `eval/`。

启动后按 `eval/CLAUDE.md` 定义的流程工作：
1. 静默读取 `eval/experiments.yaml` + `eval/config.yaml`
2. 用 AskUserQuestion 让用户选子角色（架构/执行）、实验、模型、操作
3. 执行对应的 `python3 run.py` 子命令

**工作目录**：`eval/`，详细规则见 `eval/CLAUDE.md`。
**不可修改**：src/ 下的业务代码、app_spec.md、feature_list.json。

---

## Session 结束前（强制）

1. 所有代码已 commit
2. 更新 `claude-progress.txt`
3. 应用处于可运行状态

---

## 环境约定

- **Python**：`python3`
- **代理**：国内 API 走直连，不走代理

## 编码规范

- **简单优于复杂** — 三行重复好过过早抽象
- **显式优于隐式** — 不用魔法，不吞异常
- **类型注解**：公开函数必须标注参数和返回值
- **异常处理**：捕获具体异常类型，禁止裸 `except:`
- **文件编码**：显式 `encoding="utf-8"`
- **Python**：PEP 8 | **TypeScript**：项目 ESLint 配置
