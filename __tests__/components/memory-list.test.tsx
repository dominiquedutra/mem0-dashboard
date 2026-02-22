import { render, screen, fireEvent, waitFor, act } from "@testing-library/react"
import MemoryList from "@/components/memory-list"
import type { MemoriesResponse, Memory } from "@/types/memory"

// Mock fetch globally
const mockFetch = jest.fn()
global.fetch = mockFetch

function makeMemory(i: number): Memory {
  return {
    id: `mem-${i}`,
    agent: "clawd",
    data: `Memory data ${i}`,
    createdAt: "2025-01-15T10:30:00Z",
    runId: null,
    runLabel: "—",
    hash: `hash-${i}`,
  }
}

function makeResponse(total: number, offset: number, limit: number): MemoriesResponse {
  const count = Math.min(limit, total - offset)
  return {
    total,
    offset,
    limit,
    memories: Array.from({ length: count }, (_, i) => makeMemory(offset + i)),
  }
}

function mockFetchSuccess(total: number) {
  mockFetch.mockImplementation(async (url: string) => {
    const params = new URL(url, "http://localhost").searchParams
    const limit = Number(params.get("limit") ?? 20)
    const offset = Number(params.get("offset") ?? 0)
    return {
      ok: true,
      json: async () => makeResponse(total, offset, limit),
    }
  })
}

beforeEach(() => {
  mockFetch.mockReset()
})

describe("MemoryList pagination", () => {
  it("fetches with page size of 20", async () => {
    mockFetchSuccess(100)

    await act(async () => {
      render(<MemoryList agent="clawd" />)
    })

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled()
    })

    const calledUrl = mockFetch.mock.calls[0][0] as string
    const params = new URL(calledUrl, "http://localhost").searchParams
    expect(params.get("limit")).toBe("20")
  })

  it("shows First and Last buttons when multiple pages exist", async () => {
    mockFetchSuccess(100)

    await act(async () => {
      render(<MemoryList agent="clawd" />)
    })

    await waitFor(() => {
      expect(screen.getByText("First")).toBeInTheDocument()
    })
    expect(screen.getByText("Last")).toBeInTheDocument()
  })

  it("disables First and Prev buttons on first page", async () => {
    mockFetchSuccess(100)

    await act(async () => {
      render(<MemoryList agent="clawd" />)
    })

    await waitFor(() => {
      expect(screen.getByText("First")).toBeDisabled()
    })
    expect(screen.getByText("Prev")).toBeDisabled()
  })

  it("First button navigates to page 1", async () => {
    mockFetchSuccess(100)

    await act(async () => {
      render(<MemoryList agent="clawd" />)
    })

    // Go to page 2 first
    await waitFor(() => {
      expect(screen.getByText("Next")).toBeEnabled()
    })

    await act(async () => {
      fireEvent.click(screen.getByText("Next"))
    })

    await waitFor(() => {
      expect(screen.getByText("Page 2 of 5")).toBeInTheDocument()
    })

    // Now click First
    await act(async () => {
      fireEvent.click(screen.getByText("First"))
    })

    await waitFor(() => {
      expect(screen.getByText("Page 1 of 5")).toBeInTheDocument()
    })
  })

  it("Last button navigates to final page", async () => {
    mockFetchSuccess(100)

    await act(async () => {
      render(<MemoryList agent="clawd" />)
    })

    await waitFor(() => {
      expect(screen.getByText("Last")).toBeEnabled()
    })

    await act(async () => {
      fireEvent.click(screen.getByText("Last"))
    })

    await waitFor(() => {
      expect(screen.getByText("Page 5 of 5")).toBeInTheDocument()
    })

    // Last and Next should now be disabled
    expect(screen.getByText("Last")).toBeDisabled()
    expect(screen.getByText("Next")).toBeDisabled()
  })

  it("does not show pagination for single page", async () => {
    mockFetchSuccess(10) // 10 items < 20 page size = 1 page

    await act(async () => {
      render(<MemoryList agent="clawd" />)
    })

    await waitFor(() => {
      expect(screen.getByText(/Showing/)).toBeInTheDocument()
    })

    expect(screen.queryByText("First")).not.toBeInTheDocument()
    expect(screen.queryByText("Last")).not.toBeInTheDocument()
  })
})
