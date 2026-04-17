"""Claude API 客户端 — OpenAI 兼容格式封装。"""

from __future__ import annotations

import base64
import io
import json
import logging
import os
import re
from typing import Any

from openai import APIError, APITimeoutError, OpenAI

from .prompts.diagnosis import SYSTEM_PROMPT, build_user_message

logger = logging.getLogger(__name__)

# 默认模型和超时
DEFAULT_MODEL = os.environ.get("CLAUDE_MODEL", "claude-sonnet-4-6")
DEFAULT_TIMEOUT = 90.0

# 允许的图片 MIME 类型
ALLOWED_MIME_TYPES = {"image/jpeg", "image/png", "image/webp"}

# 图片大小上限 10MB（用户上传限制）
MAX_IMAGE_BYTES = 10 * 1024 * 1024

# Claude API 实际限制 5MB，超过时自动压缩
_API_IMAGE_LIMIT = 4 * 1024 * 1024

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

        logger.info(
            "调用模型: model=%s, base_url=%s, temperature=0.3, max_tokens=2000, prompt长度=%d",
            self.model, self.base_url, len(SYSTEM_PROMPT),
        )

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

        # 单次遍历：校验 + 压缩 + 编码
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
            logger.info("图片原始大小: %dKB, mime=%s", len(image_data) // 1024, image_mime)
            # 超过阈值自动压缩（Claude API 限制 5MB）
            if len(image_data) > _API_IMAGE_LIMIT:
                image_data, image_mime = self._compress_image(image_data, image_mime)
            b64 = base64.b64encode(image_data).decode("utf-8")
            content.append(
                {
                    "type": "image_url",
                    "image_url": {"url": f"data:{image_mime};base64,{b64}"},
                }
            )
        content.append({"type": "text", "text": text})
        return content

    @staticmethod
    def _compress_image(image_data: bytes, image_mime: str) -> tuple[bytes, str]:
        """压缩图片到 4MB 以内，保持尽可能高的质量。"""
        from PIL import Image

        img = Image.open(io.BytesIO(image_data))

        # 先尝试降低 JPEG 质量
        for quality in (85, 70, 50, 30):
            buf = io.BytesIO()
            rgb = img.convert("RGB") if img.mode != "RGB" else img
            rgb.save(buf, format="JPEG", quality=quality)
            if buf.tell() <= _API_IMAGE_LIMIT:
                logger.info(
                    "图片压缩: %dKB → %dKB (quality=%d)",
                    len(image_data) // 1024, buf.tell() // 1024, quality,
                )
                return buf.getvalue(), "image/jpeg"

        # 质量压不下来，缩小分辨率
        scale = 0.7
        while scale > 0.2:
            new_size = (int(img.width * scale), int(img.height * scale))
            resized = img.resize(new_size, Image.LANCZOS)
            buf = io.BytesIO()
            rgb = resized.convert("RGB") if resized.mode != "RGB" else resized
            rgb.save(buf, format="JPEG", quality=70)
            if buf.tell() <= _API_IMAGE_LIMIT:
                logger.info(
                    "图片压缩+缩放: %dKB → %dKB (scale=%.1f, %dx%d)",
                    len(image_data) // 1024, buf.tell() // 1024,
                    scale, new_size[0], new_size[1],
                )
                return buf.getvalue(), "image/jpeg"
            scale -= 0.1

        # 兜底：强制缩到很小
        resized = img.resize((800, int(800 * img.height / img.width)), Image.LANCZOS)
        buf = io.BytesIO()
        resized.convert("RGB").save(buf, format="JPEG", quality=50)
        logger.warning("图片强制缩放到 800px: %dKB → %dKB", len(image_data) // 1024, buf.tell() // 1024)
        return buf.getvalue(), "image/jpeg"

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
        for key in ("diagnosis", "conditions", "symptoms", "treatment"):
            if key not in data:
                raise ClaudeAPIError(f"AI 返回缺少必要字段: {key}")

        return data
