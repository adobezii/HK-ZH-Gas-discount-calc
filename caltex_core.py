# -*- coding: utf-8 -*-
"""
加德士折扣與跨境比價核心算法（Python 版）

- calc_caltex_effective_price：忠實移植自 hkg-deadline/caltex-discount-calc
  （js/main.js）的「拆單券後實付」邏輯（私人能源卡折扣 + 油券門檻）。
- date_discount：內地延長殼牌 週三/六 與 8 號優惠偵測（不疊加，取較大折扣）。
- compare_cross_border：跨境比價（匯率換算、橋費攤分、回本門檻）。

僅使用 Python 標準庫；網路抓取放在獨立函式並提供離線備用值。
"""

from dataclasses import dataclass


# ===== 內置備用數據（API 失敗 / 離線時使用）=====
FALLBACK_DISCOUNT_CARDS = [
    {"id": "caltex-personal-StarCard", "type": "starCard", "description": "私人能源卡：黃金減$11 / 白金減$12", "standardDiscount": 11.0, "premiumDiscount": 12.0},
    {"id": "caltex-personal-StarCard2", "type": "starCard", "description": "私人能源卡：黃金減$11.5 / 白金減$12", "standardDiscount": 11.5, "premiumDiscount": 12.0},
    {"id": "hsbc-credit-card", "type": "hsbc", "description": "滙豐信用卡：黃金/白金減$0.9", "standardDiscount": 0.9, "premiumDiscount": 0.9},
    {"id": "starCard-others", "type": "starCard", "description": "其他私人能源卡（自訂折扣）", "standardDiscount": 0.0, "premiumDiscount": 0.0},
]

FALLBACK_COUPONS = [
    {"id": "starCard-350-50", "description": "私人能源卡 - 入滿$350減$50", "spend": 350.0, "discount": 50.0, "validCardType": "starCard", "validFor": ["standard", "premium"]},
    {"id": "hsbc-permium-800-300", "description": "滙豐信用卡 - 白金入滿$800減$300", "spend": 800.0, "discount": 300.0, "validCardType": "hsbc", "validFor": ["premium"]},
    {"id": "hsbc-standard-800-280", "description": "滙豐信用卡 - 黃金入滿$800減$280", "spend": 800.0, "discount": 280.0, "validCardType": "hsbc", "validFor": ["standard"]},
]

FALLBACK_PRICES = {"standard": 33.17, "premium": 34.97}
FALLBACK_CNY_HKD = 1.1660  # 2026-09 參考值，聯網失敗時使用


@dataclass
class CaltexResult:
    list_price: float
    card_discount: float
    discounted_price: float
    spend: float
    coupon_value: float
    total_liters: float      # 每張券需入升數（按牌價計）
    paid_liters: float
    free_liters: float
    amount_paid: float
    actual_price: float      # 券後每升實付
    actual_discount: float   # 每升節省


def calc_caltex_effective_price(list_price, card_discount, spend=350.0, coupon_value=50.0):
    """忠實移植 caltex-discount-calc 的拆單券後實付計算。

    對應原版 JS：
        totalLiters  = spend / listPrice
        paidLiters   = (spend - couponValue) / listPrice
        freeLiters   = totalLiters - paidLiters
        amountPaid   = paidLiters * (listPrice - cardDiscount)
        actualPrice  = amountPaid / totalLiters
    """
    if list_price <= 0:
        raise ValueError("牌價必須大於 0")
    if card_discount < 0 or card_discount >= list_price:
        raise ValueError("折扣金額必須介於 0 與牌價之間")
    if spend <= 0:
        raise ValueError("油券門檻金額必須大於 0")
    if coupon_value < 0 or coupon_value >= spend:
        raise ValueError("油券扣減金額必須介於 0 與門檻之間")

    discounted_price = list_price - card_discount
    total_liters = spend / list_price
    paid_liters = (spend - coupon_value) / list_price
    free_liters = total_liters - paid_liters
    amount_paid = paid_liters * discounted_price
    actual_price = amount_paid / total_liters
    return CaltexResult(
        list_price=list_price,
        card_discount=card_discount,
        discounted_price=discounted_price,
        spend=spend,
        coupon_value=coupon_value,
        total_liters=total_liters,
        paid_liters=paid_liters,
        free_liters=free_liters,
        amount_paid=amount_paid,
        actual_price=actual_price,
        actual_discount=list_price - actual_price,
    )


def pick_card_discount(cards, card_id, petrol_type, custom_discount=0.0):
    """由折扣卡清單取出對應油品的每升折扣；starCard-others 使用自訂值。"""
    if card_id == "starCard-others":
        return custom_discount
    for card in cards:
        if card["id"] == card_id:
            key = "standardDiscount" if petrol_type == "standard" else "premiumDiscount"
            return card[key]
    key = "standardDiscount" if petrol_type == "standard" else "premiumDiscount"
    return cards[0][key]


def filter_coupons(coupons, card_type, petrol_type):
    """依折扣卡類型與油品過濾可用油券（對應 updateCouponList）。"""
    return [
        coupon for coupon in coupons
        if (not coupon.get("validCardType") or card_type in coupon["validCardType"])
        and (not coupon.get("validFor") or petrol_type in coupon["validFor"])
    ]


def date_discount(day_of_month, weekday, disc_8th=2.18, disc_wed_sat=1.28):
    """內地延長殼牌優惠偵測：週三/六 與 8 號不疊加，取較大折扣。

    day_of_month: 幾號（1-31）
    weekday: Python datetime.weekday()，0=週一 ... 2=週三 ... 5=週六
    """
    hit_8th = day_of_month == 8
    hit_wed_sat = weekday in (2, 5)
    if hit_8th and hit_wed_sat:
        discount = max(disc_8th, disc_wed_sat)
        label = "8號+週三/六同時（取最平）"
    elif hit_8th:
        discount = disc_8th
        label = "8 號特惠"
    elif hit_wed_sat:
        discount = disc_wed_sat
        label = "週三/六特惠"
    else:
        discount = 0.0
        label = "無優惠"
    return {"discount": discount, "label": label}


@dataclass
class CrossBorderResult:
    cn_base_cny: float
    cn_discount: float
    cn_net_cny: float
    fx: float
    cn_net_hkd: float
    toll: float
    tank_liters: float
    hk_unit_price: float
    toll_share: float
    with_toll_price: float
    save_per_liter: float
    save_total: float
    breakeven_liters: float
    worth_direct: bool


def compare_cross_border(cn_base_cny, cn_discount, fx, toll, tank_liters, hk_unit_price):
    """跨境比價：折後純油價 → 含橋費單價 → 節省 → 回本門檻。"""
    cn_net_cny = max(cn_base_cny - cn_discount, 0.0)
    cn_net_hkd = cn_net_cny * fx
    toll_share = toll / tank_liters if tank_liters > 0 else 0.0
    with_toll_price = cn_net_hkd + toll_share
    save_per_liter = hk_unit_price - with_toll_price
    save_total = save_per_liter * tank_liters
    unit_saving = hk_unit_price - cn_net_hkd
    breakeven = (toll / unit_saving) if unit_saving > 0 else float("inf")
    return CrossBorderResult(
        cn_base_cny=cn_base_cny,
        cn_discount=cn_discount,
        cn_net_cny=cn_net_cny,
        fx=fx,
        cn_net_hkd=cn_net_hkd,
        toll=toll,
        tank_liters=tank_liters,
        hk_unit_price=hk_unit_price,
        toll_share=toll_share,
        with_toll_price=with_toll_price,
        save_per_liter=save_per_liter,
        save_total=save_total,
        breakeven_liters=breakeven,
        worth_direct=tank_liters >= breakeven,
    )


# ===== 網路抓取（失敗時回退備用值）=====
def fetch_cny_hkd_rate(timeout=5.0):
    """嘗試從免費匯率 API 取得 CNY→HKD；失敗回傳備用值。"""
    import json
    import urllib.request

    for url in (
        "https://api.exchangerate.fun/latest?base=CNY",
        "https://open.er-api.com/v6/latest/CNY",
    ):
        try:
            with urllib.request.urlopen(url, timeout=timeout) as resp:
                data = json.loads(resp.read().decode("utf-8"))
            if data.get("rates") and data["rates"].get("HKD"):
                return float(data["rates"]["HKD"])
        except Exception:
            continue
    return FALLBACK_CNY_HKD


def fetch_hk_prices(timeout=6.0):
    """抓取 hk-petrol-price-crawler 的牌價／折扣卡／油券；失敗回退備用值。

    回傳 (prices, cards, coupons)。
    """
    import json
    import urllib.request

    base = "https://hkg-deadline.github.io/hk-petrol-price-crawler/json/"
    prices = dict(FALLBACK_PRICES)
    cards = list(FALLBACK_DISCOUNT_CARDS)
    coupons = list(FALLBACK_COUPONS)
    try:
        with urllib.request.urlopen(base + "petrolprice.json", timeout=timeout) as resp:
            pp = json.loads(resp.read().decode("utf-8"))
        for item in pp:
            if item.get("type") == "Standard Petrol" and item.get("price", {}).get("Caltex"):
                prices["standard"] = float(item["price"]["Caltex"])
            elif item.get("type") == "Premium Petrol" and item.get("price", {}).get("Caltex"):
                prices["premium"] = float(item["price"]["Caltex"])
    except Exception:
        pass
    try:
        with urllib.request.urlopen(base + "caltex-discountcards.json", timeout=timeout) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        if data.get("discountCards"):
            cards = data["discountCards"]
    except Exception:
        pass
    try:
        with urllib.request.urlopen(base + "caltex-coupons.json", timeout=timeout) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        if data.get("coupons"):
            coupons = data["coupons"]
    except Exception:
        pass
    return prices, cards, coupons


def fetch_cn_98_price(token, province="广东", timeout=6.0):
    """起零數據全國油價 V2：回傳廣東 98# 價格（¥/L），失敗拋例外。"""
    import json
    import urllib.request
    from urllib.parse import urlencode

    url = "https://api.istero.com/resource/v2/oilprice?" + urlencode({"token": token, "keyword": province})
    with urllib.request.urlopen(url, timeout=timeout) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    price = data.get("data", {}).get("p98", {}).get("price")
    if price is None:
        raise ValueError(f"起零數據返回異常：code={data.get('code')}")
    return float(price)
