import {
  ensureUserPublicProfile,
  prepareNewUserRecord,
} from '~~/server/utils/users'

export default defineTask({
  meta: {
    name: 'db:seed',
    description: 'Seed the database with default admin user',
  },
  async run() {
    const log = logger.dynamic('db')
    const db = useDB()

    log.info('Seeding database with default admin user...')
    const users = await db.select().from(tables.users).all()

    if (users.length > 0) {
      log.info('User already exists, skipping seeding.')
    } else {
      log.info('No users found, creating default admin user...')
      const user = await db
        .insert(tables.users)
        .values(
          await prepareNewUserRecord(db, {
            username: process.env.LUMAMEMO_ADMIN_NAME || 'lumamemo',
            email: process.env.LUMAMEMO_ADMIN_EMAIL || 'admin@lumamemo.local',
            password: await hashPassword(
              process.env.LUMAMEMO_ADMIN_PASSWORD || 'LM1234@!',
            ),
            createdAt: new Date(),
            isAdmin: 1,
            role: 'admin',
          }),
        )
        .returning()
        .get()
      await ensureUserPublicProfile(db, user)
      log.success('Default admin user created.')
    }

    return {
      result: 'success',
    }
  },
})
