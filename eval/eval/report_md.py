"""Markdown 报告输出"""

from datetime import datetime


def generate_report(scores: dict, all_results: dict) -> str:
    """生成 Markdown 格式的评测报告"""
    lines = []

    lines.append("# 小麦病害 AI 识别 — 国内多模态大模型横评")
    lines.append(f"\n> 生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    lines.append("> 评测方式: 统一系统提示词，结构化输出（发病条件/症状识别/防治方案）")

    # ====== 一、评测说明 ======
    lines.append("\n---\n")
    lines.append("## 一、评测说明\n")
    lines.append("**目标：** 测试国内主流多模态大模型在小麦病害识别任务上的能力。\n")
    lines.append("**方法：** 所有模型使用完全相同的系统提示词，输入病害图片，要求返回结构化诊断结果。\n")

    # 模型清单
    model_names = list(scores.keys())
    lines.append("**模型清单：** " + "、".join(model_names) + "\n")

    lines.append("**评分维度：**\n")
    lines.append("| 维度 | 权重 | 评分方式 |")
    lines.append("|------|------|---------|")
    lines.append("| 病害识别 | 25% | 规则匹配（病名是否正确） |")
    lines.append("| 发病条件 | 15% | Claude 评委对照标准答案打分 0-100 |")
    lines.append("| 症状描述 | 20% | Claude 评委对照标准答案打分 0-100 |")
    lines.append("| 防治方案 | 40% | Claude 评委对照标准答案打分 0-100 |")

    # ====== 二、总分排名 ======
    lines.append("\n---\n")
    lines.append("## 二、总分排名\n")
    lines.append("| 模型 | 病害识别 | 发病条件 | 症状描述 | 防治方案 | **加权总分** | 平均延迟 |")
    lines.append("|------|---------|---------|---------|---------|------------|---------|")

    ranking = []
    for model_name, model_scores in scores.items():
        s = model_scores.get("summary", {})
        if "error" in model_scores:
            continue
        ranking.append((model_name, s))
    ranking.sort(key=lambda x: x[1]["weighted_total"], reverse=True)

    for name, s in ranking:
        lines.append(
            f"| {name} "
            f"| {s['identification']*100:.1f}% "
            f"| {s.get('conditions', 0)*100:.1f}% "
            f"| {s['symptoms']*100:.1f}% "
            f"| {s['treatment']*100:.1f}% "
            f"| **{s['weighted_total']*100:.1f}%** "
            f"| {s['avg_latency_ms']}ms |"
        )

    # ====== 三、逐病害对比 ======
    lines.append("\n---\n")
    lines.append("## 三、逐病害对比\n")

    # 动态收集病害名称
    disease_names = _collect_disease_names(scores)

    # 汇总表
    lines.append("| 病害 | " + " | ".join(name for name, _ in ranking) + " |")
    lines.append("|------|" + "|".join("------" for _ in ranking) + "|")
    for disease in disease_names:
        row = f"| {disease} "
        for name, _ in ranking:
            ds = scores[name].get("per_disease", {}).get(disease, {})
            if ds:
                row += f"| {ds['weighted_total']*100:.1f}% "
            else:
                row += "| N/A "
        row += "|"
        lines.append(row)

    # 逐病害详情
    for disease in disease_names:
        lines.append(f"\n### {disease}\n")

        for model_name, model_results in all_results.items():
            lines.append(f"#### {model_name}\n")

            for result in model_results:
                img = result.get("_image", "")
                if not _image_belongs_to(img, disease):
                    continue

                predicted = result.get("disease_name", "未知")
                confidence = result.get("confidence", 0)
                is_correct = _is_correct(predicted, disease)
                status = "✓" if is_correct else "✗"

                lines.append(f"**{img}** {status} → **{predicted}** (置信度 {confidence})\n")

                # 发病条件
                conditions = result.get("conditions", {})
                if isinstance(conditions, dict):
                    for key, label in [("climate", "气候"), ("variety", "品种"), ("cultivation", "栽培")]:
                        val = conditions.get(key, "")
                        if val:
                            lines.append(f"- **{label}因素:** {val}")
                elif conditions:
                    lines.append(f"- **发病条件:** {conditions}")

                # 症状
                symptoms = result.get("symptoms", {})
                if isinstance(symptoms, dict):
                    for key, label in [("initial", "初期"), ("typical", "典型"), ("late", "后期")]:
                        val = symptoms.get(key, "")
                        if val:
                            lines.append(f"- **{label}症状:** {val}")
                elif symptoms:
                    lines.append(f"- **症状:** {symptoms}")

                # 防治方案
                treatment = result.get("treatment", {})
                if isinstance(treatment, dict):
                    for key, label in [("agricultural", "农业防治"), ("seed_treatment", "种子处理"), ("chemical", "药剂防治")]:
                        val = treatment.get(key, "")
                        if val:
                            lines.append(f"- **{label}:** {val}")
                elif treatment:
                    lines.append(f"- **治疗:** {treatment}")

                # 评委评分理由
                per_image = scores.get(model_name, {}).get("per_image", {})
                img_score = per_image.get(img, {})
                cond_reason = img_score.get("conditions_reason", "")
                sym_reason = img_score.get("symptoms_reason", "")
                treat_reason = img_score.get("treatment_reason", "")
                if cond_reason:
                    lines.append(f"- **条件评分:** {img_score.get('conditions', 0)*100:.0f}分 — {cond_reason}")
                if sym_reason:
                    lines.append(f"- **症状评分:** {img_score.get('symptoms', 0)*100:.0f}分 — {sym_reason}")
                if treat_reason:
                    lines.append(f"- **方案评分:** {img_score.get('treatment', 0)*100:.0f}分 — {treat_reason}")

                lines.append("")

    # ====== 四、原始数据 ======
    lines.append("---\n")
    lines.append("## 四、原始数据\n")
    lines.append("完整 JSON 响应见 `results/` 目录下各模型的 `.json` 文件。\n")

    return "\n".join(lines)


def _collect_disease_names(scores: dict) -> list[str]:
    """从评分数据中收集所有病害名称，保持稳定排序"""
    names = set()
    for model_scores in scores.values():
        for disease in model_scores.get("per_disease", {}):
            names.add(disease)
    # 按固定顺序排列已知病害，新增的排在后面
    known_order = ["白粉病", "纹枯病", "细菌性叶枯病", "茎基腐病", "锈病", "赤霉病", "根腐病"]
    result = [n for n in known_order if n in names]
    result.extend(sorted(n for n in names if n not in known_order))
    return result


def _image_belongs_to(img_name: str, disease: str) -> bool:
    """判断图片是否属于指定病害"""
    return img_name.startswith(disease)


def _is_correct(predicted: str, expected: str) -> bool:
    """判断诊断是否正确"""
    p = predicted.replace("小麦", "").strip()
    e = expected.replace("小麦", "").strip()
    if p == e:
        return True
    if e == "锈病" and "锈病" in p:
        return True
    if e in p or p in e:
        return True
    return False
