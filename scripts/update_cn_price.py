#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""抓取汽油价格网（qiyoujiage.com）廣東各城市 98# 油價，輸出 data/cn98.json。

由 GitHub Actions 每日執行；前端優先讀取此快照（免 CORS 代理、最快），
快照未涵蓋的城市才回退到即時代理查詢。

僅使用標準庫。
"""

import datetime
import html as _html
import json
import os
import re
import urllib.request

BASE = "http://www.qiyoujiage.com/"
CITIES = {
    "guangdong/zhuhai.shtml": "珠海",
    "guangdong/guangzhou.shtml": "廣州",
    "guangdong/shenzhen.shtml": "深圳",
    "guangdong/dongguan.shtml": "東莞",
    "guangdong/foshan.shtml": "佛山",
    "guangdong/zhongshan.shtml": "中山",
    "guangdong.shtml": "廣東",
}
UA = "Mozilla/5.0 (compatible; HK-ZH-Gas-discount-calc/1.0; +https://github.com/adobezii/HK-ZH-Gas-discount-calc)"


def fetch_text(path, timeout=30):
    req = urllib.request.Request(BASE + path, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        raw = resp.read()
    for enc in ("utf-8", "gb18030", "gbk"):
        try:
            return raw.decode(enc)
        except UnicodeDecodeError:
            continue
    return raw.decode("utf-8", "ignore")


def strip_tags(source):
    """去除 script/style 與 HTML 標籤，並還原實體（標籤會夾在標籤與價格之間）。"""
    source = re.sub(r"<script.*?</script>", " ", source, flags=re.S | re.I)
    source = re.sub(r"<style.*?</style>", " ", source, flags=re.S | re.I)
    source = re.sub(r"<[^>]+>", " ", source)
    return _html.unescape(source)


def grab(text, grade):
    """取出「98#汽油 / 98号汽油」後面的價格。"""
    m = re.search(grade + r"\s*[#號号]?\s*汽油\s*[:：]?\s*([0-9]+(?:\.[0-9]+)?)", text)
    return float(m.group(1)) if m else None


def main():
    cities = {}
    for path, name in CITIES.items():
        try:
            text = strip_tags(fetch_text(path))
            p98 = grab(text, "98")
            if p98 is None:
                print(f"skip {name}: no 98# price")
                continue
            date = (re.search(r"(20\d{2}-\d{2}-\d{2})", text) or [None, ""])[1]
            # 表格只比較 98#，故只輸出 98#
            cities[path] = {
                "name": name,
                "p98": p98,
                "date": date,
            }
            print(f"ok   {name}: 98# {p98}")
        except Exception as exc:  # 任一城市失敗不影響其他
            print(f"fail {name}: {exc}")

    if not cities:
        raise SystemExit("no data fetched; aborting")

    payload = {
        "updated": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "source": "qiyoujiage.com",
        "cities": cities,
    }
    os.makedirs("data", exist_ok=True)
    with open("data/cn98.json", "w", encoding="utf-8") as fh:
        json.dump(payload, fh, ensure_ascii=False, indent=2)
        fh.write("\n")
    print(f"wrote data/cn98.json ({len(cities)} cities)")


if __name__ == "__main__":
    main()
