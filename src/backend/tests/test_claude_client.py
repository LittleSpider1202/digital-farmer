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
        assert "prevention" in SYSTEM_PROMPT
        assert "intervention" in SYSTEM_PROMPT

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
    },
    "prevention": ["选择抗病品种", "合理密植"],
    "intervention": [
        {
            "action": "喷施{{三唑酮可湿性粉剂}}",
            "details": "每亩用量50-75克，兑水30公斤",
        }
    ],
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
        assert len(result["prevention"]) == 2
        assert len(result["intervention"]) == 1
        assert "{{三唑酮可湿性粉剂}}" in result["intervention"][0]["action"]

        call_args = mock_create.call_args
        messages = call_args.kwargs["messages"]
        assert messages[0]["role"] == "system"
        assert messages[1]["role"] == "user"

    def test_diagnose_with_image(self) -> None:
        client = self._make_client()
        mock_resp = _make_mock_response(json.dumps(MOCK_DIAGNOSIS_RESPONSE))
        fake_image = b"\xff\xd8\xff\xe0" + b"\x00" * 100

        with patch.object(client._client.chat.completions, "create", return_value=mock_resp):
            result = client.diagnose(image_data=fake_image, image_mime="image/jpeg", description="叶子有白斑")

        assert result["diagnosis"]["disease_name"] == "小麦白粉病"

    def test_diagnose_image_without_description(self) -> None:
        client = self._make_client()
        mock_resp = _make_mock_response(json.dumps(MOCK_DIAGNOSIS_RESPONSE))
        fake_image = b"\x89PNG" + b"\x00" * 100

        with patch.object(client._client.chat.completions, "create", return_value=mock_resp):
            result = client.diagnose(image_data=fake_image, image_mime="image/png")

        assert result["diagnosis"]["disease_name"] == "小麦白粉病"

    def test_diagnose_invalid_mime_type(self) -> None:
        client = self._make_client()
        fake_image = b"\x00" * 100

        with pytest.raises(ValueError, match="不支持的图片类型"):
            client.diagnose(image_data=fake_image, image_mime="image/gif")

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
            client.diagnose(image_data=huge_image, image_mime="image/jpeg")

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
        incomplete = json.dumps({"diagnosis": {"disease_name": "test"}, "prevention": []})
        mock_resp = _make_mock_response(incomplete)

        with patch.object(client._client.chat.completions, "create", return_value=mock_resp):
            with pytest.raises(ClaudeAPIError, match="intervention"):
                client.diagnose(description="测试缺字段")
