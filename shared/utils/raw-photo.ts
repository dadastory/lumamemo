export const RAW_PHOTO_EXTENSIONS = [
  '.3fr',
  '.arw',
  '.cr2',
  '.cr3',
  '.crw',
  '.dcr',
  '.dng',
  '.erf',
  '.fff',
  '.iiq',
  '.kdc',
  '.mef',
  '.mos',
  '.mrw',
  '.nef',
  '.nrw',
  '.orf',
  '.pef',
  '.raf',
  '.rwl',
  '.rw2',
  '.srw',
  '.x3f',
] as const

export const RAW_EXTENSION_MIME_TYPES: Record<string, string> = {
  '.3fr': 'image/x-hasselblad-3fr',
  '.arw': 'image/x-sony-arw',
  '.cr2': 'image/x-canon-cr2',
  '.cr3': 'image/x-canon-cr3',
  '.crw': 'image/x-canon-crw',
  '.dcr': 'image/x-kodak-dcr',
  '.dng': 'image/x-adobe-dng',
  '.erf': 'image/x-epson-erf',
  '.fff': 'image/x-hasselblad-fff',
  '.iiq': 'image/x-leaf-iiq',
  '.kdc': 'image/x-kodak-kdc',
  '.mef': 'image/x-mamiya-mef',
  '.mos': 'image/x-leaf-mos',
  '.mrw': 'image/x-minolta-mrw',
  '.nef': 'image/x-nikon-nef',
  '.nrw': 'image/x-nikon-nrw',
  '.orf': 'image/x-olympus-orf',
  '.pef': 'image/x-pentax-pef',
  '.raf': 'image/x-fuji-raf',
  '.rwl': 'image/x-leica-rwl',
  '.rw2': 'image/x-panasonic-rw2',
  '.srw': 'image/x-samsung-srw',
  '.x3f': 'image/x-sigma-x3f',
}

export const RAW_MIME_TYPES = [
  'image/3fr',
  'image/arw',
  'image/cr2',
  'image/cr3',
  'image/crw',
  'image/dcr',
  'image/dng',
  'image/erf',
  'image/fff',
  'image/iiq',
  'image/kdc',
  'image/mef',
  'image/mos',
  'image/mrw',
  'image/nef',
  'image/nrw',
  'image/orf',
  'image/pef',
  'image/raf',
  'image/rwl',
  'image/rw2',
  'image/srw',
  'image/x3f',
  'image/x-adobe-dng',
  'image/x-canon-crw',
  'image/x-canon-cr2',
  'image/x-canon-cr3',
  'image/x-epson-erf',
  'image/x-fuji-raf',
  'image/x-hasselblad-3fr',
  'image/x-hasselblad-fff',
  'image/x-kodak-dcr',
  'image/x-kodak-kdc',
  'image/x-leaf-iiq',
  'image/x-leaf-mos',
  'image/x-leica-rwl',
  'image/x-mamiya-mef',
  'image/x-minolta-mrw',
  'image/x-nikon-nef',
  'image/x-nikon-nrw',
  'image/x-olympus-orf',
  'image/x-panasonic-rw2',
  'image/x-pentax-pef',
  'image/x-samsung-srw',
  'image/x-sigma-x3f',
  'image/x-sony-arw',
  'image/x-sony-sr2',
  'image/x-sony-srf',
] as const

export const RAW_UPLOAD_ACCEPT = [
  ...RAW_MIME_TYPES,
  ...RAW_PHOTO_EXTENSIONS,
].join(',')

const RAW_EXTENSION_SET = new Set<string>(RAW_PHOTO_EXTENSIONS)
const RAW_MIME_SET = new Set<string>(RAW_MIME_TYPES)
const GENERIC_RAW_UPLOAD_MIME_TYPES = new Set(['', 'application/octet-stream'])

export const normalizeUploadContentType = (
  contentType: string | null | undefined,
) => (contentType || '').split(';')[0]?.trim().toLowerCase() || ''

export const getFileExtension = (fileName: string | null | undefined) => {
  const cleanName = (fileName || '').split(/[?#]/)[0] || ''
  const lastDot = cleanName.lastIndexOf('.')
  if (lastDot < 0) return ''
  return cleanName.slice(lastDot).toLowerCase()
}

export const getRawMimeTypeForExtension = (
  fileName: string | null | undefined,
) => RAW_EXTENSION_MIME_TYPES[getFileExtension(fileName)]

export const isRawFileName = (fileName: string | null | undefined) =>
  RAW_EXTENSION_SET.has(getFileExtension(fileName))

export const isRawMimeType = (contentType: string | null | undefined) =>
  RAW_MIME_SET.has(normalizeUploadContentType(contentType))

export const isSupportedRawUpload = (
  fileName: string | null | undefined,
  contentType: string | null | undefined,
) => {
  if (!isRawFileName(fileName)) return false

  const normalizedContentType = normalizeUploadContentType(contentType)
  return (
    GENERIC_RAW_UPLOAD_MIME_TYPES.has(normalizedContentType) ||
    RAW_MIME_SET.has(normalizedContentType)
  )
}

export const isSupportedRawFile = (file: {
  name?: string | null
  type?: string | null
}) => isSupportedRawUpload(file.name, file.type)

export const getUploadContentType = (file: {
  name?: string | null
  type?: string | null
}) => {
  const contentType = normalizeUploadContentType(file.type)
  if (contentType) return contentType
  return isRawFileName(file.name) ? 'application/octet-stream' : ''
}
