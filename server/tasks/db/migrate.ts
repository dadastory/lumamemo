export default defineTask({
  meta: {
    name: 'db:migrate',
    description: 'Migrate the database',
  },
  async run() {
    const log = logger.dynamic('db')
    const db = useDB()

    log.info('Migrating database...')

    await db.migrate()

    log.success('Database migrated successfully.')

    return {
      result: 'success',
    }
  },
})
