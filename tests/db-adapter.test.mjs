import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { describe, it } from 'node:test'

import {
  getMigrationFolder,
  normalizeDatabaseProvider,
} from '../server/utils/db.ts'

describe('database adapter config', () => {
  it('normalizes supported providers', () => {
    assert.equal(normalizeDatabaseProvider('sqlite'), 'sqlite')
    assert.equal(normalizeDatabaseProvider('SQLITE'), 'sqlite')
    assert.equal(normalizeDatabaseProvider('postgres'), 'postgres')
    assert.equal(normalizeDatabaseProvider('postgresql'), 'postgres')
  })

  it('rejects unsupported providers', () => {
    assert.throws(
      () => normalizeDatabaseProvider('mysql'),
      /Unsupported database provider/,
    )
  })

  it('uses provider-specific migration folders', () => {
    assert.equal(getMigrationFolder('sqlite'), 'server/database/migrations')
    assert.equal(
      getMigrationFolder('postgres'),
      'server/database/migrations/postgres',
    )
  })

  it('keeps SQLite migrations in sync with user profile columns', () => {
    const migrationDir = new URL('../server/database/migrations/', import.meta.url)
    const sqliteMigrations = readdirSync(migrationDir)
      .filter((file) => /^\d+_.+\.sql$/.test(file))
      .sort()
      .map((file) => readFileSync(new URL(file, migrationDir), 'utf8'))
      .join('\n')

    for (const columnName of [
      'public_id',
      'display_name',
      'profile_title',
      'profile_slogan',
      'profile_bio',
      'homepage_visibility',
    ]) {
      assert.match(
        sqliteMigrations,
        new RegExp(`ADD \`${columnName}\`|ADD COLUMN \`${columnName}\``),
        `SQLite migrations must add users.${columnName}`,
      )
    }

    assert.match(sqliteMigrations, /users_public_id_unique/)
  })
})
