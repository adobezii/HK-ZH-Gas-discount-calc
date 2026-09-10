# -*- coding: utf-8 -*-
"""caltex_core 單元測試。

執行：python3 -m pytest test_caltex_core.py -q
     （無 pytest 時：python3 test_caltex_core.py）
"""

import math

from caltex_core import (
    calc_caltex_effective_price,
    pick_card_discount,
    filter_coupons,
    date_discount,
    compare_cross_border,
    FALLBACK_DISCOUNT_CARDS,
    FALLBACK_COUPONS,
)


def approx(a, b, tol=1e-9):
    return abs(a - b) <= tol


def test_star_card_350_50_standard_19():
    """基準案例：牌價 $33.17、私人能源卡減 $11、滿 $350 減 $50 → 券後 $19.00/L。"""
    r = calc_caltex_effective_price(33.17, 11.0, 350.0, 50.0)
    assert approx(r.actual_price, 19.002857142857142)
    assert approx(r.total_liters, 10.551703346397346)
    assert approx(r.discounted_price, 22.17)


def test_star_card_350_50_premium():
    """白金 98：牌價 $34.97、減 $12、滿 $350 減 $50 → 約 $19.69/L。"""
    r = calc_caltex_effective_price(34.97, 12.0, 350.0, 50.0)
    assert approx(r.actual_price, 19.688571428571432)


def test_hsbc_standard_800_280():
    """滙豐：黃金滿 $800 減 $280 → 約 $20.98/L。"""
    r = calc_caltex_effective_price(33.17, 0.9, 800.0, 280.0)
    assert approx(r.actual_price, 20.9755)


def test_no_coupon():
    """無油券時：實付等於牌價×升數，每升實付=折扣後價。"""
    r = calc_caltex_effective_price(33.17, 11.0, 350.0, 0.0)
    assert approx(r.actual_price, 22.17)


def test_invalid_inputs():
    for kwargs in [
        {"list_price": 0, "card_discount": 11},
        {"list_price": 33.17, "card_discount": 40},
        {"list_price": 33.17, "card_discount": -1},
        {"list_price": 33.17, "card_discount": 11, "spend": 0},
        {"list_price": 33.17, "card_discount": 11, "spend": 350, "coupon_value": 400},
    ]:
        try:
            calc_caltex_effective_price(**kwargs)
        except ValueError:
            pass
        else:
            raise AssertionError(f"應拋出 ValueError：{kwargs}")


def test_pick_card_discount():
    d = pick_card_discount(FALLBACK_DISCOUNT_CARDS, "caltex-personal-StarCard", "standard")
    assert approx(d, 11.0)
    d = pick_card_discount(FALLBACK_DISCOUNT_CARDS, "caltex-personal-StarCard", "premium")
    assert approx(d, 12.0)
    d = pick_card_discount(FALLBACK_DISCOUNT_CARDS, "starCard-others", "standard", 7.5)
    assert approx(d, 7.5)


def test_filter_coupons():
    star = filter_coupons(FALLBACK_COUPONS, "starCard", "standard")
    assert [c["id"] for c in star] == ["starCard-350-50"]
    hsbc_std = filter_coupons(FALLBACK_COUPONS, "hsbc", "standard")
    assert [c["id"] for c in hsbc_std] == ["hsbc-standard-800-280"]
    hsbc_prem = filter_coupons(FALLBACK_COUPONS, "hsbc", "premium")
    assert [c["id"] for c in hsbc_prem] == ["hsbc-permium-800-300"]


def test_date_discount():
    # 8 號（不限星期幾）
    assert date_discount(8, 3)["discount"] == 2.18
    assert date_discount(8, 3)["label"] == "8 號特惠"
    # 週三 / 週六
    assert date_discount(15, 2)["discount"] == 1.28
    assert date_discount(20, 5)["discount"] == 1.28
    # 8 號同時是週三：不疊加，取較大（2.18）
    r = date_discount(8, 2)
    assert r["discount"] == 2.18
    assert "同時" in r["label"]
    # 8 號同時是週六且週三六折扣較大
    assert date_discount(8, 5, disc_8th=1.0, disc_wed_sat=1.5)["discount"] == 1.5
    # 無優惠
    assert date_discount(15, 0)["discount"] == 0.0


def test_compare_cross_border():
    # 週三/六：內地 11.74 - 1.28 = 10.46，匯率 1.16599 → HK$12.196/L
    # 加德士券後 $19.00，橋費 $340、72.67L
    r = compare_cross_border(11.74, 1.28, 1.16599, 340.0, 72.67, 19.002857142857142)
    assert approx(r.cn_net_cny, 10.46)
    assert approx(r.cn_net_hkd, 10.46 * 1.16599)
    assert approx(r.toll_share, 340.0 / 72.67)
    assert r.save_per_liter > 0
    assert math.isfinite(r.breakeven_liters)
    # 回本門檻 = 橋費 / (香港 - 內地純油價HKD)
    expected_be = 340.0 / (19.002857142857142 - 10.46 * 1.16599)
    assert approx(r.breakeven_liters, expected_be, tol=1e-6)


def test_compare_cross_border_not_worth():
    # 內地折後折合港幣高於香港基準 → 不回本（門檻無限大）
    r = compare_cross_border(11.74, 0.0, 1.8, 340.0, 72.67, 15.0)
    assert r.breakeven_liters == float("inf")
    assert not r.worth_direct


if __name__ == "__main__":
    import sys
    import traceback

    failed = 0
    for name, fn in sorted(globals().items()):
        if name.startswith("test_") and callable(fn):
            try:
                fn()
                print(f"PASS  {name}")
            except Exception:
                failed += 1
                print(f"FAIL  {name}")
                traceback.print_exc()
    sys.exit(1 if failed else 0)
