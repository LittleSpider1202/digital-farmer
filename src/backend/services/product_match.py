"""商品匹配服务 — 从干预措施中提取关键词并匹配商品。"""

from __future__ import annotations

import re
from typing import Any

from dao.product_store import ProductStore

# 提取 {{关键词}} 的正则
_KEYWORD_RE = re.compile(r"\{\{(.+?)\}\}")


def extract_keywords(text: str) -> list[str]:
    """从文本中提取所有 {{双花括号}} 包裹的关键词。

    Args:
        text: 包含 {{关键词}} 的文本

    Returns:
        去重后的关键词列表（保持出现顺序）。
    """
    seen: set[str] = set()
    result: list[str] = []
    for match in _KEYWORD_RE.finditer(text):
        kw = match.group(1).strip()
        if kw and kw not in seen:
            seen.add(kw)
            result.append(kw)
    return result


def match_products(
    interventions: list[dict[str, Any]],
    store: ProductStore,
) -> list[dict[str, Any]]:
    """为每个干预措施匹配商品并注入 products 字段。

    遍历 intervention 列表，从 action + details 中提取 {{关键词}}，
    查询 ProductStore 获取匹配商品，写入 products 字段。

    Args:
        interventions: AI 返回的干预措施列表
        store: 商品数据存储

    Returns:
        注入了 products 字段的新干预措施列表（不修改原列表）。
    """
    result: list[dict[str, Any]] = []

    for item in interventions:
        new_item = dict(item)
        text = f"{item.get('action', '')} {item.get('details', '')}"
        keywords = extract_keywords(text)

        products: list[dict[str, Any]] = []
        seen_urls: set[str] = set()
        for kw in keywords:
            for product in store.search(kw):
                if product.buy_url not in seen_urls:
                    seen_urls.add(product.buy_url)
                    products.append(product.to_dict())

        new_item["products"] = products
        result.append(new_item)

    return result
