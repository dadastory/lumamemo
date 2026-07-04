export const DEFAULT_INITIAL_LINES = 500
export const MAX_INITIAL_LINES = 2000

type InitialLinesMode = number

export const clampInitialLines = (value: unknown): InitialLinesMode => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    return DEFAULT_INITIAL_LINES
  }
  return Math.max(0, Math.min(MAX_INITIAL_LINES, Math.floor(parsed)))
}
