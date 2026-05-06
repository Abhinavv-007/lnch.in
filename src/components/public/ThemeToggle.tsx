import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { applyTheme, getTheme, type Theme } from "@/lib/theme";

/**
 * Small icon toggle used in the public header. Reads the current resolved
 * theme on mount, then updates `<html>` and localStorage when the user clicks.
 */
export default function ThemeToggle({ className = "" }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    setTheme(getTheme());
  }, []);

  function toggle() {
    const next: Theme = theme === "light" ? "dark" : "light";
    applyTheme(next);
    setTheme(next);
  }

  const Icon = theme === "light" ? Moon : Sun;
  const label = theme === "light" ? "Switch to dark mode" : "Switch to light mode";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className={
        "inline-flex h-9 w-9 items-center justify-center rounded-full border border-rule bg-paper-elev text-fg-soft transition hover:text-accent " +
        className
      }
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}
