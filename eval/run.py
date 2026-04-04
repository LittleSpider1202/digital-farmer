"""评测入口脚本 — 以实验为核心组织

使用方式:
    # 查看所有实验
    python run.py list

    # 在指定实验内跑某个模型
    python run.py run --experiment 01_baseline_zero_shot --models seed-2.0-pro

    # 在指定实验内跑所有模型（读 experiments.yaml 中的 models 列表）
    python run.py run --experiment 01_baseline_zero_shot

    # 只评分（不重新调用模型 API）
    python run.py score --experiment 01_baseline_zero_shot

    # 只生成报告
    python run.py report --experiment 01_baseline_zero_shot

结果目录结构:
    results/
    ├── 01_baseline_zero_shot/      # 实验目录
    │   ├── meta.json               # 实验元信息
    │   ├── seed-2.0-pro/           # 模型目录（每个 session 只写自己的）
    │   │   ├── result.json         # 原始诊断结果
    │   │   └── scores.json         # 评分
    │   ├── scores.json             # 汇总评分（report 生成）
    │   ├── all_results.json        # 汇总结果（report 生成）
    │   └── report.md               # 横评报告
    └── 02_with_rag/
        └── ...
"""

import argparse
import asyncio
import json
import os
import sys
from pathlib import Path

# Windows 终端强制 UTF-8 输出，避免中文乱码
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
    os.environ.setdefault("PYTHONIOENCODING", "utf-8")

import yaml

sys.path.insert(0, str(Path(__file__).parent))

from eval.runner import run_evaluation
from eval.scorer import load_ground_truth, score_all
from eval.report_md import generate_report

BASE_DIR = Path(__file__).parent
IMAGES_DIR = BASE_DIR / "images"
RESULTS_DIR = BASE_DIR / "results"
CONFIG_FILE = BASE_DIR / "config.yaml"
GT_FILE = BASE_DIR / "ground_truth" / "ground_truth.yaml"
EXPERIMENTS_FILE = BASE_DIR / "experiments.yaml"


def load_config() -> dict:
    with open(CONFIG_FILE, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)


def load_experiments() -> dict:
    with open(EXPERIMENTS_FILE, "r", encoding="utf-8") as f:
        data = yaml.safe_load(f)
    return data.get("experiments", {})


def get_experiment(experiment_id: str) -> dict:
    """获取指定实验的配置"""
    experiments = load_experiments()
    if experiment_id not in experiments:
        print(f"实验 '{experiment_id}' 不存在。可用实验:")
        for eid, exp in experiments.items():
            print(f"  {eid}: {exp['name']} [{exp['status']}]")
        sys.exit(1)
    return experiments[experiment_id]


def get_experiment_dir(experiment_id: str) -> Path:
    """获取实验结果目录"""
    d = RESULTS_DIR / experiment_id
    d.mkdir(parents=True, exist_ok=True)
    return d


def print_scores(scores: dict):
    """在终端打印评分摘要"""
    print("\n" + "=" * 70)
    print("评测结果摘要")
    print("=" * 70)

    ranking = []
    for model_name, model_scores in scores.items():
        s = model_scores.get("summary", {})
        if "error" in model_scores:
            continue
        ranking.append((model_name, s))

    ranking.sort(key=lambda x: x[1]["weighted_total"], reverse=True)

    print(f"\n{'排名':<4} {'模型':<15} {'识别':<10} {'症状':<10} {'治疗':<10} {'总分':<10} {'延迟':<10}")
    print("-" * 69)

    for i, (name, s) in enumerate(ranking, 1):
        print(
            f"{i:<4} {name:<15} "
            f"{s['identification']*100:>6.1f}%   "
            f"{s['symptoms']*100:>6.1f}%   "
            f"{s['treatment']*100:>6.1f}%   "
            f"{s['weighted_total']*100:>6.1f}%   "
            f"{s['avg_latency_ms']:>6d}ms"
        )


# ── 子命令 ─────────────────────────────────────────────

def cmd_list(args):
    """列出所有实验"""
    experiments = load_experiments()
    if not experiments:
        print("暂无实验。请在 experiments.yaml 中添加。")
        return

    print(f"\n{'ID':<30} {'名称':<20} {'状态':<12} {'模型数'}")
    print("-" * 72)
    for eid, exp in experiments.items():
        models = exp.get("models", [])
        # 检查已完成的模型数
        exp_dir = RESULTS_DIR / eid
        done = sum(1 for m in models if (exp_dir / m / "result.json").exists())
        print(f"{eid:<30} {exp['name']:<20} {exp['status']:<12} {done}/{len(models)}")


async def cmd_run(args):
    """在实验内运行模型评测"""
    exp = get_experiment(args.experiment)
    exp_dir = get_experiment_dir(args.experiment)
    config = load_config()

    # 确定要跑的模型
    models = args.models or exp.get("models", [])
    diagnose_prompt = exp.get("diagnose_prompt", "v1_baseline")
    judge_prompt = exp.get("judge_prompt", "v1_claude")

    # 从 ground_truth 读取作物品种，作为 prompt 模板变量
    prompt_vars = {}
    with open(GT_FILE, "r", encoding="utf-8") as f:
        gt_data = yaml.safe_load(f)
    if gt_data.get("crop"):
        prompt_vars["crop"] = gt_data["crop"]

    all_results, _ = await run_evaluation(
        config=config,
        images_dir=str(IMAGES_DIR),
        experiment_dir=str(exp_dir),
        models=models,
        diagnose_prompt=diagnose_prompt,
        judge_prompt=judge_prompt,
        prompt_vars=prompt_vars,
    )

    if args.no_score:
        print("\n模型调用完成（跳过评分）。稍后运行: python run.py score -e ...")
        return

    # 评分
    ground_truth = load_ground_truth(str(GT_FILE))
    scores = score_all(all_results, ground_truth)

    with open(exp_dir / "scores.json", "w", encoding="utf-8") as f:
        json.dump(scores, f, ensure_ascii=False, indent=2)

    print_scores(scores)

    # 生成报告
    report = generate_report(scores, all_results)
    report_path = exp_dir / "report.md"
    report_path.write_text(report, encoding="utf-8")
    print(f"\n报告: {report_path}")


def cmd_score(args):
    """对实验内已有结果评分"""
    exp = get_experiment(args.experiment)
    exp_dir = get_experiment_dir(args.experiment)

    # 加载模型结果（支持 --models 过滤）
    target_models = args.models or exp.get("models", [])
    all_results = {}
    for model in target_models:
        model_file = exp_dir / model / "result.json"
        if model_file.exists():
            with open(model_file, "r", encoding="utf-8") as f:
                all_results[model] = json.load(f)

    if not all_results:
        print("实验目录内无模型结果文件")
        sys.exit(1)

    print(f"对 {len(all_results)} 个模型评分: {', '.join(all_results.keys())}")

    ground_truth = load_ground_truth(str(GT_FILE))
    scores = score_all(all_results, ground_truth, experiment_dir=exp_dir)

    print_scores(scores)


def cmd_report(args):
    """汇总各模型评分并生成横评报告（由架构 session 执行）"""
    exp = get_experiment(args.experiment)
    exp_dir = get_experiment_dir(args.experiment)

    # 从各模型目录汇总评分
    scores = {}
    for model in exp.get("models", []):
        model_scores_file = exp_dir / model / "scores.json"
        if model_scores_file.exists():
            with open(model_scores_file, "r", encoding="utf-8") as f:
                scores[model] = json.load(f)

    if not scores:
        print("未找到任何模型评分文件，请先运行评分")
        sys.exit(1)

    print(f"汇总 {len(scores)} 个模型: {', '.join(scores.keys())}")

    # 汇总 all_results.json
    all_results = {}
    for model in scores:
        model_file = exp_dir / model / "result.json"
        if model_file.exists():
            with open(model_file, "r", encoding="utf-8") as f:
                all_results[model] = json.load(f)

    # 写入合并的 scores.json 和 all_results.json
    with open(exp_dir / "scores.json", "w", encoding="utf-8") as f:
        json.dump(scores, f, ensure_ascii=False, indent=2)
    with open(exp_dir / "all_results.json", "w", encoding="utf-8") as f:
        json.dump(all_results, f, ensure_ascii=False, indent=2)

    print_scores(scores)

    report = generate_report(scores, all_results)
    report_path = exp_dir / "report.md"
    report_path.write_text(report, encoding="utf-8")
    print(f"\n报告: {report_path}")


async def main():
    parser = argparse.ArgumentParser(description="小麦病害AI识别模型横评")
    subparsers = parser.add_subparsers(dest="command", help="子命令")

    # list
    subparsers.add_parser("list", help="列出所有实验")

    # run
    p_run = subparsers.add_parser("run", help="运行模型评测")
    p_run.add_argument("--experiment", "-e", required=True, help="实验 ID")
    p_run.add_argument("--models", nargs="+", help="指定模型（默认用实验配置的全部模型）")
    p_run.add_argument("--no-score", action="store_true", help="只调用模型API，不评分（用于并行跑多个模型）")

    # score
    p_score = subparsers.add_parser("score", help="对已有结果评分")
    p_score.add_argument("--experiment", "-e", required=True, help="实验 ID")
    p_score.add_argument("--models", nargs="+", help="只评指定模型（默认评全部已有结果）")

    # report
    p_report = subparsers.add_parser("report", help="生成报告")
    p_report.add_argument("--experiment", "-e", required=True, help="实验 ID")

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        return

    if args.command == "list":
        cmd_list(args)
    elif args.command == "run":
        await cmd_run(args)
    elif args.command == "score":
        cmd_score(args)
    elif args.command == "report":
        cmd_report(args)


if __name__ == "__main__":
    asyncio.run(main())
