"""POST /api/diagnose — 农作物病害诊断端点。"""

from __future__ import annotations

import base64
import binascii
import logging

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, field_validator

from middleware.trace_id import append_trace
from services.claude_api.client import (
    MAX_IMAGE_BYTES,
    ClaudeAPIError,
    ClaudeTimeoutError,
)
from services.product_match import match_treatment_products

logger = logging.getLogger(__name__)

router = APIRouter()


_ALLOWED_MIMES = {"image/jpeg", "image/png", "image/webp"}

# base64 编码后长度上限：10MB 原始 → ceil(10*1024*1024/3)*4 ≈ 14MB + 余量
_MAX_BASE64_CHARS = (MAX_IMAGE_BYTES * 4 // 3) + 16


class ImagePayload(BaseModel):
    """单张图片：base64 编码数据 + MIME 类型。"""

    data: str = Field(..., description="base64 编码的图片数据")
    mime: str = Field(..., description="MIME 类型，如 image/jpeg")

    @field_validator("mime")
    @classmethod
    def mime_must_be_allowed(cls, v: str) -> str:
        if v not in _ALLOWED_MIMES:
            raise ValueError(f"不支持的 MIME 类型: {v}")
        return v


class DiagnoseRequest(BaseModel):
    """诊断请求体。"""

    images: list[ImagePayload] = Field(..., min_length=1, max_length=5)
    description: str = Field(default="", max_length=2000)

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


@router.post("/diagnose")
async def diagnose(
    request: Request,
    body: DiagnoseRequest,
) -> JSONResponse:
    """接收 base64 图片和问题描述，返回 AI 诊断结果。"""

    # --- trace 追加业务字段 ---
    append_trace(request, "count", str(len(body.images)))
    if body.description:
        append_trace(request, "desc", body.description[:10])

    # --- 检查服务可用性 ---
    claude_client = request.app.state.claude_client
    if claude_client is None:
        return _error_response(
            503, "SERVICE_UNAVAILABLE", "AI 诊断服务未就绪，请联系管理员"
        )

    # --- 逐张解码、校验 ---
    images_list: list[tuple[bytes, str]] = []
    for idx, img in enumerate(body.images):
        # 预检 base64 字符串长度，避免解码超大数据导致 OOM
        if len(img.data) > _MAX_BASE64_CHARS:
            return _error_response(
                400,
                "IMAGE_TOO_LARGE",
                "第{}张图片超过{}MB限制".format(idx + 1, MAX_IMAGE_BYTES // 1024 // 1024),
            )

        try:
            image_data = base64.b64decode(img.data, validate=True)
        except (binascii.Error, ValueError):
            return _error_response(
                400,
                "INVALID_BASE64",
                "第{}张图片 base64 编码无效".format(idx + 1),
            )

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
            description=body.description or None,
        )
    except ClaudeTimeoutError:
        logger.error("诊断超时")
        return _error_response(500, "AI_TIMEOUT", "AI 诊断超时，请稍后重试")
    except ClaudeAPIError as e:
        logger.error("诊断失败: %s", e)
        return _error_response(500, "AI_ERROR", str(e))
    except ValueError as e:
        logger.error("参数错误: %s", e)
        return _error_response(400, "INVALID_INPUT", str(e))

    # --- trace 追加诊断结果 ---
    disease_name = result.get("diagnosis", {}).get("disease_name", "")
    if disease_name:
        append_trace(request, "disease", disease_name)

    # --- 商品匹配注入 ---
    product_store = getattr(request.app.state, "product_store", None)
    if product_store and result.get("treatment"):
        result["treatment"] = match_treatment_products(
            result["treatment"], product_store
        )

    return JSONResponse(
        status_code=200,
        content={"success": True, "data": result},
    )
