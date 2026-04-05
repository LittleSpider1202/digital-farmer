#!/usr/bin/env python3
"""原子领取下一个可用 feature。

用法：
    python3 scripts/feature_claim.py          # 自动领取下一个
    python3 scripts/feature_claim.py 4        # 指定领取 #4

原子性：mkdir 做文件系统级互斥，防止并发领取同一 feature。
锁只在读写 JSON 期间持有（毫秒级），写完立即释放。
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
FEATURE_LIST = PROJECT_ROOT / "feature_list.json"
MUTEX = PROJECT_ROOT / ".claude" / "locks" / "claim.lock"


def _acquire() -> bool:
    try:
        MUTEX.mkdir(parents=True, exist_ok=False)
        return True
    except FileExistsError:
        return False


def _release() -> None:
    try:
        MUTEX.rmdir()
    except OSError:
        pass


def main() -> None:
    target_id = int(sys.argv[1]) if len(sys.argv) > 1 else None

    # 获取互斥锁
    if not _acquire():
        print("ERROR: 另一个 session 正在领取，请稍后重试", file=sys.stderr)
        sys.exit(1)

    try:
        with open(FEATURE_LIST, encoding="utf-8") as f:
            data = json.load(f)

        features = data["features"]
        claimed = None

        for f in features:
            if f.get("passes"):
                continue
            if f.get("status") == "in_progress":
                if target_id is not None and f["id"] == target_id:
                    print(f"ERROR: Feature #{target_id} 正在被其他 session 开发", file=sys.stderr)
                    sys.exit(1)
                continue
            if target_id is not None and f["id"] != target_id:
                continue

            # 标记为 in_progress
            f["status"] = "in_progress"
            claimed = f
            break

        if claimed is None:
            if target_id is not None:
                print(f"ERROR: Feature #{target_id} 不可用（已完成或不存在）", file=sys.stderr)
            else:
                print("ERROR: 无可领取的 feature", file=sys.stderr)
            sys.exit(1)

        # 原子写回
        with open(FEATURE_LIST, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
            f.write("\n")

        # 输出领取结果（供 skill 读取）
        print(json.dumps(claimed, ensure_ascii=False))

    finally:
        _release()


if __name__ == "__main__":
    main()
