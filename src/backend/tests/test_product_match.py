"""product_match 测试 — 关键词提取、匹配注入、空匹配。"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from dao.product_store import ProductStore
from services.product_match import extract_keywords, match_products


@pytest.fixture()
def store(tmp_path: Path) -> ProductStore:
    data = [
        {
            "keyword": "三唑酮",
            "name": "三唑酮可湿性粉剂 25%",
            "image_url": "https://img.example.com/triadimefon.jpg",
            "price": 15.80,
            "sales": 2340,
            "buy_url": "https://item.jd.com/mock-triadimefon",
        },
        {
            "keyword": "多菌灵",
            "name": "多菌灵可湿性粉剂 50%",
            "image_url": "https://img.example.com/carbendazim.jpg",
            "price": 12.50,
            "sales": 1890,
            "buy_url": "https://item.jd.com/mock-carbendazim",
        },
    ]
    path = tmp_path / "products.json"
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False)
    return ProductStore(data_path=path)


class TestExtractKeywords:
    def test_single_keyword(self) -> None:
        assert extract_keywords("喷施{{三唑酮}}") == ["三唑酮"]

    def test_multiple_keywords(self) -> None:
        text = "喷施{{三唑酮可湿性粉剂}}，也可配合{{多菌灵}}交替使用"
        assert extract_keywords(text) == ["三唑酮可湿性粉剂", "多菌灵"]

    def test_duplicate_keywords(self) -> None:
        text = "先喷{{三唑酮}}，7天后再喷{{三唑酮}}"
        assert extract_keywords(text) == ["三唑酮"]

    def test_no_keywords(self) -> None:
        assert extract_keywords("修剪病枝，加强通风") == []

    def test_empty_braces(self) -> None:
        assert extract_keywords("{{}}和正常文本") == []

    def test_whitespace_in_keyword(self) -> None:
        assert extract_keywords("{{ 三唑酮 }}") == ["三唑酮"]


class TestMatchProducts:
    def test_match_single_intervention(self, store: ProductStore) -> None:
        interventions = [
            {
                "action": "喷施{{三唑酮}}",
                "details": "每亩用量50克",
            }
        ]
        result = match_products(interventions, store)
        assert len(result) == 1
        assert len(result[0]["products"]) == 1
        assert result[0]["products"][0]["keyword"] == "三唑酮"
        assert result[0]["products"][0]["price"] == 15.80

    def test_match_multiple_keywords(self, store: ProductStore) -> None:
        interventions = [
            {
                "action": "喷施{{三唑酮}}",
                "details": "也可配合{{多菌灵}}交替使用",
            }
        ]
        result = match_products(interventions, store)
        assert len(result[0]["products"]) == 2

    def test_no_match_returns_empty_list(self, store: ProductStore) -> None:
        interventions = [
            {
                "action": "修剪病枝",
                "details": "清理落叶",
            }
        ]
        result = match_products(interventions, store)
        assert result[0]["products"] == []

    def test_no_intervention_no_crash(self, store: ProductStore) -> None:
        assert match_products([], store) == []

    def test_original_fields_preserved(self, store: ProductStore) -> None:
        interventions = [
            {
                "action": "喷施{{三唑酮}}",
                "details": "每亩50克",
                "extra_field": "should be kept",
            }
        ]
        result = match_products(interventions, store)
        assert result[0]["action"] == "喷施{{三唑酮}}"
        assert result[0]["details"] == "每亩50克"
        assert result[0]["extra_field"] == "should be kept"

    def test_does_not_mutate_original(self, store: ProductStore) -> None:
        interventions = [{"action": "喷施{{三唑酮}}", "details": ""}]
        original_copy = [dict(i) for i in interventions]
        match_products(interventions, store)
        assert interventions == original_copy
        assert "products" not in interventions[0]

    def test_product_fields_complete(self, store: ProductStore) -> None:
        interventions = [{"action": "{{三唑酮}}", "details": ""}]
        result = match_products(interventions, store)
        product = result[0]["products"][0]
        assert set(product.keys()) == {
            "keyword", "name", "image_url", "price", "sales", "buy_url"
        }

    def test_no_duplicate_products(self, tmp_path: Path) -> None:
        """两个不同关键词匹配到同一商品时不应重复。"""
        data = [
            {
                "keyword": "三唑酮",
                "name": "三唑酮可湿性粉剂 25%",
                "image_url": "https://example.com/t.jpg",
                "price": 15.80,
                "sales": 2340,
                "buy_url": "https://item.jd.com/mock-triadimefon",
            },
            {
                "keyword": "三唑酮可湿性粉剂",
                "name": "三唑酮可湿性粉剂 25%（大包装）",
                "image_url": "https://example.com/t-bulk.jpg",
                "price": 48.00,
                "sales": 890,
                "buy_url": "https://item.jd.com/mock-triadimefon-bulk",
            },
        ]
        path = tmp_path / "products.json"
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False)
        dup_store = ProductStore(data_path=path)

        interventions = [
            {"action": "喷施{{三唑酮可湿性粉剂}}", "details": ""}
        ]
        result = match_products(interventions, dup_store)
        urls = [p["buy_url"] for p in result[0]["products"]]
        assert len(urls) == len(set(urls)), "products 中不应有重复商品"
