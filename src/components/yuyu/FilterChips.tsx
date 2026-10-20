import { cx } from "./cx"

interface FilterOption<T extends string> {
  value: T
  label: string
  count?: number
}

interface FilterChipsProps<T extends string> {
  options: readonly FilterOption<T>[]
  value: T
  onChange: (value: T) => void
  label: string
}

export function FilterChips<T extends string>({ options, value, onChange, label }: FilterChipsProps<T>) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className={cx(
              "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors",
              active
                ? "border-yuyu-brand/60 bg-yuyu-brand/15 text-yuyu-fg"
                : "border-yuyu-line/60 text-yuyu-fg-muted hover:border-yuyu-line-strong hover:text-yuyu-fg",
            )}
          >
            <span>{option.label}</span>
            {option.count !== undefined && (
              <span className={cx("font-mono text-[10px]", active ? "text-yuyu-brand" : "text-yuyu-fg-subtle")}>
                {option.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
