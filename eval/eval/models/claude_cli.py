"""Claude CLI 模型 - 通过 claude -p 调用，走 Max 订阅额度"""

import json
import subprocess

from .base import BaseModel


class ClaudeCLIModel(BaseModel):
    """通过 claude -p 命令调用 Claude 模型"""

    def __init__(self, name: str, config: dict):
        super().__init__(config)
        self.name = name
        self.display_name = config.get("display_name", name)
        self.model_id = config.get("model_id", "")

    async def _call_api(self, image_b64: str, system_prompt: str, user_prompt: str) -> str:
        """不使用此方法，claude -p 不走 base64 编码"""
        raise NotImplementedError("ClaudeCLIModel uses diagnose() directly")

    async def diagnose(self, image_path: str, system_prompt: str, user_prompt: str) -> dict:
        """通过 claude -p 调用，图片直接传文件路径"""
        # 拼接 prompt：system + user + 图片路径
        prompt = f"{system_prompt}\n\n{user_prompt}\n\n{image_path}"

        cmd = ["claude", "-p", "--output-format", "json", "--bare"]
        if self.model_id:
            cmd.extend(["--model", self.model_id])

        try:
            proc = subprocess.run(
                cmd,
                input=prompt,
                capture_output=True,
                text=True,
                timeout=120,
                encoding="utf-8",
            )
            resp = json.loads(proc.stdout)

            if resp.get("is_error") or resp.get("subtype") != "success":
                error_msg = resp.get("result", "未知错误")[:200]
                return {
                    "_error": f"claude -p 失败: {error_msg}",
                    "_raw": proc.stdout[:500],
                    "_model": self.name,
                    "_parse_error": True,
                    "disease_name": "调用失败",
                    "confidence": 0,
                }

            raw = resp.get("result", "")

        except (subprocess.TimeoutExpired, FileNotFoundError) as e:
            return {
                "_error": str(e),
                "_raw": "",
                "_model": self.name,
                "_parse_error": True,
                "disease_name": "调用失败",
                "confidence": 0,
            }
        except json.JSONDecodeError:
            return {
                "_error": "claude -p 响应解析失败",
                "_raw": proc.stdout[:500] if proc else "",
                "_model": self.name,
                "_parse_error": True,
                "disease_name": "解析失败",
                "confidence": 0,
            }

        result = self._parse_response(raw)
        result["_raw"] = raw
        result["_model"] = self.name
        return result
