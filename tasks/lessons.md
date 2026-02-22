# Lessons Learned

## Session-based state for charts is fragile
- **Problem**: Using `useState` for time-series accumulation means data resets on component unmount (tab switch, page refresh)
- **Fix**: Use module-level variables for data that should survive component lifecycle. Use `useState` only as a version counter to trigger re-renders.
- **Rule**: When accumulating data across time, always ask: "What happens when the user switches tabs and comes back?"

## Next.js 14 fetch caching has TWO layers
- `export const dynamic = "force-dynamic"` only prevents route prerendering
- Internal `fetch()` calls still cached by Next.js extended fetch API
- Must add `{ cache: "no-store" }` to every fetch to external services
- **Rule**: When adding a new API route with fetch(), always include `cache: "no-store"`

## Compute rates from what you have, don't wait for accumulation
- **Problem**: Chart showing "Collecting data..." or flat 0 is useless UX
- **Fix**: If you have a cumulative total + uptime, compute rate = total/uptime immediately
- **Rule**: Always show derived metrics from single-point data first, use live deltas as supplementary

## Don't initialize URL-derived state in useEffect
- **Problem**: `useState("default")` + `useEffect(() => setState(fromURL))` creates a race: the sync-back effect writes the default to the URL before the read effect runs
- **Fix**: Use lazy initializer: `useState(() => readFromURL())`. Guard the sync-back effect with a `hashReady` flag so it skips the initial render
- **Rule**: If initial state comes from URL/localStorage, always read it synchronously in the initializer

## UI controls must be visible in ALL states
- **Problem**: Refresh button inside the "loaded data" render block is hidden during loading/error
- **Fix**: Extract shared controls (refresh button, heading) and render them before the loading/error/success branch
- **Rule**: Interactive controls should never disappear when data is loading
