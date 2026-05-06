/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx,js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        // Body now defaults to JetBrains Mono — the "developer terminal" voice
        // requested for the public lnch.in surface. Inter is kept available as
        // `font-ui` for places the typewriter feel reads as too noisy.
        sans: ['"JetBrains Mono"', "ui-monospace", "Menlo", "monospace"],
        ui: ['"Inter"', "ui-sans-serif", "system-ui", "sans-serif"],
        serif: ['"Cormorant Garamond"', '"DM Serif Display"', "Georgia", "serif"],
        mono: ['"JetBrains Mono"', "ui-monospace", "Menlo", "monospace"],
        typewriter: ['"JetBrains Mono"', "ui-monospace", "Menlo", "monospace"],
      },
      colors: {
        // Anchor: deep near-black with a hint of warmth.
        ink: {
          950: "#050505",
          900: "#0A0A0A",
          800: "#111111",
          700: "#161616",
          600: "#1F1F1F",
          500: "#262626",
          400: "#404040",
          300: "#737373",
          200: "#A3A3A3",
          100: "#E5E5E5",
        },
        // Premium gold/cream accent — pulled from Clex/lnch.in screenshots.
        gilt: {
          50: "#FBF7EA",
          100: "#F2EAC9",
          200: "#E6D9A4",
          300: "#D9C57F",
          400: "#C9AF63",
          500: "#B8964B",
          600: "#9C7C39",
          700: "#7B602B",
          800: "#5A4620",
          900: "#3B2D14",
        },
        signal: {
          ok: "#22C55E",
          warn: "#F59E0B",
          err: "#EF4444",
          info: "#3B82F6",
        },
      },
      boxShadow: {
        "gilt-sm": "0 0 0 1px rgba(217,197,127,0.18), 0 0 24px -8px rgba(217,197,127,0.25)",
        "gilt-md":
          "0 0 0 1px rgba(217,197,127,0.22), 0 12px 40px -16px rgba(217,197,127,0.30)",
        "panel": "0 1px 0 0 rgba(255,255,255,0.04) inset, 0 24px 64px -32px rgba(0,0,0,0.9)",
      },
      backgroundImage: {
        "dot-grid":
          "radial-gradient(rgba(217,197,127,0.10) 1px, transparent 1px)",
        "soft-radial":
          "radial-gradient(1200px 600px at 50% -10%, rgba(217,197,127,0.08), transparent 60%)",
      },
      backgroundSize: {
        "dot-grid": "22px 22px",
      },
      keyframes: {
        scroll: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        pulseGlow: {
          "0%,100%": {
            boxShadow:
              "0 0 0 0 rgba(217,197,127,0.30), 0 0 24px -8px rgba(217,197,127,0.30)",
          },
          "50%": {
            boxShadow:
              "0 0 0 4px rgba(217,197,127,0.10), 0 0 32px -8px rgba(217,197,127,0.50)",
          },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      animation: {
        scroll: "scroll 40s linear infinite",
        fadeUp: "fadeUp 0.55s ease-out both",
        pulseGlow: "pulseGlow 2.4s ease-in-out infinite",
        shimmer: "shimmer 1.6s linear infinite",
      },
    },
  },
  plugins: [],
};
