import { useState } from "react";
import { citySnapshot } from "../data";
import {
  fetchMainlandPrice,
  type MainlandCredentials,
  type MainlandSource,
} from "../mainland";
import { CITY_LABELS } from "../types";
import type { DashboardModel } from "../useDashboard";

interface Props {
  model: DashboardModel;
}

type Status = { tone: "muted" | "success" | "error"; text: string };

const SOURCES: Array<{ value: MainlandSource; label: string }> = [
  { value: "snapshot", label: "汽油价格网城市快照（預設）" },
  { value: "apihz", label: "接口盒子（廣東全省）" },
  { value: "showapi", label: "ShowAPI（廣東全省）" },
  { value: "istero", label: "起零數據（廣東全省）" },
  { value: "mxnzp", label: "RollToolsApi（廣東全省）" },
];

export function SourcePanel({ model }: Props) {
  const { config, setConfig, live, status: liveStatus, refreshLive } = model;
  const [source, setSource] = useState<MainlandSource>("snapshot");
  const [credentials, setCredentials] = useState<MainlandCredentials>({});
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<Status>({
    tone: "muted",
    text: `城市快照更新：${citySnapshot.updated_hkt}`,
  });
  const needsId = source === "apihz" || source === "mxnzp";

  async function refreshMainland() {
    setLoading(true);
    try {
      const result = await fetchMainlandPrice(
        source,
        config.globalCity,
        credentials,
      );
      if (result.cityScoped) {
        setConfig({
          ...config,
          gdShell: { ...config.gdShell, manualPrice: undefined },
          gdSinopec: { ...config.gdSinopec, manualPrice: undefined },
        });
      } else {
        setConfig({
          ...config,
          gdShell: {
            ...config.gdShell,
            manualPrice: {
              value: result.price,
              scope: "province",
              label: "廣東全省 API",
            },
          },
          gdSinopec: {
            ...config.gdSinopec,
            manualPrice: {
              value: result.price,
              scope: "province",
              label: "廣東全省 API",
            },
          },
        });
      }
      setStatus({
        tone: "success",
        text: `${result.label} 98# ¥${result.price.toFixed(2)}/L${
          result.cityScoped ? "" : "，已套用至兩個廣東方案"
        }`,
      });
    } catch (error) {
      setStatus({
        tone: "error",
        text: error instanceof Error ? error.message : "抓取失敗",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <details className="panel source-panel">
      <summary>資料來源與更新狀態</summary>
      <div className="source-grid">
        <label className="field">
          <span>大陸油價來源</span>
          <select
            className="select"
            value={source}
            onChange={(event) => {
              setSource(event.target.value as MainlandSource);
              setCredentials({});
            }}
          >
            {SOURCES.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        {source === "snapshot" ? (
          <div className="field">
            <span>城市級價格</span>
            <div className="status-line success">
              全域 {CITY_LABELS[config.globalCity]}；兩個廣東方案可獨立覆寫
            </div>
          </div>
        ) : (
          <>
            {needsId ? (
              <label className="field">
                <span>{source === "mxnzp" ? "app_id" : "開發者 ID"}</span>
                <input
                  className="input"
                  autoComplete="off"
                  value={credentials.id ?? ""}
                  onChange={(event) =>
                    setCredentials({ ...credentials, id: event.target.value })
                  }
                />
              </label>
            ) : null}
            <label className="field">
              <span>{source === "showapi" ? "APPCODE" : "KEY／TOKEN"}</span>
              <input
                className="input"
                type="password"
                autoComplete="off"
                value={credentials.key ?? ""}
                onChange={(event) =>
                  setCredentials({ ...credentials, key: event.target.value })
                }
              />
            </label>
          </>
        )}
        <div className="field">
          <span>香港即時資料</span>
          <div className={`status-line ${live.loaded ? "success" : "muted"}`}>
            {liveStatus === "loading"
              ? "更新中…"
              : live.loaded
                ? `已更新 ${live.updatedAt ? new Date(live.updatedAt).toLocaleTimeString("zh-HK") : ""}`
                : "使用內建備用價"}
          </div>
        </div>
        <div className="field">
          <span>操作</span>
          <div className="inline-actions">
            <button
              className="button primary pressable"
              type="button"
              disabled={loading}
              onClick={() => void refreshMainland()}
            >
              {loading ? "抓取中…" : "更新大陸油價"}
            </button>
            <button
              className="button subtle pressable"
              type="button"
              onClick={() => void refreshLive()}
            >
              更新香港油價
            </button>
          </div>
        </div>
        <div className={`status-line ${status.tone} field full`}>
          {status.text}
        </div>
        <p className="status-line" style={{ gridColumn: "1 / -1" }}>
          憑證只保留在今次頁面記憶體，不寫入 localStorage。省級 API
          不會冒充城市價格；需要城市級價格時請用每日快照或手動輸入。
        </p>
      </div>
    </details>
  );
}
