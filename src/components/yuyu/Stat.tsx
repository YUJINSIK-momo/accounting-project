import { cx } from "./cx"
import { toneText, type Tone } from "./tone"

interface StatProps {
  value: string
  label: string
  hint?: string
  tone?: Tone
  className?: string
}

export function Stat({ value, label, hint, tone = "brand", className }: StatProps) {
  return (
    <div className={cx("rounded-yuyu-lg border border-yuyu-line/60 bg-yuyu-surface p-4", className)}>
      <div className={cx("font-mono text-2xl font-semibold tracking-tight", toneText[tone])}>{value}</div>
      <div className="mt-1 text-sm font-medium text-yuyu-fg">{label}</div>
      {hint && <div className="mt-0.5 text-xs leading-relaxed text-yuyu-fg-subtle">{hint}</div>}
    </div>
  )
}
