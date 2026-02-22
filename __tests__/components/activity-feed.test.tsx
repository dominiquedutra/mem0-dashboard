import { render, screen, waitFor } from "@testing-library/react"
import ActivityFeed from "@/components/activity-feed"

afterEach(() => {
  jest.restoreAllMocks()
})

describe("ActivityFeed", () => {
  it("shows empty state when no memories", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      json: () => Promise.resolve({ memories: [], total: 0 }),
    }) as jest.Mock

    render(<ActivityFeed />)

    await waitFor(() => {
      expect(
        screen.getByText("No recent activity in the last 24 hours.")
      ).toBeInTheDocument()
    })
  })

  it("renders Recent Activity title", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      json: () => Promise.resolve({ memories: [], total: 0 }),
    }) as jest.Mock

    render(<ActivityFeed />)

    await waitFor(() => {
      expect(screen.getByText("Recent Activity")).toBeInTheDocument()
    })
  })

  it("renders memory items when data is returned", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      json: () =>
        Promise.resolve({
          memories: [
            {
              id: "mem-1",
              agent: "clawd",
              data: "User likes TypeScript over JavaScript",
              createdAt: new Date().toISOString(),
              runId: null,
              runLabel: "unknown",
              hash: "h1",
            },
          ],
          total: 1,
        }),
    }) as jest.Mock

    render(<ActivityFeed />)

    await waitFor(() => {
      expect(screen.getByText("clawd")).toBeInTheDocument()
      expect(
        screen.getByText(/User likes TypeScript/)
      ).toBeInTheDocument()
    })
  })

  it("truncates long data to 60 chars", async () => {
    const longText = "A".repeat(100)
    global.fetch = jest.fn().mockResolvedValue({
      json: () =>
        Promise.resolve({
          memories: [
            {
              id: "mem-2",
              agent: "ana",
              data: longText,
              createdAt: new Date().toISOString(),
              runId: null,
              runLabel: "unknown",
              hash: "h2",
            },
          ],
          total: 1,
        }),
    }) as jest.Mock

    render(<ActivityFeed />)

    await waitFor(() => {
      const truncated = "A".repeat(60) + "..."
      expect(screen.getByText(truncated)).toBeInTheDocument()
    })
  })
})
