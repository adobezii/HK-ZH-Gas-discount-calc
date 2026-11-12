import {
  animate,
  motion,
  useDragControls,
  useMotionValue,
  type AnimationPlaybackControls,
  type PanInfo,
} from "motion/react";
import {
  useEffect,
  useId,
  useRef,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  CITY_LABELS,
  CITY_OPTIONS,
  type CityBinding,
  type DashboardConfig,
  type LivePrices,
  type QuoteResult,
  type StationId,
} from "../types";
import { springFromApple } from "../physics";
import {
  cnpcDirectDiscount,
  hkSinopecDiscount,
  resolveCity,
} from "../calc";

interface Props {
  quote: QuoteResult;
  config: DashboardConfig;
  setConfig: (config: DashboardConfig) => void;
  live: LivePrices;
  onClose: () => void;
}

function priceFor(config: DashboardConfig, live: LivePrices, stationId: StationId) {
  switch (stationId) {
    case "hk-shell":
      return config.hkShell.manualPrice ?? live.shell[config.hkShell.fuel];
    case "hk-caltex":
      return config.hkCaltex.manualPrice ?? live.caltex[config.hkCaltex.fuel];
    case "hk-cnpc":
      return config.hkCnpc.manualPrice ?? live.cnpc;
    case "hk-sinopec":
      return config.hkSinopec.manualPrice ?? live.sinopec[config.hkSinopec.fuel];
    default:
      return 0;
  }
}

function PriceControl({
  id,
  label,
  currency,
  automated,
  value,
  onChange,
  onReset,
}: {
  id: string;
  label: string;
  currency: string;
  automated: boolean;
  value: number;
  onChange: (value: number) => void;
  onReset: () => void;
}) {
  return (
    <div className="field full">
      <label htmlFor={id}>
        {label}（{currency}/L）
      </label>
      <div className="inline-actions">
        <input
          id={id}
          className="input"
          type="number"
          min="0"
          step="0.01"
          value={Number.isFinite(value) && value > 0 ? value : ""}
          onChange={(event) => onChange(Number(event.target.value) || 0)}
        />
        {!automated ? (
          <button className="button subtle pressable" type="button" onClick={onReset}>
            使用自動價
          </button>
        ) : (
          <span className="status-line success" style={{ alignSelf: "center" }}>
            自動／城市價
          </span>
        )}
      </div>
    </div>
  );
}

function CityControl({
  binding,
  overrideCity,
  globalCity,
  onChange,
}: {
  binding: CityBinding;
  overrideCity: DashboardConfig["gdShell"]["overrideCity"];
  globalCity: DashboardConfig["globalCity"];
  onChange: (binding: CityBinding, overrideCity: DashboardConfig["gdShell"]["overrideCity"]) => void;
}) {
  const city = resolveCity(binding, globalCity);
  return (
    <div className="field full">
      <span>大陸城市</span>
      <div className="inline-actions">
        <select
          className="select"
          aria-label="大陸城市"
          value={city}
          onChange={(event) =>
            onChange(
              {
                mode: "override",
                city: event.target.value as DashboardConfig["globalCity"],
              },
              event.target.value as DashboardConfig["globalCity"],
            )
          }
        >
          {CITY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {binding.mode === "follow-global" ? (
          <span className="badge">跟隨全域：{CITY_LABELS[globalCity]}</span>
        ) : (
          <button
            className="button subtle pressable"
            type="button"
            onClick={() => onChange({ mode: "follow-global" }, overrideCity)}
          >
            恢復跟隨全域
          </button>
        )}
      </div>
    </div>
  );
}

export function StationDetailSheet({
  quote,
  config,
  setConfig,
  live,
  onClose,
}: Props) {
  const titleId = useId();
  const y = useMotionValue(
    typeof window === "undefined" ? 600 : window.innerHeight,
  );
  const controls = useDragControls();
  const flight = useRef<AnimationPlaybackControls | null>(null);
  const sheetRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const reducedMotion = () =>
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const stopFlight = () => flight.current?.stop();

  const animateTo = (target: number, done?: () => void) => {
    stopFlight();
    if (reducedMotion()) {
      y.set(target);
      done?.();
      return;
    }
    flight.current = animate(y, target, {
      type: "spring",
      ...springFromApple({ dampingRatio: 1, response: 0.3 }),
    });
    if (done) void flight.current.finished.then(done);
  };

  const requestClose = () => animateTo(window.innerHeight, onClose);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    animateTo(0);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        requestClose();
        return;
      }
      if (event.key !== "Tab" || !sheetRef.current) return;
      const focusable = Array.from(
        sheetRef.current.querySelectorAll<HTMLElement>(
          'button, input, select, summary, [href], [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((node) => !node.hasAttribute("disabled"));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      stopFlight();
      document.body.style.overflow = originalOverflow;
      document.removeEventListener("keydown", onKeyDown);
      previous?.focus();
    };
  }, []);

  const onDragEnd = (_event: PointerEvent, info: PanInfo) => {
    if (info.velocity.y > 700 || y.get() > 120) {
      animateTo(window.innerHeight, onClose);
    } else {
      animateTo(0);
    }
  };

  const onHandlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    stopFlight();
    controls.start(event);
  };

  const update = (next: DashboardConfig) => setConfig(next);
  const basePrice = priceFor(config, live, quote.stationId);

  return (
    <div className="sheet-layer">
      <button
        type="button"
        className="sheet-backdrop"
        aria-label="關閉詳情"
        onClick={requestClose}
      />
      <motion.section
        ref={sheetRef}
        className="station-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        style={{ y }}
        drag="y"
        dragControls={controls}
        dragListener={false}
        dragConstraints={{ top: 0, bottom: window.innerHeight }}
        dragElastic={0.12}
        dragMomentum={false}
        onPointerDown={stopFlight}
        onDragStart={stopFlight}
        onDragEnd={onDragEnd}
      >
        <div
          className="sheet-handle"
          onPointerDown={onHandlePointerDown}
          aria-hidden="true"
        >
          <span />
        </div>
        <div className="sheet-head">
          <div>
            <div className="eyebrow">方案詳情</div>
            <h2 id={titleId}>{quote.name}</h2>
            <p className="lede">
              HK${quote.unitPriceHkd.toFixed(2)}/L · HK$
              {quote.totalHkd.toFixed(2)}
            </p>
          </div>
          <button
            ref={closeRef}
            className="button subtle pressable"
            type="button"
            onClick={requestClose}
            aria-label="關閉"
          >
            關閉
          </button>
        </div>

        <div className="sheet-form">
          {quote.stationId === "hk-shell" ? (
            <>
              <div className="field full">
                <span>油品</span>
                <div className="segmented">
                  {(["premium", "standard"] as const).map((fuel) => (
                    <button
                      key={fuel}
                      type="button"
                      aria-pressed={config.hkShell.fuel === fuel}
                      onClick={() =>
                        update({
                          ...config,
                          hkShell: { ...config.hkShell, fuel },
                        })
                      }
                    >
                      {fuel === "premium" ? "V-Power" : "FuelSave"}
                    </button>
                  ))}
                </div>
              </div>
              <label className="field">
                <span>優惠日別</span>
                <select
                  className="select"
                  value={config.hkShell.offerDay}
                  onChange={(event) =>
                    update({
                      ...config,
                      hkShell: {
                        ...config.hkShell,
                        offerDay: event.target.value as DashboardConfig["hkShell"]["offerDay"],
                      },
                    })
                  }
                >
                  <option value="auto">自動跟隨日期</option>
                  <option value="wed">星期三</option>
                  <option value="weekend">星期六／日</option>
                  <option value="weekday">平日</option>
                </select>
              </label>
              <label className="checkbox-row">
                <span>計入 GO+ 積分價值</span>
                <input
                  type="checkbox"
                  checked={config.hkShell.includePoints}
                  onChange={(event) =>
                    update({
                      ...config,
                      hkShell: {
                        ...config.hkShell,
                        includePoints: event.target.checked,
                      },
                    })
                  }
                />
              </label>
              <label className="field">
                <span>額外滿額券門檻</span>
                <input
                  className="input"
                  type="number"
                  min="0"
                  value={config.hkShell.couponMin}
                  onChange={(event) =>
                    update({
                      ...config,
                      hkShell: {
                        ...config.hkShell,
                        couponMin: Number(event.target.value) || 0,
                      },
                    })
                  }
                />
              </label>
              <label className="field">
                <span>滿額券減額</span>
                <input
                  className="input"
                  type="number"
                  min="0"
                  value={config.hkShell.couponValue}
                  onChange={(event) =>
                    update({
                      ...config,
                      hkShell: {
                        ...config.hkShell,
                        couponValue: Number(event.target.value) || 0,
                      },
                    })
                  }
                />
              </label>
              <label className="field">
                <span>信用卡回贈 %</span>
                <input
                  className="input"
                  type="number"
                  min="0"
                  max="100"
                  value={config.hkShell.rebatePercent}
                  onChange={(event) =>
                    update({
                      ...config,
                      hkShell: {
                        ...config.hkShell,
                        rebatePercent: Number(event.target.value) || 0,
                      },
                    })
                  }
                />
              </label>
              <PriceControl
                id="hk-shell-price"
                label="Shell 牌價"
                currency="HK$"
                automated={config.hkShell.manualPrice === undefined}
                value={basePrice}
                onChange={(manualPrice) =>
                  update({
                    ...config,
                    hkShell: { ...config.hkShell, manualPrice },
                  })
                }
                onReset={() =>
                  update({
                    ...config,
                    hkShell: { ...config.hkShell, manualPrice: undefined },
                  })
                }
              />
            </>
          ) : null}

          {quote.stationId === "hk-caltex" ? (
            <>
              <div className="field full">
                <span>油品</span>
                <div className="segmented">
                  {(["premium", "standard"] as const).map((fuel) => (
                    <button
                      key={fuel}
                      type="button"
                      aria-pressed={config.hkCaltex.fuel === fuel}
                      onClick={() =>
                        update({
                          ...config,
                          hkCaltex: { ...config.hkCaltex, fuel },
                        })
                      }
                    >
                      {fuel === "premium" ? "白金 98" : "黃金"}
                    </button>
                  ))}
                </div>
              </div>
              <label className="field full">
                <span>折扣卡</span>
                <select
                  className="select"
                  value={config.hkCaltex.cardId}
                  onChange={(event) =>
                    update({
                      ...config,
                      hkCaltex: {
                        ...config.hkCaltex,
                        cardId: event.target.value,
                      },
                    })
                  }
                >
                  {live.cards.map((card) => (
                    <option key={card.id} value={card.id}>
                      {card.description}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field full">
                <span>油券</span>
                <select
                  className="select"
                  value={config.hkCaltex.couponId}
                  onChange={(event) =>
                    update({
                      ...config,
                      hkCaltex: {
                        ...config.hkCaltex,
                        couponId: event.target.value,
                      },
                    })
                  }
                >
                  {live.coupons.map((coupon) => (
                    <option key={coupon.id} value={coupon.id}>
                      {coupon.description}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>信用卡回贈 %</span>
                <input
                  className="input"
                  type="number"
                  min="0"
                  max="100"
                  value={config.hkCaltex.rebatePercent}
                  onChange={(event) =>
                    update({
                      ...config,
                      hkCaltex: {
                        ...config.hkCaltex,
                        rebatePercent: Number(event.target.value) || 0,
                      },
                    })
                  }
                />
              </label>
              <PriceControl
                id="hk-caltex-price"
                label="Caltex 牌價"
                currency="HK$"
                automated={config.hkCaltex.manualPrice === undefined}
                value={basePrice}
                onChange={(manualPrice) =>
                  update({
                    ...config,
                    hkCaltex: { ...config.hkCaltex, manualPrice },
                  })
                }
                onReset={() =>
                  update({
                    ...config,
                    hkCaltex: { ...config.hkCaltex, manualPrice: undefined },
                  })
                }
              />
            </>
          ) : null}

          {quote.stationId === "hk-cnpc" ? (
            <>
              <label className="field full">
                <span>中石油純直減（週末請手動輸入）</span>
                <div className="inline-actions">
                  <input
                    className="input"
                    type="number"
                    min="0"
                    step="0.05"
                    value={
                      config.hkCnpc.discountOverride ??
                      cnpcDirectDiscount(config.date)
                    }
                    onChange={(event) =>
                      update({
                        ...config,
                        hkCnpc: {
                          ...config.hkCnpc,
                          discountOverride: Number(event.target.value) || 0,
                        },
                      })
                    }
                  />
                  {config.hkCnpc.discountOverride !== undefined ? (
                    <button
                      className="button subtle pressable"
                      type="button"
                      onClick={() =>
                        update({
                          ...config,
                          hkCnpc: {
                            ...config.hkCnpc,
                            discountOverride: undefined,
                          },
                        })
                      }
                    >
                      使用日期自動值
                    </button>
                  ) : null}
                </div>
              </label>
              <label className="checkbox-row full">
                <span>符合折實滿 HK$300</span>
                <input
                  type="checkbox"
                  checked={config.hkCnpc.eligible}
                  onChange={(event) =>
                    update({
                      ...config,
                      hkCnpc: {
                        ...config.hkCnpc,
                        eligible: event.target.checked,
                      },
                    })
                  }
                />
              </label>
              <PriceControl
                id="hk-cnpc-price"
                label="中石油超級汽油牌價"
                currency="HK$"
                automated={config.hkCnpc.manualPrice === undefined}
                value={basePrice}
                onChange={(manualPrice) =>
                  update({
                    ...config,
                    hkCnpc: { ...config.hkCnpc, manualPrice },
                  })
                }
                onReset={() =>
                  update({
                    ...config,
                    hkCnpc: { ...config.hkCnpc, manualPrice: undefined },
                  })
                }
              />
              <div className="warning full">
                積分及免費升級不計入。觀塘站星期三不適用 $13.90 直減。
              </div>
            </>
          ) : null}

          {quote.stationId === "hk-sinopec" ? (
            <>
              <div className="field full">
                <span>油品</span>
                <div className="segmented">
                  {(["premium", "standard"] as const).map((fuel) => (
                    <button
                      key={fuel}
                      type="button"
                      aria-pressed={config.hkSinopec.fuel === fuel}
                      onClick={() =>
                        update({
                          ...config,
                          hkSinopec: { ...config.hkSinopec, fuel },
                        })
                      }
                    >
                      {fuel === "premium" ? "超級汽油" : "中石化汽油"}
                    </button>
                  ))}
                </div>
              </div>
              <label className="checkbox-row">
                <span>符合 X CARD／APP 會員</span>
                <input
                  type="checkbox"
                  checked={config.hkSinopec.member}
                  onChange={(event) =>
                    update({
                      ...config,
                      hkSinopec: {
                        ...config.hkSinopec,
                        member: event.target.checked,
                      },
                    })
                  }
                />
              </label>
              <label className="checkbox-row">
                <span>計入積分最高兌換價值</span>
                <input
                  type="checkbox"
                  checked={config.hkSinopec.includePoints}
                  onChange={(event) =>
                    update({
                      ...config,
                      hkSinopec: {
                        ...config.hkSinopec,
                        includePoints: event.target.checked,
                        discountOverride: undefined,
                      },
                    })
                  }
                />
              </label>
              <label className="field full">
                <span>每升優惠（可手動覆寫）</span>
                <div className="inline-actions">
                  <input
                    className="input"
                    type="number"
                    min="0"
                    step="0.01"
                    value={
                      config.hkSinopec.discountOverride ??
                      hkSinopecDiscount(
                        config.date,
                        config.hkSinopec.fuel,
                        config.hkSinopec.includePoints,
                      )
                    }
                    onChange={(event) =>
                      update({
                        ...config,
                        hkSinopec: {
                          ...config.hkSinopec,
                          discountOverride: Number(event.target.value) || 0,
                        },
                      })
                    }
                  />
                  {config.hkSinopec.discountOverride !== undefined ? (
                    <button
                      className="button subtle pressable"
                      type="button"
                      onClick={() =>
                        update({
                          ...config,
                          hkSinopec: {
                            ...config.hkSinopec,
                            discountOverride: undefined,
                          },
                        })
                      }
                    >
                      使用日期自動值
                    </button>
                  ) : null}
                </div>
              </label>
              <PriceControl
                id="hk-sinopec-price"
                label="中石化牌價"
                currency="HK$"
                automated={config.hkSinopec.manualPrice === undefined}
                value={basePrice}
                onChange={(manualPrice) =>
                  update({
                    ...config,
                    hkSinopec: { ...config.hkSinopec, manualPrice },
                  })
                }
                onReset={() =>
                  update({
                    ...config,
                    hkSinopec: { ...config.hkSinopec, manualPrice: undefined },
                  })
                }
              />
              <div className="warning full">
                山頂道、麥當勞道及堅尼地道不適用。星期一滿 25L
                電子券未自動疊加。
              </div>
            </>
          ) : null}

          {quote.stationId === "gd-shell" ? (
            <>
              <CityControl
                binding={config.gdShell.binding}
                overrideCity={config.gdShell.overrideCity}
                globalCity={config.globalCity}
                onChange={(binding, overrideCity) =>
                  update({
                    ...config,
                    gdShell: { ...config.gdShell, binding, overrideCity },
                  })
                }
              />
              <label className="checkbox-row full">
                <span>計入過境路費</span>
                <input
                  type="checkbox"
                  checked={config.gdShell.includeToll}
                  onChange={(event) =>
                    update({
                      ...config,
                      gdShell: {
                        ...config.gdShell,
                        includeToll: event.target.checked,
                      },
                    })
                  }
                />
              </label>
              <PriceControl
                id="gd-shell-price"
                label="廣東 Shell 98# 牌價"
                currency="¥"
                automated={config.gdShell.manualPrice === undefined}
                value={
                  config.gdShell.manualPrice ??
                  Number(
                    config.gdShell.manualPrice ??
                      quote.breakdown.find((item) => item.label === "人民幣牌價")?.value.replace(/[^\d.]/g, ""),
                  )
                }
                onChange={(manualPrice) =>
                  update({
                    ...config,
                    gdShell: { ...config.gdShell, manualPrice },
                  })
                }
                onReset={() =>
                  update({
                    ...config,
                    gdShell: { ...config.gdShell, manualPrice: undefined },
                  })
                }
              />
              <div className="warning full">
                汽油价格网快照提供城市價；省級 API 只提供廣東全省價格。
              </div>
            </>
          ) : null}

          {quote.stationId === "gd-sinopec" ? (
            <>
              <CityControl
                binding={config.gdSinopec.binding}
                overrideCity={config.gdSinopec.overrideCity}
                globalCity={config.globalCity}
                onChange={(binding, overrideCity) =>
                  update({
                    ...config,
                    gdSinopec: { ...config.gdSinopec, binding, overrideCity },
                  })
                }
              />
              <label className="field">
                <span>每升立減（¥/L）</span>
                <input
                  className="input"
                  type="number"
                  min="0"
                  step="0.1"
                  value={config.gdSinopec.discountPerLiter}
                  onChange={(event) =>
                    update({
                      ...config,
                      gdSinopec: {
                        ...config.gdSinopec,
                        discountPerLiter: Number(event.target.value) || 0,
                      },
                    })
                  }
                />
              </label>
              <label className="field">
                <span>加油卡方案</span>
                <select
                  className="select"
                  value={config.gdSinopec.cardFee === 388 ? "1" : "2"}
                  onChange={(event) =>
                    update({
                      ...config,
                      gdSinopec: {
                        ...config.gdSinopec,
                        cardFee: event.target.value === "1" ? 388 : 588,
                      },
                    })
                  }
                >
                  <option value="1">1 年卡 · ¥388</option>
                  <option value="2">2 年卡 · ¥588</option>
                </select>
              </label>
              <label className="field full">
                <span>卡費</span>
                <input
                  className="input"
                  type="number"
                  min="0"
                  value={config.gdSinopec.cardFee}
                  onChange={(event) =>
                    update({
                      ...config,
                      gdSinopec: {
                        ...config.gdSinopec,
                        cardFee: Number(event.target.value) || 0,
                      },
                    })
                  }
                />
              </label>
              <label className="checkbox-row full">
                <span>計入過境路費</span>
                <input
                  type="checkbox"
                  checked={config.gdSinopec.includeToll}
                  onChange={(event) =>
                    update({
                      ...config,
                      gdSinopec: {
                        ...config.gdSinopec,
                        includeToll: event.target.checked,
                      },
                    })
                  }
                />
              </label>
              <PriceControl
                id="gd-sinopec-price"
                label="廣東中石化 98# 牌價"
                currency="¥"
                automated={config.gdSinopec.manualPrice === undefined}
                value={
                  config.gdSinopec.manualPrice ??
                  Number(
                    quote.breakdown.find((item) => item.label === "人民幣牌價")?.value.replace(/[^\d.]/g, ""),
                  )
                }
                onChange={(manualPrice) =>
                  update({
                    ...config,
                    gdSinopec: { ...config.gdSinopec, manualPrice },
                  })
                }
                onReset={() =>
                  update({
                    ...config,
                    gdSinopec: { ...config.gdSinopec, manualPrice: undefined },
                  })
                }
              />
              <div className="warning full">
                卡費不計入本次加油總額；回本升數只按卡費 ÷
                每升立減計算，不攤分路費。
              </div>
            </>
          ) : null}
        </div>
      </motion.section>
    </div>
  );
}
