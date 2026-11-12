# -*- coding: utf-8 -*-
"""粵港六站共用的資料模型與折扣計算。"""

from __future__ import annotations

import copy
import json
from datetime import date
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent
CITY_LABELS = {
    "zhuhai": "珠海",
    "shenzhen": "深圳",
    "guangzhou": "廣州",
}
CITY_KEYS = {
    "zhuhai": "guangdong/zhuhai.shtml",
    "shenzhen": "guangdong/shenzhen.shtml",
    "guangzhou": "guangdong/guangzhou.shtml",
}


def load_json(path: str) -> dict[str, Any]:
    with (ROOT / path).open(encoding="utf-8") as handle:
        return json.load(handle)


def load_promotions() -> dict[str, Any]:
    return load_json("data/promotions.json")


def load_city_snapshot() -> dict[str, Any]:
    return load_json("data/cn98.json")


def default_state(today: date | None = None) -> dict[str, Any]:
    promotions = load_promotions()
    current = (today or date.today()).isoformat()
    cards = promotions["gdSinopec"]["cards"]
    card_fee = next((card["fee"] for card in cards if card["id"] == "two-year"), cards[0]["fee"])
    return {
        "liters": 60.0,
        "fx": 1.08,
        "global_city": "zhuhai",
        "date": current,
        "hk_shell": {
            "fuel": "premium",
            "offer_day": "auto",
            "include_points": False,
            "coupon_min": 0.0,
            "coupon_value": 0.0,
            "rebate_percent": 0.0,
            "manual_price": None,
        },
        "hk_caltex": {
            "fuel": "standard",
            "card_id": promotions["caltex"]["cards"][0]["id"],
            "coupon_id": promotions["caltex"]["coupons"][0]["id"],
            "rebate_percent": 0.0,
            "manual_price": None,
        },
        "hk_cnpc": {
            "eligible": True,
            "discount_override": None,
            "manual_price": None,
        },
        "hk_sinopec": {
            "fuel": "premium",
            "member": True,
            "include_points": False,
            "discount_override": None,
            "manual_price": None,
        },
        "gd_shell": {
            "city_mode": "follow",
            "override_city": "zhuhai",
            "include_toll": True,
            "manual_price": None,
        },
        "gd_sinopec": {
            "city_mode": "follow",
            "override_city": "zhuhai",
            "discount_per_liter": promotions["gdSinopec"]["discountPerLiter"],
            "card_fee": card_fee,
            "include_toll": False,
            "manual_price": None,
        },
    }


def fallback_hk_data() -> dict[str, Any]:
    promotions = load_promotions()
    return {
        "loaded": False,
        "shell": promotions["hkShell"]["prices"],
        "caltex": {
            "standard": promotions["caltex"]["standardPrice"],
            "premium": promotions["caltex"]["premiumPrice"],
        },
        "cnpc": promotions["hkCnpc"]["price"],
        "sinopec": promotions["hkSinopec"]["prices"],
        "cards": promotions["caltex"]["cards"],
        "coupons": promotions["caltex"]["coupons"],
    }


def _weekday(iso: str) -> int:
    return date.fromisoformat(iso).weekday()


def cnpc_direct_discount(iso: str) -> float:
    promotions = load_promotions()
    rule = promotions["hkCnpc"]
    if not (rule["start"] <= iso <= rule["end"]):
        return 0.0
    weekday = _weekday(iso)
    if weekday == 2:
        return rule["direct"]["wed"]
    if weekday in (0, 1, 3):
        return rule["direct"]["monThu"]
    return rule["direct"]["weekend"]


def hk_sinopec_discount(iso: str, fuel: str, include_points: bool) -> float:
    promotions = load_promotions()
    rule = promotions["hkSinopec"]
    if not (rule["start"] <= iso <= rule["end"]):
        return 0.0
    weekday = _weekday(iso)
    if fuel == "standard":
        selected = (
            rule["standard"]["weekend"]
            if weekday in (5, 6)
            else rule["standard"]["weekday"]
        )
        return selected["allIn"] if include_points else selected["direct"]

    selected = rule["premium"]["weekend"]
    if weekday in (0, 3):
        selected = rule["premium"]["monThu"]
    elif weekday in (1, 4):
        selected = rule["premium"]["tueFri"]
    elif weekday == 2 and iso <= rule["wednesdayEnd"]:
        selected = rule["premium"]["wed"]
    return selected["allIn"] if include_points else selected["direct"]


def gd_shell_discount(iso: str) -> float:
    promotions = load_promotions()
    day = int(iso[-2:])
    weekday = _weekday(iso)
    hit_8 = day in (8, 18, 28)
    hit_wed_sat = weekday in (2, 5)
    if hit_8 and hit_wed_sat:
        return max(promotions["gdShell"]["discount8th"], promotions["gdShell"]["discountWedSat"])
    if hit_8:
        return promotions["gdShell"]["discount8th"]
    if hit_wed_sat:
        return promotions["gdShell"]["discountWedSat"]
    return 0.0


def resolve_city(station: dict[str, Any], global_city: str) -> str:
    return global_city if station["city_mode"] == "follow" else station["override_city"]


def city_price(city: str, snapshot: dict[str, Any]) -> tuple[float, str, bool]:
    promotions = load_promotions()
    entry = snapshot.get("cities", {}).get(CITY_KEYS[city])
    if entry and float(entry.get("p98", 0)) > 0:
        return float(entry["p98"]), "snapshot", bool(entry.get("stale"))
    return float(promotions["gdShell"]["fallback"]), "fallback", False


def _caltex_card_coupon(
    state: dict[str, Any],
    cards: list[dict[str, Any]],
    coupons: list[dict[str, Any]],
) -> tuple[dict[str, Any], dict[str, Any] | None]:
    config = state["hk_caltex"]
    card = next((item for item in cards if item["id"] == config["card_id"]), cards[0])
    valid = []
    for coupon in coupons:
        card_types = coupon.get("validCardType")
        if isinstance(card_types, str):
            card_types = [card_types]
        if card_types and card["type"] not in card_types:
            continue
        if coupon.get("validFor") and config["fuel"] not in coupon["validFor"]:
            continue
        valid.append(coupon)
    selected = next((item for item in valid if item["id"] == config["coupon_id"]), valid[0] if valid else None)
    return card, selected


def build_quotes(
    state: dict[str, Any],
    hk_data: dict[str, Any] | None = None,
    snapshot: dict[str, Any] | None = None,
) -> list[dict[str, Any]]:
    promotions = load_promotions()
    data = hk_data or fallback_hk_data()
    city_data = snapshot or load_city_snapshot()
    liters = max(0.1, float(state["liters"]))
    fx = max(0.01, float(state["fx"]))
    toll_hkd = promotions["toll"]["rmbPerCrossing"] * promotions["toll"]["crossings"] * fx

    shell = state["hk_shell"]
    shell_base = shell["manual_price"] or data["shell"][shell["fuel"]]
    weekday = _weekday(state["date"])
    offer_day = shell["offer_day"]
    if offer_day == "auto":
        offer_day = "wed" if weekday == 2 else "weekend" if weekday in (5, 6) else "weekday"
    shell_rule = promotions["hkShell"]["offers"][shell["fuel"]][offer_day]
    shell_discount = shell_rule["allIn"] if shell["include_points"] else shell_rule["cash"]
    shell_after = max(0.0, (shell_base - shell_discount) * liters)
    shell_voucher = (
        shell["coupon_value"]
        if shell["coupon_min"] > 0 and shell_after >= shell["coupon_min"]
        else 0.0
    )
    shell_final = max(0.0, (shell_after - shell_voucher) * (1 - shell["rebate_percent"] / 100))

    card, coupon = _caltex_card_coupon(state, data["cards"], data["coupons"])
    caltex = state["hk_caltex"]
    caltex_base = caltex["manual_price"] or data["caltex"][caltex["fuel"]]
    card_discount = card["standardDiscount"] if caltex["fuel"] == "standard" else card["premiumDiscount"]
    discounted_caltex = max(0.0, caltex_base - card_discount)
    caltex_final = discounted_caltex * liters
    usable = 0
    rest = liters
    if coupon and coupon["spend"] > 0:
        per_coupon = coupon["spend"] / caltex_base
        usable = int((liters * caltex_base + 0.005 * caltex_base) // coupon["spend"])
        rest = max(0.0, liters - usable * per_coupon)
        paid_liters = usable * ((coupon["spend"] - coupon["discount"]) / caltex_base) + rest
        caltex_final = paid_liters * discounted_caltex
    caltex_final = max(0.0, caltex_final * (1 - caltex["rebate_percent"] / 100))

    cnpc = state["hk_cnpc"]
    cnpc_base = cnpc["manual_price"] or data["cnpc"]
    cnpc_discount = (
        min(cnpc_base, cnpc["discount_override"] if cnpc["discount_override"] is not None else cnpc_direct_discount(state["date"]))
        if cnpc["eligible"]
        else 0.0
    )
    cnpc_final = max(0.0, (cnpc_base - cnpc_discount) * liters)

    sinohk = state["hk_sinopec"]
    sinohk_base = sinohk["manual_price"] or data["sinopec"][sinohk["fuel"]]
    sinohk_discount = (
        min(
            sinohk_base,
            sinohk["discount_override"]
            if sinohk["discount_override"] is not None
            else hk_sinopec_discount(state["date"], sinohk["fuel"], sinohk["include_points"]),
        )
        if sinohk["member"]
        else 0.0
    )
    sinohk_final = max(0.0, (sinohk_base - sinohk_discount) * liters)

    shell_city = resolve_city(state["gd_shell"], state["global_city"])
    shell_city_price, shell_source, shell_stale = city_price(shell_city, city_data)
    gd_shell_base = state["gd_shell"]["manual_price"] or shell_city_price
    shell_discount_amount = gd_shell_discount(state["date"])
    gd_shell_final = (
        max(0.0, (gd_shell_base - shell_discount_amount) * liters) * fx
        + (toll_hkd if state["gd_shell"]["include_toll"] else 0.0)
    )

    sino_city = resolve_city(state["gd_sinopec"], state["global_city"])
    sino_city_price, sino_source, sino_stale = city_price(sino_city, city_data)
    gd_sino_base = state["gd_sinopec"]["manual_price"] or sino_city_price
    gd_sino_discount = float(state["gd_sinopec"]["discount_per_liter"])
    gd_sino_final = (
        max(0.0, (gd_sino_base - gd_sino_discount) * liters) * fx
        + (toll_hkd if state["gd_sinopec"]["include_toll"] else 0.0)
    )
    payback = (
        state["gd_sinopec"]["card_fee"] / gd_sino_discount
        if gd_sino_discount > 0
        else float("inf")
    )

    totals = [
        shell_final,
        caltex_final,
        cnpc_final,
        sinohk_final,
        gd_shell_final,
        gd_sino_final,
    ]
    winner = min(totals)

    def quote(
        station_id: str,
        name: str,
        short_name: str,
        accent: str,
        total: float,
        gross: float,
        source: str,
        source_label: str,
        city: str | None,
        breakdown: list[dict[str, str]],
    ) -> dict[str, Any]:
        return {
            "station_id": station_id,
            "name": name,
            "short_name": short_name,
            "accent": accent,
            "city": city,
            "unit_price": total / liters,
            "total": total,
            "gross": gross,
            "saving": gross - total,
            "source": source,
            "source_label": source_label,
            "is_winner": abs(total - winner) < 0.005,
            "breakdown": breakdown,
        }

    hk_source = "api" if data.get("loaded") else "fallback"
    hk_label = "香港油價公開資料" if data.get("loaded") else "內建備用價"
    return [
        quote(
            "hk-shell",
            "香港 Shell",
            "Shell",
            "#facc15",
            shell_final,
            shell_base * liters,
            hk_source,
            hk_label,
            None,
            [
                {"label": "牌價", "value": f"HK$ {shell_base:.2f}/L"},
                {"label": "直減", "value": f"HK$ {shell_discount:.2f}/L"},
            ],
        ),
        quote(
            "hk-caltex",
            "香港加德士",
            "加德士",
            "#ef4444",
            caltex_final,
            caltex_base * liters,
            hk_source,
            hk_label,
            None,
            [
                {"label": "牌價", "value": f"HK$ {caltex_base:.2f}/L"},
                {"label": "卡折扣", "value": f"HK$ {card_discount:.2f}/L"},
                {"label": "可用券", "value": f"{usable} 張，餘 {rest:.2f}L"},
            ],
        ),
        quote(
            "hk-cnpc",
            "香港中石油",
            "中石油",
            "#f97316",
            cnpc_final,
            cnpc_base * liters,
            hk_source,
            hk_label,
            None,
            [
                {"label": "牌價", "value": f"HK$ {cnpc_base:.2f}/L"},
                {"label": "純直減", "value": f"HK$ {cnpc_discount:.2f}/L"},
            ],
        ),
        quote(
            "hk-sinopec",
            "香港中石化",
            "港中石化",
            "#06b6d4",
            sinohk_final,
            sinohk_base * liters,
            hk_source,
            hk_label,
            None,
            [
                {"label": "牌價", "value": f"HK$ {sinohk_base:.2f}/L"},
                {"label": "每升優惠", "value": f"HK$ {sinohk_discount:.2f}/L"},
            ],
        ),
        quote(
            "gd-shell",
            "廣東 Shell",
            "粵 Shell",
            "#10b981",
            gd_shell_final,
            gd_shell_base * liters * fx,
            state["gd_shell"]["manual_price"] is not None and "manual" or shell_source,
            f"{CITY_LABELS[shell_city]} · {'上次快照' if shell_stale else '城市快照'}",
            shell_city,
            [
                {"label": "城市", "value": CITY_LABELS[shell_city]},
                {"label": "人民幣牌價", "value": f"¥{gd_shell_base:.2f}/L"},
                {"label": "每升立減", "value": f"¥{shell_discount_amount:.2f}/L"},
                {"label": "過境路費", "value": f"HK$ {toll_hkd:.0f}" if state["gd_shell"]["include_toll"] else "未計"},
            ],
        ),
        quote(
            "gd-sinopec",
            "廣東中石化",
            "粵中石化",
            "#3b82f6",
            gd_sino_final,
            gd_sino_base * liters * fx,
            state["gd_sinopec"]["manual_price"] is not None and "manual" or sino_source,
            f"{CITY_LABELS[sino_city]} · {'上次快照' if sino_stale else '城市快照'}",
            sino_city,
            [
                {"label": "城市", "value": CITY_LABELS[sino_city]},
                {"label": "人民幣牌價", "value": f"¥{gd_sino_base:.2f}/L"},
                {"label": "每升立減", "value": f"¥{gd_sino_discount:.2f}/L"},
                {"label": "卡費回本", "value": f"{payback:.0f}L" if payback != float("inf") else "—"},
                {"label": "過境路費", "value": f"HK$ {toll_hkd:.0f}" if state["gd_sinopec"]["include_toll"] else "未計"},
            ],
        ),
    ]


def clone_state(state: dict[str, Any]) -> dict[str, Any]:
    return copy.deepcopy(state)
