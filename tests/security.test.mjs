import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it } from 'node:test'

import Database from 'better-sqlite3'

import {
  canManageOwnedResource,
  getUserDeletionRestrictions,
  getSafeUserSession,
  isAdminUser,
  isDisabledUser,
  isPhotoPublic,
  isSameUserId,
  requireActiveUserSession,
  resolvePhotoTaskOwnerUserId,
  sanitizeSessionUser,
  serializeAdminPhoto,
  serializePublicPhoto,
  getStorageKeyOwnerUserId,
  isStorageKeyInUserNamespace,
} from '../server/utils/security.ts'
import { getUserOwnedPhotoStorageKeys } from '../server/utils/photo-delete.ts'
import { LocalStorageProvider } from '../server/services/storage/providers/local.ts'

describe('security serializers', () => {
  const photo = {
    id: 'photo-1',
    title: 'Public photo',
    description: 'Visible description',
    width: 4000,
    height: 3000,
    aspectRatio: 1.333,
    dateTaken: '2024-01-02T03:04:05.000Z',
    storageKey: 'photos/private/original.jpg',
    thumbnailKey: 'photos/private/thumb.webp',
    fileSize: 123456,
    lastModified: '2024-01-03T00:00:00.000Z',
    originalUrl: '/storage/photos/private/original.jpg',
    thumbnailUrl: '/storage/photos/private/thumb.webp',
    thumbnailHash: 'thumbhash',
    imageVariants: {
      thumb: {
        key: 'photos/private/variants/photo-1/thumb.webp',
        url: '/storage/photos/private/variants/photo-1/thumb.webp',
        width: 320,
        height: 240,
        size: 12000,
        format: 'webp',
      },
      card: {
        key: 'photos/private/variants/photo-1/card.webp',
        url: '/storage/photos/private/variants/photo-1/card.webp',
        width: 960,
        height: 720,
        size: 64000,
        format: 'webp',
      },
      view: {
        key: 'photos/private/variants/photo-1/view.webp',
        url: '/storage/photos/private/variants/photo-1/view.webp',
        width: 2048,
        height: 1536,
        size: 220000,
        format: 'webp',
      },
    },
    tags: ['travel'],
    exif: {
      Make: 'Nikon',
      Model: 'P6000',
      FNumber: 2.7,
      ExposureTime: '1/125',
      ISO: 64,
      GPSLatitude: 43.4674,
      GPSLongitude: 11.8851,
      UserComment: 'private note',
      MotionPhoto: true,
    },
    latitude: 43.4674,
    longitude: 11.8851,
    country: 'Italy',
    city: 'Arezzo',
    locationName: 'Arezzo',
    isLivePhoto: false,
    livePhotoVideoUrl: '/storage/photos/private/video.mov',
    livePhotoVideoKey: 'photos/private/video.mov',
    ownerUserId: 2,
    ownerUsername: 'alice',
    ownerAvatar: '/avatar/alice.png',
    ownerEmail: 'alice@example.com',
  }

  it('removes credentials from session users', () => {
    const safeUser = sanitizeSessionUser({
      id: 1,
      email: 'admin@example.com',
      username: 'admin',
      password: 'hashed-password',
      avatar: null,
      isAdmin: 1,
      createdAt: new Date('2024-01-01T00:00:00.000Z'),
    })

    assert.deepEqual(Object.keys(safeUser).sort(), [
      'avatar',
      'createdAt',
      'disabledAt',
      'displayName',
      'email',
      'homepageVisibility',
      'id',
      'isAdmin',
      'profileBio',
      'profileSlogan',
      'profileTitle',
      'publicId',
      'role',
      'username',
    ])
    assert.equal('password' in safeUser, false)
    assert.equal(safeUser.role, 'admin')
    assert.equal(safeUser.disabledAt, null)
  })

  it('evaluates roles and disabled users consistently', () => {
    assert.equal(isAdminUser({ role: 'admin', isAdmin: 0 }), true)
    assert.equal(isAdminUser({ role: 'user', isAdmin: 1 }), false)
    assert.equal(isAdminUser({ role: null, isAdmin: 1 }), true)
    assert.equal(isAdminUser({ role: 'user', isAdmin: 0 }), false)

    assert.equal(isDisabledUser({ disabledAt: null }), false)
    assert.equal(
      isDisabledUser({ disabledAt: '2026-01-01T00:00:00.000Z' }),
      true,
    )
  })

  it('requires ownership for user-scoped resources even when the user is an admin', () => {
    assert.equal(canManageOwnedResource({ id: 1, role: 'admin' }, 2), false)
    assert.equal(canManageOwnedResource({ id: 1, role: 'admin' }, 1), true)
    assert.equal(canManageOwnedResource({ id: 1, role: 'user' }, 1), true)
    assert.equal(canManageOwnedResource({ id: 1, role: 'user' }, 2), false)
    assert.equal(canManageOwnedResource(null, 1), false)
  })

  it('compares user ids across serialized session and route param types', () => {
    assert.equal(isSameUserId('1', 1), true)
    assert.equal(isSameUserId(1, '1'), true)
    assert.equal(isSameUserId('01', 1), true)
    assert.equal(isSameUserId(1, 2), false)
    assert.equal(isSameUserId(null, 1), false)
  })

  it('blocks deleting the current user and the last active admin', () => {
    assert.deepEqual(
      getUserDeletionRestrictions(
        { id: '1', role: 'admin' },
        { id: 1, role: 'admin' },
        2,
      ),
      {
        isSelf: true,
        isLastActiveAdmin: false,
      },
    )
    assert.deepEqual(
      getUserDeletionRestrictions(
        { id: 2, role: 'admin' },
        { id: 1, role: 'admin' },
        1,
      ),
      {
        isSelf: false,
        isLastActiveAdmin: true,
      },
    )
    assert.deepEqual(
      getUserDeletionRestrictions(
        { id: 2, role: 'admin' },
        { id: 3, role: 'user' },
        1,
      ),
      {
        isSelf: false,
        isLastActiveAdmin: false,
      },
    )
  })

  it('does not rely on Nitro auto-imports inside session DB lookup', () => {
    const source = readFileSync(
      new URL('../server/utils/security.ts', import.meta.url),
      'utf8',
    )
    const helperSource = source.slice(
      source.indexOf('const getCurrentSessionUser'),
      source.indexOf('const clearInvalidSession'),
    )

    assert.match(
      helperSource,
      /const \{ useDB, tables, eq \} = await import\(['"]\.\/db\.ts['"]\)/,
    )
  })

  it('only treats explicitly public photos as public', () => {
    assert.equal(isPhotoPublic({ visibility: 'public' }), true)
    assert.equal(isPhotoPublic({ visibility: 'private' }), false)
    assert.equal(isPhotoPublic({ visibility: null }), false)
    assert.equal(isPhotoPublic({}), false)
  })

  it('accepts user storage namespaces with optional storage prefixes', () => {
    assert.equal(isStorageKeyInUserNamespace('users/2/a.jpg', 2), true)
    assert.equal(isStorageKeyInUserNamespace('/photos/users/2/a.jpg', 2), true)
    assert.equal(isStorageKeyInUserNamespace('photos/users/20/a.jpg', 2), false)
    assert.equal(isStorageKeyInUserNamespace('users/3/a.jpg', 2), false)
  })

  it('rejects storage namespaces with traversal or absolute paths', () => {
    assert.equal(isStorageKeyInUserNamespace('../users/2/a.jpg', 2), false)
    assert.equal(
      isStorageKeyInUserNamespace('users/2/../../evil.jpg', 2),
      false,
    )
    assert.equal(isStorageKeyInUserNamespace('/etc/users/2/a.jpg', 2), false)
    assert.equal(isStorageKeyInUserNamespace('users\\2\\a.jpg', 2), false)
  })

  it('blocks local storage writes outside the storage base path', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'chronoframe-storage-'))
    const basePath = join(tempDir, 'storage')
    const escapedPath = join(tempDir, 'escape.jpg')
    const provider = new LocalStorageProvider({
      provider: 'local',
      basePath,
      baseUrl: '/storage',
    })

    try {
      await assert.rejects(
        () => provider.create('users/2/../../../escape.jpg', Buffer.from('x')),
        /Invalid storage key/,
      )
      assert.equal(existsSync(escapedPath), false)
    } finally {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('extracts photo task owners from storage namespaces only', () => {
    assert.equal(getStorageKeyOwnerUserId('users/2/a.jpg'), 2)
    assert.equal(getStorageKeyOwnerUserId('/photos/users/25/a.jpg'), 25)
    assert.equal(
      getStorageKeyOwnerUserId('photos/users/not-a-user/a.jpg'),
      null,
    )
    assert.equal(getStorageKeyOwnerUserId('photos/public/a.jpg'), null)
  })

  it('resolves photo task owners without defaulting to the current admin', () => {
    assert.equal(
      resolvePhotoTaskOwnerUserId({
        storageKey: 'imports/legacy.jpg',
        existingOwnerUserId: 7,
        explicitOwnerUserId: 99,
      }),
      7,
    )
    assert.equal(
      resolvePhotoTaskOwnerUserId({
        storageKey: 'photos/users/8/new.jpg',
        explicitOwnerUserId: 99,
      }),
      8,
    )
    assert.equal(
      resolvePhotoTaskOwnerUserId({
        storageKey: 'imports/unknown.jpg',
        explicitOwnerUserId: 99,
      }),
      null,
    )
  })

  it('only allows user deletion to remove files in the target user namespace', () => {
    const photo = {
      storageKey: 'photos/users/4/original.heic',
      thumbnailKey: 'thumbnails/generated.webp',
      livePhotoVideoKey: 'photos/users/5/video.mov',
      imageVariants: {
        thumb: {
          key: 'photos/users/4/variants/photo-1/thumb.webp',
          url: '/storage/photos/users/4/variants/photo-1/thumb.webp',
        },
        card: {
          key: 'photos/users/4/variants/photo-1/card.webp',
          url: '/storage/photos/users/4/variants/photo-1/card.webp',
        },
        view: {
          key: 'photos/users/5/variants/photo-1/view.webp',
          url: '/storage/photos/users/5/variants/photo-1/view.webp',
        },
      },
    }

    assert.deepEqual(getUserOwnedPhotoStorageKeys(photo, 4), [
      'photos/users/4/original.heic',
      'photos/users/4/original.jpeg',
      'photos/users/4/variants/photo-1/thumb.webp',
      'photos/users/4/variants/photo-1/card.webp',
    ])
    assert.deepEqual(getUserOwnedPhotoStorageKeys(photo, 5), [
      'photos/users/5/video.mov',
      'photos/users/5/variants/photo-1/view.webp',
    ])
  })

  it('public photo serialization keeps display metadata without storage internals', () => {
    const publicPhoto = serializePublicPhoto(photo)

    assert.equal(publicPhoto.id, 'photo-1')
    assert.equal(publicPhoto.thumbnailUrl, '/image/photos/private/thumb.webp')
    assert.equal(publicPhoto.originalUrl, '/image/photos/private/original.jpg')
    assert.deepEqual(publicPhoto.imageVariants.thumb, {
      url: '/image/photos/private/variants/photo-1/thumb.webp',
      width: 320,
      height: 240,
      size: 12000,
      format: 'webp',
    })
    assert.equal('key' in publicPhoto.imageVariants.thumb, false)
    assert.equal(publicPhoto.latitude, 43.4674)
    assert.equal(publicPhoto.longitude, 11.8851)
    assert.equal(publicPhoto.exif.Make, 'Nikon')
    assert.equal(publicPhoto.exif.Model, 'P6000')
    assert.equal(publicPhoto.exif.UserComment, undefined)
    assert.equal(publicPhoto.exif.MotionPhoto, undefined)
    assert.deepEqual(publicPhoto.owner, {
      id: 2,
      username: 'alice',
      avatar: '/avatar/alice.png',
    })
    assert.equal('ownerUserId' in publicPhoto, false)
    assert.equal('photoFaces' in publicPhoto, false)
    assert.equal(
      JSON.stringify(publicPhoto).includes('alice@example.com'),
      false,
    )
    assert.equal('storageKey' in publicPhoto, false)
    assert.equal('thumbnailKey' in publicPhoto, false)
    assert.equal('livePhotoVideoKey' in publicPhoto, false)
  })

  it('admin photo serialization preserves full fields', () => {
    const adminPhoto = serializeAdminPhoto(photo)

    assert.equal(adminPhoto.storageKey, 'photos/private/original.jpg')
    assert.equal(adminPhoto.thumbnailKey, 'photos/private/thumb.webp')
    assert.equal(adminPhoto.livePhotoVideoKey, 'photos/private/video.mov')
    assert.equal(adminPhoto.thumbnailUrl, '/image/photos/private/thumb.webp')
    assert.equal(adminPhoto.originalUrl, '/image/photos/private/original.jpg')
    assert.deepEqual(adminPhoto.imageVariants.thumb, {
      key: 'photos/private/variants/photo-1/thumb.webp',
      url: '/image/photos/private/variants/photo-1/thumb.webp',
      width: 320,
      height: 240,
      size: 12000,
      format: 'webp',
    })
    assert.equal(
      adminPhoto.livePhotoVideoUrl,
      '/image/photos/private/video.mov',
    )
    assert.equal(adminPhoto.exif.UserComment, 'private note')
    assert.equal(adminPhoto.exif.MotionPhoto, true)
  })

  it('clears stale sessions when the user record no longer exists', async () => {
    const originalGlobals = {
      getUserSession: globalThis.getUserSession,
      requireUserSession: globalThis.requireUserSession,
      clearUserSession: globalThis.clearUserSession,
      createError: globalThis.createError,
    }
    const originalEnv = {
      DATABASE_PROVIDER: process.env.DATABASE_PROVIDER,
      DATABASE_URL: process.env.DATABASE_URL,
    }
    const tempDir = mkdtempSync(join(tmpdir(), 'chronoframe-security-'))
    process.env.DATABASE_PROVIDER = 'sqlite'
    process.env.DATABASE_URL = join(tempDir, 'app.sqlite3')

    const sqlite = new Database(process.env.DATABASE_URL)
    sqlite.exec(`
      CREATE TABLE users (
        id integer PRIMARY KEY AUTOINCREMENT,
        name text NOT NULL UNIQUE,
        email text NOT NULL UNIQUE,
        password text,
        public_id text UNIQUE,
        display_name text,
        profile_title text,
        profile_slogan text,
        profile_bio text,
        homepage_visibility text NOT NULL DEFAULT 'private',
        avatar text,
        created_at integer NOT NULL,
        is_admin integer NOT NULL DEFAULT 0,
        role text NOT NULL DEFAULT 'user',
        disabled_at integer
      )
    `)
    sqlite.close()

    const { closeDB } = await import('../server/utils/db.ts')

    const clearedEvents = []
    const event = {}
    const staleSession = {
      user: {
        id: 42,
        email: 'deleted@example.com',
        username: 'deleted',
        role: 'user',
      },
    }

    globalThis.getUserSession = async () => staleSession
    globalThis.requireUserSession = async () => staleSession
    globalThis.clearUserSession = async (clearedEvent) => {
      clearedEvents.push(clearedEvent)
    }
    globalThis.createError = (input) =>
      Object.assign(new Error(input.statusMessage), input)

    try {
      const safeSession = await getSafeUserSession(event)

      assert.equal(safeSession.user, null)
      assert.deepEqual(clearedEvents, [event])

      await assert.rejects(
        () => requireActiveUserSession(event),
        (error) =>
          error.statusCode === 401 &&
          error.statusMessage === 'Session user no longer exists',
      )
      assert.equal(clearedEvents.length, 2)
    } finally {
      for (const [key, value] of Object.entries(originalGlobals)) {
        if (value === undefined) {
          delete globalThis[key]
        } else {
          globalThis[key] = value
        }
      }
      closeDB()
      for (const [key, value] of Object.entries(originalEnv)) {
        if (value === undefined) {
          delete process.env[key]
        } else {
          process.env[key] = value
        }
      }
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('reloads session user state before authorizing photo visibility and storage', () => {
    const source = readFileSync(
      new URL('../server/utils/security.ts', import.meta.url),
      'utf8',
    )

    const visibilitySource = source.slice(
      source.indexOf('export async function isPhotoVisibleToRequest'),
      source.indexOf('export function storagePathMatches'),
    )
    const storageSource = source.slice(
      source.indexOf('export async function authorizePhotoStorageKey'),
      source.indexOf('export async function syncPhotoVisibility'),
    )

    assert.match(visibilitySource, /getSafeUserSession\(event\)/)
    assert.doesNotMatch(visibilitySource, /getUserSession\(event\)/)
    assert.match(storageSource, /getSafeUserSession\(event\)/)
    assert.doesNotMatch(storageSource, /getUserSession\(event\)/)
  })

  it('reloads session user state before filtering photo album membership', () => {
    const source = readFileSync(
      new URL('../server/api/photos/[photoId]/albums.get.ts', import.meta.url),
      'utf8',
    )

    assert.match(source, /getSafeUserSession\(event\)/)
    assert.doesNotMatch(source, /getUserSession\(event\)/)
  })

  it('does not let admin role bypass user-scoped upload, queue, and album routes', () => {
    const uploadApi = readFileSync(
      new URL('../server/api/photos/upload.put.ts', import.meta.url),
      'utf8',
    )
    const addTaskApi = readFileSync(
      new URL('../server/api/queue/add-task.post.ts', import.meta.url),
      'utf8',
    )
    const addTasksApi = readFileSync(
      new URL('../server/api/queue/add-tasks.post.ts', import.meta.url),
      'utf8',
    )
    const queueStatsApi = readFileSync(
      new URL('../server/api/queue/stats/[taskId].get.ts', import.meta.url),
      'utf8',
    )
    const photoAlbumsApi = readFileSync(
      new URL('../server/api/photos/[photoId]/albums.get.ts', import.meta.url),
      'utf8',
    )

    assert.doesNotMatch(uploadApi, /!isAdminUser\(session\.user\)/)
    assert.match(
      uploadApi,
      /!isStorageKeyInUserNamespace\(storageKey,\s*session\.user\.id\)/,
    )
    assert.doesNotMatch(addTaskApi, /isAdminUser\(session\.user\)/)
    assert.match(addTaskApi, /payload\.ownerUserId = session\.user\.id/)
    assert.match(addTaskApi, /payload\.ownerUserId = photo\.ownerUserId/)
    assert.doesNotMatch(addTasksApi, /requireAdminSession\(event\)/)
    assert.match(addTasksApi, /requireActiveUserSession\(event\)/)
    assert.match(addTasksApi, /payload\.ownerUserId = session\.user\.id/)
    assert.match(addTasksApi, /task\.payload\.ownerUserId = photo\.ownerUserId/)
    assert.doesNotMatch(queueStatsApi, /isAdminUser\(session\.user\)/)
    assert.match(
      queueStatsApi,
      /taskStats\.payload\?\.ownerUserId !== session\.user\.id/,
    )
    assert.doesNotMatch(photoAlbumsApi, /isAdminUser/)
    assert.doesNotMatch(photoAlbumsApi, /return isAdmin/)
    assert.match(
      photoAlbumsApi,
      /eq\(tables\.albums\.ownerUserId,\s*session\.user\.id\)/,
    )
  })

  it('does not proxy remote URLs through the thumbnail route', () => {
    const source = readFileSync(
      new URL(
        '../server/routes/thumb/[...thumbnailUrl].get.ts',
        import.meta.url,
      ),
      'utf8',
    )

    assert.doesNotMatch(source, /new URL\(url\)/)
    assert.doesNotMatch(source, /fetch\(fetchUrl\)/)
  })

  it('does not hardcode insecure authentication cookies', () => {
    const files = [
      '../server/api/login.post.ts',
      '../server/api/invitations/[token]/accept.post.ts',
      '../server/api/auth/github.get.ts',
      '../server/api/auth/oidc.get.ts',
      '../server/api/auth/oidc/callback.get.ts',
      '../server/api/wizard/submit.post.ts',
    ]

    for (const file of files) {
      const source = readFileSync(new URL(file, import.meta.url), 'utf8')
      assert.doesNotMatch(source, /secure:\s*false/)
    }

    const helperSource = readFileSync(
      new URL('../server/utils/auth-cookie.ts', import.meta.url),
      'utf8',
    )
    assert.match(helperSource, /x-forwarded-proto/)
    assert.match(helperSource, /secure:\s*!allowInsecureCookie && isHttps/)
    assert.doesNotMatch(helperSource, /NODE_ENV/)
  })

  it('does not inject analytics configuration with raw inline html', () => {
    const source = readFileSync(
      new URL('../app/plugins/analytics-tracker.client.ts', import.meta.url),
      'utf8',
    )

    assert.doesNotMatch(source, /innerHTML/)
    assert.doesNotMatch(source, /\$\{matomoUrl\}/)
    assert.match(source, /new URL\(/)
  })
})
