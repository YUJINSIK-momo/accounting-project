import type { ReactNode } from "react"

interface PageHeaderProps {
  eyebrow?: string
  title: ReactNode
  lead?: ReactNode
  children?: ReactNode
}

// 페이지 맨 위 제목 영역 — 모든 새 페이지가 같은 모양으로 시작한다
export function PageHeader({ eyebrow, title, lead, children }: PageHeaderProps) {
  return (
    <header className="space-y-4 border-b border-yuyu-line/50 pb-8">
      {eyebrow && (
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-yuyu-brand">{eyebrow}</p>
      )}
      <h1 className="text-3xl sm:text-4xl font-bold leading-tight text-yuyu-fg">{title}</h1>
      {lead && <p className="max-w-3xl text-base leading-relaxed text-yuyu-fg-muted">{lead}</p>}
      {children}
    </header>
  )
}
