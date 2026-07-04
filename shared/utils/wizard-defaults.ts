export const isEmptyWizardValue = (value: unknown) =>
  value === undefined || value === null || value === ''

export const applyWizardSchemaDefaults = (
  defaults: Record<string, any>,
  currentState: Record<string, any>,
) => {
  const merged = { ...currentState }

  for (const [key, value] of Object.entries(defaults)) {
    if (isEmptyWizardValue(merged[key])) {
      merged[key] = value
    }
  }

  return merged
}
