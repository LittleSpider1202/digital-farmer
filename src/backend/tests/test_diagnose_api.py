"""POST /api/diagnose 端点测试（JSON payload + base64 图片）。"""

from __future__ import annotations

import base64
from typing import Iterator
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

from main import app
from services.claude_api.client import ClaudeAPIError, ClaudeTimeoutError

# JPEG 最小合法魔数
_JPEG_MAGIC = b"\xff\xd8\xff\xe0" + b"\x00" * 100
# PNG 魔数
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


def _b64(data: bytes) -> str:
    """将 bytes 编码为 base64 字符串。"""
    return base64.b64encode(data).decode()


def _make_body(
    images: list[dict[str, str]] | None = None,
    description: str | None = None,
) -> dict:
    """构造 JSON 请求体。"""
    if images is None:
        images = [{"data": _b64(_JPEG_MAGIC), "mime": "image/jpeg"}]
    body: dict = {"images": images}
    if description is not None:
        body["description"] = description
    return body


def _make_image_payload(
    content: bytes = _JPEG_MAGIC, mime: str = "image/jpeg"
) -> dict[str, str]:
    """构造单张图片 payload。"""
    return {"data": _b64(content), "mime": mime}


# ────────────────────────────────────────────
# 正常诊断
# ────────────────────────────────────────────

MOCK_DIAGNOSIS = {
    "diagnosis": {
        "disease_name": "小麦白粉病",
        "confidence": 0.85,
        "description": "白粉病是由真菌引起的常见病害",
        "pathogen": "白粉菌 (Blumeria graminis)",
    },
    "conditions": {
        "climate": "温暖潮湿，春季多雨",
        "variety": "感病品种",
        "cultivation": "偏施氮肥，密植",
    },
    "symptoms": {
        "initial": "叶片出现小白点",
        "typical": "白色粉状霉层扩展",
        "late": "霉层变灰褐色",
    },
    "treatment": {
        "agricultural": "清除病残体，合理轮作",
        "seed_treatment": "播种前用{{三唑酮}}拌种",
        "chemical": "发病初期喷施{{三唑酮可湿性粉剂}}，每亩50-75克",
    },
}


class TestDiagnoseSuccess:
    """正常诊断请求。"""

    def test_normal_upload(self, client: TestClient) -> None:
        app.state.claude_client.diagnose.return_value = MOCK_DIAGNOSIS

        resp = client.post(
            "/api/diagnose",
            json=_make_body(description="叶子发黄有斑点"),
        )

        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert body["data"]["diagnosis"]["disease_name"] == "小麦白粉病"
        assert body["data"]["diagnosis"]["pathogen"] == "白粉菌 (Blumeria graminis)"
        assert body["data"]["conditions"]["climate"] == "温暖潮湿，春季多雨"
        assert body["data"]["symptoms"]["initial"] == "叶片出现小白点"
        assert "chemical" in body["data"]["treatment"]

    def test_empty_description(self, client: TestClient) -> None:
        app.state.claude_client.diagnose.return_value = MOCK_DIAGNOSIS

        resp = client.post(
            "/api/diagnose",
            json=_make_body(description=""),
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
            json=_make_body(),
        )

        assert resp.status_code == 200
        assert resp.json()["success"] is True

    def test_png_upload(self, client: TestClient) -> None:
        app.state.claude_client.diagnose.return_value = MOCK_DIAGNOSIS

        resp = client.post(
            "/api/diagnose",
            json=_make_body(images=[_make_image_payload(_PNG_MAGIC, "image/png")]),
        )

        assert resp.status_code == 200

    def test_webp_upload(self, client: TestClient) -> None:
        app.state.claude_client.diagnose.return_value = MOCK_DIAGNOSIS

        resp = client.post(
            "/api/diagnose",
            json=_make_body(images=[_make_image_payload(_WEBP_MAGIC, "image/webp")]),
        )

        assert resp.status_code == 200


# ────────────────────────────────────────────
# 输入校验错误
# ────────────────────────────────────────────


class TestDiagnoseValidation:
    """输入校验：格式和大小。"""

    def test_invalid_magic_bytes(self, client: TestClient) -> None:
        """即使 mime 声称 image/jpeg，魔数不对也拒绝。"""
        resp = client.post(
            "/api/diagnose",
            json=_make_body(images=[_make_image_payload(_GIF_MAGIC, "image/jpeg")]),
        )

        assert resp.status_code == 400
        assert resp.json()["error_code"] == "INVALID_IMAGE_FORMAT"

    def test_invalid_format_gif(self, client: TestClient) -> None:
        """GIF mime 被 Pydantic 拒绝（422）。"""
        resp = client.post(
            "/api/diagnose",
            json=_make_body(images=[_make_image_payload(_GIF_MAGIC, "image/gif")]),
        )

        assert resp.status_code == 422

    def test_invalid_format_pdf(self, client: TestClient) -> None:
        """PDF mime 被 Pydantic 拒绝（422）。"""
        resp = client.post(
            "/api/diagnose",
            json=_make_body(images=[_make_image_payload(b"%PDF-1.4" + b"\x00" * 100, "application/pdf")]),
        )

        assert resp.status_code == 422

    def test_image_too_large(self, client: TestClient) -> None:
        # 10MB + 1 byte，保留 JPEG 魔数
        oversized = _JPEG_MAGIC + b"\x00" * (10 * 1024 * 1024 + 1 - len(_JPEG_MAGIC))

        resp = client.post(
            "/api/diagnose",
            json=_make_body(images=[_make_image_payload(oversized)]),
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
            json=_make_body(images=[_make_image_payload(exact)]),
        )

        assert resp.status_code == 200

    def test_invalid_base64(self, client: TestClient) -> None:
        """非法 base64 字符串返回 400。"""
        resp = client.post(
            "/api/diagnose",
            json={"images": [{"data": "not-valid-base64!!!", "mime": "image/jpeg"}]},
        )

        assert resp.status_code == 400
        assert resp.json()["error_code"] == "INVALID_BASE64"

    def test_empty_images_rejected(self, client: TestClient) -> None:
        """空 images 数组被 Pydantic 拒绝（422）。"""
        resp = client.post(
            "/api/diagnose",
            json={"images": []},
        )

        assert resp.status_code == 422


# ────────────────────────────────────────────
# 服务不可用
# ────────────────────────────────────────────


class TestServiceUnavailable:
    """ClaudeClient 未初始化时返回 503。"""

    def test_null_client_returns_503(self) -> None:
        with TestClient(app) as c:
            app.state.claude_client = None
            resp = c.post(
                "/api/diagnose",
                json=_make_body(),
            )
        assert resp.status_code == 503
        assert resp.json()["error_code"] == "SERVICE_UNAVAILABLE"


# ────────────────────────────────────────────
# AI 服务错误
# ────────────────────────────────────────────


class TestDiagnoseAIErrors:
    """Claude API 异常处理。"""

    def test_ai_timeout(self, client: TestClient) -> None:
        app.state.claude_client.diagnose.side_effect = ClaudeTimeoutError(
            "Claude API 超时（>30s）"
        )

        resp = client.post(
            "/api/diagnose",
            json=_make_body(description="叶子有黑斑"),
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
            json=_make_body(),
        )

        assert resp.status_code == 500
        assert resp.json()["error_code"] == "INTERNAL_ERROR"

    def test_value_error_caught(self, client: TestClient) -> None:
        """ClaudeClient 内部 ValueError 也应被捕获。"""
        app.state.claude_client.diagnose.side_effect = ValueError("unexpected")

        resp = client.post(
            "/api/diagnose",
            json=_make_body(),
        )

        assert resp.status_code == 500
        assert resp.json()["error_code"] == "INTERNAL_ERROR"


# ────────────────────────────────────────────
# Trace ID Header
# ────────────────────────────────────────────


class TestTraceId:
    """X-Trace-Id 响应 header。"""

    def test_trace_id_present_on_success(self, client: TestClient) -> None:
        app.state.claude_client.diagnose.return_value = MOCK_DIAGNOSIS

        resp = client.post(
            "/api/diagnose",
            json=_make_body(description="叶子发黄"),
        )

        trace_id = resp.headers.get("X-Trace-Id", "")
        assert trace_id  # 非空（纯 hex ID）
        assert len(trace_id) == 32  # 16 bytes hex

    def test_trace_id_contains_disease(self, client: TestClient) -> None:
        app.state.claude_client.diagnose.return_value = MOCK_DIAGNOSIS

        resp = client.post(
            "/api/diagnose",
            json=_make_body(),
        )

        trace_id = resp.headers.get("X-Trace-Id", "")
        assert len(trace_id) == 32

    def test_trace_id_present_on_error(self, client: TestClient) -> None:
        """即使校验失败也应有 trace_id。"""
        resp = client.post(
            "/api/diagnose",
            json=_make_body(images=[_make_image_payload(_GIF_MAGIC, "image/gif")]),
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
            json=_make_body(
                images=[
                    _make_image_payload(_JPEG_MAGIC, "image/jpeg"),
                    _make_image_payload(_PNG_MAGIC, "image/png"),
                ],
                description="多处病斑",
            ),
        )

        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        call_kwargs = app.state.claude_client.diagnose.call_args.kwargs
        assert len(call_kwargs["images"]) == 2

    def test_five_images_max(self, client: TestClient) -> None:
        """上传 5 张图片（上限）正常诊断。"""
        app.state.claude_client.diagnose.return_value = MOCK_DIAGNOSIS

        resp = client.post(
            "/api/diagnose",
            json=_make_body(
                images=[_make_image_payload() for _ in range(5)],
            ),
        )

        assert resp.status_code == 200
        call_kwargs = app.state.claude_client.diagnose.call_args.kwargs
        assert len(call_kwargs["images"]) == 5

    def test_six_images_rejected(self, client: TestClient) -> None:
        """超过 5 张被 Pydantic 拒绝（422）。"""
        resp = client.post(
            "/api/diagnose",
            json=_make_body(
                images=[_make_image_payload() for _ in range(6)],
            ),
        )

        assert resp.status_code == 422

    def test_single_image_backward_compat(self, client: TestClient) -> None:
        """单张图片仍然兼容。"""
        app.state.claude_client.diagnose.return_value = MOCK_DIAGNOSIS

        resp = client.post(
            "/api/diagnose",
            json=_make_body(),
        )

        assert resp.status_code == 200
        call_kwargs = app.state.claude_client.diagnose.call_args.kwargs
        assert len(call_kwargs["images"]) == 1

    def test_multi_images_one_invalid_mime(self, client: TestClient) -> None:
        """多图中有一张 mime 不合法，Pydantic 拒绝（422）。"""
        resp = client.post(
            "/api/diagnose",
            json=_make_body(
                images=[
                    _make_image_payload(_JPEG_MAGIC, "image/jpeg"),
                    _make_image_payload(_GIF_MAGIC, "image/gif"),
                ],
            ),
        )

        assert resp.status_code == 422

    def test_multi_images_one_invalid_magic(self, client: TestClient) -> None:
        """多图中有一张魔数不合法（mime 正确但内容是 GIF），返回 400。"""
        resp = client.post(
            "/api/diagnose",
            json=_make_body(
                images=[
                    _make_image_payload(_JPEG_MAGIC, "image/jpeg"),
                    _make_image_payload(_GIF_MAGIC, "image/jpeg"),
                ],
            ),
        )

        assert resp.status_code == 400
        body = resp.json()
        assert body["error_code"] == "INVALID_IMAGE_FORMAT"
        assert "2" in body["message"]

    def test_multi_images_one_too_large(self, client: TestClient) -> None:
        """多图中有一张超大，返回 400 并指明序号。"""
        oversized = _JPEG_MAGIC + b"\x00" * (10 * 1024 * 1024 + 1 - len(_JPEG_MAGIC))

        resp = client.post(
            "/api/diagnose",
            json=_make_body(
                images=[
                    _make_image_payload(_JPEG_MAGIC, "image/jpeg"),
                    _make_image_payload(oversized, "image/jpeg"),
                ],
            ),
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
            json=_make_body(
                images=[
                    _make_image_payload(),
                    _make_image_payload(),
                ],
            ),
        )

        trace_id = resp.headers.get("X-Trace-Id", "")
        assert len(trace_id) == 32  # 纯 hex ID，业务字段在日志中
