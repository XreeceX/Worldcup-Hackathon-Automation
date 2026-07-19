import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        pitch: {
          950: "var(--pitch-950)",
          900: "var(--pitch-900)",
          800: "var(--pitch-800)",
          700: "var(--pitch-700)",
        },
        line: { 600: "var(--line-600)" },
        chalk: {
          100: "var(--chalk-100)",
          400: "var(--chalk-400)",
          600: "var(--chalk-600)",
        },
        turf: { 400: "var(--turf-400)", 500: "var(--turf-500)" },
        gold: { 400: "var(--gold-400)" },
        voidc: { 400: "var(--void-400)" },
        loss: { 400: "var(--loss-400)" },
        info: { 400: "var(--info-400)" },
      },
    },
  },
  plugins: [],
};
export default config;
