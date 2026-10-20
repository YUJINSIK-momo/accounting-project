/** @type {import('tailwindcss').Config} */
// yuyu 토큰을 Tailwind 색으로 잇는다 — Backend-Developer-Portfolio 의 설정에서 yuyu 부분만 가져왔다
const token = (name) => `rgb(var(--yuyu-${name}) / <alpha-value>)`

export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        yuyu: {
          bg: token("bg"),
          surface: token("surface"),
          raised: token("raised"),
          overlay: token("overlay"),
          line: token("line"),
          "line-strong": token("line-strong"),
          fg: token("fg"),
          "fg-muted": token("fg-muted"),
          "fg-subtle": token("fg-subtle"),
          brand: token("brand"),
          "brand-strong": token("brand-strong"),
          ai: token("ai"),
          infra: token("infra"),
          web: token("web"),
          success: token("success"),
          warning: token("warning"),
          danger: token("danger"),
        },
      },
      borderRadius: {
        "yuyu-sm": "var(--yuyu-radius-sm)",
        "yuyu-md": "var(--yuyu-radius-md)",
        "yuyu-lg": "var(--yuyu-radius-lg)",
      },
      boxShadow: {
        "yuyu-raised": "var(--yuyu-shadow-raised)",
      },
      fontFamily: {
        sans: ["var(--yuyu-font-sans)"],
        mono: ["var(--yuyu-font-mono)"],
      },
    },
  },
  plugins: [],
}
