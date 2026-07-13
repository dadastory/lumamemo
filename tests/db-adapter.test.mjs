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

  it('keeps SQLite baseline in sync with user profile columns', () => {
    const migrationDir = new URL(
      '../server/database/migrations/',
      import.meta.url,
    )
    const sqliteMigrationFiles = readdirSync(migrationDir)
      .filter((file) => /^\d+_.+\.sql$/.test(file))
      .sort()
    const sqliteMigrations = sqliteMigrationFiles
      .map((file) => readFileSync(new URL(file, migrationDir), 'utf8'))
      .join('\n')

    assert.deepEqual(sqliteMigrationFiles, ['0000_initial.sql'])

    for (const columnName of [
      'public_id',
      'display_name',
      'profile_title',
      'profile_slogan',
      'profile_bio',
      'homepage_visibility',
      'storage_quota_bytes',
    ]) {
      assert.match(
        sqliteMigrations,
        new RegExp(`\`${columnName}\``),
        `SQLite baseline must include users.${columnName}`,
      )
    }

    assert.match(sqliteMigrations, /users_public_id_unique/)
  })

  it('registers the SQLite baseline in the Drizzle journal', () => {
    const migrationDir = new URL(
      '../server/database/migrations/',
      import.meta.url,
    )
    const migration = readFileSync(
      new URL('0000_initial.sql', migrationDir),
      'utf8',
    )
    const journal = JSON.parse(
      readFileSync(new URL('meta/_journal.json', migrationDir), 'utf8'),
    )

    assert.match(migration, /`image_variants` text/)
    assert.deepEqual(journal.entries.map((entry) => entry.tag), ['0000_initial'])
  })

  it('keeps RAW photo version columns in SQLite and Postgres baselines', () => {
    const sqliteMigrationDir = new URL(
      '../server/database/migrations/',
      import.meta.url,
    )
    const postgresMigrationDir = new URL(
      '../server/database/migrations/postgres/',
      import.meta.url,
    )
    const sqliteMigration = readFileSync(
      new URL('0000_initial.sql', sqliteMigrationDir),
      'utf8',
    )
    const postgresMigration = readFileSync(
      new URL('0000_initial.sql', postgresMigrationDir),
      'utf8',
    )

    assert.match(sqliteMigration, /CREATE TABLE `photo_assets`/)
    assert.match(sqliteMigration, /`display_storage_key` text/)
    assert.match(postgresMigration, /CREATE TABLE "photo_assets"/)
    assert.match(postgresMigration, /"display_storage_key" text/)
  })
})
