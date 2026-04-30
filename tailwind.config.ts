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
        // ── Brand: Electric Blue tonal ramp, anchored on 500 = #4A9EE0 ──
        // Used in existing code as `brand-300` / `brand-500` / `brand-500/20` etc.
        // Swapping the scale here updates every semantic token reference app-wide.
        brand: {
          50:  "#EFF7FC",
          100: "#D6ECF7",
          200: "#ADD3EE",
          300: "#85BBE4",
          400: "#65ABDD",
          500: "#4A9EE0",  // Electric Blue — brand primary
          600: "#3B85BE",
          700: "#2D6699",
          800: "#204B72",
          900: "#14354F",
        },
        // ── Surfaces: Gunmetal palette per brand spec ──
        surface: {
          primary:   "#0E1216",  // Gunmetal Black — page bg
          secondary: "#181E24",  // Deep Steel — cards / elevated bg
          tertiary:  "#2D343C",  // Gunmetal — accent surfaces / pill bg
          elevated:  "#363E47",  // one step above tertiary for modals etc.
          hover:     "#232A32",  // between secondary and tertiary for hover states
        },
        // ── Crisp: Warship Grey as a semantic accent (part of the brand vocabulary) ──
        crisp: {
          light:   "#B4BBC2",
          DEFAULT: "#8C949C",  // Warship Grey — secondary accent
          dark:    "#646B73",
        },
        // ── Paper: Hangar White for primary text on dark ──
        paper: {
          DEFAULT: "#E8ECEF",  // Hangar White
        },
      },
      fontFamily: { sans: ["Inter", "system-ui", "sans-serif"] },
      spacing: { sidebar: "260px", "sidebar-collapsed": "72px", header: "64px" },
      boxShadow: {
        // Electric Blue pulse replacing the old violet glow
        glow:      "0 0 20px rgba(74, 158, 224, 0.2)",
        "glow-lg": "0 0 40px rgba(74, 158, 224, 0.25)",
      },
      animation: {
        shimmer: "shimmer 2s ease-in-out infinite",
        "fade-in-up": "fadeInUp 400ms ease-out forwards",
        "toast-in": "toastIn 300ms ease-out forwards",
        "toast-out": "toastOut 200ms ease-in forwards",
        "pulse-dot": "pulseDot 1.4s ease-in-out infinite",
        float: "float 3s ease-in-out infinite",
        gradient: "gradientShift 4s ease infinite",
        "rocket-bob":    "rocket-bob 1.4s ease-in-out infinite",
        "flame-flicker": "flame-flicker 0.4s ease-in-out infinite",
        "puff-rise":     "puff-rise 1.5s ease-out infinite",
        twinkle:         "twinkle 2s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
export default config;
