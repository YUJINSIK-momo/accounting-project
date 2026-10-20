import type { ReactNode } from "react"
import { cx } from "./cx"

interface ContainerProps {
  children: ReactNode
  width?: "narrow" | "default" | "wide"
  className?: string
}

const widthClass = { narrow: "max-w-3xl", default: "max-w-5xl", wide: "max-w-7xl" }

export function Container({ children, width = "default", className }: ContainerProps) {
  return <div className={cx("mx-auto w-full px-4 sm:px-6", widthClass[width], className)}>{children}</div>
}
