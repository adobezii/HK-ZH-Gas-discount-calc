# -*- coding: utf-8 -*-
"""粵港六站油價比較器（Streamlit）。

執行：streamlit run fuel_calc.py
"""

from __future__ import annotations

from datetime import date
from datetime import datetime
from zoneinfo import ZoneInfo
from typing import Any

import streamlit as st

from caltex_core import (
    fetch_cn_98_price,
    fetch_cn_98_price_apihz,
    fetch_cn_98_price_mxnzp,
    fetch_cn_98_price_showapi,
    fetch_cny_hkd_rate,
    fetch_hk_prices,
)
from gas_dashboard import (
    CITY_LABELS,
    build_quotes,
    default_state,
    fallback_hk_data,
    load_city_snapshot,
    load_promotions,
)

st.set_page_config(page_title="粵港六站油價比較", page_icon="⛽", layout="wide")

PROMOTIONS = load_promotions()
CITIES = list(CITY_LABELS.items())

st.markdown(
    """
    <style>
    :root {
      --panel: #121a28; --line: #29364a; --muted: #9aa8ba; --good: #34d399;
    }
    html, body, [class*="css"] {
      font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text",
        "PingFang TC", "PingFang HK", "PingFang SC", sans-serif;
      font-variant-numeric: tabular-nums;
    }
    .block-container { max-width: 1500px; padding-top: 2rem; }
    [data-testid="stMetric"] {
      border: 1px solid var(--line); border-radius: 14px;
      background: var(--panel); padding: .85rem;
    }
    [data-testid="stMetricValue"] { letter-spacing: -.03em; }
    .station-card {
      min-height: 178px; padding: 1rem; border: 1px solid var(--line);
      border-radius: 14px; background: var(--panel); margin-bottom: .7rem;
      border-top: 3px solid var(--station-accent);
    }
    .station-card.winner { border-color: var(--good); }
    .station-kicker { color: var(--muted); font-size: .72rem; }
    .station-title { margin: .18rem 0; font-size: 1.03rem; font-weight: 750; }
    .station-price { margin-top: .8rem; font-size: 1.65rem; font-weight: 800; }
    .station-total { color: var(--muted); font-size: .78rem; }
    .scope-chip {
      display: inline-block; margin: .2rem .25rem 0 0; padding: .1rem .35rem;
      border: 1px solid var(--line); border-radius: 999px;
      color: var(--muted); font-size: .64rem;
    }
    .winner-chip {
      display: inline-block; margin-left: .35rem; padding: .1rem .4rem;
      border: 1px solid var(--good); border-radius: 999px;
      color: var(--good); font-size: .62rem;
    }
    div[data-testid="stExpander"] {
      border-color: var(--line) !important; background: var(--panel);
    }
    @media (prefers-reduced-motion: reduce) {
      * { animation-duration: .01ms !important; transition-duration: .01ms !important; }
    }
    </style>
    """,
    unsafe_allow_html=True,
)


@st.cache_data(ttl=3600)
def get_hk_data() -> dict[str, Any]:
    fallback = fallback_hk_data()
    try:
        prices, cards, coupons = fetch_hk_prices()
        return {
            "loaded": True,
            "updated_at": datetime.now().astimezone().isoformat(),
            "shell": {
                "premium": prices["premium"],
                "standard": prices["standard"],
            },
            "caltex": {
                "premium": prices["premium"],
                "standard": prices["standard"],
            },
            "cnpc": prices["premium"],
            "sinopec": {
                "premium": prices["premium"],
                "standard": prices["standard"],
            },
            "cards": cards,
            "coupons": coupons,
        }
    except Exception:
        return fallback


@st.cache_data(ttl=3600)
def get_fx() -> float:
    try:
        return float(fetch_cny_hkd_rate())
    except Exception:
        return 1.08


if "dashboard" not in st.session_state:
    st.session_state.dashboard = default_state()
    st.session_state.dashboard["fx"] = get_fx()

state = st.session_state.dashboard


def manual_price_input(
    label: str,
    config: dict[str, Any],
    fallback: float,
    key: str,
    structured: bool = False,
) -> None:
    enabled = st.checkbox(
        f"手動輸入{label}",
        value=config["manual_price"] is not None,
        key=f"{key}_on",
    )
    if enabled:
        current = config["manual_price"]
        current_value = (
            float(current["value"])
            if isinstance(current, dict)
            else float(current or fallback)
        )
        value = st.number_input(
            f"{label}（每升）",
            min_value=0.0,
            value=current_value,
            step=0.05,
            key=f"{key}_value",
        )
        config["manual_price"] = (
            {"value": value, "scope": "manual", "label": "手動價格"}
            if structured
            else value
        )
    else:
        config["manual_price"] = None


def city_binding_control(config: dict[str, Any], key: str) -> None:
    override = st.checkbox(
        "個別覆寫城市",
        value=config["city_mode"] == "override",
        key=f"{key}_override",
    )
    if override:
        config["city_mode"] = "override"
        config["override_city"] = st.selectbox(
            "方案城市",
            [value for value, _ in CITIES],
            format_func=lambda value: CITY_LABELS[value],
            index=[value for value, _ in CITIES].index(config["override_city"]),
            key=f"{key}_city",
        )
    else:
        config["city_mode"] = "follow"


with st.sidebar:
    st.header("全域條件")
    st.caption("兩個廣東方案預設跟隨全域城市，可個別覆寫。")
    selected_city = st.selectbox(
        "大陸城市",
        [value for value, _ in CITIES],
        format_func=lambda value: CITY_LABELS[value],
        index=[value for value, _ in CITIES].index(state["global_city"]),
    )
    state["global_city"] = selected_city

    automatic_date = st.checkbox(
        "自動按今日校準優惠",
        value=state.get("date_mode", "auto") == "auto",
        key="st_auto_date",
    )
    today_hk = datetime.now(ZoneInfo("Asia/Hong_Kong")).date()
    today_iso = today_hk.isoformat()
    if automatic_date:
        if (
            state.get("date_mode") != "auto"
            or state.get("last_calibrated_date") != today_iso
        ):
            state["date"] = today_iso
            state["hk_shell"]["offer_day"] = "auto"
            state["hk_cnpc"]["discount_override"] = None
            state["hk_sinopec"]["discount_override"] = None
            state["last_calibrated_date"] = today_iso
        selected_date = st.date_input(
            "加油日期（自動今日）",
            value=today_hk,
            disabled=True,
        )
    else:
        selected_date = st.date_input(
            "加油日期", value=date.fromisoformat(state["date"])
        )
        state["date"] = selected_date.isoformat()
    state["date_mode"] = "auto" if automatic_date else "manual"
    state["liters"] = st.number_input(
        "入油升數（L）",
        min_value=1.0,
        max_value=100.0,
        value=float(state["liters"]),
        step=0.5,
    )
    state["fx"] = st.number_input(
        "CNY → HKD",
        min_value=0.01,
        value=float(state["fx"]),
        step=0.005,
        format="%.4f",
    )

    if st.button("更新香港油價與匯率", use_container_width=True):
        get_hk_data.clear()
        get_fx.clear()
        state["fx"] = get_fx()
        st.rerun()

    st.divider()
    st.subheader("大陸油價來源")
    source = st.selectbox(
        "來源",
        ["城市快照", "接口盒子", "ShowAPI", "起零數據", "RollToolsApi"],
    )
    snapshot = load_city_snapshot()
    st.caption(
        f"城市快照更新：{snapshot.get('updated_hkt', '—')}；"
        "省級 API 只代表廣東全省。"
    )
    credentials: dict[str, str] = {}
    if source in ("接口盒子", "RollToolsApi"):
        credentials["id"] = st.text_input("開發者 ID／app_id")
    if source != "城市快照":
        credentials["key"] = st.text_input(
            "KEY／APPCODE／TOKEN", type="password"
        )
    if st.button("套用大陸油價", use_container_width=True):
        try:
            if source == "城市快照":
                state["gd_shell"]["manual_price"] = None
                state["gd_sinopec"]["manual_price"] = None
                st.success(f"已使用 {CITY_LABELS[state['global_city']]} 城市快照")
            elif source == "接口盒子":
                price = fetch_cn_98_price_apihz(
                    credentials["id"], credentials["key"]
                )
                for key in ("gd_shell", "gd_sinopec"):
                    state[key]["manual_price"] = {
                        "value": price,
                        "scope": "province",
                        "label": "廣東全省 API",
                    }
                st.success(f"廣東全省 98#：¥{price:.2f}/L")
            elif source == "ShowAPI":
                price = fetch_cn_98_price_showapi(credentials["key"])
                for key in ("gd_shell", "gd_sinopec"):
                    state[key]["manual_price"] = {
                        "value": price,
                        "scope": "province",
                        "label": "廣東全省 API",
                    }
                st.success(f"廣東全省 98#：¥{price:.2f}/L")
            elif source == "起零數據":
                price = fetch_cn_98_price(credentials["key"])
                for key in ("gd_shell", "gd_sinopec"):
                    state[key]["manual_price"] = {
                        "value": price,
                        "scope": "province",
                        "label": "廣東全省 API",
                    }
                st.success(f"廣東全省 98#：¥{price:.2f}/L")
            else:
                price = fetch_cn_98_price_mxnzp(
                    credentials["id"], credentials["key"]
                )
                for key in ("gd_shell", "gd_sinopec"):
                    state[key]["manual_price"] = {
                        "value": price,
                        "scope": "province",
                        "label": "廣東全省 API",
                    }
                st.success(f"廣東全省 98#：¥{price:.2f}/L")
        except Exception as exc:
            st.error(f"抓取失敗：{exc}")

    if st.button("重設全部設定", use_container_width=True):
        st.session_state.dashboard = default_state()
        st.rerun()

hk_data = get_hk_data()
quotes = build_quotes(state, hk_data=hk_data, snapshot=snapshot)
winner = min(quotes, key=lambda item: item["total"])

st.title("粵港六站油價及油卡比價")
st.caption(
    f"{state['date']}｜{state['liters']:.1f}L｜"
    f"1¥ = HK${state['fx']:.4f}｜全域城市：{CITY_LABELS[state['global_city']]}｜"
    f"日期校準：{'自動今日' if state['date_mode'] == 'auto' else '手動指定'}"
)
hk_status = (
    f"香港公開價 {datetime.fromisoformat(hk_data['updated_at']).strftime('%H:%M')}"
    if hk_data.get("loaded") and hk_data.get("updated_at")
    else "香港備用價"
)
gd_scopes = sorted({item["price_scope"] for item in quotes if item["city_mode"]})
scope_names = {
    "city": "城市快照",
    "province": "廣東全省 API",
    "manual": "手動價格",
    "fallback": "備用價",
}
scope_text = " · ".join(scope_names.get(scope, scope) for scope in gd_scopes)
st.markdown(
    f'<div class="status-line">{hk_status}　·　城市快照 {snapshot.get("updated_hkt", "—")}'
    f'　·　大陸資料 {scope_text or "未載入"}</div>',
    unsafe_allow_html=True,
)

metric_cols = st.columns(4)
metric_cols[0].metric(
    "全場最抵", winner["name"], f"HK$ {winner['unit_price']:.2f}/L"
)
metric_cols[1].metric("最抵總額", f"HK$ {winner['total']:.2f}")
second = min(
    (item for item in quotes if item["station_id"] != winner["station_id"]),
    key=lambda item: item["total"],
)
metric_cols[2].metric("領先次選", f"HK$ {second['total'] - winner['total']:.2f}")
metric_cols[3].metric(
    "香港資料", "即時／公開" if hk_data.get("loaded") else "內建備用"
)

ranked_quotes = sorted(quotes, key=lambda item: item["total"])
show_all = st.toggle("查看其餘三站", value=False)
display_quotes = ranked_quotes if show_all else ranked_quotes[:3]

st.subheader("六站結果" if show_all else "最抵三強")
for start in range(0, len(display_quotes), 3):
    cols = st.columns(3)
    for column, item in zip(cols, display_quotes[start : start + 3]):
        with column:
            rank = ranked_quotes.index(item) + 1
            winner_class = " winner" if item["is_winner"] else ""
            winner_chip = (
                '<span class="winner-chip">最低</span>'
                if item["is_winner"]
                else ""
            )
            city = f" · {CITY_LABELS[item['city']]}" if item["city"] else ""
            mode = ""
            if item["city_mode"]:
                mode = (
                    f'<span class="scope-chip">'
                    f'{"已自訂" if item["city_mode"] == "override" else "跟隨全域"}'
                    f"{city}</span>"
                )
            scope = {
                "city": "城市快照",
                "province": "廣東全省 API",
                "manual": "手動價格",
                "fallback": "備用價",
                "live": "香港公開價",
            }.get(item["price_scope"], item["price_scope"])
            date_rule = (
                f'<span class="scope-chip">{item["date_rule_label"]}</span>'
                if item.get("date_rule_label")
                else ""
            )
            st.markdown(
                f"""
                <div class="station-card{winner_class}" style="--station-accent:{item['accent']}">
                  <div class="station-kicker">{rank}. {item['source_label']}</div>
                  <div class="station-title">{item['name']}{winner_chip}</div>
                  <div>{mode}<span class="scope-chip">{scope}</span>{date_rule}</div>
                  <div class="station-price">HK$ {item['unit_price']:.2f}<small> / L</small></div>
                  <div class="station-total">本次總額 HK$ {item['total']:.2f}</div>
                </div>
                """,
                unsafe_allow_html=True,
            )

st.subheader("方案設定")
with st.expander("香港 Shell"):
    shell = state["hk_shell"]
    shell["fuel"] = st.selectbox(
        "油品",
        ["premium", "standard"],
        format_func=lambda value: "V-Power" if value == "premium" else "FuelSave",
        index=["premium", "standard"].index(shell["fuel"]),
        key="st_shell_fuel",
    )
    shell["offer_day"] = st.selectbox(
        "優惠日別",
        ["auto", "wed", "weekend", "weekday"],
        format_func=lambda value: {
            "auto": "自動",
            "wed": "星期三",
            "weekend": "週末",
            "weekday": "平日",
        }[value],
        index=["auto", "wed", "weekend", "weekday"].index(
            shell["offer_day"]
        ),
        key="st_shell_day",
    )
    shell["include_points"] = st.checkbox(
        "計入 GO+ 積分", value=shell["include_points"]
    )
    shell["coupon_min"] = st.number_input(
        "滿額券門檻", min_value=0.0, value=float(shell["coupon_min"])
    )
    shell["coupon_value"] = st.number_input(
        "滿額券減額", min_value=0.0, value=float(shell["coupon_value"])
    )
    shell["rebate_percent"] = st.number_input(
        "信用卡回贈 %",
        min_value=0.0,
        max_value=100.0,
        value=float(shell["rebate_percent"]),
    )
    manual_price_input(
        "Shell 牌價",
        shell,
        hk_data["shell"][shell["fuel"]],
        "st_shell_price",
    )

with st.expander("香港加德士"):
    caltex = state["hk_caltex"]
    caltex["fuel"] = st.selectbox(
        "油品",
        ["premium", "standard"],
        format_func=lambda value: "白金 98" if value == "premium" else "黃金",
        index=["premium", "standard"].index(caltex["fuel"]),
        key="st_caltex_fuel",
    )
    card_ids = [card["id"] for card in hk_data["cards"]]
    card_labels = {
        card["id"]: card["description"] for card in hk_data["cards"]
    }
    caltex["card_id"] = st.selectbox(
        "折扣卡",
        card_ids,
        index=(
            card_ids.index(caltex["card_id"])
            if caltex["card_id"] in card_ids
            else 0
        ),
        format_func=lambda value: card_labels[value],
    )
    coupon_ids = [""] + [coupon["id"] for coupon in hk_data["coupons"]]
    coupon_labels = {
        "": "無油券",
        **{
            coupon["id"]: coupon["description"]
            for coupon in hk_data["coupons"]
        },
    }
    caltex["coupon_id"] = st.selectbox(
        "油券",
        coupon_ids,
        index=(
            coupon_ids.index(caltex["coupon_id"])
            if caltex["coupon_id"] in coupon_ids
            else 0
        ),
        format_func=lambda value: coupon_labels[value],
    )
    caltex["rebate_percent"] = st.number_input(
        "信用卡回贈 %",
        min_value=0.0,
        max_value=100.0,
        value=float(caltex["rebate_percent"]),
        key="st_caltex_rebate",
    )
    manual_price_input(
        "加德士牌價",
        caltex,
        hk_data["caltex"][caltex["fuel"]],
        "st_caltex_price",
    )

with st.expander("香港中石油"):
    cnpc = state["hk_cnpc"]
    cnpc["eligible"] = st.checkbox(
        "符合折實滿 HK$300", value=cnpc["eligible"]
    )
    use_override = st.checkbox(
        "手動覆寫純直減", value=cnpc["discount_override"] is not None
    )
    cnpc["discount_override"] = (
        st.number_input(
            "每升直減",
            min_value=0.0,
            value=float(cnpc["discount_override"] or 0.0),
            step=0.05,
        )
        if use_override
        else None
    )
    manual_price_input(
        "中石油超級汽油牌價",
        cnpc,
        hk_data["cnpc"],
        "st_cnpc_price",
    )
    st.caption("只計純直減；週末官方未列明直減時請手動覆寫。")

with st.expander("香港中石化"):
    sinohk = state["hk_sinopec"]
    sinohk["fuel"] = st.selectbox(
        "油品",
        ["premium", "standard"],
        format_func=lambda value: (
            "超級汽油" if value == "premium" else "中石化汽油"
        ),
        index=["premium", "standard"].index(sinohk["fuel"]),
        key="st_sinohk_fuel",
    )
    sinohk["member"] = st.checkbox(
        "符合 X CARD／APP 會員", value=sinohk["member"]
    )
    sinohk["include_points"] = st.checkbox(
        "計入積分最高價值", value=sinohk["include_points"]
    )
    use_sino_override = st.checkbox(
        "手動覆寫每升優惠",
        value=sinohk["discount_override"] is not None,
    )
    sinohk["discount_override"] = (
        st.number_input(
            "每升優惠",
            min_value=0.0,
            value=float(sinohk["discount_override"] or 0.0),
            step=0.01,
        )
        if use_sino_override
        else None
    )
    manual_price_input(
        "中石化牌價",
        sinohk,
        hk_data["sinopec"][sinohk["fuel"]],
        "st_sinohk_price",
    )

with st.expander("廣東 Shell"):
    gd_shell = state["gd_shell"]
    city_binding_control(gd_shell, "st_gd_shell")
    gd_shell["include_toll"] = st.checkbox(
        "計入過境路費", value=gd_shell["include_toll"]
    )
    city = (
        state["global_city"]
        if gd_shell["city_mode"] == "follow"
        else gd_shell["override_city"]
    )
    city_entry = snapshot["cities"].get(
        f"guangdong/{city}.shtml", {}
    )
    manual_price_input(
        "廣東 Shell 98# 牌價",
        gd_shell,
        float(city_entry.get("p98", 11.65)),
        "st_gd_shell_price",
        structured=True,
    )
    if isinstance(gd_shell["manual_price"], dict) and gd_shell["manual_price"].get("scope") == "province":
        st.warning("此價格為廣東全省 API，不提供珠海／深圳／廣州細分。")

with st.expander("廣東中石化愛跑98"):
    gd_sino = state["gd_sinopec"]
    city_binding_control(gd_sino, "st_gd_sinopec")
    gd_sino["discount_per_liter"] = st.number_input(
        "每升立減（¥/L）",
        min_value=0.0,
        value=float(gd_sino["discount_per_liter"]),
        step=0.1,
    )
    card_options = PROMOTIONS["gdSinopec"]["cards"]
    card_labels = {
        card["id"]: f"{card['label']} · ¥{card['fee']}"
        for card in card_options
    }
    selected_card = st.selectbox(
        "加油卡方案",
        [card["id"] for card in card_options],
        index=1 if gd_sino["card_fee"] == card_options[1]["fee"] else 0,
        format_func=lambda value: card_labels[value],
    )
    gd_sino["card_fee"] = next(
        card["fee"] for card in card_options if card["id"] == selected_card
    )
    gd_sino["include_toll"] = st.checkbox(
        "計入過境路費",
        value=gd_sino["include_toll"],
        key="st_gd_sinopec_toll",
    )
    city = (
        state["global_city"]
        if gd_sino["city_mode"] == "follow"
        else gd_sino["override_city"]
    )
    city_entry = snapshot["cities"].get(
        f"guangdong/{city}.shtml", {}
    )
    manual_price_input(
        "廣東中石化 98# 牌價",
        gd_sino,
        float(city_entry.get("p98", 11.65)),
        "st_gd_sinopec_price",
        structured=True,
    )
    if isinstance(gd_sino["manual_price"], dict) and gd_sino["manual_price"].get("scope") == "province":
        st.warning("此價格為廣東全省 API，不提供城市細分。")
    payback = (
        gd_sino["card_fee"] / gd_sino["discount_per_liter"]
        if gd_sino["discount_per_liter"] > 0
        else None
    )
    st.caption(
        f"卡費回本：{payback:.0f}L；卡費不計入單次加油總額。"
        if payback
        else "請設定大於 0 的每升立減。"
    )

st.subheader("分享摘要")
summary_lines = [
    f"【粵港六站油價比價】{state['date']}",
    f"{state['liters']:.1f}L｜1¥ = HK${state['fx']:.4f}｜"
    f"全域城市 {CITY_LABELS[state['global_city']]}",
]
for item in quotes:
    city = (
        f"（{CITY_LABELS[item['city']]}）" if item["city"] else ""
    )
    summary_lines.append(
        f"{item['name']}{city}：HK${item['unit_price']:.2f}/L，"
        f"總額 HK${item['total']:.2f}"
    )
summary_lines.append(
    f"全場最抵：{winner['name']}，HK${winner['unit_price']:.2f}/L"
)
st.code("\n".join(summary_lines), language=None)
st.caption("價格及優惠僅供參考，以油站實際交易為準。")
