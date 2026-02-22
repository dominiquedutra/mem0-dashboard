import * as React from "react"
import { cn } from "@/lib/utils"

interface TooltipProps extends React.HTMLAttributes<HTMLDivElement> {
  content: string
}

function Tooltip({ content, children, className, ...props }: TooltipProps) {
  return (
    <div className={cn("relative group inline-block", className)} title={content} {...props}>
      {children}
    </div>
  )
}

export { Tooltip }
