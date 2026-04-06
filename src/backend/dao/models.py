"""数据模型定义。"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class Product:
    """农资商品数据模型。"""

    keyword: str
    name: str
    image_url: str
    price: float
    sales: int
    buy_url: str

    def to_dict(self) -> dict[str, Any]:
        """转换为可 JSON 序列化的字典。"""
        return {
            "keyword": self.keyword,
            "name": self.name,
            "image_url": self.image_url,
            "price": self.price,
            "sales": self.sales,
            "buy_url": self.buy_url,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> Product:
        """从字典创建 Product 实例。"""
        return cls(
            keyword=data["keyword"],
            name=data["name"],
            image_url=data["image_url"],
            price=float(data["price"]),
            sales=int(data["sales"]),
            buy_url=data["buy_url"],
        )
