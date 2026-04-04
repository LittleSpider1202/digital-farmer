from .base import BaseModel
from .openai_compat import OpenAICompatModel
from .claude_cli import ClaudeCLIModel


def create_model(name: str, config: dict) -> BaseModel:
    """从 config 创建模型实例，根据 provider 字段路由"""
    provider = config.get("provider", "openai")
    if provider == "claude-cli":
        return ClaudeCLIModel(name=name, config=config)
    return OpenAICompatModel(name=name, config=config)
