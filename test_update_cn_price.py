import json

import pytest

from scripts import update_cn_price


def test_all_failures_keep_snapshot(monkeypatch, tmp_path):
    path = tmp_path / "cn98.json"
    original = '{"cities":{"guangdong/zhuhai.shtml":{"name":"珠海","p98":11.09}}}'
    path.write_text(original, encoding="utf-8")
    monkeypatch.setattr(update_cn_price, "DATA_PATH", str(path))
    monkeypatch.setattr(update_cn_price, "fetch_text", lambda *_: "95號汽油: 9.10")
    with pytest.raises(SystemExit):
        update_cn_price.main()
    assert path.read_text(encoding="utf-8") == original


def test_partial_refresh_retains_price_dates_and_records_changelog(monkeypatch, tmp_path):
    path = tmp_path / "cn98.json"
    changelog = tmp_path / "CHANGELOG.md"
    changelog.write_text("# 變更紀錄\n\n## 原有紀錄\n", encoding="utf-8")
    path.write_text(json.dumps({
        "updated_hkt": "2026-11-14",
        "cities": {
            "guangdong/zhuhai.shtml": {"name": "珠海", "p98": 11.09},
            "guangdong/shenzhen.shtml": {"name": "深圳", "p98": 11.11},
        },
    }), encoding="utf-8")
    monkeypatch.setattr(update_cn_price, "DATA_PATH", str(path))
    monkeypatch.setattr(update_cn_price, "fetch_text", lambda city: (
        "95號汽油: 9.10 98號汽油: 11.09" if city.endswith("zhuhai.shtml") else "95號汽油: 9.10"
    ))

    update_cn_price.main(changelog)

    snapshot = json.loads(path.read_text(encoding="utf-8"))
    zhuhai = snapshot["cities"]["guangdong/zhuhai.shtml"]
    shenzhen = snapshot["cities"]["guangdong/shenzhen.shtml"]
    assert snapshot["updated_hkt"] == zhuhai["price_date"] == "2026-11-14"
    assert zhuhai["checked_at"] == snapshot["checked_at"]
    assert shenzhen["stale"] and "checked_at" not in shenzhen
    assert shenzhen["p98"] == 11.11
    history = changelog.read_text(encoding="utf-8")
    assert "1/7 個地區成功，珠海參考價 ¥11.09/L" in history
    assert history.index("油價快照") < history.index("原有紀錄")
