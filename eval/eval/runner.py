"""评测执行器 - 遍历图片×模型，收集结果"""
from __future__ import annotations

import asyncio
import json
import time
from datetime import datetime
from pathlib import Path

from .prompts import load_diagnose_prompt
from .models import create_model


async def run_single(model_instance, image_path: str, image_name: str,
                     system_prompt: str, user_prompt: str) -> dict:
    """对单张图片调用单个模型"""
    start = time.time()
    try:
        result = await model_instance.diagnose(image_path, system_prompt, user_prompt)
        result["_latency_ms"] = int((time.time() - start) * 1000)
        result["_error"] = None
    except Exception as e:
        result = {
            "_error": str(e),
            "_raw": "",
            "_model": model_instance.name,
            "_latency_ms": int((time.time() - start) * 1000),
            "_parse_error": True,
            "disease_name": "调用失败",
            "confidence": 0,
        }
    result["_image"] = image_name
    result["_timestamp"] = datetime.now().isoformat()
    return result


async def run_model_on_all_images(model_instance, image_paths: list[tuple[str, str]],
                                  system_prompt: str, user_prompt: str,
                                  existing_results: list[dict] | None = None) -> list[dict]:
    """单个模型跑所有图片，支持断点续跑（跳过已成功的）"""
    total = len(image_paths)

    # 构建已有结果索引：image_name -> result
    existing_map = {}
    if existing_results:
        for r in existing_results:
            name = r.get("_image", "")
            if name and not r.get("_error") and not r.get("_parse_error"):
                existing_map[name] = r

    results = []
    skipped = 0
    errors = 0
    t0 = time.time()

    for i, (image_path, image_name) in enumerate(image_paths, 1):
        # 断点续跑：跳过已成功的
        if image_name in existing_map:
            results.append(existing_map[image_name])
            skipped += 1
            continue

        retry_tag = " [重试]" if existing_results else ""
        result = await run_single(model_instance, image_path, image_name, system_prompt, user_prompt)
        if result.get("_error"):
            errors += 1

        called = i - skipped
        elapsed = time.time() - t0
        avg_per_call = elapsed / called if called > 0 else 0
        remaining = sum(1 for _, n in image_paths[i:] if n not in existing_map)
        eta = int(avg_per_call * remaining)
        eta_str = f"{eta//60}m{eta%60:02d}s" if eta >= 60 else f"{eta}s"

        status = "x" if result.get("_error") else result.get("disease_name", "?")
        print(f"  [{i}/{total}] {image_name}{retry_tag} -> {status} ({result.get('_latency_ms', 0)}ms) ETA {eta_str}", flush=True)
        results.append(result)

    elapsed_total = int(time.time() - t0)
    new_count = total - skipped
    if skipped:
        print(f"\n  跳过已成功: {skipped} 张, 新调用: {new_count} 张, 失败 {errors}, 耗时 {elapsed_total//60}m{elapsed_total%60:02d}s")
    else:
        print(f"\n  完成: {total} 张, 失败 {errors}, 耗时 {elapsed_total//60}m{elapsed_total%60:02d}s")
    return results


async def run_evaluation(config: dict, images_dir: str, experiment_dir: str,
                         models: list[str] | None = None,
                         diagnose_prompt: str = "v1_baseline",
                         judge_prompt: str = "v1_claude",
                         prompt_vars: dict | None = None,
                         image_whitelist: list[str] | None = None) -> tuple[dict, Path]:
    """
    在实验目录内执行评测

    Args:
        config: 包含各模型API key的配置
        images_dir: 图片目录
        experiment_dir: 实验结果目录
        models: 要测试的模型列表，None 表示全部
        diagnose_prompt: 诊断 prompt 名称
        judge_prompt: 评委 prompt 名称
        prompt_vars: prompt 模板变量，如 {"crop": "小麦"}
        image_whitelist: 只跑这些图片（文件名列表），None 表示全部
    """
    system_prompt, user_prompt = load_diagnose_prompt(diagnose_prompt, **(prompt_vars or {}))

    exp_dir = Path(experiment_dir)
    exp_dir.mkdir(parents=True, exist_ok=True)
    print(f"实验目录: {exp_dir}", flush=True)

    # 收集图片
    images_path = Path(images_dir)
    image_files = []
    for ext in ("*.jpeg", "*.jpg", "*.png"):
        image_files.extend(images_path.glob(ext))
    image_files.sort(key=lambda p: p.name)

    # 白名单过滤
    if image_whitelist:
        whiteset = set(image_whitelist)
        image_files = [f for f in image_files if f.name in whiteset]

    image_paths = [(str(p), p.name) for p in image_files]
    print(f"共 {len(image_paths)} 张图片待评测\n", flush=True)

    # 确定要测试的模型（从 config 读取可用模型列表）
    all_model_configs = config.get("models", {})
    model_names = models or list(all_model_configs.keys())

    # 加载已有结果（支持增量跑模型）
    all_results = {}
    all_results_file = exp_dir / "all_results.json"
    if all_results_file.exists():
        with open(all_results_file, "r", encoding="utf-8") as f:
            all_results = json.load(f)

    # 逐模型串行（避免并发导致API限流）
    for model_name in model_names:
        model_config = all_model_configs.get(model_name, {})

        if not model_config:
            print(f"跳过未知模型: {model_name}（config.yaml 中未定义）")
            continue

        if model_config.get("provider") != "claude-cli" and not model_config.get("api_key"):
            print(f"跳过 {model_name}: 未配置 API Key")
            continue

        model_instance = create_model(model_name, model_config)

        print(f"\n{'='*50}", flush=True)
        print(f"评测模型: {model_instance.display_name} ({model_name})", flush=True)
        print(f"{'='*50}", flush=True)

        # 加载已有结果（支持断点续跑）
        model_dir = exp_dir / model_name
        model_dir.mkdir(parents=True, exist_ok=True)
        model_result_file = model_dir / "result.json"
        existing_results = None
        if model_result_file.exists():
            with open(model_result_file, "r", encoding="utf-8") as f:
                existing_results = json.load(f)

        results = await run_model_on_all_images(model_instance, image_paths,
                                                system_prompt, user_prompt,
                                                existing_results=existing_results)
        all_results[model_name] = results

        # 保存结果
        with open(model_result_file, "w", encoding="utf-8") as f:
            json.dump(results, f, ensure_ascii=False, indent=2)
        print(f"结果已保存: {model_result_file}")

    # 保存汇总结果
    with open(all_results_file, "w", encoding="utf-8") as f:
        json.dump(all_results, f, ensure_ascii=False, indent=2)
    print(f"\n汇总结果: {all_results_file}")

    # 写入实验元信息
    meta = {
        "timestamp": datetime.now().isoformat(),
        "diagnose_prompt": diagnose_prompt,
        "judge_prompt": judge_prompt,
        "models": list(all_results.keys()),
        "total_images": len(image_paths),
    }
    with open(exp_dir / "meta.json", "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)

    return all_results, exp_dir
