import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "bmcv_theme";
const options = ["light", "dark", "system"];

const systemPrefersDark = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches;

const resolvedTheme = (mode) => (mode === "system" ? (systemPrefersDark() ? "dark" : "light") : mode);

const setThemeColorMeta = (theme) => {
  let meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement("meta");
    meta.setAttribute("name", "theme-color");
    document.head.appendChild(meta);
  }
  meta.setAttribute("content", theme === "dark" ? "#0B1120" : "#FFFFFF");
};

export function useTheme() {
  const [mode, setModeState] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return options.includes(saved) ? saved : "system";
  });
  const [resolved, setResolved] = useState(() => resolvedTheme(mode));

  const applyTheme = useCallback((nextMode) => {
    const nextResolved = resolvedTheme(nextMode);
    document.documentElement.classList.toggle("dark", nextResolved === "dark");
    setThemeColorMeta(nextResolved);
    setResolved(nextResolved);
  }, []);

  useEffect(() => {
    document.documentElement.classList.add("no-transitions");
    applyTheme(mode);
    const timer = window.setTimeout(() => document.documentElement.classList.remove("no-transitions"), 100);
    return () => {
      window.clearTimeout(timer);
      document.documentElement.classList.remove("dark", "no-transitions");
      setThemeColorMeta("light");
    };
  }, [applyTheme, mode]);

  useEffect(() => {
    if (mode !== "system" || !window.matchMedia) return undefined;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const listener = () => applyTheme("system");
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, [applyTheme, mode]);

  const setMode = (nextMode) => {
    const safeMode = options.includes(nextMode) ? nextMode : "system";
    localStorage.setItem(STORAGE_KEY, safeMode);
    setModeState(safeMode);
  };

  const cycleMode = () => {
    const index = options.indexOf(mode);
    setMode(options[(index + 1) % options.length]);
  };

  return { mode, resolved, setMode, cycleMode };
}
