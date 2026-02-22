import { render, screen, fireEvent } from "@testing-library/react"
import LiveIndicator from "@/components/live-indicator"

describe("LiveIndicator", () => {
  it("renders Live text", () => {
    render(<LiveIndicator lastUpdated={null} onRefresh={jest.fn()} />)
    expect(screen.getByText("Live")).toBeInTheDocument()
  })

  it("renders pulsing dot", () => {
    const { container } = render(
      <LiveIndicator lastUpdated={null} onRefresh={jest.fn()} />
    )
    const pulsingDot = container.querySelector(".animate-pulse")
    expect(pulsingDot).toBeInTheDocument()
  })

  it("renders last updated time when provided", () => {
    const date = new Date(Date.now() - 5 * 60 * 1000) // 5 minutes ago
    render(<LiveIndicator lastUpdated={date} onRefresh={jest.fn()} />)
    expect(screen.getByText(/ago/)).toBeInTheDocument()
  })

  it("does not render last updated when null", () => {
    render(<LiveIndicator lastUpdated={null} onRefresh={jest.fn()} />)
    expect(screen.queryByText(/ago/)).not.toBeInTheDocument()
  })

  it("calls onRefresh when clicked", () => {
    const onRefresh = jest.fn()
    render(<LiveIndicator lastUpdated={null} onRefresh={onRefresh} />)
    fireEvent.click(screen.getByRole("button"))
    expect(onRefresh).toHaveBeenCalledTimes(1)
  })
})
