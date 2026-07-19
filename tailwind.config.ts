import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        cork: "#3E2B23",
        "cork-light": "#5A4030",
        "cork-dark": "#2A1D17",
        card: "#F3E9D2",
        "card-shadow": "#D8C79E",
        line: "#C9B98F",
        ink: "#241F1A",
        thread: "#B23A2F",
        "thread-dim": "#7A2A22",
        pin: "#C9A227",
        tag: "#E8B23D",
        muted: "#B7A98C",
      },
      fontFamily: {
        display: ["var(--font-display)", "monospace"],
        body: ["var(--font-body)", "serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      backgroundImage: {
        cork: "radial-gradient(circle at 20% 20%, rgba(255,255,255,0.03) 0, transparent 40%), radial-gradient(circle at 80% 60%, rgba(0,0,0,0.15) 0, transparent 45%)",
      },
    },
  },
  plugins: [],
};
export default config;
