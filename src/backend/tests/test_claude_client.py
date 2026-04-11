"""Claude API 客户端测试。"""

from __future__ import annotations

import json
from unittest.mock import MagicMock, patch

import httpx
import pytest
from openai import APIError, APITimeoutError

from services.claude_api.client import ALLOWED_MIME_TYPES, ClaudeAPIError, ClaudeClient
from services.claude_api.prompts.diagnosis import SYSTEM_PROMPT, build_user_message


# --- Prompt 测试 ---


class TestDiagnosisPrompt:
    def test_system_prompt_contains_json_format(self) -> None:
        assert "disease_name" in SYSTEM_PROMPT
        assert "confidence" in SYSTEM_PROMPT
        assert "pathogen" in SYSTEM_PROMPT
        assert "conditions" in SYSTEM_PROMPT
        assert "symptoms" in SYSTEM_PROMPT
        assert "treatment" in SYSTEM_PROMPT

    def test_system_prompt_requires_placeholder(self) -> None:
        assert "{{" in SYSTEM_PROMPT
        assert "}}" in SYSTEM_PROMPT

    def test_build_user_message_with_description(self) -> None:
        msg = build_user_message("叶子发黄有斑点")
        assert "叶子发黄有斑点" in msg
        assert "<user_input>" in msg

    def test_build_user_message_strips_newlines(self) -> None:
        msg = build_user_message("line1\nline2\rline3")
        assert "\n" not in msg
        assert "\r" not in msg

    def test_build_user_message_truncates_long_input(self) -> None:
        long_desc = "a" * 1000
        msg = build_user_message(long_desc)
        assert len(long_desc) > 500
        assert "a" * 500 in msg
        assert "a" * 501 not in msg

    def test_build_user_message_without_description(self) -> None:
        msg = build_user_message(None)
        assert "诊断" in msg

    def test_build_user_message_empty_string(self) -> None:
        msg = build_user_message("")
        assert "诊断" in msg

    def test_build_user_message_multi_image(self) -> None:
        msg = build_user_message("多处病斑", image_count=3)
        assert "3 张" in msg
        assert "综合分析" in msg
        assert "多处病斑" in msg

    def test_build_user_message_single_image_default(self) -> None:
        msg = build_user_message("叶子发黄", image_count=1)
        assert "这张" in msg
        assert "张" not in msg.replace("这张", "")


# --- Client 初始化测试 ---


class TestClaudeClientInit:
    def test_init_from_env(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("CLAUDE_API_KEY", "sk-test-key")
        monkeypatch.setenv("CLAUDE_API_BASE_URL", "https://relay.example.com/v1")
        client = ClaudeClient()
        assert client.api_key == "sk-test-key"
        assert client.base_url == "https://relay.example.com/v1"

    def test_init_missing_api_key(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.delenv("CLAUDE_API_KEY", raising=False)
        monkeypatch.setenv("CLAUDE_API_BASE_URL", "https://relay.example.com/v1")
        with pytest.raises(ValueError, match="CLAUDE_API_KEY"):
            ClaudeClient()

    def test_init_missing_base_url(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("CLAUDE_API_KEY", "sk-test-key")
        monkeypatch.delenv("CLAUDE_API_BASE_URL", raising=False)
        with pytest.raises(ValueError, match="CLAUDE_API_BASE_URL"):
            ClaudeClient()

    def test_init_with_explicit_params(self) -> None:
        client = ClaudeClient(api_key="sk-explicit", base_url="https://custom.com/v1")
        assert client.api_key == "sk-explicit"
        assert client.base_url == "https://custom.com/v1"


# --- 诊断调用测试 ---


MOCK_DIAGNOSIS_RESPONSE = {
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


def _make_mock_response(content: str | None) -> MagicMock:
    """构建 mock 的 OpenAI chat completion 响应。"""
    mock_message = MagicMock()
    mock_message.content = content
    mock_choice = MagicMock()
    mock_choice.message = mock_message
    mock_response = MagicMock()
    mock_response.choices = [mock_choice]
    return mock_response


def _make_empty_choices_response() -> MagicMock:
    """构建 choices 为空的响应。"""
    mock_response = MagicMock()
    mock_response.choices = []
    return mock_response


class TestClaudeClientDiagnose:
    def _make_client(self) -> ClaudeClient:
        return ClaudeClient(api_key="sk-test", base_url="https://relay.example.com/v1")

    def test_diagnose_text_only(self) -> None:
        client = self._make_client()
        mock_resp = _make_mock_response(json.dumps(MOCK_DIAGNOSIS_RESPONSE))

        with patch.object(client._client.chat.completions, "create", return_value=mock_resp) as mock_create:
            result = client.diagnose(description="叶子发黄")

        assert result["diagnosis"]["disease_name"] == "小麦白粉病"
        assert result["diagnosis"]["confidence"] == 0.85
        assert result["diagnosis"]["pathogen"] == "白粉菌 (Blumeria graminis)"
        assert "climate" in result["conditions"]
        assert "initial" in result["symptoms"]
        assert "{{三唑酮可湿性粉剂}}" in result["treatment"]["chemical"]

        call_args = mock_create.call_args
        messages = call_args.kwargs["messages"]
        assert messages[0]["role"] == "system"
        assert messages[1]["role"] == "user"

    def test_diagnose_with_image(self) -> None:
        client = self._make_client()
        mock_resp = _make_mock_response(json.dumps(MOCK_DIAGNOSIS_RESPONSE))
        fake_image = b"\xff\xd8\xff\xe0" + b"\x00" * 100

        with patch.object(client._client.chat.completions, "create", return_value=mock_resp):
            result = client.diagnose(
                images=[(fake_image, "image/jpeg")],
                description="叶子有白斑",
            )

        assert result["diagnosis"]["disease_name"] == "小麦白粉病"

    def test_diagnose_image_without_description(self) -> None:
        client = self._make_client()
        mock_resp = _make_mock_response(json.dumps(MOCK_DIAGNOSIS_RESPONSE))
        fake_image = b"\x89PNG" + b"\x00" * 100

        with patch.object(client._client.chat.completions, "create", return_value=mock_resp):
            result = client.diagnose(images=[(fake_image, "image/png")])

        assert result["diagnosis"]["disease_name"] == "小麦白粉病"

    def test_diagnose_invalid_mime_type(self) -> None:
        client = self._make_client()
        fake_image = b"\x00" * 100

        with pytest.raises(ValueError, match="不支持的图片类型"):
            client.diagnose(images=[(fake_image, "image/gif")])

    def test_diagnose_timeout(self) -> None:
        client = self._make_client()
        timeout_error = APITimeoutError(request=httpx.Request("POST", "https://example.com"))

        with patch.object(client._client.chat.completions, "create", side_effect=timeout_error):
            with pytest.raises(ClaudeAPIError, match="超时"):
                client.diagnose(description="测试超时")

    def test_diagnose_invalid_json_response(self) -> None:
        client = self._make_client()
        mock_resp = _make_mock_response("这不是JSON")

        with patch.object(client._client.chat.completions, "create", return_value=mock_resp):
            with pytest.raises(ClaudeAPIError, match="JSON"):
                client.diagnose(description="测试无效响应")

    def test_diagnose_api_error(self) -> None:
        client = self._make_client()
        api_error = APIError(
            message="Internal Server Error",
            request=httpx.Request("POST", "https://example.com"),
            body=None,
        )

        with patch.object(client._client.chat.completions, "create", side_effect=api_error):
            with pytest.raises(ClaudeAPIError, match="不可用"):
                client.diagnose(description="测试API错误")

    def test_diagnose_image_too_large(self) -> None:
        client = self._make_client()
        huge_image = b"\xff\xd8\xff\xe0" + b"\x00" * (11 * 1024 * 1024)

        with pytest.raises(ValueError, match="超出限制"):
            client.diagnose(images=[(huge_image, "image/jpeg")])

    def test_diagnose_empty_choices(self) -> None:
        client = self._make_client()
        mock_resp = _make_empty_choices_response()

        with patch.object(client._client.chat.completions, "create", return_value=mock_resp):
            with pytest.raises(ClaudeAPIError, match="空 choices"):
                client.diagnose(description="测试空响应")

    def test_diagnose_none_content(self) -> None:
        client = self._make_client()
        mock_resp = _make_mock_response(None)

        with patch.object(client._client.chat.completions, "create", return_value=mock_resp):
            with pytest.raises(ClaudeAPIError, match="空内容"):
                client.diagnose(description="测试空内容")

    def test_diagnose_markdown_fenced_response(self) -> None:
        client = self._make_client()
        fenced = "```json\n" + json.dumps(MOCK_DIAGNOSIS_RESPONSE) + "\n```"
        mock_resp = _make_mock_response(fenced)

        with patch.object(client._client.chat.completions, "create", return_value=mock_resp):
            result = client.diagnose(description="测试代码块")

        assert result["diagnosis"]["disease_name"] == "小麦白粉病"

    def test_diagnose_unclosed_fence(self) -> None:
        client = self._make_client()
        unclosed = "```json\n{\"diagnosis\": {}"
        mock_resp = _make_mock_response(unclosed)

        with patch.object(client._client.chat.completions, "create", return_value=mock_resp):
            with pytest.raises(ClaudeAPIError, match="不完整"):
                client.diagnose(description="测试截断")

    def test_diagnose_missing_field(self) -> None:
        client = self._make_client()
        incomplete = json.dumps({"diagnosis": {"disease_name": "test"}, "conditions": {}})
        mock_resp = _make_mock_response(incomplete)

        with patch.object(client._client.chat.completions, "create", return_value=mock_resp):
            with pytest.raises(ClaudeAPIError, match="symptoms"):
                client.diagnose(description="测试缺字段")

    def test_diagnose_multi_images(self) -> None:
        """多图诊断：2 张图片生成正确的 content 结构。"""
        client = self._make_client()
        mock_resp = _make_mock_response(json.dumps(MOCK_DIAGNOSIS_RESPONSE))
        img1 = b"\xff\xd8\xff\xe0" + b"\x00" * 100
        img2 = b"\x89PNG" + b"\x00" * 100

        with patch.object(
            client._client.chat.completions, "create", return_value=mock_resp
        ) as mock_create:
            result = client.diagnose(
                images=[(img1, "image/jpeg"), (img2, "image/png")],
                description="叶子有多处病斑",
            )

        assert result["diagnosis"]["disease_name"] == "小麦白粉病"
        call_args = mock_create.call_args
        user_content = call_args.kwargs["messages"][1]["content"]
        # 应有 2 个 image_url + 1 个 text
        assert isinstance(user_content, list)
        assert len(user_content) == 3
        assert user_content[0]["type"] == "image_url"
        assert user_content[1]["type"] == "image_url"
        assert user_content[2]["type"] == "text"
        assert "2 张" in user_content[2]["text"]

    def test_diagnose_five_images(self) -> None:
        """最大 5 张图片正常处理。"""
        client = self._make_client()
        mock_resp = _make_mock_response(json.dumps(MOCK_DIAGNOSIS_RESPONSE))
        imgs = [(b"\xff\xd8\xff\xe0" + b"\x00" * 100, "image/jpeg")] * 5

        with patch.object(
            client._client.chat.completions, "create", return_value=mock_resp
        ) as mock_create:
            result = client.diagnose(images=imgs)

        user_content = mock_create.call_args.kwargs["messages"][1]["content"]
        assert len(user_content) == 6  # 5 images + 1 text
        assert "5 张" in user_content[5]["text"]

    def test_diagnose_no_images(self) -> None:
        """images=None 退化为纯文本诊断。"""
        client = self._make_client()
        mock_resp = _make_mock_response(json.dumps(MOCK_DIAGNOSIS_RESPONSE))

        with patch.object(
            client._client.chat.completions, "create", return_value=mock_resp
        ) as mock_create:
            client.diagnose(images=None, description="叶子发黄")

        user_content = mock_create.call_args.kwargs["messages"][1]["content"]
        assert isinstance(user_content, str)

    def test_diagnose_multi_images_one_invalid_mime(self) -> None:
        """多图中有一张 MIME 不合法应拒绝。"""
        client = self._make_client()
        img_ok = (b"\xff\xd8\xff\xe0" + b"\x00" * 100, "image/jpeg")
        img_bad = (b"\x00" * 100, "image/gif")

        with pytest.raises(ValueError, match="不支持的图片类型"):
            client.diagnose(images=[img_ok, img_bad])
