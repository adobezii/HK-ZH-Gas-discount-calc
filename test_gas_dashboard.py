# -*- coding: utf-8 -*-

from copy import deepcopy

from gas_dashboard import (
    build_quotes,
    cnpc_direct_discount,
    default_state,
    gd_shell_discount,
    hk_sinopec_discount,
    load_city_snapshot,
)


def quote(quotes, station_id):
    return next(item for item in quotes if item["station_id"] == station_id)


def test_city_defaults_and_overrides():
    state = default_state()
    state["date"] = "2026-11-12"
    snapshot = deepcopy(load_city_snapshot())
    snapshot["cities"]["guangdong/zhuhai.shtml"]["p98"] = 11.0
    snapshot["cities"]["guangdong/shenzhen.shtml"]["p98"] = 12.0
    snapshot["cities"]["guangdong/guangzhou.shtml"]["p98"] = 13.0

    quotes = build_quotes(state, snapshot=snapshot)
    assert quote(quotes, "gd-shell")["city"] == "zhuhai"
    assert quote(quotes, "gd-sinopec")["city"] == "zhuhai"

    state["global_city"] = "shenzhen"
    state["gd_shell"]["city_mode"] = "override"
    state["gd_shell"]["override_city"] = "guangzhou"
    quotes = build_quotes(state, snapshot=snapshot)
    assert quote(quotes, "gd-shell")["city"] == "guangzhou"
    assert quote(quotes, "gd-sinopec")["city"] == "shenzhen"


def test_discount_rules():
    assert cnpc_direct_discount("2026-11-12") == 12.6
    assert cnpc_direct_discount("2026-11-18") == 13.9
    assert cnpc_direct_discount("2026-11-20") == 0
    assert hk_sinopec_discount("2026-11-18", "premium", False) == 13.51
    assert hk_sinopec_discount("2026-11-18", "premium", True) == 15.1
    assert hk_sinopec_discount("2026-11-21", "standard", True) == 6.61
    assert gd_shell_discount("2026-11-18") == 1.88
    assert gd_shell_discount("2026-11-21") == 0.98


def test_sinopec_payback_and_independent_toll():
    state = default_state()
    state["date"] = "2026-11-12"
    state["gd_sinopec"]["manual_price"] = 11.65
    state["gd_sinopec"]["include_toll"] = False
    quotes = build_quotes(state)
    result = quote(quotes, "gd-sinopec")
    assert abs(result["total"] - (11.65 - 2.0) * 60 * 1.08) < 1e-6
    assert {"label": "卡費回本", "value": "294L"} in result["breakdown"]

    state["gd_sinopec"]["include_toll"] = True
    quotes = build_quotes(state)
    tolled = quote(quotes, "gd-sinopec")
    assert abs(tolled["total"] - ((11.65 - 2.0) * 60 * 1.08 + 142.5 * 2 * 1.08)) < 1e-5
