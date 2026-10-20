// yuyu 색 역할 — 배지·아이콘·강조선이 같은 이름을 쓴다
export type Tone = "neutral" | "brand" | "ai" | "infra" | "web" | "success" | "warning" | "danger"

export const toneText: Record<Tone, string> = {
  neutral: "text-yuyu-fg-muted",
  brand: "text-yuyu-brand",
  ai: "text-yuyu-ai",
  infra: "text-yuyu-infra",
  web: "text-yuyu-web",
  success: "text-yuyu-success",
  warning: "text-yuyu-warning",
  danger: "text-yuyu-danger",
}

export const toneSoft: Record<Tone, string> = {
  neutral: "bg-yuyu-raised text-yuyu-fg-muted border-yuyu-line/70",
  brand: "bg-yuyu-brand/10 text-yuyu-brand border-yuyu-brand/30",
  ai: "bg-yuyu-ai/10 text-yuyu-ai border-yuyu-ai/30",
  infra: "bg-yuyu-infra/10 text-yuyu-infra border-yuyu-infra/30",
  web: "bg-yuyu-web/10 text-yuyu-web border-yuyu-web/30",
  success: "bg-yuyu-success/10 text-yuyu-success border-yuyu-success/30",
  warning: "bg-yuyu-warning/10 text-yuyu-warning border-yuyu-warning/30",
  danger: "bg-yuyu-danger/10 text-yuyu-danger border-yuyu-danger/30",
}

export const toneBorder: Record<Tone, string> = {
  neutral: "border-yuyu-line/60",
  brand: "border-yuyu-brand/35",
  ai: "border-yuyu-ai/35",
  infra: "border-yuyu-infra/35",
  web: "border-yuyu-web/35",
  success: "border-yuyu-success/35",
  warning: "border-yuyu-warning/35",
  danger: "border-yuyu-danger/35",
}

// 카드 윗변 강조선 — Tailwind 가 찾을 수 있게 클래스 이름을 문자열 그대로 둔다
export const toneTopBorder: Record<Tone, string> = {
  neutral: "border-t-yuyu-line-strong",
  brand: "border-t-yuyu-brand",
  ai: "border-t-yuyu-ai",
  infra: "border-t-yuyu-infra",
  web: "border-t-yuyu-web",
  success: "border-t-yuyu-success",
  warning: "border-t-yuyu-warning",
  danger: "border-t-yuyu-danger",
}

// 상태 점 — 같은 이유로 문자열 그대로 둔다
export const toneDot: Record<Tone, string> = {
  neutral: "bg-yuyu-fg-subtle",
  brand: "bg-yuyu-brand",
  ai: "bg-yuyu-ai",
  infra: "bg-yuyu-infra",
  web: "bg-yuyu-web",
  success: "bg-yuyu-success",
  warning: "bg-yuyu-warning",
  danger: "bg-yuyu-danger",
}
