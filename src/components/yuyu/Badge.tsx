import type { ReactNode } from "react"
import { cx } from "./cx"
import { toneSoft, type Tone } from "./tone"

interface BadgeProps {
  children: ReactNode
  tone?: Tone
  size?: "sm" | "md"
  className?: string
}

export function Badge({ children, tone = "neutral", size = "sm", className }: BadgeProps) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-full border font-medium whitespace-nowrap",
        size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs",
        toneSoft[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}
