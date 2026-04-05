"""POST /api/diagnose — 农作物病害诊断端点。"""

from __future__ import annotations

import logging
import re

from fastapi import APIRouter, File, Form, Request, UploadFile
from typing import Annotated
from fastapi.responses import JSONResponse

from middleware.trace_id import append_trace
from services.claude_api.client import (
    MAX_IMAGE_BYTES,
    ClaudeAPIError,
    ClaudeTimeoutError,
)
from services.product_match import match_products

logger = logging.getLogger(__name__)

router = APIRouter()

# 控制字符正则（防止 header injection）
_CONTROL_CHARS = re.compile(r"[\x00-\x1f\x7f]")

# 魔数 → MIME 类型映射（校验真实文件类型）
_MAGIC_SIGNATURES: list[tuple[bytes, bytes | None, int, str]] = [
    # (prefix, extra_check, extra_offset, mime)
    (b"\xff\xd8\xff", None, 0, "image/jpeg"),
    (b"\x89PNG", None, 0, "image/png"),
    (b"RIFF", b"WEBP", 8, "image/webp"),
]


def _sniff_mime(data: bytes) -> str | None:
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


MAX_IMAGES = 5


@router.post("/diagnose")
async def diagnose(
    request: Request,
    images: Annotated[list[UploadFile], File(description="1-5 张病害图片")],
    description: str = Form(default="", max_length=2000),
) -> JSONResponse:
    """接收图片和问题描述，返回 AI 诊断结果。"""

    # --- 图片数量校验 ---
    if len(images) == 0:
        return _error_response(400, "NO_IMAGE", "请至少上传 1 张图片")
    if len(images) > MAX_IMAGES:
        return _error_response(
            400,
            "IMAGE_COUNT_EXCEEDED",
            f"最多上传 {MAX_IMAGES} 张图片",
        )

    # --- trace 追加业务字段（过滤控制字符） ---
    first_filename = _CONTROL_CHARS.sub("", images[0].filename or "unknown") or "unknown"
    append_trace(request, "image", first_filename)
    if len(images) > 1:
        append_trace(request, "count", str(len(images)))
    if description:
        append_trace(request, "desc", description[:10])

    # --- 检查服务可用性 ---
    claude_client = request.app.state.claude_client
    if claude_client is None:
        return _error_response(
            503, "SERVICE_UNAVAILABLE", "AI 诊断服务未就绪，请联系管理员"
        )

    # --- 逐张读取、校验 ---
    images_list: list[tuple[bytes, str]] = []
    for idx, img in enumerate(images):
        image_data = await img.read(MAX_IMAGE_BYTES + 1)
        if len(image_data) > MAX_IMAGE_BYTES:
            return _error_response(
                400,
                "IMAGE_TOO_LARGE",
                "第{}张图片超过{}MB限制".format(idx + 1, MAX_IMAGE_BYTES // 1024 // 1024),
            )

        real_mime = _sniff_mime(image_data)
        if real_mime is None:
            return _error_response(
                400,
                "INVALID_IMAGE_FORMAT",
                "第{}张图片格式不支持，仅支持 jpg/png/webp".format(idx + 1),
            )

        images_list.append((image_data, real_mime))

    # --- 调用 AI 诊断 ---
    try:
        result = claude_client.diagnose(
            images=images_list,
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

    # --- 商品匹配注入 ---
    product_store = getattr(request.app.state, "product_store", None)
    if product_store and result.get("intervention"):
        result["intervention"] = match_products(
            result["intervention"], product_store
        )

    return JSONResponse(
        status_code=200,
        content={"success": True, "data": result},
    )
