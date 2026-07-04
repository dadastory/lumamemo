const STORAGE_KEY_SCHEME_RE = /^[a-z][a-z\d+.-]*:/i

export const normalizeStorageKey = (
  key: string | null | undefined,
): string | null => {
  if (typeof key !== 'string') return null

  const raw = key.trim()
  if (!raw || raw.includes('\\') || STORAGE_KEY_SCHEME_RE.test(raw)) {
    return null
  }

  const withoutLeadingSlash = raw.replace(/^\/+/, '')
  if (!withoutLeadingSlash) return null

  const segments = withoutLeadingSlash.split('/').filter(Boolean)
  if (segments.some((segment) => segment === '.' || segment === '..')) {
    return null
  }

  return segments.join('/')
}

export const requireSafeStorageKey = (key: string): string => {
  const normalized = normalizeStorageKey(key)
  if (!normalized) {
    throw new Error('Invalid storage key')
  }
  return normalized
}
