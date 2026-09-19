import { Moon, Sun } from "@phosphor-icons/react";
import { useTheme } from "../hooks/useTheme";

// Light and dark switch as a mono text button. Lives in the hero's top row
// since there is no nav.
export function ThemeToggle() {
  const [theme, toggleTheme] = useTheme();
  const dark = theme === "dark";

  return (
    <button
      className="toggle label"
      type="button"
      onClick={toggleTheme}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {dark ? (
        <Sun size={13} aria-hidden="true" />
      ) : (
        <Moon size={13} aria-hidden="true" />
      )}
      {dark ? "Light" : "Dark"}
    </button>
  );
}
