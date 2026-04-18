import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f5f3ff", 100: "#ede9fe", 200: "#ddd6fe", 300: "#c4b5fd",
          400: "#a78bfa", 500: "#8b5cf6", 600: "#7c3aed", 700: "#6d28d9",
          800: "#5b21b6", 900: "#4c1d95",
        },
        surface: {
          primary: "#09090b", secondary: "#0f0f14", tertiary: "#16161d",
          elevated: "#1c1c27", hover: "#232330",
        },
      },
      fontFamily: { sans: ["Inter", "system-ui", "sans-serif"] },
      spacing: { sidebar: "260px", "sidebar-collapsed": "72px", header: "64px" },
      boxShadow: {
        glow: "0 0 20px rgba(139, 92, 246, 0.15)",
        "glow-lg": "0 0 40px rgba(139, 92, 246, 0.2)",
      },
      animation: {
        shimmer: "shimmer 2s ease-in-out infinite",
        "fade-in-up": "fadeInUp 400ms ease-out forwards",
        "toast-in": "toastIn 300ms ease-out forwards",
        "toast-out": "toastOut 200ms ease-in forwards",
        "pulse-dot": "pulseDot 1.4s ease-in-out infinite",
        float: "float 3s ease-in-out infinite",
        gradient: "gradientShift 4s ease infinite",
      },
    },
  },
  plugins: [],
};
export default config;
