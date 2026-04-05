"""Trace ID 中间件 — 生成请求级 trace_id，写入响应 header。"""

from __future__ import annotations

import re
import secrets
from urllib.parse import quote

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response


class TraceIdMiddleware(BaseHTTPMiddleware):
    """为每个请求生成 trace_id，注入 request.state 并写入响应 header。"""

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        trace_id = secrets.token_hex(8)

        # 初始化 trace_id 和 parts 列表，业务层可通过 append_trace 追加字段
        request.state.trace_id = trace_id
        request.state.trace_parts = []

        response = await call_next(request)

        # 最终 trace_id = 业务字段|...|hex
        final_parts = request.state.trace_parts
        final_parts.append(trace_id)  # hex 始终在末尾
        response.headers["X-Trace-Id"] = "|".join(final_parts)

        return response


def append_trace(request: Request, key: str, value: str) -> None:
    """向当前请求的 trace_id 追加业务字段。

    Args:
        request: 当前 FastAPI Request 对象
        key: 字段名（如 "image", "desc", "disease"）
        value: 字段值（会截取前 20 字符）
    """
    _CRLF_PIPE = re.compile(r"[\r\n|]")
    truncated = value[:20] if value else ""
    safe_value = quote(_CRLF_PIPE.sub("", truncated), safe="")
    request.state.trace_parts.append(f"{key}={safe_value}")
