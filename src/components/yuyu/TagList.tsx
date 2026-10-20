import { cx } from "./cx"

interface TagListProps {
  items: readonly string[]
  className?: string
}

// 기술 이름 같은 짧은 낱말 묶음 — 배지보다 조용한 모양
export function TagList({ items, className }: TagListProps) {
  return (
    <ul className={cx("flex flex-wrap gap-1.5", className)}>
      {items.map((item) => (
        <li
          key={item}
          className="rounded-yuyu-sm border border-yuyu-line/60 bg-yuyu-bg/60 px-2 py-0.5 font-mono text-[11px] text-yuyu-fg-muted"
        >
          {item}
        </li>
      ))}
    </ul>
  )
}
