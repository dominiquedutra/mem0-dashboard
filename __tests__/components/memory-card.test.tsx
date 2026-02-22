import { render, screen, fireEvent, act } from "@testing-library/react"
import MemoryCard from "@/components/memory-card"
import type { Memory } from "@/types/memory"

const mockMemory: Memory = {
  id: "abc12345-6789-0000-1111-222233334444",
  agent: "clawd",
  data: "The user prefers dark mode interfaces",
  createdAt: "2025-01-15T10:30:00Z",
  runId: "run-xyz",
  runLabel: "run-xyz",
  hash: "abc123",
}

describe("MemoryCard", () => {
  it("renders agent badge", () => {
    render(<MemoryCard memory={mockMemory} />)
    expect(screen.getByText("clawd")).toBeInTheDocument()
  })

  it("renders run label badge", () => {
    render(<MemoryCard memory={mockMemory} />)
    expect(screen.getByText("run-xyz")).toBeInTheDocument()
  })

  it("renders memory data", () => {
    render(<MemoryCard memory={mockMemory} />)
    expect(
      screen.getByText("The user prefers dark mode interfaces")
    ).toBeInTheDocument()
  })

  it("renders relative timestamp", () => {
    render(<MemoryCard memory={mockMemory} />)
    // date-fns formatDistanceToNow will render something like "X months ago"
    const timeEl = screen.getByText(/ago/)
    expect(timeEl).toBeInTheDocument()
  })

  it("renders first 8 chars of ID", () => {
    render(<MemoryCard memory={mockMemory} />)
    expect(screen.getByText("ID: abc12345")).toBeInTheDocument()
  })

  it("copies full ID to clipboard on copy button click", async () => {
    const writeText = jest.fn().mockResolvedValue(undefined)
    Object.assign(navigator, {
      clipboard: { writeText },
    })

    render(<MemoryCard memory={mockMemory} />)
    const copyBtn = screen.getByRole("button", { name: /copy memory id/i })
    await act(async () => {
      fireEvent.click(copyBtn)
    })

    expect(writeText).toHaveBeenCalledWith(mockMemory.id)
  })
})
