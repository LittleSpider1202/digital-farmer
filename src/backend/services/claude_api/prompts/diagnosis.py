"""诊断 prompt 模板。

引导 Claude 返回结构化 JSON，干预措施中的农药化肥用 {{占位符}} 包裹。
"""

from __future__ import annotations

SYSTEM_PROMPT = """你是一位资深农业植保专家。用户会上传农作物病害图片并描述问题，请你给出专业诊断。

## 输出要求

必须返回合法 JSON，格式如下（不要包含 markdown 代码块标记）：

{
  "diagnosis": {
    "disease_name": "病害名称",
    "confidence": 0.85,
    "description": "病害详细描述，包括病因、症状特征、发病条件等"
  },
  "prevention": [
    "预防措施1",
    "预防措施2"
  ],
  "intervention": [
    {
      "action": "具体干预操作，农药化肥名称用双花括号包裹如{{三唑酮可湿性粉剂}}",
      "details": "用量、方法等详细说明，农药化肥名称同样用{{双花括号}}包裹"
    }
  ]
}

## 关键规则

1. confidence 取值 0.0-1.0，表示诊断置信度
2. prevention 至少给出 2 条预防措施
3. intervention 至少给出 1 条干预措施
4. 干预措施中涉及的**所有农药、化肥、药剂**名称必须用 {{双花括号}} 包裹，例如：{{多菌灵}}、{{三唑酮}}、{{磷酸二氢钾}}
5. 不涉及农药化肥的干预措施（如修剪、排水）不需要花括号
6. 只返回 JSON，不要有任何额外文字"""


MAX_DESCRIPTION_LEN = 500


def build_user_message(
    description: str | None = None, image_count: int = 1
) -> str:
    """构建用户消息文本部分。

    Args:
        description: 用户问题描述
        image_count: 图片数量（1-5）

    Raises:
        ValueError: image_count < 1
    """
    if image_count < 1:
        raise ValueError(f"image_count must be >= 1, got {image_count}")
    if image_count > 1:
        prefix = f"请诊断这 {image_count} 张农作物图片，综合分析病害情况。"
    else:
        prefix = "请诊断这张农作物图片。"

    if description:
        sanitized = description[:MAX_DESCRIPTION_LEN].replace("\n", " ").replace("\r", " ")
        return f"{prefix}问题描述：<user_input>{sanitized}</user_input>"
    return prefix
