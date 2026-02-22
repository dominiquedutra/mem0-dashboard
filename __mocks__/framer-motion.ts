import React from "react"

export const motion = {
  div: React.forwardRef((props: any, ref: any) => {
    const { initial, animate, exit, variants, transition, whileHover, whileTap, layout, ...rest } = props
    return React.createElement("div", { ...rest, ref })
  }),
  span: React.forwardRef((props: any, ref: any) => {
    const { initial, animate, exit, variants, transition, whileHover, whileTap, layout, ...rest } = props
    return React.createElement("span", { ...rest, ref })
  }),
}

export const AnimatePresence = ({ children }: { children: React.ReactNode }) => children
export const useAnimation = () => ({ start: jest.fn(), stop: jest.fn() })
export const useMotionValue = (val: number) => ({ get: () => val, set: jest.fn() })
export const useTransform = (val: any, from: any, to: any) => ({ get: () => to[0] })
