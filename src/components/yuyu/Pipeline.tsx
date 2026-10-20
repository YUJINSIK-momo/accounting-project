import { ChevronRight } from "lucide-react"
import { cx } from "./cx"
import { toneSoft, type Tone } from "./tone"

export interface PipelineNode {
  label: string
  sub?: string
  tone?: Tone
  /** 사람이 손대는 단계는 점선으로 그린다 */
  human?: boolean
}

interface PipelineProps {
  nodes: readonly PipelineNode[]
  className?: string
}

// 가로 흐름도 — 좁은 화면에서는 줄바꿈되어 위에서 아래로 읽힌다
export function Pipeline({ nodes, className }: PipelineProps) {
  return (
    <ol className={cx("flex flex-wrap items-stretch gap-y-3", className)}>
      {nodes.map((node, i) => (
        <li key={node.label} className="flex items-center">
          <div
            className={cx(
              "rounded-yuyu-md border px-3 py-2",
              toneSoft[node.tone ?? "neutral"],
              node.human && "border-dashed",
            )}
          >
            <div className="text-xs font-semibold text-yuyu-fg">{node.label}</div>
            {node.sub && <div className="mt-0.5 text-[11px] leading-snug opacity-80">{node.sub}</div>}
          </div>
          {i < nodes.length - 1 && (
            <ChevronRight size={16} className="mx-1 shrink-0 text-yuyu-fg-subtle" aria-hidden />
          )}
        </li>
      ))}
    </ol>
  )
}
