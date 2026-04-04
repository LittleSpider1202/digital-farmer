# 交接文档 — 数字农人项目

> 交接时间：2026-04-04
> 交接原因：开发机从 Windows 迁移至 Mac Air

---

## 一、项目概述

国税局+腾讯+渠道方合作项目，当前聚焦 AI 农作物病害识别的 demo 验证阶段。核心工作是用自建评测框架对国内主流多模态大模型进行横向评测，评估其在小麦病害识别场景下的能力。

**仓库地址**：https://github.com/LittleSpider1202/digital-farmer

## 二、新机器环境搭建

### 2.1 基础工具

```bash
# 1. 克隆仓库
git clone https://github.com/LittleSpider1202/digital-farmer.git 数字农人
cd 数字农人

# 2. Python 环境（Mac 用 python3）
python3 --version  # 需要 3.10+
pip3 install httpx pyyaml

# 3. Claude Code CLI
# 确保已安装 claude（Max 订阅）
claude --version

# 4. 飞书 CLI（可选，用于推送报告到飞书）
npm install -g @anthropic-ai/claude-code
npm install -g @anthropic-ai/claude-code
npx skills add larksuite/cli --all -y
lark-cli auth login
```

### 2.2 配置文件

仓库里不含敏感配置，需要手动创建：

```bash
# 复制配置模板，填入真实 API Key
cp 评测/config.yaml.example 评测/config.yaml
# 编辑 config.yaml，填入：
#   - 火山引擎 API Key（seed-2.0-pro）
#   - 阿里云 API Key（qwen3.5-plus）
#   - 智谱 API Key（glm-4.6v）
#   - 飞书 app_id / app_secret
```

### 2.3 评测图片

评测图片未提交到 git（体积大），需要从原机器拷贝：

```
评测/images/
├── 白粉病_1.jpeg ~ 白粉病_10.jpeg（10 张）
├── 纹枯病_1.jpeg ~ 纹枯病_9.jpeg（9 张）
├── 锈病_1.png ~ 锈病_10.jpeg（10 张）
├── 茎基腐病_1.jpeg ~ 茎基腐病_10.jpeg（10 张）
└── 细菌性叶枯病_1.png ~ 细菌性叶枯病_4.png（4 张）
共 43 张，约 7.2MB
```

### 2.4 评测结果

评测结果也未提交（持续变化），需要从原机器拷贝：

```
评测/results/01_baseline_zero_shot/
├── seed-2.0-pro/    result.json + scores.json
├── qwen3.5-plus/    result.json + scores.json
├── glm-4.6v/        result.json + scores.json
├── claude-opus-4.6/ result.json + scores.json
├── all_results.json
├── scores.json
├── meta.json
└── report.md
共约 1.3MB
```

### 2.5 CLAUDE.md 适配

**重要**：需要修改 `CLAUDE.md` 中的环境约定：

```diff
- **Python 命令**：本机使用 `py`（不是 `python` 或 `python3`）
+ **Python 命令**：本机使用 `python3`
```

同时检查 `评测/run.py` 中是否有硬编码的 `py` 命令调用。

### 2.6 代理配置

原机器使用 Clash Verge 代理（国内 API 走直连）。Mac 上：
- 如果也用 Clash：配置相同，国内 API 默认走 GEOIP,CN,DIRECT
- 如果不用代理：国内 API（火山引擎、阿里云、智谱）直连即可，无需额外配置
- Claude CLI 需要能访问外网

## 三、项目架构

```
数字农人/
├── CLAUDE.md              # 项目级规范（环境、编码标准）
├── .gitignore
├── 原型/                   # Stitch 生成的原型页面
├── 截图/                   # 调试截图
└── 评测/                   # 核心评测模块
    ├── CLAUDE.md           # 评测专属规范（session 流程、角色权限）
    ├── config.yaml         # 模型配置（API Key，不提交）
    ├── config.yaml.example # 配置模板
    ├── experiments.yaml    # 实验注册表
    ├── run.py              # CLI 入口（run / score / report / list）
    ├── eval/
    │   ├── models/
    │   │   ├── base.py          # 模型基类
    │   │   ├── openai_compat.py # OpenAI 兼容 API（Seed/Qwen/GLM）
    │   │   ├── claude_cli.py    # Claude CLI 模式（claude -p）
    │   │   └── __init__.py      # create_model 工厂
    │   ├── prompts.py      # Prompt 加载器（支持模板变量）
    │   ├── runner.py       # 评测执行器（断点续跑）
    │   ├── scorer.py       # Claude 评委打分（断点续评 + 状态追踪）
    │   └── report_md.py    # Markdown 报告生成
    ├── prompts/
    │   ├── diagnose/
    │   │   ├── v1_baseline.yaml    # 零样本 prompt
    │   │   └── v2_with_crop.yaml   # 带品种信息 prompt
    │   └── judge/
    │       └── v1_claude.yaml      # 评委 prompt
    ├── ground_truth/       # 标准答案（YAML + TXT）
    ├── images/             # 评测图片（不提交）
    └── results/            # 评测结果（不提交）
```

## 四、核心设计

### 4.1 Config-driven 模型管理

所有模型在 `config.yaml` 定义，添加/修改模型只需编辑配置文件，代码无需改动。通过 `provider` 字段区分调用方式：
- `openai`（默认）：走 OpenAI 兼容 API
- `claude-cli`：走 `claude -p` 命令

### 4.2 多 Session 并行

架构 session 负责设计和汇总，执行 session 各跑一个模型。每个模型写入独立子目录 `results/<experiment>/<model>/`，避免并发写入冲突。

### 4.3 断点续跑 + 断点续评

- **run**：加载已有 `result.json`，跳过无 `_error` 和 `_parse_error` 的图片
- **score**：加载已有 `scores.json`，跳过 `_status: "success"` 的记录，自动重试失败记录
- 兼容旧数据：无 `_status` 字段但 `weighted_total > 0` 的记录视为成功

### 4.4 评分状态追踪

每条评分记录带 `_status` 字段：
- `"success"`：评委成功返回，分数有效
- `"judge_error"`：评委调用失败（如限流），下次自动重试

## 五、常用命令

```bash
cd 评测

# 查看实验列表
python3 run.py list

# 跑模型评测（不评分）
python3 run.py run -e 01_baseline_zero_shot --models seed-2.0-pro --no-score

# 评分（Claude 评委）
python3 run.py score -e 01_baseline_zero_shot --models seed-2.0-pro

# 生成横评报告
python3 run.py report -e 01_baseline_zero_shot
```

## 六、当前进度

### 已完成

| 实验 | 模型 | 评测 | 评分 | 总分 |
|------|------|:---:|:---:|:---:|
| 01_baseline | Claude Opus 4.6 | 43/43 | 43/43 | **80.3%** |
| 01_baseline | Seed-2.0-Pro | 43/43 | 43/43 | **58.6%** |
| 01_baseline | Qwen3.5-Plus | 43/43 | 43/43 | **57.2%** |
| 01_baseline | GLM-4.6V | 43/43 | 43/43 | **41.0%** |

### 待办

1. **02_with_crop 实验**：已注册（experiments.yaml），prompt 已准备（v2_with_crop.yaml），未执行。验证加入"这是小麦"后各模型提升幅度
2. **评委独立性**：Claude 同时做被测模型和评委，可能存在自评偏高。考虑引入交叉评审
3. **RAG 增强实验（03）**：规划中，注入专业知识库后再测
4. **飞书报告**：已创建文档（https://www.feishu.cn/wiki/D4IRwnwORiUrNRkNl3FcWoDknOd），后续评测结果可自动同步

## 七、已知问题

1. **seed/qwen 旧 scores.json 无 `_status` 字段**：已做兼容处理（`weighted_total > 0` 视为成功），但建议后续重评时全部带上新字段
2. **Qwen 偶发空返回**：43 张中有 9 张首次调用返回空，重跑后全部成功，属于 API 偶发问题
3. **所有进度 print 必须加 `flush=True`**：Python 管道模式下 stdout 默认块缓冲，不加 flush 看不到实时输出

## 八、外部服务账号

| 服务 | 用途 | 备注 |
|------|------|------|
| 火山引擎 Ark | Seed-2.0-Pro API | 有免费额度 |
| 阿里云百炼 | Qwen3.5-Plus API | 有免费额度 |
| 智谱开放平台 | GLM-4.6V API | 有免费额度 |
| Claude Max | Claude Opus 4.6 + 评委 | 订阅额度，注意并发限流 |
| 飞书开放平台 | 报告推送 | app_id: cli_a94cf0c6423b5bc4 |
| GitHub | 代码托管 | LittleSpider1202/digital-farmer |

---

*Generated by Claude Opus 4.6 · 2026-04-04*
