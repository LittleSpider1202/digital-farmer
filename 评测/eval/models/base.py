"""模型适配器基类 - 统一接口"""

import base64
import json
import re
from abc import ABC, abstractmethod
from pathlib import Path


class BaseModel(ABC):
    """所有模型适配器的基类"""

    name: str = "base"
    display_name: str = "Base Model"

    def __init__(self, config: dict):
        self.config = config

    @abstractmethod
    async def _call_api(self, image_b64: str, system_prompt: str, user_prompt: str) -> str:
        """调用模型API，返回原始文本响应"""
        ...

    async def diagnose(self, image_path: str, system_prompt: str, user_prompt: str) -> dict:
        """统一诊断接口：图片路径 -> 结构化结果"""
        image_b64 = self._encode_image(image_path)
        raw_response = await self._call_api(image_b64, system_prompt, user_prompt)
        result = self._parse_response(raw_response)
        result["_raw"] = raw_response
        result["_model"] = self.name
        return result

    @staticmethod
    def _encode_image(image_path: str) -> str:
        """将图片编码为 base64"""
        path = Path(image_path)
        suffix = path.suffix.lower()
        mime_map = {".jpeg": "image/jpeg", ".jpg": "image/jpeg", ".png": "image/png"}
        mime = mime_map.get(suffix, "image/jpeg")
        with open(path, "rb") as f:
            b64 = base64.b64encode(f.read()).decode()
        return f"data:{mime};base64,{b64}"

    @staticmethod
    def _parse_response(raw: str) -> dict:
        """从模型原始输出中提取 JSON"""
        # 尝试从 markdown code block 中提取
        match = re.search(r"```(?:json)?\s*\n?(.*?)\n?```", raw, re.DOTALL)
        text = match.group(1).strip() if match else raw.strip()

        try:
            return json.loads(text)
        except json.JSONDecodeError:
            # 尝试找到第一个 { 到最后一个 }
            start = text.find("{")
            end = text.rfind("}")
            if start != -1 and end != -1:
                try:
                    return json.loads(text[start:end + 1])
                except json.JSONDecodeError:
                    pass
            return {"_parse_error": True, "disease_name": "解析失败", "confidence": 0}
