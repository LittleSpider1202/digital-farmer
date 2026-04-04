"""OpenAI 兼容接口 - 国内多数模型支持此格式

所有模型配置从 config.yaml 读取，无需为每个模型创建单独的类。
"""

import httpx
from .base import BaseModel


class OpenAICompatModel(BaseModel):
    """兼容 OpenAI Chat Completions API 格式的模型"""

    def __init__(self, name: str, config: dict):
        super().__init__(config)
        self.name = name
        self.display_name = config.get("display_name", name)
        self.api_base = config.get("api_base", "")
        self.model_id = config.get("model_id", "")

    def _get_api_key(self) -> str:
        return self.config.get("api_key", "")

    def _get_headers(self) -> dict:
        return {
            "Authorization": f"Bearer {self._get_api_key()}",
            "Content-Type": "application/json",
        }

    def _build_payload(self, image_b64: str, system_prompt: str, user_prompt: str) -> dict:
        return {
            "model": self.model_id,
            "messages": [
                {"role": "system", "content": system_prompt},
                {
                    "role": "user",
                    "content": [
                        {"type": "image_url", "image_url": {"url": image_b64}},
                        {"type": "text", "text": user_prompt},
                    ],
                },
            ],
            "temperature": 0.1,
            "max_tokens": 2000,
        }

    async def _call_api(self, image_b64: str, system_prompt: str, user_prompt: str) -> str:
        url = f"{self.api_base}/chat/completions"
        payload = self._build_payload(image_b64, system_prompt, user_prompt)
        headers = self._get_headers()

        async with httpx.AsyncClient(timeout=120) as client:
            resp = await client.post(url, json=payload, headers=headers)
            resp.raise_for_status()
            data = resp.json()
            return data["choices"][0]["message"]["content"]
