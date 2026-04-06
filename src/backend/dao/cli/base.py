"""爬取基类 — 定义商品爬取接口。"""

from __future__ import annotations

import json
import logging
from abc import ABC, abstractmethod
from pathlib import Path
from typing import Any

from dao.models import Product

logger = logging.getLogger(__name__)


class BaseScraper(ABC):
    """商品爬取抽象基类。"""

    @abstractmethod
    def scrape(self) -> list[Product]:
        """执行爬取，返回商品列表。"""

    def save(self, products: list[Product], path: str | Path) -> None:
        """将爬取结果保存到 JSON 文件。"""
        out_path = Path(path)
        out_path.parent.mkdir(parents=True, exist_ok=True)

        data: list[dict[str, Any]] = [p.to_dict() for p in products]
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

        logger.info("保存 %d 条商品到 %s", len(products), out_path)
