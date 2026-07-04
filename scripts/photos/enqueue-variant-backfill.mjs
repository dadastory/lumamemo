#!/usr/bin/env node

const baseUrl = (
  process.env.CHRONOFRAME_BASE_URL || 'http://localhost:3000'
).replace(/\/+$/, '')
const cookie = process.env.CHRONOFRAME_COOKIE || ''

if (!cookie) {
  console.error(
    'CHRONOFRAME_COOKIE is required to enqueue variant backfill tasks.',
  )
  console.error(
    'Example: CHRONOFRAME_COOKIE="session=..." node scripts/photos/enqueue-variant-backfill.mjs',
  )
  process.exit(1)
}

const headers = {
  cookie,
  'content-type': 'application/json',
}

const request = async (path, options = {}) => {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      ...headers,
      ...options.headers,
    },
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(
      `${options.method || 'GET'} ${path} failed: ${response.status} ${body}`,
    )
  }

  return await response.json()
}

const photos = await request('/api/photos')
const tasks = photos
  .filter((photo) => photo.id && photo.storageKey)
  .map((photo) => ({
    payload: {
      type: 'photo-variants',
      photoId: photo.id,
    },
    priority: 1,
    maxAttempts: 3,
  }))

if (tasks.length === 0) {
  console.log('No photos with original storage keys found.')
  process.exit(0)
}

const result = await request('/api/queue/add-tasks', {
  method: 'POST',
  body: JSON.stringify({
    tasks,
    defaultPriority: 1,
    defaultMaxAttempts: 3,
  }),
})

console.log(`Enqueued ${tasks.length} photo variant backfill task(s).`)
console.log(JSON.stringify(result, null, 2))
