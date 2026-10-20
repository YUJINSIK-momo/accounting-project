import type { ReactNode } from "react"
import { cx } from "./cx"

interface SectionHeaderProps {
  eyebrow?: string
  title: string
  description?: ReactNode
  action?: ReactNode
  className?: string
}

export function SectionHeader({ eyebrow, title, description, action, className }: SectionHeaderProps) {
  return (
    <div className={cx("flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="space-y-1.5">
        {eyebrow && (
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-yuyu-brand">{eyebrow}</p>
        )}
        <h2 className="text-xl sm:text-2xl font-bold text-yuyu-fg">{title}</h2>
        {description && <p className="max-w-2xl text-sm leading-relaxed text-yuyu-fg-muted">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}
