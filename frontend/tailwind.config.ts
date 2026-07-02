import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class", '[data-theme="dark"]'],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-dm-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-space-grotesk)", "system-ui", "sans-serif"],
        editorial: ["var(--font-dm-serif)", "Georgia", "serif"],
        ui: ["var(--font-outfit)", "system-ui", "sans-serif"],
      },
      borderRadius: {
        xs: "calc(var(--pd-radius-md) - 6px)",
        sm: "calc(var(--pd-radius-md) - 4px)",
        md: "var(--pd-radius-md)",
        lg: "var(--pd-radius-lg)",
        xl: "var(--pd-radius-xl)",
      },
      boxShadow: {
        panel: "var(--pd-shadow-panel)",
        float: "var(--pd-shadow-float)",
        glow: "var(--pd-shadow-glow)",
      },
      transitionTimingFunction: {
        smooth: "var(--pd-ease-smooth)",
        spring: "var(--pd-ease-spring)",
      },
      transitionDuration: {
        fast: "var(--pd-duration-fast)",
        normal: "var(--pd-duration-normal)",
        slow: "var(--pd-duration-slow)",
      },
      keyframes: {
        "aurora-shift": {
          "0%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
          "100%": { backgroundPosition: "0% 50%" },
        },
        "float-gentle": {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-6px)" },
        },
      },
      animation: {
        "aurora-shift": "aurora-shift 12s ease infinite",
        "float-gentle": "float-gentle 3.4s ease-in-out infinite",
      },
    },
  },
};

export default config;

