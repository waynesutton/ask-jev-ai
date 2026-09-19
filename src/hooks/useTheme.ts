import { useCallback, useEffect, useState } from "react";

export type Theme = "light" | "dark";

const KEY = "ask-jev-theme";

// Light is the default. The stored choice wins. index.html applies the same
// attribute before paint so there is no flash; this hook keeps React in sync.
function readTheme(): Theme {
  try {
    return window.localStorage.getItem(KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

export function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(readTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    const meta = document.querySelector<HTMLMetaElement>(
      'meta[name="theme-color"]',
    );
    if (meta) meta.content = theme === "dark" ? "#0a0b0c" : "#e2e2df";
    try {
      window.localStorage.setItem(KEY, theme);
    } catch {
      // Private mode or blocked storage. The theme still applies for this visit.
    }
  }, [theme]);

  const toggle = useCallback(() => {
    setTheme((t) => (t === "dark" ? "light" : "dark"));
  }, []);

  return [theme, toggle];
}
