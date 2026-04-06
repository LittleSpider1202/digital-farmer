"""CLI 爬取测试 — 基类、JD 实现。"""

from __future__ import annotations

import json
from pathlib import Path

from dao.cli.base import BaseScraper
from dao.cli.jd_agri import JdAgriScraper
from dao.models import Product


class TestBaseScraper:
    def test_save_creates_file(self, tmp_path: Path) -> None:
        class DummyScraper(BaseScraper):
            def scrape(self) -> list[Product]:
                return [
                    Product(
                        keyword="测试",
                        name="测试商品",
                        image_url="https://example.com/test.jpg",
                        price=10.0,
                        sales=100,
                        buy_url="https://example.com/buy",
                    )
                ]

        scraper = DummyScraper()
        out_path = tmp_path / "subdir" / "output.json"
        scraper.save(scraper.scrape(), out_path)

        assert out_path.exists()
        with open(out_path, encoding="utf-8") as f:
            data = json.load(f)
        assert len(data) == 1
        assert data[0]["keyword"] == "测试"

    def test_save_utf8(self, tmp_path: Path) -> None:
        class CnScraper(BaseScraper):
            def scrape(self) -> list[Product]:
                return [
                    Product(
                        keyword="磷酸二氢钾",
                        name="磷酸二氢钾 98%",
                        image_url="https://example.com/mkp.jpg",
                        price=8.80,
                        sales=5600,
                        buy_url="https://example.com/buy-mkp",
                    )
                ]

        scraper = CnScraper()
        out_path = tmp_path / "cn.json"
        scraper.save(scraper.scrape(), out_path)

        with open(out_path, encoding="utf-8") as f:
            data = json.load(f)
        assert data[0]["name"] == "磷酸二氢钾 98%"


class TestJdAgriScraper:
    def test_scrape_returns_products(self) -> None:
        scraper = JdAgriScraper()
        products = scraper.scrape()
        assert len(products) >= 5

    def test_product_fields_complete(self) -> None:
        scraper = JdAgriScraper()
        for product in scraper.scrape():
            assert product.keyword
            assert product.name
            assert product.image_url
            assert product.price > 0
            assert product.sales >= 0
            assert product.buy_url

    def test_scrape_and_save(self, tmp_path: Path) -> None:
        scraper = JdAgriScraper()
        products = scraper.scrape()
        out_path = tmp_path / "jd_products.json"
        scraper.save(products, out_path)

        with open(out_path, encoding="utf-8") as f:
            data = json.load(f)
        assert len(data) == len(products)
