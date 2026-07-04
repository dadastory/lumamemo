import { z } from 'zod'
import { settingsManager } from '~~/server/services/settings/settingsManager'
import { storageConfigSchema } from '~~/shared/types/storage'
import { useDB, tables, eq } from '~~/server/utils/db'
import {
  ensureUserPublicProfile,
  prepareNewUserRecord,
} from '~~/server/utils/users'
import { getAuthCookieOptions } from '~~/server/utils/auth-cookie'

export default eventHandler(async (event) => {
  await requireFirstLaunch(event)

  const body = await readValidatedBody(
    event,
    z.object({
      admin: z.object({
        email: z.string().email(),
        password: z.string().min(6),
        username: z.string().min(2).default('admin'),
      }),
      site: z.object({
        title: z.string().min(1),
        slogan: z.string().optional(),
        avatarUrl: z.string().optional(),
        author: z.string().optional(),
      }),
      storage: z.object({
        name: z.string().min(1),
        config: storageConfigSchema,
      }),
      map: z
        .object({
          provider: z.enum(['mapbox', 'maplibre']),
          token: z.string().optional().default(''),
          style: z.string().optional(),
        })
        .superRefine((map, ctx) => {
          if (map.provider === 'mapbox' && !map.token) {
            ctx.addIssue({
              code: 'custom',
              path: ['token'],
              message: 'Mapbox token is required',
            })
          }
        }),
    }).parse,
  )

  const db = useDB()

  // 1. Handle Admin User
  let adminUser: typeof tables.users.$inferSelect | undefined
  const existingUser = await db.select().from(tables.users).limit(1).get()
  if (existingUser) {
    if (existingUser.email === body.admin.email) {
      await db
        .update(tables.users)
        .set({
          password: await hashPassword(body.admin.password),
          username: body.admin.username,
          displayName: body.site.author || body.admin.username,
          profileTitle: body.site.title,
          profileSlogan: body.site.slogan || null,
          avatar: body.site.avatarUrl || null,
          isAdmin: 1,
          role: 'admin',
        })
        .where(eq(tables.users.id, existingUser.id))
        .run()
      adminUser = await db
        .select()
        .from(tables.users)
        .where(eq(tables.users.id, existingUser.id))
        .get()
    } else {
      throw createError({
        statusCode: 400,
        message: 'User already exists',
      })
    }
  } else {
    await db
      .insert(tables.users)
      .values(
        await prepareNewUserRecord(db, {
          email: body.admin.email,
          username: body.admin.username,
          displayName: body.site.author || body.admin.username,
          profileTitle: body.site.title,
          profileSlogan: body.site.slogan || null,
          avatar: body.site.avatarUrl || null,
          password: await hashPassword(body.admin.password),
          isAdmin: 1,
          role: 'admin',
          createdAt: new Date(),
        }),
      )
      .run()
    adminUser = await db
      .select()
      .from(tables.users)
      .where(eq(tables.users.email, body.admin.email))
      .get()
  }

  if (adminUser) {
    await ensureUserPublicProfile(db, adminUser)
  }

  // 2. Handle Storage Settings
  // Check if provider already exists to avoid duplicates if re-running?
  // For now, just add it.
  const id = await settingsManager.storage.addProvider({
    name: body.storage.name,
    provider: body.storage.config.provider,
    config: body.storage.config,
  })
  await settingsManager.set('storage', 'provider', id)

  // 3. Handle Map Settings
  await settingsManager.set('map', 'provider', body.map.provider)
  if (body.map.provider === 'mapbox') {
    await settingsManager.set('map', 'mapbox.token', body.map.token)
    if (body.map.style)
      await settingsManager.set('map', 'mapbox.style', body.map.style)
  } else {
    await settingsManager.set('map', 'maplibre.token', body.map.token || '')
    if (body.map.style)
      await settingsManager.set('map', 'maplibre.style', body.map.style)
  }

  // 4. Mark Complete
  await settingsManager.set('system', 'firstLaunch', false, undefined, true)

  // 5. Auto-login the admin user
  if (adminUser) {
    await setUserSession(
      event,
      { user: sanitizeSessionUser(adminUser) },
      {
        cookie: {
          ...getAuthCookieOptions(event),
        },
      },
    )
  }

  return { success: true }
})
