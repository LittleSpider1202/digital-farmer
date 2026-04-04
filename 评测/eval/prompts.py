"""Prompt 加载器 - 从 prompts/ 目录加载 YAML 定义的 prompt"""

from pathlib import Path

import yaml

PROMPTS_DIR = Path(__file__).parent.parent / "prompts"


def load_prompt(category: str, name: str) -> dict:
    """加载指定 prompt 文件

    Args:
        category: 子目录名，如 "diagnose" 或 "judge"
        name: 文件名（不含 .yaml），如 "v1_baseline"

    Returns:
        YAML 文件解析后的 dict
    """
    path = PROMPTS_DIR / category / f"{name}.yaml"
    if not path.exists():
        raise FileNotFoundError(f"Prompt 文件不存在: {path}")
    with open(path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)


def load_diagnose_prompt(name: str = "v1_baseline", **kwargs) -> tuple[str, str]:
    """加载诊断 prompt，返回 (system_prompt, user_prompt)

    支持 user_prompt 模板变量替换，如 {crop} → "小麦"
    system_prompt 不做替换（含 JSON 示例，花括号会冲突）
    """
    data = load_prompt("diagnose", name)
    system_prompt = data["system_prompt"]
    user_prompt = data["user_prompt"]
    if kwargs:
        user_prompt = user_prompt.format(**kwargs)
    return system_prompt, user_prompt


def load_judge_prompt(name: str = "v1_claude") -> str:
    """加载评委 prompt 模板"""
    data = load_prompt("judge", name)
    return data["prompt"]


# 向后兼容：默认加载 v1 baseline
SYSTEM_PROMPT, USER_PROMPT = load_diagnose_prompt()
