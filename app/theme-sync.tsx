"use client";

import { useEffect } from "react";

export function ThemeSync() {
  useEffect(() => {
    let savedTheme: string | null = null;
    try { savedTheme = window.localStorage.getItem("artha-theme"); } catch { /* Fall back to the system preference. */ }
    const systemPreference = window.matchMedia("(prefers-color-scheme: dark)");
    const followsSystem = savedTheme !== "dark" && savedTheme !== "light";
    const applyTheme = () => {
      document.documentElement.dataset.theme = followsSystem
        ? (systemPreference.matches ? "dark" : "light")
        : savedTheme as "dark" | "light";
    };
    applyTheme();
    if (!followsSystem) return;
    systemPreference.addEventListener("change", applyTheme);
    return () => systemPreference.removeEventListener("change", applyTheme);
  }, []);

  return null;
}
