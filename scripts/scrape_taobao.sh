#!/bin/bash
# 淘宝商品数据采集脚本 — 每个关键词搜索后提取前3条商品
# 使用 opencli operate 从浏览器 DOM 提取

set -euo pipefail

export no_proxy="*.taobao.com,*.tbcdn.cn,*.alicdn.com,*.tmall.com"
export NO_PROXY="*.taobao.com,*.tbcdn.cn,*.alicdn.com,*.tmall.com"

OUTFILE="src/backend/dao/data/taobao_raw.jsonl"
> "$OUTFILE"

EXTRACT_JS='
(() => {
  const cards = document.querySelectorAll("a[class*=doubleCardWrapper]");
  if (!cards.length) return [];
  return Array.from(cards).slice(0, 3).map(card => {
    const titleEl = card.querySelector("[class*=title] span, [class*=Title] span");
    const priceInt = card.querySelector("[class*=priceInt]");
    const priceFloat = card.querySelector("[class*=priceFloat]");
    const img = card.querySelector("img[src*=alicdn]");
    const salesEl = card.querySelector("[class*=realSales]");
    return {
      title: titleEl?.textContent?.trim() || card.querySelector("[class*=title]")?.textContent?.trim() || "",
      price: (priceInt?.textContent || "") + (priceFloat?.textContent || ""),
      img: img?.src || "",
      link: card.href || "",
      sales: salesEl?.textContent?.trim() || "",
    };
  });
})()
'

# 关键词列表：农药名+搜索后缀
KEYWORDS=(
  "三唑酮 农药 杀菌剂"
  "戊唑醇 农药 杀菌剂"
  "多菌灵 农药 杀菌剂"
  "烯唑醇 农药 杀菌剂"
  "氟环唑 农药 杀菌剂"
  "丙环唑 农药 杀菌剂"
  "腈菌唑 农药 杀菌剂"
  "咪鲜胺 农药 杀菌剂"
  "氰烯菌酯 农药"
  "丙硫菌唑 农药"
  "井冈霉素 农药 纹枯病"
  "己唑醇 农药 杀菌剂"
  "嘧菌酯 农药 杀菌剂"
  "百菌清 农药 杀菌剂"
  "甲基托布津 农药"
  "吡虫啉 农药 杀虫剂"
  "啶虫脒 农药 杀虫剂"
  "抗蚜威 农药"
  "阿维菌素 农药 杀虫剂"
  "甲维盐 农药 杀虫剂"
  "高效氯氟氰菊酯 农药"
  "磷酸二氢钾 农用"
  "尿素 农用 追肥"
  "复合肥 小麦专用"
)

TOTAL=${#KEYWORDS[@]}
echo "共 $TOTAL 个关键词，预计耗时 $((TOTAL * 10)) 秒"

for i in "${!KEYWORDS[@]}"; do
  KW="${KEYWORDS[$i]}"
  IDX=$((i + 1))
  echo "[$IDX/$TOTAL] 搜索: $KW"

  # URL encode
  ENCODED=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$KW'))")

  # 打开搜索页
  opencli operate open "https://s.taobao.com/search?q=$ENCODED" >/dev/null 2>&1

  # 等待页面加载
  sleep 3

  # 提取数据
  RESULT=$(opencli operate eval "$EXTRACT_JS" 2>/dev/null || echo "[]")

  # 写入 JSONL（每行: {keyword, products: [...]}）
  # 提取纯关键词（第一个词）
  PURE_KW=$(echo "$KW" | awk '{print $1}')
  echo "{\"keyword\": \"$PURE_KW\", \"products\": $RESULT}" >> "$OUTFILE"

  echo "  → 提取完成"

  # 随机间隔 1-2 秒
  if [ $IDX -lt $TOTAL ]; then
    WAIT=$((RANDOM % 2 + 1))
    sleep $WAIT
  fi
done

echo ""
echo "采集完成！结果保存在 $OUTFILE"
echo "共 $(wc -l < "$OUTFILE") 条记录"
