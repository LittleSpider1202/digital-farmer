"""京东农资商品爬取 — Phase 1 生成 mock 数据。"""

from __future__ import annotations

import logging
from pathlib import Path

logger = logging.getLogger(__name__)

from dao.cli.base import BaseScraper
from dao.models import Product

# 默认输出路径
_DEFAULT_OUTPUT = Path(__file__).parent.parent / "data" / "products.json"


class JdAgriScraper(BaseScraper):
    """京东农资商品爬取器。

    Phase 1：返回预定义的 mock 数据。
    Phase 2：对接京东 API / 页面爬取。
    """

    def scrape(self) -> list[Product]:
        """生成 mock 农资商品数据。"""
        return [
            Product(
                keyword="三唑酮",
                name="三唑酮可湿性粉剂 25%",
                image_url="https://img.example.com/triadimefon-25.jpg",
                price=15.80,
                sales=2340,
                buy_url="https://item.jd.com/mock-triadimefon",
            ),
            Product(
                keyword="多菌灵",
                name="多菌灵可湿性粉剂 50%",
                image_url="https://img.example.com/carbendazim-50.jpg",
                price=12.50,
                sales=1890,
                buy_url="https://item.jd.com/mock-carbendazim",
            ),
            Product(
                keyword="百菌清",
                name="百菌清悬浮剂 75%",
                image_url="https://img.example.com/chlorothalonil-75.jpg",
                price=18.00,
                sales=1560,
                buy_url="https://item.jd.com/mock-chlorothalonil",
            ),
            Product(
                keyword="吡虫啉",
                name="吡虫啉悬浮剂 10%",
                image_url="https://img.example.com/imidacloprid-10.jpg",
                price=9.90,
                sales=3210,
                buy_url="https://item.jd.com/mock-imidacloprid",
            ),
            Product(
                keyword="磷酸二氢钾",
                name="磷酸二氢钾 98%",
                image_url="https://img.example.com/mkp-98.jpg",
                price=8.80,
                sales=5600,
                buy_url="https://item.jd.com/mock-mkp",
            ),
            Product(
                keyword="复合肥",
                name="复合肥 15-15-15",
                image_url="https://img.example.com/npk-15-15-15.jpg",
                price=45.00,
                sales=4200,
                buy_url="https://item.jd.com/mock-npk",
            ),
            Product(
                keyword="甲基托布津",
                name="甲基托布津可湿性粉剂 70%",
                image_url="https://img.example.com/thiophanate-methyl-70.jpg",
                price=22.00,
                sales=980,
                buy_url="https://item.jd.com/mock-thiophanate-methyl",
            ),
            Product(
                keyword="阿维菌素",
                name="阿维菌素乳油 1.8%",
                image_url="https://img.example.com/abamectin-1.8.jpg",
                price=14.00,
                sales=2780,
                buy_url="https://item.jd.com/mock-abamectin",
            ),
        ]


def main() -> None:
    """CLI 入口：爬取并保存商品数据。"""
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    scraper = JdAgriScraper()
    products = scraper.scrape()
    scraper.save(products, _DEFAULT_OUTPUT)
    logger.info("完成：共 %d 条商品", len(products))


if __name__ == "__main__":
    main()
