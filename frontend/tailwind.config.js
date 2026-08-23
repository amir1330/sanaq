/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#101211",
        paper: "#F4F5F3",
        foam: "#FFFFFF",
        line: "#D8DBD6",
        sun: "#E8B923",
        sky: "#0E7C86",
        mute: "#6A6F6B",
        alert: "#E24B2D",
        crema: "#E8B923",
        roast: "#101211",
        rust: "#E24B2D",
        pine: "#0E7C86",
        stone: "#F4F5F3",
      },
      fontFamily: {
        display: ['"JetBrains Mono"', "ui-monospace", "monospace"],
        sans: ['"JetBrains Mono"', "ui-monospace", "monospace"],
        mono: ['"JetBrains Mono"', "ui-monospace", "monospace"],
      },
      borderRadius: {
        md: "2px",
        lg: "2px",
      },
    },
  },
  plugins: [],
};
