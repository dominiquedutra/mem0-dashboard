import { render, screen } from "@testing-library/react"
import StatsHeader from "@/components/stats-header"
import type { StatsResponse } from "@/types/memory"

const mockStats: StatsResponse = {
  total: 150,
  agents: {
    clawd: 80,
    ana: 45,
    norma: 25,
  },
  collection: "agent_memories",
  lastUpdated: "2025-01-01T00:00:00Z",
}

describe("StatsHeader", () => {
  it("renders skeleton when loading", () => {
    render(<StatsHeader stats={null} loading={true} />)
    expect(screen.getByTestId("stats-skeleton")).toBeInTheDocument()
  })

  it("renders nothing when not loading and no stats", () => {
    const { container } = render(<StatsHeader stats={null} loading={false} />)
    expect(container.firstChild).toBeNull()
  })

  it("renders total count", () => {
    render(<StatsHeader stats={mockStats} loading={false} />)
    expect(screen.getByText("150")).toBeInTheDocument()
    expect(screen.getByText("Total")).toBeInTheDocument()
  })

  it("renders agent counts", () => {
    render(<StatsHeader stats={mockStats} loading={false} />)
    expect(screen.getByText("80")).toBeInTheDocument()
    expect(screen.getByText("45")).toBeInTheDocument()
    expect(screen.getByText("25")).toBeInTheDocument()
    expect(screen.getByText("clawd")).toBeInTheDocument()
    expect(screen.getByText("ana")).toBeInTheDocument()
    expect(screen.getByText("norma")).toBeInTheDocument()
  })

  it("renders 'memories' label for each card", () => {
    render(<StatsHeader stats={mockStats} loading={false} />)
    const memoryLabels = screen.getAllByText("memories")
    expect(memoryLabels).toHaveLength(4) // total + 3 agents
  })

  it("shows top 2 + Others when more than 3 agents", () => {
    const manyAgentsStats: StatsResponse = {
      total: 300,
      agents: {
        clawd: 100,
        ana: 80,
        norma: 60,
        flux: 40,
        zeta: 20,
      },
      collection: "agent_memories",
      lastUpdated: "2025-01-01T00:00:00Z",
    }

    render(<StatsHeader stats={manyAgentsStats} loading={false} />)

    // Total card
    expect(screen.getByText("300")).toBeInTheDocument()
    expect(screen.getByText("Total")).toBeInTheDocument()

    // Top 2 agents
    expect(screen.getByText("clawd")).toBeInTheDocument()
    expect(screen.getByText("100")).toBeInTheDocument()
    expect(screen.getByText("ana")).toBeInTheDocument()
    expect(screen.getByText("80")).toBeInTheDocument()

    // Others card combines norma(60) + flux(40) + zeta(20) = 120
    expect(screen.getByText("Others")).toBeInTheDocument()
    expect(screen.getByText("120")).toBeInTheDocument()

    // Only 4 memory labels (Total + top2 + Others)
    const memoryLabels = screen.getAllByText("memories")
    expect(memoryLabels).toHaveLength(4)
  })

  it("shows all agents without Others when exactly 3 agents", () => {
    render(<StatsHeader stats={mockStats} loading={false} />)

    expect(screen.queryByText("Others")).not.toBeInTheDocument()
    expect(screen.getByText("clawd")).toBeInTheDocument()
    expect(screen.getByText("ana")).toBeInTheDocument()
    expect(screen.getByText("norma")).toBeInTheDocument()
  })

  it("handles a single agent", () => {
    const singleStats: StatsResponse = {
      total: 50,
      agents: { flux: 50 },
      collection: "test",
      lastUpdated: "2025-01-01T00:00:00Z",
    }

    render(<StatsHeader stats={singleStats} loading={false} />)

    expect(screen.getByText("Total")).toBeInTheDocument()
    expect(screen.getByText("flux")).toBeInTheDocument()
    // Both Total and flux show 50
    expect(screen.getAllByText("50")).toHaveLength(2)
    expect(screen.queryByText("Others")).not.toBeInTheDocument()
  })
})
