import type { ElementType, ReactNode } from "react"
import { cx } from "./cx"
import { toneBorder, toneText, type Tone } from "./tone"

interface CalloutProps {
  title?: string
  children: ReactNode
  tone?: Tone
  icon?: ElementType
  className?: string
}

export function Callout({ title, children, tone = "brand", icon: Icon, className }: CalloutProps) {
  return (
    <div className={cx("flex gap-3 rounded-yuyu-lg border border-l-4 bg-yuyu-surface/70 p-4", toneBorder[tone], className)}>
      {Icon && <Icon size={18} className={cx("mt-0.5 shrink-0", toneText[tone])} aria-hidden />}
      <div className="space-y-1 text-sm leading-relaxed text-yuyu-fg-muted">
        {title && <p className="font-semibold text-yuyu-fg">{title}</p>}
        <div>{children}</div>
      </div>
    </div>
  )
}
