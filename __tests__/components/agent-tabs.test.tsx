import { render, screen, fireEvent } from "@testing-library/react"
import AgentTabs from "@/components/agent-tabs"

const agents = ["clawd", "ana", "norma"]
const counts: Record<string, number> = { clawd: 80, ana: 45, norma: 25 }

describe("AgentTabs", () => {
  it("renders All tab with total count", () => {
    const onSelect = jest.fn()
    render(
      <AgentTabs
        agents={agents}
        counts={counts}
        selected={null}
        onSelect={onSelect}
      />
    )
    expect(screen.getByText("All")).toBeInTheDocument()
    expect(screen.getByText("150")).toBeInTheDocument()
  })

  it("renders a tab for each agent with count", () => {
    const onSelect = jest.fn()
    render(
      <AgentTabs
        agents={agents}
        counts={counts}
        selected={null}
        onSelect={onSelect}
      />
    )
    expect(screen.getByText("clawd")).toBeInTheDocument()
    expect(screen.getByText("80")).toBeInTheDocument()
    expect(screen.getByText("ana")).toBeInTheDocument()
    expect(screen.getByText("45")).toBeInTheDocument()
    expect(screen.getByText("norma")).toBeInTheDocument()
    expect(screen.getByText("25")).toBeInTheDocument()
  })

  it("calls onSelect with agent name when tab clicked", () => {
    const onSelect = jest.fn()
    render(
      <AgentTabs
        agents={agents}
        counts={counts}
        selected={null}
        onSelect={onSelect}
      />
    )
    fireEvent.click(screen.getByText("ana"))
    expect(onSelect).toHaveBeenCalledWith("ana")
  })

  it("calls onSelect with null when All tab clicked", () => {
    const onSelect = jest.fn()
    render(
      <AgentTabs
        agents={agents}
        counts={counts}
        selected="clawd"
        onSelect={onSelect}
      />
    )
    fireEvent.click(screen.getByText("All"))
    expect(onSelect).toHaveBeenCalledWith(null)
  })

  it("marks selected tab as active", () => {
    const onSelect = jest.fn()
    render(
      <AgentTabs
        agents={agents}
        counts={counts}
        selected="clawd"
        onSelect={onSelect}
      />
    )
    const clawdTab = screen.getByText("clawd").closest("button")
    expect(clawdTab).toHaveAttribute("aria-selected", "true")
  })
})
