export const normalizeStatsNumber = (value: unknown): number => {
  if (value === null || value === undefined || value === '') return 0

  const numberValue =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number(value)
        : Number.NaN

  return Number.isFinite(numberValue) ? numberValue : 0
}
