type EnvLike = Record<string, string | undefined>

const stringValue = (env: EnvLike, key: string, fallback = '') =>
  env[key] ?? fallback

const booleanValue = (env: EnvLike, key: string, fallback = false) => {
  const value = env[key]
  if (value == null || value === '') return fallback
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase())
}

const storageProvider = (value: string | undefined) => {
  if (value === 's3' || value === 'openlist' || value === 'local') {
    return value
  }
  return 'local'
}

const mapProvider = (value: string | undefined) => {
  if (value === 'mapbox' || value === 'maplibre') {
    return value
  }
  return 'maplibre'
}

export const getWizardStorageDefaults = (env: EnvLike = process.env) => ({
  provider: storageProvider(env.NUXT_STORAGE_PROVIDER),
  name: 'Default Storage',
  'local.basePath': stringValue(
    env,
    'NUXT_PROVIDER_LOCAL_PATH',
    './data/storage',
  ),
  'local.baseUrl': stringValue(env, 'NUXT_PROVIDER_LOCAL_BASE_URL', '/storage'),
  'local.prefix': 'photos/',
  's3.endpoint': stringValue(env, 'NUXT_PROVIDER_S3_ENDPOINT'),
  's3.bucket': stringValue(env, 'NUXT_PROVIDER_S3_BUCKET'),
  's3.region': stringValue(env, 'NUXT_PROVIDER_S3_REGION', 'auto'),
  's3.accessKeyId': stringValue(env, 'NUXT_PROVIDER_S3_ACCESS_KEY_ID'),
  's3.secretAccessKey': stringValue(env, 'NUXT_PROVIDER_S3_SECRET_ACCESS_KEY'),
  's3.prefix': stringValue(env, 'NUXT_PROVIDER_S3_PREFIX', 'photos/'),
  's3.cdnUrl': stringValue(env, 'NUXT_PROVIDER_S3_CDN_URL'),
  's3.forcePathStyle': booleanValue(
    env,
    'NUXT_PROVIDER_S3_FORCE_PATH_STYLE',
    false,
  ),
  's3.maxKeys': 1000,
  'openlist.baseUrl': stringValue(env, 'NUXT_PROVIDER_OPENLIST_BASE_URL'),
  'openlist.rootPath': stringValue(
    env,
    'NUXT_PROVIDER_OPENLIST_ROOT_PATH',
    '/photos',
  ),
  'openlist.token': stringValue(env, 'NUXT_PROVIDER_OPENLIST_TOKEN'),
  'openlist.cdnUrl': stringValue(env, 'NUXT_PROVIDER_OPENLIST_CDN_URL'),
  'openlist.uploadEndpoint': stringValue(
    env,
    'NUXT_PROVIDER_OPENLIST_ENDPOINT_UPLOAD',
    '/api/fs/put',
  ),
  'openlist.downloadEndpoint': stringValue(
    env,
    'NUXT_PROVIDER_OPENLIST_ENDPOINT_DOWNLOAD',
  ),
  'openlist.listEndpoint': stringValue(
    env,
    'NUXT_PROVIDER_OPENLIST_ENDPOINT_LIST',
  ),
  'openlist.deleteEndpoint': stringValue(
    env,
    'NUXT_PROVIDER_OPENLIST_ENDPOINT_DELETE',
    '/api/fs/remove',
  ),
  'openlist.metaEndpoint': stringValue(
    env,
    'NUXT_PROVIDER_OPENLIST_ENDPOINT_META',
    '/api/fs/get',
  ),
  'openlist.pathField': stringValue(
    env,
    'NUXT_PROVIDER_OPENLIST_PATH_FIELD',
    'path',
  ),
})

export const getWizardMapDefaults = (env: EnvLike = process.env) => ({
  provider: mapProvider(env.NUXT_PUBLIC_MAP_PROVIDER),
  'mapbox.token': stringValue(env, 'NUXT_PUBLIC_MAPBOX_ACCESS_TOKEN'),
  'mapbox.style': stringValue(
    env,
    'NUXT_PUBLIC_MAP_MAPBOX_STYLE',
    'mapbox://styles/mapbox/standard',
  ),
  'maplibre.token': stringValue(env, 'NUXT_PUBLIC_MAP_MAPLIBRE_TOKEN'),
  'maplibre.style': stringValue(
    env,
    'NUXT_PUBLIC_MAP_MAPLIBRE_STYLE',
    '/maps/style.json?v=global',
  ),
})
