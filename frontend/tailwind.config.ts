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
        background: "#080c16",
        cardBg: "rgba(15, 23, 42, 0.75)",
        cardBorder: "rgba(255, 255, 255, 0.1)",
        aiCyan: "#00f2fe",
        aiPurple: "#7928ca",
        aiBlue: "#3b82f6",
        aiGreen: "#10b981",
        aiRed: "#ef4444"
      },
      backgroundImage: {
        'glow-gradient': 'radial-gradient(circle at 50% 20%, rgba(0, 242, 254, 0.15), transparent 60%)',
        'card-gradient': 'linear-gradient(135deg, rgba(30, 41, 59, 0.8) 0%, rgba(15, 23, 42, 0.9) 100%)'
      }
    },
  },
  plugins: [],
};
export default config;
