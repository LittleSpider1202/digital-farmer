"""单 case 测试：跑通 模型调用 → Claude评委评分 → MD报告 全链路"""

import asyncio
import json
import sys
from pathlib import Path

import yaml

sys.path.insert(0, str(Path(__file__).parent))

from eval.models import create_model
from eval.prompts import load_diagnose_prompt
from eval.scorer import load_ground_truth, score_all
from eval.report_md import generate_report

BASE_DIR = Path(__file__).parent
MODEL_NAME = "seed-2.0-pro"


async def main():
    with open(BASE_DIR / "config.yaml", "r", encoding="utf-8") as f:
        config = yaml.safe_load(f)

    test_images = [
        "白粉病_1.jpeg",
        "纹枯病_1.jpeg",
        "细菌性叶枯病_1.png",
        "茎基腐病_1.jpeg",
        "锈病_1.png",
    ]

    # 1. 调用模型
    system_prompt, user_prompt = load_diagnose_prompt("v1_baseline")
    model_config = config["models"][MODEL_NAME]
    model = create_model(MODEL_NAME, model_config)
    results = []

    for img in test_images:
        print(f"诊断: {img} ...", end=" ", flush=True)
        result = await model.diagnose(str(BASE_DIR / "images" / img), system_prompt, user_prompt)
        result["_image"] = img
        print(f"-> {result.get('disease_name', '?')}")
        results.append(result)

    all_results = {MODEL_NAME: results}

    # 2. Claude 评委评分（通过 claude -p）
    print("\nClaude 评委评分中...")
    gt = load_ground_truth(str(BASE_DIR / "ground_truth" / "ground_truth.yaml"))
    scores = score_all(all_results, gt)

    s = scores[MODEL_NAME]["summary"]
    print(f"\n结果: 识别{s['identification']*100:.0f}% 症状{s['symptoms']*100:.0f}% 治疗{s['treatment']*100:.0f}% 总分{s['weighted_total']*100:.0f}%")

    # 3. 保存结果到测试实验目录
    results_dir = BASE_DIR / "results" / "_test"
    results_dir.mkdir(parents=True, exist_ok=True)

    model_dir = results_dir / MODEL_NAME
    model_dir.mkdir(parents=True, exist_ok=True)
    with open(model_dir / "result.json", "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    with open(results_dir / "all_results.json", "w", encoding="utf-8") as f:
        json.dump(all_results, f, ensure_ascii=False, indent=2)
    with open(results_dir / "scores.json", "w", encoding="utf-8") as f:
        json.dump(scores, f, ensure_ascii=False, indent=2)

    # 4. 生成 MD 报告
    report = generate_report(scores, all_results)
    report_path = results_dir / "report.md"
    report_path.write_text(report, encoding="utf-8")
    print(f"报告: {report_path}")


if __name__ == "__main__":
    asyncio.run(main())
