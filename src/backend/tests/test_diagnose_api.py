"""POST /api/diagnose 端点测试。"""

from __future__ import annotations

import io
from typing import Iterator
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

from main import app
from services.claude_api.client import ClaudeAPIError, ClaudeTimeoutError

# JPEG 最小合法魔数
_JPEG_MAGIC = b"\xff\xd8\xff\xe0" + b"\x00" * 100
# PNG ���数
_PNG_MAGIC = b"\x89PNG\r\n\x1a\n" + b"\x00" * 100
# WebP 魔数: RIFF + 4 bytes size + WEBP
_WEBP_MAGIC = b"RIFF\x00\x00\x00\x00WEBP" + b"\x00" * 100
# GIF 魔数（不允许）
_GIF_MAGIC = b"GIF89a" + b"\x00" * 100


@pytest.fixture()
def client() -> Iterator[TestClient]:
    """创建 TestClient 并注入 mock ClaudeClient（lifespan 后覆盖）。"""
    with TestClient(app) as c:
        app.state.claude_client = MagicMock()
        yield c
    app.state.claude_client = None


def _make_image(
    content: bytes = _JPEG_MAGIC,
    content_type: str = "image/jpeg",
    filename: str = "test.jpg",
) -> tuple:
    """构造 multipart 上传的图片元组。"""
    return ("images", (filename, io.BytesIO(content), content_type))


# ────────────────────────────────────────────
# 正常诊断
# ──────────────────��─────────────────────────

MOCK_DIAGNOSIS = {
    "diagnosis": {
        "disease_name": "小麦白粉病",
        "confidence": 0.85,
        "description": "白粉病是由真菌引起的常见病害",
    },
    "prevention": ["选择抗病品种", "合理密植"],
    "intervention": [
        {
            "action": "喷施{{三唑酮可��性粉剂}}",
            "details": "每亩用量50-75克",
        }
    ],
}


class TestDiagnoseSuccess:
    """正常诊断请求。"""

    def test_normal_upload(self, client: TestClient) -> None:
        app.state.claude_client.diagnose.return_value = MOCK_DIAGNOSIS

        resp = client.post(
            "/api/diagnose",
            files=[_make_image()],
            data={"description": "叶子发黄有斑点"},
        )

        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert body["data"]["diagnosis"]["disease_name"] == "小麦白粉病"
        assert body["data"]["prevention"] == ["选择抗病品种", "合理密植"]
        assert len(body["data"]["intervention"]) == 1

    def test_empty_description(self, client: TestClient) -> None:
        app.state.claude_client.diagnose.return_value = MOCK_DIAGNOSIS

        resp = client.post(
            "/api/diagnose",
            files=[_make_image()],
            data={"description": ""},
        )

        assert resp.status_code == 200
        assert resp.json()["success"] is True
        call_kwargs = app.state.claude_client.diagnose.call_args.kwargs
        assert call_kwargs["description"] is None
        assert len(call_kwargs["images"]) == 1

    def test_no_description_field(self, client: TestClient) -> None:
        """不传 description 字段，默认空字符串。"""
        app.state.claude_client.diagnose.return_value = MOCK_DIAGNOSIS

        resp = client.post(
            "/api/diagnose",
            files=[_make_image()],
        )

        assert resp.status_code == 200
        assert resp.json()["success"] is True

    def test_png_upload(self, client: TestClient) -> None:
        app.state.claude_client.diagnose.return_value = MOCK_DIAGNOSIS

        resp = client.post(
            "/api/diagnose",
            files=[_make_image(content=_PNG_MAGIC, content_type="image/png", filename="test.png")],
        )

        assert resp.status_code == 200

    def test_webp_upload(self, client: TestClient) -> None:
        app.state.claude_client.diagnose.return_value = MOCK_DIAGNOSIS

        resp = client.post(
            "/api/diagnose",
            files=[_make_image(content=_WEBP_MAGIC, content_type="image/webp", filename="test.webp")],
        )

        assert resp.status_code == 200


# ──��─────────────────────────────────────────
# 输入校验错误
# ─────────��──────────────────────────────────


class TestDiagnoseValidation:
    """输入校验：格式和大小。"""

    def test_invalid_magic_bytes(self, client: TestClient) -> None:
        """即使 content_type 是 image/jpeg，魔数不对也拒绝。"""
        resp = client.post(
            "/api/diagnose",
            files=[_make_image(content=_GIF_MAGIC, content_type="image/jpeg")],
        )

        assert resp.status_code == 400
        assert resp.json()["error_code"] == "INVALID_IMAGE_FORMAT"

    def test_invalid_format_gif(self, client: TestClient) -> None:
        resp = client.post(
            "/api/diagnose",
            files=[_make_image(content=_GIF_MAGIC, content_type="image/gif", filename="test.gif")],
        )

        assert resp.status_code == 400
        body = resp.json()
        assert body["success"] is False
        assert body["error_code"] == "INVALID_IMAGE_FORMAT"

    def test_invalid_format_pdf(self, client: TestClient) -> None:
        resp = client.post(
            "/api/diagnose",
            files=[_make_image(content=b"%PDF-1.4", content_type="application/pdf", filename="test.pdf")],
        )

        assert resp.status_code == 400
        assert resp.json()["error_code"] == "INVALID_IMAGE_FORMAT"

    def test_image_too_large(self, client: TestClient) -> None:
        # 10MB + 1 byte，保留 JPEG 魔数
        oversized = _JPEG_MAGIC + b"\x00" * (10 * 1024 * 1024 + 1 - len(_JPEG_MAGIC))

        resp = client.post(
            "/api/diagnose",
            files=[_make_image(content=oversized)],
        )

        assert resp.status_code == 400
        body = resp.json()
        assert body["error_code"] == "IMAGE_TOO_LARGE"

    def test_image_exactly_10mb(self, client: TestClient) -> None:
        """恰好 10MB 应该通过。"""
        app.state.claude_client.diagnose.return_value = MOCK_DIAGNOSIS
        exact = _JPEG_MAGIC + b"\x00" * (10 * 1024 * 1024 - len(_JPEG_MAGIC))

        resp = client.post(
            "/api/diagnose",
            files=[_make_image(content=exact)],
        )

        assert resp.status_code == 200


# ────────────────────────────────────────────
# 服务不可用
# ────────────────────────────────────────────


class TestServiceUnavailable:
    """ClaudeClient 未初始化时返回 503。"""

    def test_null_client_returns_503(self) -> None:
        app.state.claude_client = None
        with TestClient(app) as c:
            resp = c.post(
                "/api/diagnose",
                files=[_make_image()],
            )
        assert resp.status_code == 503
        assert resp.json()["error_code"] == "SERVICE_UNAVAILABLE"


# ────────────────────────────────────────────
# AI 服务错误
# ─────���──────────────────────────────────────


class TestDiagnoseAIErrors:
    """Claude API 异常处理。"""

    def test_ai_timeout(self, client: TestClient) -> None:
        app.state.claude_client.diagnose.side_effect = ClaudeTimeoutError(
            "Claude API 超时（>30s）"
        )

        resp = client.post(
            "/api/diagnose",
            files=[_make_image()],
            data={"description": "叶子有黑斑"},
        )

        assert resp.status_code == 500
        body = resp.json()
        assert body["error_code"] == "AI_TIMEOUT"

    def test_ai_internal_error(self, client: TestClient) -> None:
        app.state.claude_client.diagnose.side_effect = ClaudeAPIError(
            "AI 服务暂时不可用"
        )

        resp = client.post(
            "/api/diagnose",
            files=[_make_image()],
        )

        assert resp.status_code == 500
        assert resp.json()["error_code"] == "INTERNAL_ERROR"

    def test_value_error_caught(self, client: TestClient) -> None:
        """ClaudeClient 内部 ValueError 也应被捕获。"""
        app.state.claude_client.diagnose.side_effect = ValueError("unexpected")

        resp = client.post(
            "/api/diagnose",
            files=[_make_image()],
        )

        assert resp.status_code == 500
        assert resp.json()["error_code"] == "INTERNAL_ERROR"


# ─────────────────────────���──────────────────
# Trace ID Header
# ────────────────────────────────────────────


class TestTraceId:
    """X-Trace-Id 响应 header。"""

    def test_trace_id_present_on_success(self, client: TestClient) -> None:
        app.state.claude_client.diagnose.return_value = MOCK_DIAGNOSIS

        resp = client.post(
            "/api/diagnose",
            files=[_make_image()],
            data={"description": "叶子发黄"},
        )

        trace_id = resp.headers.get("X-Trace-Id", "")
        assert trace_id  # 非空
        assert "image=" in trace_id
        assert "desc=" in trace_id

    def test_trace_id_contains_disease(self, client: TestClient) -> None:
        app.state.claude_client.diagnose.return_value = MOCK_DIAGNOSIS

        resp = client.post(
            "/api/diagnose",
            files=[_make_image()],
        )

        trace_id = resp.headers.get("X-Trace-Id", "")
        # URL-encoded
        assert "disease=" in trace_id

    def test_trace_id_present_on_error(self, client: TestClient) -> None:
        """即使校验失败也应有 trace_id。"""
        resp = client.post(
            "/api/diagnose",
            files=[_make_image(content=_GIF_MAGIC, content_type="image/gif")],
        )

        assert resp.headers.get("X-Trace-Id")

    def test_health_has_trace_id(self, client: TestClient) -> None:
        resp = client.get("/health")
        assert resp.status_code == 200
        assert resp.headers.get("X-Trace-Id")


# ────────────────────────────────────────────
# 多图上传
# ────────────────────────────────────────────


class TestMultiImageUpload:
    """Feature #9：多图上传（1-5 张）。"""

    def test_two_images(self, client: TestClient) -> None:
        """上传 2 张图片正常诊断。"""
        app.state.claude_client.diagnose.return_value = MOCK_DIAGNOSIS

        resp = client.post(
            "/api/diagnose",
            files=[
                _make_image(filename="img1.jpg"),
                _make_image(content=_PNG_MAGIC, content_type="image/png", filename="img2.png"),
            ],
            data={"description": "多处病斑"},
        )

        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        # 验证传给 claude_client 的 images 列表长度
        call_kwargs = app.state.claude_client.diagnose.call_args.kwargs
        assert len(call_kwargs["images"]) == 2

    def test_five_images_max(self, client: TestClient) -> None:
        """上传 5 张图片（上限）正常诊断。"""
        app.state.claude_client.diagnose.return_value = MOCK_DIAGNOSIS

        resp = client.post(
            "/api/diagnose",
            files=[_make_image(filename=f"img{i}.jpg") for i in range(5)],
        )

        assert resp.status_code == 200
        call_kwargs = app.state.claude_client.diagnose.call_args.kwargs
        assert len(call_kwargs["images"]) == 5

    def test_six_images_rejected(self, client: TestClient) -> None:
        """超过 5 张返回 400 IMAGE_COUNT_EXCEEDED。"""
        resp = client.post(
            "/api/diagnose",
            files=[_make_image(filename=f"img{i}.jpg") for i in range(6)],
        )

        assert resp.status_code == 400
        assert resp.json()["error_code"] == "IMAGE_COUNT_EXCEEDED"

    def test_single_image_backward_compat(self, client: TestClient) -> None:
        """单张图片仍然兼容。"""
        app.state.claude_client.diagnose.return_value = MOCK_DIAGNOSIS

        resp = client.post(
            "/api/diagnose",
            files=[_make_image()],
        )

        assert resp.status_code == 200
        call_kwargs = app.state.claude_client.diagnose.call_args.kwargs
        assert len(call_kwargs["images"]) == 1

    def test_multi_images_one_invalid(self, client: TestClient) -> None:
        """多图中有一张格式不合法，返回 400 并指明序号。"""
        resp = client.post(
            "/api/diagnose",
            files=[
                _make_image(filename="good.jpg"),
                _make_image(content=_GIF_MAGIC, content_type="image/gif", filename="bad.gif"),
            ],
        )

        assert resp.status_code == 400
        body = resp.json()
        assert body["error_code"] == "INVALID_IMAGE_FORMAT"
        assert "2" in body["message"]  # 第2张

    def test_multi_images_one_too_large(self, client: TestClient) -> None:
        """多图中有一张超大，返回 400 并指明序号。"""
        oversized = _JPEG_MAGIC + b"\x00" * (10 * 1024 * 1024 + 1 - len(_JPEG_MAGIC))

        resp = client.post(
            "/api/diagnose",
            files=[
                _make_image(filename="small.jpg"),
                _make_image(content=oversized, filename="big.jpg"),
            ],
        )

        assert resp.status_code == 400
        body = resp.json()
        assert body["error_code"] == "IMAGE_TOO_LARGE"
        assert "2" in body["message"]  # 第2张

    def test_trace_id_contains_count(self, client: TestClient) -> None:
        """多图时 trace_id 包含 count 字段。"""
        app.state.claude_client.diagnose.return_value = MOCK_DIAGNOSIS

        resp = client.post(
            "/api/diagnose",
            files=[
                _make_image(filename="a.jpg"),
                _make_image(filename="b.jpg"),
            ],
        )

        trace_id = resp.headers.get("X-Trace-Id", "")
        assert "count=2" in trace_id
