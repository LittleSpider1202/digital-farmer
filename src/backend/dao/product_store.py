"""商品数据存储 — JSON 文件读写 + 关键词查询。"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any

from dao.models import Product

logger = logging.getLogger(__name__)

# 默认数据文件路径
_DEFAULT_DATA_PATH = Path(__file__).parent / "data" / "products.json"


class ProductStore:
    """内存商品库，启动时从 JSON 文件加载。"""

    def __init__(self, data_path: str | Path | None = None) -> None:
        self._path = Path(data_path) if data_path else _DEFAULT_DATA_PATH
        self._products: list[Product] = []
        self._load()

    def _load(self) -> None:
        """从 JSON 文件加载商品数据。"""
        if not self._path.exists():
            logger.warning("商品数据文件不存在: %s", self._path)
            return

        try:
            with open(self._path, encoding="utf-8") as f:
                raw: list[dict[str, Any]] = json.load(f)
            self._products = [Product.from_dict(item) for item in raw]
        except (json.JSONDecodeError, KeyError, TypeError, ValueError) as e:
            logger.error("商品数据文件格式错误，跳过加载: %s", e)
            self._products = []
            return

        logger.info("加载 %d 条商品数据", len(self._products))

    def search(self, keyword: str) -> list[Product]:
        """按关键词模糊匹配商品。

        匹配逻辑：keyword 包含商品的 keyword，或商品的 keyword 包含 keyword。
        例如搜索"三唑酮可湿性粉剂"能匹配到 keyword="三唑酮" 的商品。

        Returns:
            匹配的商品列表（无匹配返回空列表）。
        """
        if not keyword:
            return []

        results: list[Product] = []
        for product in self._products:
            if keyword in product.keyword or product.keyword in keyword:
                results.append(product)
        return results

    def save(self, products: list[Product], path: str | Path | None = None) -> None:
        """将商品列表写入 JSON 文件。

        路径限制在 dao/data/ 目录内，防止路径穿越。
        """
        out_path = (Path(path) if path else self._path).resolve()
        allowed_root = Path(__file__).parent.resolve() / "data"
        if not str(out_path).startswith(str(allowed_root)):
            raise ValueError(f"拒绝写入沙箱外路径: {out_path}")

        out_path.parent.mkdir(parents=True, exist_ok=True)

        data = [p.to_dict() for p in products]
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

        logger.info("保存 %d 条商品数据到 %s", len(products), out_path)

    @property
    def count(self) -> int:
        """商品总数。"""
        return len(self._products)
