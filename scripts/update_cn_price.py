#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""抓取汽油价格网（qiyoujiage.com）廣東各城市 98# 油價，輸出 data/cn98.json。

由 GitHub Actions 每日執行；前端優先讀取此快照（免 CORS 代理、最快），
快照未涵蓋的城市才回退到即時代理查詢。

安全性與穩健性：
- 優先 HTTPS，失敗才退回 HTTP。
- 價格需落在合理區間（見 MIN/MAX_PRICE），否則視為解析失敗。
- 單一城市失敗時保留上一次的良好數值，不用壞資料覆蓋。
- 全部城市都失敗則中止，不寫檔（保留舊快照）。
- 若價格與檔案內完全相同，保留原本的 updated 時間戳，讓 git 不產生無意義提交。

僅使用標準庫。
"""

import datetime
import html as _html
import json
import os
import re
import urllib.request

SITE = "www.qiyoujiage.com"
CITIES = {
    "guangdong/zhuhai.shtml": "珠海",
    "guangdong/guangzhou.shtml": "廣州",
    "guangdong/shenzhen.shtml": "深圳",
    "guangdong/dongguan.shtml": "東莞",
    "guangdong/foshan.shtml": "佛山",
    "guangdong/zhongshan.shtml": "中山",
    "guangdong.shtml": "廣東",
}
DATA_PATH = "data/cn98.json"
# 合理油價區間（¥/L）；超出視為頁面改版或解析錯誤
MIN_PRICE = 3.0
MAX_PRICE = 20.0
UA = "Mozilla/5.0 (compatible; HK-ZH-Gas-discount-calc/1.0; +https://github.com/adobezii/HK-ZH-Gas-discount-calc)"


def fetch_text(path, timeout=30):
    last_error = None
    for scheme in ("https", "http"):
        try:
            req = urllib.request.Request(f"{scheme}://{SITE}/{path}", headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                raw = resp.read()
            for enc in ("utf-8-sig", "utf-8", "gb18030", "gbk"):
                try:
                    return raw.decode(enc)
                except UnicodeDecodeError:
                    continue
            return raw.decode("utf-8", "ignore")
        except Exception as exc:  # noqa: BLE001 - 逐層降級
            last_error = exc
    raise last_error


def strip_tags(source):
    """去除 script/style 與 HTML 標籤，並還原實體（標籤會夾在標籤與價格之間）。"""
    source = re.sub(r"<script.*?</script>", " ", source, flags=re.S | re.I)
    source = re.sub(r"<style.*?</style>", " ", source, flags=re.S | re.I)
    source = re.sub(r"<[^>]+>", " ", source)
    return _html.unescape(source)


def grab(text, grade):
    """取出「98#汽油 / 98号汽油」後面的價格；超出合理區間回傳 None。"""
    m = re.search(grade + r"\s*[#號号]?\s*汽油\s*[:：]?\s*([0-9]+(?:\.[0-9]+)?)", text)
    if not m:
        return None
    value = float(m.group(1))
    if not (MIN_PRICE <= value <= MAX_PRICE):
        print(f"warn: {grade}# price {value} out of plausible range; ignored")
        return None
    return value


# 註：不採用頁面上的日期——該頁有「已於2017年5月26日更新」之類的過期註腳，
# 直接抓會得到錯誤日期。改由快照自身記錄抓取時間（UTC 與香港時間）。

def load_existing():
    try:
        with open(DATA_PATH, encoding="utf-8") as fh:
            return json.load(fh)
    except Exception:
        return {}


def main():
    previous = load_existing()
    prev_cities = previous.get("cities") or {}
    cities = {}

    for path, name in CITIES.items():
        entry = None
        try:
            text = strip_tags(fetch_text(path))
            p98 = grab(text, "98")
            if p98 is not None:
                entry = {"name": name, "p98": p98}
                print(f"ok   {name}: 98# {p98}")
        except Exception as exc:  # 任一城市失敗不影響其他
            print(f"fail {name}: {exc}")

        if entry is None:
            # 保留上一次的良好數值，不用壞資料覆蓋
            old = prev_cities.get(path)
            if old and old.get("p98"):
                entry = dict(old)
                entry["stale"] = True
                print(f"keep {name}: 沿用上次數值 {old.get('p98')}")
        if entry is not None:
            cities[path] = entry

    if not cities:
        raise SystemExit("no data fetched; aborting (snapshot left unchanged)")

    # 價格未變動時保留原 updated，避免每日產生無意義提交
    def price_view(data):
        return {k: v.get("p98") for k, v in (data or {}).items()}

    now_utc = datetime.datetime.now(datetime.timezone.utc)
    hkt = now_utc.astimezone(datetime.timezone(datetime.timedelta(hours=8)))
    if price_view(cities) == price_view(prev_cities):
        # 價格未變 → 沿用原本時間戳，讓檔案位元組不變、git 不產生提交
        updated = previous.get("updated") or ""
        updated_hkt = previous.get("updated_hkt") or hkt.strftime("%Y-%m-%d")
    else:
        updated = now_utc.strftime("%Y-%m-%dT%H:%M:%SZ")
        updated_hkt = hkt.strftime("%Y-%m-%d")

    payload = {"updated": updated, "updated_hkt": updated_hkt, "source": SITE, "cities": cities}
    if payload == previous:
        print("snapshot unchanged; nothing written")
        return

    os.makedirs(os.path.dirname(DATA_PATH) or ".", exist_ok=True)
    with open(DATA_PATH, "w", encoding="utf-8") as fh:
        json.dump(payload, fh, ensure_ascii=False, indent=2)
        fh.write("\n")
    print(f"wrote {DATA_PATH} ({len(cities)} cities, updated={updated})")


if __name__ == "__main__":
    main()
