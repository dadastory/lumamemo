export const LOG_SEARCH_MARK_CLASS =
  'bg-yellow-300 dark:bg-yellow-700 text-black dark:text-white rounded'

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export const highlightLogSearch = (content: string, query: string) => {
  const escapedContent = escapeHtml(content)
  const normalizedQuery = query.trim()
  if (!normalizedQuery) return escapedContent

  const regex = new RegExp(`(${escapeRegExp(escapeHtml(normalizedQuery))})`, 'gi')
  return escapedContent.replace(
    regex,
    `<mark class="${LOG_SEARCH_MARK_CLASS}">$1</mark>`,
  )
}
