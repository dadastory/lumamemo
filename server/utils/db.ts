import { existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

import Database from 'better-sqlite3'
import { drizzle as drizzleSqlite } from 'drizzle-orm/better-sqlite3'
import { migrate as migrateSqlite } from 'drizzle-orm/better-sqlite3/migrator'
import { drizzle as drizzlePostgres } from 'drizzle-orm/node-postgres'
import { eq, and } from 'drizzle-orm'
import pg from 'pg'

import * as sqliteSchema from '../database/schema.ts'
import * as postgresSchema from '../database/schema/postgres.ts'

export { eq, and }

type DatabaseProvider = 'sqlite' | 'postgres'
type AnyDb = any
type AnyQuery = any

const schemas = {
  sqlite: sqliteSchema,
  postgres: postgresSchema,
} satisfies Record<DatabaseProvider, Record<string, any>>

export const normalizeDatabaseProvider = (
  provider = process.env.DATABASE_PROVIDER || 'sqlite',
): DatabaseProvider => {
  const normalized = provider.toLowerCase()
  if (normalized === 'sqlite') return 'sqlite'
  if (normalized === 'postgres' || normalized === 'postgresql') return 'postgres'
  throw new Error(`Unsupported database provider "${provider}"`)
}

export const getMigrationFolder = (provider = getDatabaseProvider()) =>
  provider === 'postgres'
    ? 'server/database/migrations/postgres'
    : 'server/database/migrations'

export const tables = new Proxy({} as typeof sqliteSchema, {
  get(_target, prop) {
    return schemas[getDatabaseProvider()][prop as string]
  },
})

// 创建单例数据库连接
let dbInstance: AnyDb | null = null
let sqliteInstance: Database.Database | null = null
let postgresPool: pg.Pool | null = null
let migrationPromise: Promise<void> | null = null

export const getDatabaseProvider = () =>
  normalizeDatabaseProvider(process.env.DATABASE_PROVIDER || 'sqlite')

export const getSqliteDatabasePath = () =>
  process.env.DATABASE_URL && !process.env.DATABASE_URL.startsWith('postgres')
    ? process.env.DATABASE_URL
    : 'data/app.sqlite3'

const wrapQuery = (query: AnyQuery): AnyQuery => {
  if (!query || typeof query !== 'object') return query

  return new Proxy(query, {
    get(target, prop, receiver) {
      if (prop === 'get') {
        if (typeof target.get === 'function') {
          return (...args: any[]) => target.get(...args)
        }
        return async () => {
          const rows = await target
          return rows?.[0]
        }
      }

      if (prop === 'all') {
        if (typeof target.all === 'function') {
          return (...args: any[]) => target.all(...args)
        }
        return async () => await target
      }

      if (prop === 'run') {
        if (typeof target.run === 'function') {
          return (...args: any[]) => target.run(...args)
        }
        return async () => await target
      }

      if (prop === 'then' && typeof target.then === 'function') {
        return target.then.bind(target)
      }

      const value = Reflect.get(target, prop, receiver)
      if (typeof value !== 'function') return value

      return (...args: any[]) => {
        const result = value.apply(target, args)
        return result && typeof result === 'object' ? wrapQuery(result) : result
      }
    },
  })
}

const wrapDb = (db: AnyDb, provider: DatabaseProvider): AnyDb =>
  new Proxy(db, {
    get(target, prop, receiver) {
      if (prop === 'provider') return provider
      if (prop === 'schema') return schemas[provider]
      if (prop === 'migrate') {
        return () => migrateDatabase(provider, target)
      }
      if (prop === 'transaction') {
        return async (callback: (tx: AnyDb) => Promise<any> | any) => {
          if (provider === 'sqlite') {
            if (!sqliteInstance) throw new Error('SQLite connection is closed')
            sqliteInstance.exec('BEGIN')
            try {
              const result = await callback(wrapDb(target, provider))
              sqliteInstance.exec('COMMIT')
              return result
            } catch (error) {
              sqliteInstance.exec('ROLLBACK')
              throw error
            }
          }

          return target.transaction(async (tx: AnyDb) => {
            return await callback(wrapDb(tx, provider))
          })
        }
      }

      const value = Reflect.get(target, prop, receiver)
      if (typeof value !== 'function') return value

      return (...args: any[]) => {
        const result = value.apply(target, args)
        return result && typeof result === 'object' ? wrapQuery(result) : result
      }
    },
  })

async function migratePostgres() {
  if (!postgresPool) throw new Error('PostgreSQL connection is closed')

  const folder = resolve(getMigrationFolder('postgres'))
  if (!existsSync(folder)) {
    throw new Error(`PostgreSQL migration folder not found: ${folder}`)
  }

  const client = await postgresPool.connect()
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS __lumamemo_migrations (
        id serial PRIMARY KEY,
        name text NOT NULL UNIQUE,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `)

    const applied = new Set(
      (
        await client.query<{ name: string }>(
          'SELECT name FROM __lumamemo_migrations ORDER BY name',
        )
      ).rows.map((row) => row.name),
    )

    const files = readdirSync(folder)
      .filter((file) => file.endsWith('.sql'))
      .sort()

    for (const file of files) {
      if (applied.has(file)) continue

      const sqlText = readFileSync(resolve(folder, file), 'utf8')
      const statements = sqlText
        .split('--> statement-breakpoint')
        .map((statement) => statement.trim())
        .filter(Boolean)

      await client.query('BEGIN')
      try {
        for (const statement of statements) {
          await client.query(statement)
        }
        await client.query(
          'INSERT INTO __lumamemo_migrations (name) VALUES ($1)',
          [file],
        )
        await client.query('COMMIT')
      } catch (error) {
        await client.query('ROLLBACK')
        throw error
      }
    }
  } finally {
    client.release()
  }
}

async function migrateDatabase(provider: DatabaseProvider, db: AnyDb) {
  if (provider === 'postgres') {
    await migratePostgres()
    return
  }

  mkdirSync(dirname(resolve(getSqliteDatabasePath())), { recursive: true })
  await migrateSqlite(db, {
    migrationsFolder: resolve(getMigrationFolder('sqlite')),
  })
}

export function runDatabaseMigrationsOnce() {
  if (!migrationPromise) {
    migrationPromise = (async () => {
      const db = useDB()
      await db.migrate()
    })().catch((error) => {
      migrationPromise = null
      throw error
    })
  }

  return migrationPromise
}

export function waitForDatabaseMigrations() {
  return migrationPromise || runDatabaseMigrationsOnce()
}

export function useDB() {
  const provider = getDatabaseProvider()

  if (!dbInstance || !sqliteInstance) {
    if (provider === 'postgres') {
      if (!dbInstance || !postgresPool) {
        postgresPool = new pg.Pool({
          connectionString: process.env.DATABASE_URL,
        })
        dbInstance = wrapDb(
          drizzlePostgres(postgresPool, { schema: postgresSchema }),
          provider,
        )
      }
      return dbInstance
    }

    // 创建数据库连接，启用WAL模式以提高并发性能
    sqliteInstance = new Database(getSqliteDatabasePath(), {
      verbose:
        process.env.NODE_ENV === 'development'
          ? logger.dynamic('db').verbose
          : undefined,
    })

    // 启用WAL模式以提高并发性能
    sqliteInstance.pragma('journal_mode = WAL')
    sqliteInstance.pragma('synchronous = NORMAL')
    sqliteInstance.pragma('cache_size = 1000')
    sqliteInstance.pragma('temp_store = MEMORY')

    dbInstance = wrapDb(drizzleSqlite(sqliteInstance, { schema: sqliteSchema }), provider)
  }

  return dbInstance
}

// 优雅关闭数据库连接
export function closeDB() {
  if (sqliteInstance) {
    sqliteInstance.close()
    sqliteInstance = null
    dbInstance = null
  }
  if (postgresPool) {
    void postgresPool.end()
    postgresPool = null
    dbInstance = null
  }
}

export type User = typeof sqliteSchema.users.$inferSelect
export type UserInvite = typeof sqliteSchema.userInvites.$inferSelect
export type Photo = typeof sqliteSchema.photos.$inferSelect

export type PipelineQueueItem = typeof sqliteSchema.pipelineQueue.$inferSelect
export type NewPipelineQueueItem = typeof sqliteSchema.pipelineQueue.$inferInsert

export type PhotoReaction = typeof sqliteSchema.photoReactions.$inferSelect

export type Album = typeof sqliteSchema.albums.$inferSelect
export type NewAlbum = typeof sqliteSchema.albums.$inferInsert
export type AlbumPhoto = typeof sqliteSchema.albumPhotos.$inferSelect
export type NewAlbumPhoto = typeof sqliteSchema.albumPhotos.$inferInsert
export type AlbumWithPhotos = Album & {
  photos: Photo[]
}
