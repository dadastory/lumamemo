import { defineConfig } from 'drizzle-kit'

const databaseProvider = (process.env.DATABASE_PROVIDER || 'sqlite').toLowerCase()

export default defineConfig(
  databaseProvider === 'postgres' || databaseProvider === 'postgresql'
    ? {
        dialect: 'postgresql',
        schema: './server/database/schema/postgres.ts',
        out: './server/database/migrations/postgres',
        dbCredentials: {
          url:
            process.env.DATABASE_URL ||
            'postgres://chronoframe:chronoframe-postgres-password@localhost:5432/chronoframe',
        },
      }
    : {
        dialect: 'sqlite',
        schema: './server/database/schema.ts',
        out: './server/database/migrations',
        dbCredentials: {
          url: process.env.DATABASE_URL || 'file:./data/app.sqlite3',
        },
      },
)
