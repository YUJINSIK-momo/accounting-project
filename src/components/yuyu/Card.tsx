import type { ReactNode } from "react"
import { Link } from "react-router-dom"
import { cx } from "./cx"
import { toneBorder, type Tone } from "./tone"

interface CardProps {
  children: ReactNode
  tone?: Tone
  /** 카드 전체를 링크로 만든다 */
  to?: string
  href?: string
  padding?: "sm" | "md" | "lg"
  className?: string
}

const paddingClass = { sm: "p-4", md: "p-5", lg: "p-6 sm:p-8" }

export function Card({ children, tone = "neutral", to, href, padding = "md", className }: CardProps) {
  const interactive = Boolean(to || href)
  const classes = cx(
    "block rounded-yuyu-lg border bg-yuyu-surface shadow-yuyu-raised",
    toneBorder[tone],
    paddingClass[padding],
    interactive && "group transition-colors hover:bg-yuyu-raised hover:border-yuyu-brand/45",
    className,
  )
  if (to) return <Link to={to} className={classes}>{children}</Link>
  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={classes}>
        {children}
      </a>
    )
  }
  return <div className={classes}>{children}</div>
}
