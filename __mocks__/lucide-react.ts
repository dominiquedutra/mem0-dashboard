import React from "react"

const createIcon = (name: string) =>
  React.forwardRef((props: any, ref: any) =>
    React.createElement("svg", { ...props, ref, "data-testid": `icon-${name}` })
  )

export const Copy = createIcon("copy")
export const Check = createIcon("check")
export const Search = createIcon("search")
export const X = createIcon("x")
export const ChevronLeft = createIcon("chevron-left")
export const ChevronRight = createIcon("chevron-right")
export const Loader2 = createIcon("loader-2")
export const Brain = createIcon("brain")
export const Activity = createIcon("activity")
export const Zap = createIcon("zap")
