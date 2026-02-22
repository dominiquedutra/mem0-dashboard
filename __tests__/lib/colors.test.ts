import { getAgentColor, getAgentTailwindClass, getAgentTabClasses } from "@/lib/colors"

describe("getAgentColor", () => {
  it("returns blue for clawd", () => {
    expect(getAgentColor("clawd")).toBe("#3b82f6")
  })

  it("returns green for ana", () => {
    expect(getAgentColor("ana")).toBe("#22c55e")
  })

  it("returns orange for norma", () => {
    expect(getAgentColor("norma")).toBe("#f97316")
  })

  it("returns gray for unknown", () => {
    expect(getAgentColor("unknown")).toBe("#6b7280")
  })

  it("returns a palette color for a new agent", () => {
    const color = getAgentColor("flux")
    expect(color).toMatch(/^#[0-9a-f]{6}$/)
    expect(color).not.toBe("#6b7280") // not gray
  })

  it("returns consistent colors for the same agent name", () => {
    expect(getAgentColor("flux")).toBe(getAgentColor("flux"))
    expect(getAgentColor("zeta")).toBe(getAgentColor("zeta"))
  })

  it("returns different colors for different unknown agents", () => {
    // Not guaranteed by hash but highly likely with these names
    const colors = new Set([
      getAgentColor("flux"),
      getAgentColor("zeta"),
      getAgentColor("omega"),
      getAgentColor("delta"),
    ])
    expect(colors.size).toBeGreaterThan(1)
  })

  it("returns a valid hex color from the palette", () => {
    const palette = ["#a855f7", "#ec4899", "#14b8a6", "#eab308", "#ef4444", "#06b6d4"]
    const color = getAgentColor("brandnew")
    expect(palette).toContain(color)
  })
})

describe("getAgentTailwindClass", () => {
  it("returns blue-400 class for clawd", () => {
    expect(getAgentTailwindClass("clawd")).toBe("text-blue-400")
  })

  it("returns green-400 class for ana", () => {
    expect(getAgentTailwindClass("ana")).toBe("text-green-400")
  })

  it("returns orange-400 class for norma", () => {
    expect(getAgentTailwindClass("norma")).toBe("text-orange-400")
  })

  it("returns gray-400 class for unknown agents", () => {
    expect(getAgentTailwindClass("unknown")).toBe("text-gray-400")
    expect(getAgentTailwindClass("flux")).toBe("text-gray-400")
  })
})

describe("getAgentTabClasses", () => {
  it("returns blue classes for clawd", () => {
    expect(getAgentTabClasses("clawd")).toContain("blue-400")
  })

  it("returns green classes for ana", () => {
    expect(getAgentTabClasses("ana")).toContain("green-400")
  })

  it("returns orange classes for norma", () => {
    expect(getAgentTabClasses("norma")).toContain("orange-400")
  })

  it("returns gray classes for unknown agents", () => {
    expect(getAgentTabClasses("flux")).toContain("gray-400")
    expect(getAgentTabClasses("unknown")).toContain("gray-400")
  })

  it("includes data-active border classes", () => {
    const classes = getAgentTabClasses("clawd")
    expect(classes).toContain("data-[active=true]:border-blue-400")
    expect(classes).toContain("data-[active=true]:text-blue-400")
  })
})
