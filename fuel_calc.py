# -*- coding: utf-8 -*-
"""
粵港油價即時對比計算器（Streamlit 版）

執行：streamlit run fuel_calc.py

整合：
  1. 加德士拆單券後實付（caltex_core.calc_caltex_effective_price）
  2. 內地延長殼牌 98 折後價 + 日期優惠規則（8 號 / 週三六，不疊加取最平）
  3. 即時匯率 CNY→HKD（exchangerate.fun / open.er-api.com，失敗用備用值）
  4. 橋費攤分與回本門檻
"""

import math
from datetime import datetime

import streamlit as st

from caltex_core import (
    calc_caltex_effective_price,
    pick_card_discount,
    filter_coupons,
    date_discount,
    compare_cross_border,
    fetch_cny_hkd_rate,
    fetch_hk_prices,
    fetch_cn_98_price,
    fetch_cn_98_price_showapi,
)

st.set_page_config(page_title="粵港油價對比計算器", page_icon="⛽", layout="wide")


@st.cache_data(ttl=3600)
def get_live_data():
    """聯網抓取香港牌價／折扣卡／油券與匯率（快取 1 小時）。"""
    prices, cards, coupons = fetch_hk_prices()
    rate = fetch_cny_hkd_rate()
    return prices, cards, coupons, rate


prices, cards, coupons, auto_rate = get_live_data()

# ===== 側邊欄參數 =====
st.sidebar.header("⚙️ 參數設定")
calc_date = st.sidebar.date_input("加油日期", datetime.now())
weekday = calc_date.weekday()
day_of_month = calc_date.day

rate_input = st.sidebar.number_input("CNY → HKD 匯率", value=float(f"{auto_rate:.4f}"), step=0.005)
bridge_toll = st.sidebar.number_input("來回橋費 / 額外口岸成本 (HKD)", value=340.0, step=10.0)
fuel_volume = st.sidebar.slider("加油容量 (L)", 30.0, 85.0, 72.67, 0.5)
trip_mode = st.sidebar.radio("行程模式", ["專程北上（含橋費）", "順路北上（零橋費）"], index=0)
toll = bridge_toll if trip_mode.startswith("專程") else 0.0

st.sidebar.subheader("🇨🇳 內地油價（延長殼牌 98#）")
mainland_base_price = st.sidebar.number_input("原價 (¥/L)", value=11.74, step=0.05)
disc_8th = st.sidebar.number_input("8 號立減 (¥/L)", value=2.18, step=0.05)
disc_wed = st.sidebar.number_input("週三/六立減 (¥/L)", value=1.28, step=0.05)
auto_disc = date_discount(day_of_month, weekday, disc_8th, disc_wed)
mainland_discount = st.sidebar.number_input(
    f"每升立減 (¥/L) — {auto_disc['label']}",
    value=float(auto_disc["discount"]),
    step=0.05,
)

st.sidebar.caption("提示：8 號 / 週三六優惠不疊加，系統自動取較大折扣；金額依當月海報調整。")
st.sidebar.subheader("🌐 即時抓取（可選）")
cn_source = st.sidebar.selectbox("內地油價來源", ["ShowAPI 今日油價（APPCODE）", "起零數據全國油價（token）"])
use_showapi = cn_source.startswith("ShowAPI")
cn_key = st.sidebar.text_input(
    "APPCODE" if use_showapi else "起零數據 token",
    type="password",
    help="留空則以手動輸入為準",
)
if st.sidebar.button("↻ 抓取內地 98# 牌價"):
    if cn_key:
        try:
            if use_showapi:
                mainland_base_price = fetch_cn_98_price_showapi(cn_key, prov="广东")
            else:
                mainland_base_price = fetch_cn_98_price(cn_key, province="广东")
            st.sidebar.success(f"已更新：¥{mainland_base_price:.2f}/L")
        except Exception as exc:
            st.sidebar.error(f"抓取失敗：{exc}")
    else:
        st.sidebar.warning("請先填入 " + ("APPCODE" if use_showapi else "起零數據 token") + "。")

st.sidebar.subheader("🇭🇰 香港基準")
hk_base_mode = st.sidebar.radio("香港比較基準", ["自動：加德士券後價", "手動：消委會折後價"], index=0)
hk_caltex = None

if hk_base_mode.startswith("自動"):
    st.sidebar.caption("加德士拆單計算設定")
    fuel_type = st.sidebar.radio("油品", ["standard（黃金平油）", "premium（白金 98）"], index=0)
    petrol = "standard" if "standard" in fuel_type else "premium"
    card_desc = st.sidebar.selectbox("折扣卡", [c["description"] for c in cards], index=0)
    card = next(c for c in cards if c["description"] == card_desc)
    valid_coupons = filter_coupons(coupons, card["type"], petrol)
    if not valid_coupons:
        st.sidebar.warning("該折扣卡目前沒有可用油券，將以無券計算。")
    coupon_desc = st.sidebar.selectbox(
        "油券",
        [c["description"] for c in valid_coupons],
        index=0,
    ) if valid_coupons else None
    coupon = next((c for c in valid_coupons if c["description"] == coupon_desc), None) if coupon_desc else None
    custom_discount = (
        st.sidebar.number_input("自訂每升折扣 (HK$)", value=0.0, step=0.1)
        if card["id"] == "starCard-others"
        else 0.0
    )
    hk_list_default = prices["standard" if petrol == "standard" else "premium"]
    list_price = st.sidebar.number_input("加德士牌價 (HK$/L，自動抓取)", value=float(hk_list_default), step=0.01)
    card_discount = pick_card_discount(cards, card["id"], petrol, custom_discount)
    spend = coupon["spend"] if coupon else 350.0
    coupon_value = coupon["discount"] if coupon else 0.0
    hk_caltex = calc_caltex_effective_price(list_price, card_discount, spend, coupon_value)
    hk_unit_price = hk_caltex.actual_price
else:
    hk_unit_price = st.sidebar.number_input("香港每升實付 (HKD)", value=23.99, step=0.1)

# ===== 核心計算 =====
result = compare_cross_border(mainland_base_price, mainland_discount, rate_input, toll, fuel_volume, hk_unit_price)

# ===== 主界面 =====
st.title("⛽ 粵港油價即時對比")
st.caption(
    f"計算基準：{calc_date}（{auto_disc['label']}）｜匯率 1 CNY = {rate_input:.4f} HKD｜"
    f"橋費 HK${toll:.0f}｜行程：{'專程北上' if trip_mode.startswith('專程') else '順路北上'}"
)

col1, col2, col3, col4 = st.columns(4)
col1.metric("內地折後純油價", f"HK$ {result.cn_net_hkd:.2f} / L", f"¥ {result.cn_net_cny:.2f}")
col2.metric("含橋費單價", f"HK$ {result.with_toll_price:.2f} / L", f"攤分橋費 HK${result.toll_share:.2f}")
col3.metric("香港基準單價", f"HK$ {hk_unit_price:.2f} / L")
col4.metric(
    f"一箱（{fuel_volume:.1f}L）節省",
    f"HK$ {result.save_total:.1f}",
    delta=f"{result.save_total:.1f} HKD",
    delta_color="normal" if result.save_total > 0 else "inverse",
)

if hk_caltex:
    split_count = math.ceil(fuel_volume / hk_caltex.total_liters)
    st.info(
        f"加德士拆單計算：牌價 ${hk_caltex.list_price:.2f}，卡折扣 ${hk_caltex.card_discount:.2f}/L → "
        f"折扣後 ${hk_caltex.discounted_price:.2f}/L；每張券需入 {hk_caltex.total_liters:.2f}L"
        f"（免費 {hk_caltex.free_liters:.2f}L），實付 ${hk_caltex.amount_paid:.2f} → "
        f"**券後 ${hk_caltex.actual_price:.2f}/L**。加滿 {fuel_volume:.1f}L 需拆單 **{split_count} 次**。"
    )

st.divider()
col_left, col_right = st.columns(2)

with col_left:
    st.subheader("📊 總花費明細")
    comparison_data = {
        "方案": ["香港（券後）", "專程北上（含橋費）", "順路北上（零橋費）"],
        "每升成本 (HKD)": [
            f"${hk_unit_price:.2f}",
            f"${result.with_toll_price:.2f}",
            f"${result.cn_net_hkd:.2f}",
        ],
        f"總支出（{fuel_volume:.1f}L）": [
            f"${hk_unit_price * fuel_volume:.2f}",
            f"${result.cn_net_hkd * fuel_volume + toll:.2f}",
            f"${result.cn_net_hkd * fuel_volume:.2f}",
        ],
        "相對香港差額": [
            "基準",
            f"省 ${(hk_unit_price - result.with_toll_price) * fuel_volume:.2f}",
            f"省 ${(hk_unit_price - result.cn_net_hkd) * fuel_volume:.2f}",
        ],
    }
    st.table(comparison_data)

with col_right:
    st.subheader("💡 決策與損益平衡分析")
    if result.breakeven_liters == float("inf"):
        st.error("內地折後價折合港幣後已高於香港基準，專程北上不划算。")
    else:
        st.write(f"• **專程北上回本門檻**：每次需加滿 **{result.breakeven_liters:.1f} L** 方可抵消 HK${toll:.0f} 橋費。")
        if result.worth_direct:
            st.success(f"目前設定容量（{fuel_volume:.1f}L）已超過回本門檻，專程前往依然划算！")
        else:
            st.warning(f"目前設定容量（{fuel_volume:.1f}L）低於回本門檻，專程前往會倒蝕橋費。")
    st.write(f"• **順路北上效益**：若本身有出行需求（橋費不計入），加滿可直接節省 **HK${(hk_unit_price - result.cn_net_hkd) * fuel_volume:.1f}**。")

st.caption(
    "資料來源：香港牌價／折扣卡／油券 — hk-petrol-price-crawler（data.gov.hk）；匯率 — exchangerate.fun／open.er-api.com；"
    "內地油價 — 起零數據。加德士折扣算法移植自 hkg-deadline/caltex-discount-calc（GPL-3.0）。"
)
