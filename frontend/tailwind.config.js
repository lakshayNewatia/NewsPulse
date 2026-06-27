/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink:    "#0A0A0F",
        surface:"#111118",
        panel:  "#16161F",
        border: "#1E1E2E",
        muted:  "#2A2A3C",
        text:   "#E2E2F0",
        dim:    "#8888AA",
        accent: "#6C6FFF",       // electric indigo
        pulse:  "#FF6B6B",       // live pulse red
        bbc:    "#E01B24",
        reuters:"#FF8000",
        alj:    "#00A651",
        guardian:"#00BFFF",
      },
      fontFamily: {
        display: ["'Space Grotesk'", "system-ui", "sans-serif"],
        body:    ["'Inter'", "system-ui", "sans-serif"],
        mono:    ["'JetBrains Mono'", "monospace"],
      },
      animation: {
        "pulse-ring": "pulse-ring 1.4s cubic-bezier(0.4,0,0.6,1) infinite",
        "slide-up":   "slide-up 0.4s ease-out",
        "fade-in":    "fade-in 0.3s ease-out",
      },
      keyframes: {
        "pulse-ring": {
          "0%, 100%": { opacity: 1 },
          "50%":       { opacity: 0.4 },
        },
        "slide-up": {
          from: { transform: "translateY(16px)", opacity: 0 },
          to:   { transform: "translateY(0)",    opacity: 1 },
        },
        "fade-in": {
          from: { opacity: 0 },
          to:   { opacity: 1 },
        },
      },
    },
  },
  plugins: [],
};
