import type { ReactNode } from "react"
import { cx } from "./cx"
import { toneSoft, type Tone } from "./tone"

export interface Step {
  title: string
  body: ReactNode
  /** 사람이 결정하는 단계 등 따로 표시할 꼬리표 */
  note?: string
  tone?: Tone
}

interface StepsProps {
  steps: readonly Step[]
  className?: string
}

// 세로 번호 흐름 — 파이프라인 단계를 설명할 때 쓴다
export function Steps({ steps, className }: StepsProps) {
  return (
    <ol className={cx("relative space-y-4", className)}>
      {steps.map((step, i) => (
        <li key={step.title} className="relative flex gap-4">
          {i < steps.length - 1 && (
            <span aria-hidden className="absolute left-4 top-9 bottom-[-1rem] w-px bg-yuyu-line/60" />
          )}
          <span
            className={cx(
              "relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border font-mono text-xs font-semibold",
              toneSoft[step.tone ?? "brand"],
            )}
          >
            {i + 1}
          </span>
          <div className="min-w-0 flex-1 pb-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold text-yuyu-fg">{step.title}</h3>
              {step.note && (
                <span className="rounded-full border border-yuyu-warning/40 px-2 py-0.5 text-[10px] font-medium text-yuyu-warning">
                  {step.note}
                </span>
              )}
            </div>
            <div className="mt-1 text-sm leading-relaxed text-yuyu-fg-muted">{step.body}</div>
          </div>
        </li>
      ))}
    </ol>
  )
}
