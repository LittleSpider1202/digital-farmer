# CLAUDE.md — 数字农人

## 项目简介

国税局+腾讯+渠道方合作项目，农作物病害 AI 诊断 Web demo。用户上传图片+描述问题，AI 给出诊断结果、预防措施、干预措施，干预措施涉及农药化肥时展示商品推荐（图片、价格、销量、链接）。

**技术栈**：Next.js（前端）+ Python FastAPI（后端）+ Claude Opus 4.6（国内中转 API）

---

## Session 启动流程（强制，优先级最高）

**无论用户第一条消息说什么，都必须先完成以下启动流程。**

**第一步（静默）**：读取本文件 → `app_spec.md` → `feature_list.json` → `claude-progress.txt` → `git log --oneline -10`

**第二步**：使用 AskUserQuestion，让用户选择本次 session 的角色：

### 角色一：架构师

> 负责需求分析、方案设计、任务拆解、技术选型。不写业务代码。

**工作方式**：
1. 理解用户需求，用 AskUserQuestion 澄清模糊点
2. 委托 `planner` agent 生成实现方案
3. 委托 `architect` agent 做系统设计决策
4. 将方案写入 `app_spec.md` 或更新 `feature_list.json`
5. 复杂决策记录到 `docs/arch-decisions.md`

**可修改**：CLAUDE.md、app_spec.md、feature_list.json、docs/
**不可修改**：src/ 下的业务代码

### 角色二：开发者

> 负责功能实现、代码编写、单元测试。每次只做一个 feature。

**工作方式**：
1. 读取 `feature_list.json`，选择最高优先级未完成的 feature
2. 如果是 medium/complex 任务，先用 Plan Mode 规划
3. 编写代码，遵循 TDD：委托 `tdd-guide` agent 指导测试先行
4. 代码写完后，委托 `code-reviewer` agent 审查
5. 构建失败时，委托 `build-error-resolver` agent 修复
6. 完成后更新 `feature_list.json` 和 `claude-progress.txt`
7. git commit

**可修改**：src/、tests/、feature_list.json、claude-progress.txt
**不可修改**：app_spec.md、CLAUDE.md

### 角色三：评估者

> 负责安全审查、E2E 测试、质量把关。不写新功能代码。

**工作方式**：
1. 委托 `security-reviewer` agent 做安全扫描
2. 委托 `e2e-runner` agent 编写和执行端到端测试
3. 委托 `code-reviewer` agent 做全面代码审查
4. 委托 `python-reviewer` agent 审查后端 Python 代码
5. 汇总所有审查结果，按严重程度排序输出报告
6. 将发现的问题写入 `feature_list.json` 作为 bugfix 任务

**可修改**：tests/、feature_list.json、docs/
**不可修改**：src/ 下的业务代码（只提 issue，不直接改）

---

## Session 结束前（强制）

1. 所有代码已 commit
2. 更新 `claude-progress.txt`（写明做了什么、下一步建议）
3. 应用处于可运行状态

---

## 环境约定

- **Python 命令**：本机使用 `python3`
- **代理**：国内 API（火山引擎、阿里云、腾讯云、智谱）走直连，不走代理

## Python 编码规范

遵循 PEP 8。以下为本项目强调的几点：

- **简单优于复杂** — 不过度抽象，三行重复代码好过一个过早的抽象
- **显式优于隐式** — 不用魔法，不吞异常
- **类型注解**：公开函数必须标注参数和返回值类型
- **异常处理**：捕获具体异常类型，禁止裸 `except:`
- **文件编码**：所有文件读写显式指定 `encoding="utf-8"`
