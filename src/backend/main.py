"""FastAPI 入口 — 数字农人 API。"""

from __future__ import annotations

import logging
import os
from contextlib import asynccontextmanager
from typing import AsyncIterator

from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from api.diagnose import router as diagnose_router
from api.health import router as health_router
from dao.product_store import ProductStore
from middleware.trace_id import TraceIdMiddleware
from services.claude_api.client import ClaudeClient

load_dotenv()

logging.basicConfig(
    format="%(asctime)s [%(levelname)s] %(message)s",
    level=logging.INFO,
)

_logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """应用生命周期：启动时初始化 ClaudeClient。"""
    api_key = os.environ.get("CLAUDE_API_KEY")
    base_url = os.environ.get("CLAUDE_API_BASE_URL")

    if api_key and base_url:
        app.state.claude_client = ClaudeClient(api_key=api_key, base_url=base_url)
    else:
        _logger.warning("CLAUDE_API_KEY 或 CLAUDE_API_BASE_URL 未设置，诊断端点将不可用")
        app.state.claude_client = None

    app.state.product_store = ProductStore()
    _logger.info("商品数据加载完成，共 %d 条", app.state.product_store.count)
    yield


app = FastAPI(title="数字农人 API", version="0.1.0", lifespan=lifespan)

# --- Middleware（注册顺序：后注册的先执行） ---
_cors_origins = os.environ.get("CORS_ORIGINS", "http://localhost:3000").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
    expose_headers=["X-Trace-Id"],
)
# 请求体大小限制：base64 膨胀约 4/3，5 张 × 10MB × 1.34 ≈ 67MB + headroom
MAX_BODY_BYTES = 75 * 1024 * 1024


class BodySizeLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):  # type: ignore[override]
        content_length = request.headers.get("content-length")
        if content_length and int(content_length) > MAX_BODY_BYTES:
            return JSONResponse(
                status_code=413,
                content={
                    "success": False,
                    "error_code": "PAYLOAD_TOO_LARGE",
                    "message": "请求体超过大小限制",
                },
            )
        return await call_next(request)


app.add_middleware(BodySizeLimitMiddleware)
app.add_middleware(TraceIdMiddleware)

# --- Routers ---
app.include_router(health_router)
app.include_router(diagnose_router, prefix="/api")
