"""ProductStore 测试 — 加载、查询、无匹配。"""

from __future__ import annotations

import json
import tempfile
from pathlib import Path

import pytest

from dao.models import Product
from dao.product_store import ProductStore


@pytest.fixture()
def sample_products() -> list[dict]:
    return [
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
        {
            "keyword": "三唑酮可湿性粉剂",
            "name": "三唑酮可湿性粉剂 25%（大包装）",
            "image_url": "https://img.example.com/triadimefon-bulk.jpg",
            "price": 48.00,
            "sales": 890,
            "buy_url": "https://item.jd.com/mock-triadimefon-bulk",
        },
    ]


@pytest.fixture()
def store_path(sample_products: list[dict], tmp_path: Path) -> Path:
    path = tmp_path / "products.json"
    with open(path, "w", encoding="utf-8") as f:
        json.dump(sample_products, f, ensure_ascii=False)
    return path


@pytest.fixture()
def store(store_path: Path) -> ProductStore:
    return ProductStore(data_path=store_path)


class TestProductStoreLoad:
    def test_load_products(self, store: ProductStore) -> None:
        assert store.count == 3

    def test_load_nonexistent_file(self, tmp_path: Path) -> None:
        store = ProductStore(data_path=tmp_path / "missing.json")
        assert store.count == 0

    def test_load_default_data(self) -> None:
        """加载项目自带的 mock 数据文件。"""
        store = ProductStore()
        assert store.count >= 20


class TestProductStoreSearch:
    def test_exact_keyword_match(self, store: ProductStore) -> None:
        results = store.search("多菌灵")
        assert len(results) == 1
        assert results[0].name == "多菌灵可湿性粉剂 50%"

    def test_fuzzy_match_keyword_in_query(self, store: ProductStore) -> None:
        """搜索"三唑酮可湿性粉剂"应匹配 keyword="三唑酮" 和 keyword="三唑酮可湿性粉剂"。"""
        results = store.search("三唑酮可湿性粉剂")
        assert len(results) == 2
        names = {r.name for r in results}
        assert "三唑酮可湿性粉剂 25%" in names
        assert "三唑酮可湿性粉剂 25%（大包装）" in names

    def test_fuzzy_match_query_in_keyword(self, store: ProductStore) -> None:
        """搜索"三唑酮"应匹配 keyword="三唑酮" 和 keyword="三唑酮可湿性粉剂"。"""
        results = store.search("三唑酮")
        assert len(results) == 2

    def test_no_match(self, store: ProductStore) -> None:
        results = store.search("不存在的农药")
        assert results == []

    def test_empty_keyword(self, store: ProductStore) -> None:
        results = store.search("")
        assert results == []


class TestProductStoreErrorHandling:
    def test_corrupt_json_degrades_gracefully(self, tmp_path: Path) -> None:
        path = tmp_path / "bad.json"
        path.write_text("{invalid json", encoding="utf-8")
        store = ProductStore(data_path=path)
        assert store.count == 0

    def test_missing_field_degrades_gracefully(self, tmp_path: Path) -> None:
        path = tmp_path / "incomplete.json"
        path.write_text('[{"keyword": "test"}]', encoding="utf-8")
        store = ProductStore(data_path=path)
        assert store.count == 0


class TestProductStoreSave:
    def test_save_and_reload(self) -> None:
        """save 写入 dao/data/ 目录内的文件并可重新加载。"""
        products = [
            Product(
                keyword="测试",
                name="测试商品",
                image_url="https://example.com/test.jpg",
                price=10.0,
                sales=100,
                buy_url="https://example.com/buy",
            )
        ]
        out_path = Path(__file__).parent.parent / "dao" / "data" / "_test_save.json"
        store = ProductStore()
        try:
            store.save(products, out_path)
            reloaded = ProductStore(data_path=out_path)
            assert reloaded.count == 1
            results = reloaded.search("测试")
            assert len(results) == 1
            assert results[0].price == 10.0
        finally:
            out_path.unlink(missing_ok=True)

    def test_save_rejects_path_outside_sandbox(self, tmp_path: Path) -> None:
        store = ProductStore()
        with pytest.raises(ValueError, match="沙箱外"):
            store.save([], tmp_path / "evil.json")
