// 格式化字节大小的辅助函数
export const formatBytes = (
  bytes: number | string | null | undefined,
): string => {
  const normalizedBytes =
    typeof bytes === 'number'
      ? bytes
      : typeof bytes === 'string'
        ? Number(bytes)
        : 0

  if (!Number.isFinite(normalizedBytes) || normalizedBytes <= 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.min(
    Math.floor(Math.log(normalizedBytes) / Math.log(k)),
    sizes.length - 1,
  )
  return (
    parseFloat((normalizedBytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  )
}
