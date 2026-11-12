import { lazy, Suspense, useEffect, useState } from "react";
import { Link, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { DashboardPage } from "./pages/DashboardPage";
import { useDashboard } from "./useDashboard";

const ClassicPage = lazy(() => import("./pages/ClassicPage"));

function AppFrame() {
  const model = useDashboard();
  const navigate = useNavigate();
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    const saved = localStorage.getItem("hkzh.theme");
    if (saved === "light" || saved === "dark") return saved;
    return window.matchMedia("(prefers-color-scheme: light)").matches
      ? "light"
      : "dark";
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("hkzh.theme", theme);
  }, [theme]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const redirect = params.get("redirect");
    if (params.get("view") === "classic" || redirect?.startsWith("/classic")) {
      navigate("/classic", { replace: true });
    }
  }, [navigate]);

  return (
    <div className="app-shell">
      <header className="site-header">
        <Link className="brand" to="/" aria-label="粵港油價比價首頁">
          <span className="brand-mark" aria-hidden="true" />
          <span>
            <strong>粵港油價比價</strong>
            <small>六站 · 三城 · 即時決策</small>
          </span>
        </Link>
        <nav aria-label="主要導覽">
          <Link to="/">六站比較</Link>
          <Link to="/classic">經典比較</Link>
        </nav>
        <button
          type="button"
          className="button subtle pressable"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          aria-label={`切換至${theme === "dark" ? "淺色" : "深色"}主題`}
        >
          {theme === "dark" ? "淺色" : "深色"}
        </button>
      </header>

      <main>
        <Routes>
          <Route path="/" element={<DashboardPage model={model} />} />
          <Route
            path="/classic"
            element={
              <Suspense fallback={<div className="page loading">載入經典比較…</div>}>
                <ClassicPage model={model} />
              </Suspense>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default AppFrame;
