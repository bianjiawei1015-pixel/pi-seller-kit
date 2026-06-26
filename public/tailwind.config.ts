import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Surfaces
        canvas: "#F6F5FB", // cool near-white app background
        surface: "#FFFFFF", // cards
        // Ink
        ink: "#191331", // near-black violet, primary text
        muted: "#6B6580", // secondary text
        hairline: "#ECEAF3", // borders / dividers
        // Brand (Pi violet)
        pi: {
          50: "#F3EEFE",
          100: "#E6DBFD",
          300: "#B89BF6",
          500: "#7C3AED",
          600: "#6D28D9",
          700: "#5B21B6",
        },
        // Status
        success: "#16A34A",
        danger: "#DC2626",
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "SF Pro Text",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
        // Monospace is the signature: every Pi amount and id reads like a
        // crypto balance — precise, tabular, unmistakably a "wallet" number.
        mono: [
          "ui-monospace",
          "SF Mono",
          "SFMono-Regular",
          "Menlo",
          "Consolas",
          "Liberation Mono",
          "monospace",
        ],
      },
      borderRadius: {
        card: "20px",
        pill: "999px",
      },
      boxShadow: {
        card: "0 1px 2px rgba(25, 19, 49, 0.04), 0 8px 24px rgba(25, 19, 49, 0.06)",
        cta: "0 8px 20px rgba(109, 40, 217, 0.28)",
        bar: "0 -1px 0 rgba(25, 19, 49, 0.06)",
      },
      maxWidth: {
        app: "480px", // mobile-first column, centered on larger screens
      },
    },
  },
  plugins: [],
};

export default config;
