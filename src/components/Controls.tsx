import { CITY_OPTIONS } from "../types";
import type { DashboardModel } from "../useDashboard";

interface Props {
  model: DashboardModel;
}

export function Controls({ model }: Props) {
  const { config, setConfig, status, refreshLive, resetAll } = model;

  return (
    <section className="panel controls" aria-label="全域計算條件">
      <label className="field">
        <span>入油升數（L）</span>
        <input
          className="input"
          type="number"
          min="1"
          max="100"
          step="0.5"
          value={config.liters}
          onChange={(event) =>
            setConfig({
              ...config,
              liters: Math.max(1, Number(event.target.value) || 1),
            })
          }
        />
      </label>
      <label className="field">
        <span>CNY → HKD</span>
        <input
          className="input"
          type="number"
          min="0.01"
          step="0.005"
          value={config.fx}
          onChange={(event) =>
            setConfig({
              ...config,
              fx: Math.max(0.01, Number(event.target.value) || 1),
            })
          }
        />
      </label>
      <label className="field">
        <span>全域大陸城市</span>
        <select
          className="select"
          value={config.globalCity}
          onChange={(event) =>
            setConfig({
              ...config,
              globalCity: event.target.value as typeof config.globalCity,
            })
          }
        >
          {CITY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <div className="field">
        <div className="field-heading">
          <label htmlFor="fuel-date">加油日期</label>
          <label className="auto-date-toggle">
            <input
              type="checkbox"
              checked={config.dateMode === "auto"}
              onChange={(event) =>
                event.target.checked
                  ? model.useAutomaticDate()
                  : model.setManualDate(config.date)
              }
            />
            自動今日
          </label>
        </div>
        <input
          id="fuel-date"
          className="input"
          type="date"
          value={config.date}
          onChange={(event) => model.setManualDate(event.target.value)}
        />
      </div>
      <div className="inline-actions">
        <button
          className="button subtle pressable"
          type="button"
          onClick={() => void refreshLive()}
          disabled={status === "loading"}
        >
          {status === "loading" ? "更新中…" : "更新香港價"}
        </button>
        <button className="button subtle pressable" type="button" onClick={resetAll}>
          重設
        </button>
      </div>
    </section>
  );
}
