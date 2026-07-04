import { runDatabaseMigrationsOnce } from '../utils/db'

const migrationLogger = logger.dynamic('db-migrate')

async function runMigrations() {
  await runDatabaseMigrationsOnce()
  migrationLogger.info('Database migration finished successfully')
}

export default defineNitroPlugin(async () => {
  await runMigrations().catch((error) => {
    migrationLogger.error('Database migration failed', error)
    throw error
  })
})
