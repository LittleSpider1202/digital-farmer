"""Claude API 客户端 — OpenAI 兼容格式封装。"""

from __future__ import annotations

import base64
import json
import logging
import os
import re
from typing import Any

from openai import APIError, APITimeoutError, OpenAI

from .prompts.diagnosis import SYSTEM_PROMPT, build_user_message

logger = logging.getLogger(__name__)

# 默认模型和超时
DEFAULT_MODEL = "claude-opus-4-6-20250414"
DEFAULT_TIMEOUT = 30.0

# 允许的图片 MIME 类型
ALLOWED_MIME_TYPES = {"image/jpeg", "image/png", "image/webp"}

# 图片大小上限 10MB（与 app_spec 一致）
MAX_IMAGE_BYTES = 10 * 1024 * 1024

# Markdown 代码块正则
_FENCE_RE = re.compile(r"```(?:\w+)?\n([\s\S]*?)```")


class ClaudeAPIError(Exception):
    """Claude API 调用异常。"""


class ClaudeTimeoutError(ClaudeAPIError):
    """Claude API 超时异常。"""


class ClaudeClient:
    """通过 OpenAI 兼容格式调用 Claude API。"""

    def __init__(
        self,
        api_key: str | None = None,
        base_url: str | None = None,
        model: str = DEFAULT_MODEL,
        timeout: float = DEFAULT_TIMEOUT,
    ) -> None:
        self.api_key = api_key or os.environ.get("CLAUDE_API_KEY")
        self.base_url = base_url or os.environ.get("CLAUDE_API_BASE_URL")

        if not self.api_key:
            raise ValueError("CLAUDE_API_KEY 未设置：请通过参数或环境变量提供")
        if not self.base_url:
            raise ValueError("CLAUDE_API_BASE_URL 未设置：请通过参数或环境变量提供")

        self.model = model
        self.timeout = timeout

        self._client = OpenAI(
            api_key=self.api_key,
            base_url=self.base_url,
            timeout=self.timeout,
        )

    def diagnose(
        self,
        images: list[tuple[bytes, str]] | None = None,
        description: str | None = None,
    ) -> dict[str, Any]:
        """发送诊断请求，返回结构化诊断结果。

        Args:
            images: 图片列表，每项为 (二进制数据, MIME类型)，1-5 张
            description: 用户问题描述（可选）

        Returns:
            包含 diagnosis/prevention/intervention 的字典

        Raises:
            ClaudeAPIError: API 调用失败或返回格式异常
        """
        user_content = self._build_user_content(images, description)

        messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_content},
        ]

        try:
            response = self._client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=0.3,
                max_tokens=2000,
            )
        except APITimeoutError as e:
            raise ClaudeTimeoutError(f"Claude API 超时（>{self.timeout}s）") from e
        except APIError as e:
            logger.error("Claude API error: %s", e.message or str(e))
            raise ClaudeAPIError("AI 服务暂时不可用，请稍后重试") from e

        if not response.choices:
            raise ClaudeAPIError("Claude API 返回空 choices 列表")

        raw_text = response.choices[0].message.content
        if raw_text is None:
            raise ClaudeAPIError("Claude API 返回空内容（可能触发内容过滤）")

        return self._parse_response(raw_text)

    def _build_user_content(
        self,
        images: list[tuple[bytes, str]] | None,
        description: str | None,
    ) -> str | list[dict[str, Any]]:
        """构建用户消息内容（纯文本或图文混合）。"""
        if not images:
            return build_user_message(description)

        text = build_user_message(description, image_count=len(images))

        # 单次遍历：校验 + 编码（endpoint 层已校验，此处为防御性检查）
        content: list[dict[str, Any]] = []
        for image_data, image_mime in images:
            if len(image_data) > MAX_IMAGE_BYTES:
                raise ValueError(
                    f"图片大小超出限制（最大 {MAX_IMAGE_BYTES // 1024 // 1024} MB）"
                )
            if image_mime not in ALLOWED_MIME_TYPES:
                raise ValueError(
                    f"不支持的图片类型: {image_mime}，仅支持 {ALLOWED_MIME_TYPES}"
                )
            b64 = base64.b64encode(image_data).decode("utf-8")
            content.append(
                {
                    "type": "image_url",
                    "image_url": {"url": f"data:{image_mime};base64,{b64}"},
                }
            )
        content.append({"type": "text", "text": text})
        return content

    def _parse_response(self, raw_text: str) -> dict[str, Any]:
        """解析 AI 返回的 JSON 文本。"""
        text = raw_text.strip()

        # 兼容模型可能包裹 markdown 代码块的情况
        fence_match = _FENCE_RE.search(text)
        if fence_match:
            text = fence_match.group(1).strip()
        elif text.startswith("```"):
            raise ClaudeAPIError("AI 返回内容不完整（可能触发 max_tokens 截断）")

        try:
            data = json.loads(text)
        except json.JSONDecodeError as e:
            logger.debug("AI returned invalid JSON: %s", e)
            raise ClaudeAPIError("AI 返回非法 JSON") from e

        # 基本结构校验
        for key in ("diagnosis", "prevention", "intervention"):
            if key not in data:
                raise ClaudeAPIError(f"AI 返回缺少必要字段: {key}")

        return data
