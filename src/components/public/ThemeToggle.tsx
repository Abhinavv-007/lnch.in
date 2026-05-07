import { useEffect, useRef, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { applyThemeWithReveal, getTheme, type Theme } from "@/lib/theme";

/**
 * Small icon toggle used in the public header. Reads the current resolved
 * theme on mount, then triggers a circular reveal of the new theme expanding
 * from the click origin (or the button center on keyboard activation).
 */
export default function ThemeToggle({ className = "" }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>("dark");
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    setTheme(getTheme());
  }, []);

  function toggle(e: React.MouseEvent<HTMLButtonElement>) {
    const next: Theme = theme === "light" ? "dark" : "light";
    // Detail===0 means the click was synthesized from a keyboard activation.
    // Fall back to the button center so the reveal still feels intentional.
    if (e.detail === 0 && buttonRef.current) {
      const r = buttonRef.current.getBoundingClientRect();
      applyThemeWithReveal(next, {
        clientX: r.left + r.width / 2,
        clientY: r.top + r.height / 2,
      });
    } else {
      applyThemeWithReveal(next, e.nativeEvent);
    }
    setTheme(next);
  }

  const Icon = theme === "light" ? Moon : Sun;
  const label = theme === "light" ? "Switch to dark mode" : "Switch to light mode";

  return (
    <button
      ref={buttonRef}
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
