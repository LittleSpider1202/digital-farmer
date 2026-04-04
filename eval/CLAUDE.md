# CLAUDE.md — 评测模块

## Session 启动流程（强制，优先级最高）

**无论用户第一条消息说什么，都必须先完成以下启动流程。**

**第一步（静默）**：读取 `experiments.yaml` 和 `config.yaml`，提取实验列表和模型列表。

**第二步**：使用一次 AskUserQuestion，将读取到的信息嵌入问题选项中，让用户一次性回答：

1. **角色**：架构（评测方案设计、框架搭建）还是 执行（运行评测、生成报告）？
2. **实验**：列出已有实验的 ID 和名称供选择，同时提供「新建实验」选项
3. **模型**（仅执行）：列出 config.yaml 中已配置的模型名称供选择
4. **操作**（仅执行）：全量评测（run --no-score）/ 只评分（score）/ 只生成报告（report）

架构角色只需回答第 1、2 题。执行角色 4 题都要回答。

**第三步**：确认目标模型的 API Key 已配置，然后执行。

---

## 角色与权限

| 角色 | 可修改 | 不可修改 |
|------|--------|---------|
| 架构 | CLAUDE.md, eval/, ground_truth/, *.py, experiments.yaml | results/, config.yaml 中的 API Key |
| 执行 | results/<自己的模型目录>/ | eval/ 框架代码, CLAUDE.md, experiments.yaml |

### 架构 session

启动加载：CLAUDE.md → experiments.yaml → eval/prompts.py → ground_truth/ → results/

职责：评测方案设计、评分维度定义、框架搭建、实验规划。不跑全量评测。

### 执行 session

启动加载：CLAUDE.md → experiments.yaml → config.yaml → `py run.py list`

每个 session **只负责自己被分配的那一个模型**。不要关注其他模型的进度、不要尝试跑其他模型、不要主动发起横评或汇总。完成自己的任务后等待用户指令。

```bash
# 查看实验列表
cd eval && py run.py list

# 跑自己负责的模型
py run.py run -e <experiment-id> --models <model-name> --no-score

# 跑完后，只评自己的模型
py run.py score -e <experiment-id> --models <model-name>
```

**禁止执行 session 做的事**：
- 不要跑 `py run.py report`（横评报告由架构 session 生成）
- 不要省略 `--models` 参数（会误评其他模型）
- 不要用 `run_in_background`（必须前台运行，看实时输出）

---

## 实验管理

`experiments.yaml` 是实验注册表，唯一 source of truth。模型定义在 `config.yaml`，配置驱动，添加模型只需改 config。

结果目录结构：
```
results/<experiment-id>/
├── <model-name>/           # 每个模型一个子目录（执行 session 只写自己的）
│   ├── result.json         # 原始诊断结果
│   └── scores.json         # 评分（支持断点续评）
├── meta.json               # 实验元信息
├── scores.json             # 汇总评分（report 命令生成）
├── all_results.json        # 汇总结果（report 命令生成）
└── report.md               # 横评报告（架构 session 生成）
```

---

## 输出规范

- **长时间任务必须打印进度**：所有超过 1 分钟的操作（模型调用、评分）必须逐条输出进度，包含 `[当前/总数]`、ETA、关键结果
- **所有进度 print 必须加 `flush=True`**：Python 管道模式下 stdout 默认块缓冲，不 flush 用户看不到实时输出
- **禁止使用 `run_in_background`**：必须前台运行，确保能看到实时输出

---

## 关键约定

- **评分用 Claude 评委**：通过 `claude -p --output-format json` 调用，走 Max 订阅额度，无需 API Key
- **模型接口统一走 OpenAI 兼容格式**，配置驱动
- **Prompt 版本管理**：`prompts/` 目录下 YAML 化，实验配置引用 prompt 名称
- **断点续评**：score 命令会跳过已评过的图片，中断后重跑不浪费 token
