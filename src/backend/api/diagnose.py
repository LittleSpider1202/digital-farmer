"""POST /api/diagnose — 农作物病害诊断端点。"""

from __future__ import annotations

import logging
import re
from typing import Optional

from fastapi import APIRouter, File, Form, Request, UploadFile
from fastapi.responses import JSONResponse

from middleware.trace_id import append_trace
from services.claude_api.client import (
    MAX_IMAGE_BYTES,
    ClaudeAPIError,
    ClaudeTimeoutError,
)

logger = logging.getLogger(__name__)

router = APIRouter()

# 控制字符正则（防止 header injection）
_CONTROL_CHARS = re.compile(r"[\x00-\x1f\x7f]")

# 魔数 → MIME 类型映射（校验真实文件类型）
_MAGIC_SIGNATURES: list[tuple[bytes, Optional[bytes], int, str]] = [
    # (prefix, extra_check, extra_offset, mime)
    (b"\xff\xd8\xff", None, 0, "image/jpeg"),
    (b"\x89PNG", None, 0, "image/png"),
    (b"RIFF", b"WEBP", 8, "image/webp"),
]


def _sniff_mime(data: bytes) -> Optional[str]:
    """通过文件魔数检测真实 MIME 类型。"""
    for prefix, extra, offset, mime in _MAGIC_SIGNATURES:
        if data[:len(prefix)] == prefix:
            if extra is None:
                return mime
            if data[offset:offset + len(extra)] == extra:
                return mime
    return None


def _error_response(
    status_code: int, error_code: str, message: str
) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={"success": False, "error_code": error_code, "message": message},
    )


@router.post("/diagnose")
async def diagnose(
    request: Request,
    image: UploadFile = File(...),
    description: str = Form(default="", max_length=2000),
) -> JSONResponse:
    """接收图片和问题描述，返回 AI 诊断结果。"""

    # --- trace 追加业务字段（过滤控制字符） ---
    filename = _CONTROL_CHARS.sub("", image.filename or "unknown") or "unknown"
    append_trace(request, "image", filename)
    if description:
        append_trace(request, "desc", description[:10])

    # --- 检查服务可用性 ---
    claude_client = request.app.state.claude_client
    if claude_client is None:
        return _error_response(
            503, "SERVICE_UNAVAILABLE", "AI 诊断服务未就绪，请联系管理员"
        )

    # --- 读取图片（限制读取量，防止内存耗尽） ---
    image_data = await image.read(MAX_IMAGE_BYTES + 1)
    if len(image_data) > MAX_IMAGE_BYTES:
        return _error_response(
            400,
            "IMAGE_TOO_LARGE",
            "上传图片超过{}MB限制".format(MAX_IMAGE_BYTES // 1024 // 1024),
        )

    # --- 魔数校验真实文件类型 ---
    real_mime = _sniff_mime(image_data)
    if real_mime is None:
        return _error_response(
            400,
            "INVALID_IMAGE_FORMAT",
            "仅支持 jpg/png/webp 格式",
        )

    # --- 调用 AI 诊断 ---
    try:
        result = claude_client.diagnose(
            image_data=image_data,
            image_mime=real_mime,
            description=description or None,
        )
    except ClaudeTimeoutError:
        logger.error("诊断超时")
        return _error_response(500, "AI_TIMEOUT", "AI 诊断超时，请稍后重试")
    except (ClaudeAPIError, ValueError) as e:
        logger.error("诊断失败: %s", e)
        return _error_response(500, "INTERNAL_ERROR", "服务器内部错误")

    # --- trace 追加诊断结果 ---
    disease_name = result.get("diagnosis", {}).get("disease_name", "")
    if disease_name:
        append_trace(request, "disease", disease_name)

    return JSONResponse(
        status_code=200,
        content={"success": True, "data": result},
    )
