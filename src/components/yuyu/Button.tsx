import type { ElementType, ReactNode } from "react"
import { Link } from "react-router-dom"
import { cx } from "./cx"

type Variant = "solid" | "outline" | "ghost"
type Size = "sm" | "md"

interface ButtonProps {
  children: ReactNode
  variant?: Variant
  size?: Size
  icon?: ElementType
  trailingIcon?: ElementType
  /** 사이트 안 경로 — react-router Link 로 그린다 */
  to?: string
  /** 바깥 주소 — 새 탭으로 연다 */
  href?: string
  onClick?: () => void
  disabled?: boolean
  /** 글자 없이 아이콘만 보일 때 읽어 줄 이름 */
  label?: string
  className?: string
}

const variantClass: Record<Variant, string> = {
  solid: "bg-yuyu-brand-strong text-white hover:bg-yuyu-brand border border-transparent",
  outline: "border border-yuyu-line-strong/70 text-yuyu-fg hover:border-yuyu-brand/60 hover:bg-yuyu-raised",
  ghost: "border border-transparent text-yuyu-fg-muted hover:text-yuyu-fg hover:bg-yuyu-raised",
}

const sizeClass: Record<Size, string> = {
  sm: "h-8 px-3 text-xs gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
}

export function Button({
  children, variant = "solid", size = "md", icon: Icon, trailingIcon: TrailingIcon,
  to, href, onClick, disabled, label, className,
}: ButtonProps) {
  const classes = cx(
    "inline-flex items-center justify-center rounded-yuyu-md font-medium transition-colors whitespace-nowrap",
    variantClass[variant],
    sizeClass[size],
    disabled && "pointer-events-none opacity-40",
    className,
  )
  const iconSize = size === "sm" ? 14 : 16
  const content = (
    <>
      {Icon && <Icon size={iconSize} aria-hidden />}
      <span>{children}</span>
      {TrailingIcon && <TrailingIcon size={iconSize} aria-hidden />}
    </>
  )

  if (to) return <Link to={to} className={classes}>{content}</Link>
  if (href) {
    const external = /^https?:/.test(href)
    return (
      <a
        href={href}
        className={classes}
        target={external ? "_blank" : undefined}
        rel={external ? "noopener noreferrer" : undefined}
      >
        {content}
      </a>
    )
  }
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-label={label} className={classes}>
      {content}
    </button>
  )
}
