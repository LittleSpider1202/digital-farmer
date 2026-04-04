"""评分逻辑 - Claude 评委模式（通过 claude -p 调用）

维度：
- 病害识别 (40%): 规则匹配，对就是对
- 症状描述 (20%): Claude 评委打分 0-100
- 治疗方案 (40%): Claude 评委打分 0-100
"""

import json
import re
import subprocess
from pathlib import Path

import yaml

from .prompts import load_judge_prompt

# ── 标准答案加载 ──────────────────────────────────────────

def load_ground_truth(gt_path: str) -> dict:
    """加载标准答案，返回 {image_name: disease_info} 的映射"""
    gt_dir = Path(gt_path).parent
    with open(gt_path, "r", encoding="utf-8") as f:
        data = yaml.safe_load(f)

    image_map = {}
    for disease_name, info in data["diseases"].items():
        ref_path = gt_dir / info["reference_file"]
        ref_text = ref_path.read_text(encoding="utf-8") if ref_path.exists() else ""
        info["reference_text"] = ref_text

        for img in info["images"]:
            image_map[img] = info
    return image_map


# ── 病害识别（规则匹配）────────────────────────────────────

def score_identification(result: dict, truth: dict) -> float:
    """病害识别准确率 (0 或 1)"""
    if result.get("_parse_error") or result.get("_error"):
        return 0.0

    predicted = result.get("disease_name", "").strip()
    expected = truth["disease_name"]

    predicted_clean = predicted.replace("小麦", "").strip()
    expected_clean = expected.replace("小麦", "").strip()

    if predicted_clean == expected_clean:
        return 1.0

    if expected_clean == "锈病" and "锈病" in predicted_clean:
        return 1.0

    if expected_clean in predicted_clean or predicted_clean in expected_clean:
        return 0.8

    return 0.0


# ── Claude 评委（claude -p）──────────────────────────────

JUDGE_PROMPT = load_judge_prompt()

# Claude 评委 token 用量追踪
_last_usage = {"input_tokens": 0, "output_tokens": 0, "cost_usd": 0}
_cumulative_usage = {"input_tokens": 0, "output_tokens": 0, "cost_usd": 0}


def judge_with_claude(reference_text: str, result: dict) -> dict:
    """通过 claude -p 调用评委打分"""

    symptoms = result.get("symptoms", "")
    treatment = result.get("treatment", {})
    if isinstance(treatment, dict):
        treatment_text = "\n".join(f"- {k}: {v}" for k, v in treatment.items())
    else:
        treatment_text = str(treatment)

    prompt = JUDGE_PROMPT.format(
        reference=reference_text,
        predicted_name=result.get("disease_name", "未知"),
        symptoms=symptoms,
        treatment=treatment_text,
    )

    try:
        proc = subprocess.run(
            ["claude", "-p", "--output-format", "json"],
            input=prompt,
            capture_output=True,
            text=True,
            timeout=120,
            encoding="utf-8",
        )
        resp = json.loads(proc.stdout)

        # 检查 claude -p 是否成功返回
        if resp.get("is_error") or resp.get("subtype") != "success":
            error_msg = resp.get("result", "未知错误")[:200]
            return {
                "_status": "judge_error",
                "symptoms_score": 0, "symptoms_reason": f"评委调用失败: {error_msg}",
                "treatment_score": 0, "treatment_reason": f"评委调用失败: {error_msg}",
            }

        raw = resp.get("result", "")

        # 提取 token usage
        usage = resp.get("usage", {})
        cost = resp.get("total_cost_usd", 0)
        _last_usage["input_tokens"] = usage.get("input_tokens", 0) + usage.get("cache_read_input_tokens", 0) + usage.get("cache_creation_input_tokens", 0)
        _last_usage["output_tokens"] = usage.get("output_tokens", 0)
        _last_usage["cost_usd"] = cost
        _cumulative_usage["input_tokens"] += _last_usage["input_tokens"]
        _cumulative_usage["output_tokens"] += _last_usage["output_tokens"]
        _cumulative_usage["cost_usd"] += cost

    except (subprocess.TimeoutExpired, FileNotFoundError) as e:
        return {
            "_status": "judge_error",
            "symptoms_score": 0, "symptoms_reason": f"claude -p 调用失败: {e}",
            "treatment_score": 0, "treatment_reason": f"claude -p 调用失败: {e}",
        }
    except (json.JSONDecodeError, KeyError):
        return {
            "_status": "judge_error",
            "symptoms_score": 0, "symptoms_reason": f"claude -p 响应解析失败",
            "treatment_score": 0, "treatment_reason": "claude -p 响应解析失败",
        }

    # 解析评分 JSON
    match = re.search(r"\{.*\}", raw, re.DOTALL)
    if match:
        try:
            parsed = json.loads(match.group())
            parsed["_status"] = "success"
            return parsed
        except json.JSONDecodeError:
            pass

    return {
        "_status": "judge_error",
        "symptoms_score": 0, "symptoms_reason": f"评委响应解析失败: {raw[:200]}",
        "treatment_score": 0, "treatment_reason": "评委响应解析失败",
    }


def _save_scores_file(scores_file: Path, scores: list[dict],
                      per_image: dict, per_disease: dict) -> None:
    """实时保存评分结果到文件"""
    if not scores:
        return
    n = len(scores)
    avg = lambda key: round(sum(s[key] for s in scores) / n, 3)
    data = {
        "summary": {
            "total_images": n,
            "identification": avg("identification"),
            "symptoms": avg("symptoms"),
            "treatment": avg("treatment"),
            "weighted_total": avg("weighted_total"),
            "avg_latency_ms": int(sum(s.get("latency_ms", 0) for s in scores) / n),
        },
        "per_image": per_image,
    }
    with open(scores_file, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


# ── 综合评分 ──────────────────────────────────────────────

def score_single(result: dict, truth: dict) -> dict:
    """对单条结果进行全维度评分"""
    s_id = score_identification(result, truth)

    judge_result = judge_with_claude(
        reference_text=truth.get("reference_text", ""),
        result=result,
    )

    status = judge_result.pop("_status", "success")

    s_sym = judge_result.get("symptoms_score", 0) / 100.0
    s_treat = judge_result.get("treatment_score", 0) / 100.0

    # 加权总分: 识别40% + 症状20% + 治疗40%
    weighted = s_id * 0.40 + s_sym * 0.20 + s_treat * 0.40

    return {
        "_status": status,
        "identification": round(s_id, 3),
        "symptoms": round(s_sym, 3),
        "treatment": round(s_treat, 3),
        "weighted_total": round(weighted, 3),
        "symptoms_reason": judge_result.get("symptoms_reason", ""),
        "treatment_reason": judge_result.get("treatment_reason", ""),
    }


def score_model(model_results: list[dict], ground_truth: dict,
                scores_file: Path | None = None) -> dict:
    """对单个模型的所有结果评分，支持断点续评"""
    import time

    scores = []
    per_image = {}
    per_disease = {}

    # 加载已有评分（断点续评）
    existing_per_image = {}
    if scores_file and scores_file.exists():
        with open(scores_file, "r", encoding="utf-8") as f:
            existing = json.load(f)
        existing_per_image = existing.get("per_image", {})

    # 预计算有效数量
    valid_results = [(r, ground_truth.get(r.get("_image", "")))
                     for r in model_results if ground_truth.get(r.get("_image", ""))]
    total = len(valid_results)
    skipped = 0
    t0 = time.time()

    for i, (result, truth) in enumerate(valid_results, 1):
        image_name = result.get("_image", "")

        # 断点续评：跳过已成功的记录（兼容无 _status 的旧数据）
        existing = existing_per_image.get(image_name, {})
        is_success = (existing.get("_status") == "success"
                      or ("_status" not in existing and existing.get("weighted_total", 0) > 0))
        if is_success:
            s = existing
            skipped += 1
        else:
            elapsed = time.time() - t0
            evaluated = i - skipped
            avg = elapsed / evaluated if evaluated > 1 else 0
            remaining = total - i
            eta = int(avg * remaining)
            eta_str = f"{eta//60}m{eta%60:02d}s" if eta >= 60 else f"{eta}s"
            eta_part = f" ETA {eta_str}" if evaluated > 1 else ""
            retry_tag = " [重试]" if existing else ""

            print(f"  [{i}/{total}] 评分: {image_name}{retry_tag} ...", end=" ", flush=True)
            s = score_single(result, truth)

            if s["_status"] == "success":
                token_info = f" | ${_last_usage['cost_usd']:.3f} (累计${_cumulative_usage['cost_usd']:.2f})"
                print(f"识别{s['identification']*100:.0f} 症状{s['symptoms']*100:.0f} 治疗{s['treatment']*100:.0f}{eta_part}{token_info}", flush=True)
            else:
                print(f"评委失败: {s.get('symptoms_reason', '')[:80]}", flush=True)

            s["image"] = image_name
            s["disease"] = truth["disease_name"]
            s["predicted"] = result.get("disease_name", "未知")
            s["latency_ms"] = result.get("_latency_ms", 0)

            # 只有成功的才写入文件
            if s["_status"] == "success" and scores_file:
                per_image[image_name] = s
                _save_scores_file(scores_file, [x for x in scores + [s] if x.get("_status") == "success"], per_image, per_disease)

        if "image" not in s:
            s["image"] = image_name
            s["disease"] = truth["disease_name"]
            s["predicted"] = result.get("disease_name", "未知")
            s["latency_ms"] = result.get("_latency_ms", 0)

        scores.append(s)
        if s["_status"] == "success":
            per_image[image_name] = s

        disease = truth["disease_name"]
        if disease not in per_disease:
            per_disease[disease] = []
        per_disease[disease].append(s)

    elapsed_total = int(time.time() - t0)
    success_count = sum(1 for s in scores if s.get("_status") == "success")
    error_count = sum(1 for s in scores if s.get("_status") == "judge_error")
    new_count = total - skipped
    if skipped:
        print(f"  跳过已评: {skipped} 张, 新评: {new_count} 张")
    if error_count:
        print(f"  评委失败: {error_count} 张（下次重跑会自动重试）")
    print(f"  评分完成: {success_count}/{total} 成功, 耗时 {elapsed_total//60}m{elapsed_total%60:02d}s, 累计费用 ${_cumulative_usage['cost_usd']:.2f}\n")

    # 只用成功的记录计算汇总
    success_scores = [s for s in scores if s.get("_status") == "success"]
    if not success_scores:
        return {"error": "无有效评分", "per_image": per_image}

    n = len(success_scores)
    avg = lambda key: round(sum(s[key] for s in success_scores) / n, 3)

    disease_summary = {}
    for disease, disease_scores in per_disease.items():
        ds_success = [s for s in disease_scores if s.get("_status") == "success"]
        if not ds_success:
            continue
        dn = len(ds_success)
        disease_summary[disease] = {
            "count": dn,
            "identification": round(sum(s["identification"] for s in ds_success) / dn, 3),
            "symptoms": round(sum(s["symptoms"] for s in ds_success) / dn, 3),
            "treatment": round(sum(s["treatment"] for s in ds_success) / dn, 3),
            "weighted_total": round(sum(s["weighted_total"] for s in ds_success) / dn, 3),
        }

    return {
        "summary": {
            "total_images": len(scores),
            "success_images": n,
            "identification": avg("identification"),
            "symptoms": avg("symptoms"),
            "treatment": avg("treatment"),
            "weighted_total": avg("weighted_total"),
            "avg_latency_ms": int(sum(s["latency_ms"] for s in success_scores) / n),
        },
        "per_disease": disease_summary,
        "per_image": per_image,
    }


def score_all(all_results: dict, ground_truth: dict,
              experiment_dir: Path | None = None) -> dict:
    """对所有模型的结果评分"""
    all_scores = {}
    for model_name, model_results in all_results.items():
        # 重置累计用量（每个模型独立统计）
        _cumulative_usage["input_tokens"] = 0
        _cumulative_usage["output_tokens"] = 0
        _cumulative_usage["cost_usd"] = 0

        scores_file = experiment_dir / model_name / "scores.json" if experiment_dir else None

        print(f"\n评分模型: {model_name}")
        model_score = score_model(model_results, ground_truth, scores_file=scores_file)
        model_score["judge_usage"] = {
            "total_input_tokens": _cumulative_usage["input_tokens"],
            "total_output_tokens": _cumulative_usage["output_tokens"],
            "total_cost_usd": round(_cumulative_usage["cost_usd"], 4),
        }
        all_scores[model_name] = model_score

        # 最终写入完整评分文件
        if scores_file:
            with open(scores_file, "w", encoding="utf-8") as f:
                json.dump(model_score, f, ensure_ascii=False, indent=2)

    return all_scores
