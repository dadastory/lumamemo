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
    const migrationDir = new URL(
      '../server/database/migrations/',
      import.meta.url,
    )
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

  it('registers the image variants SQLite migration in the Drizzle journal', () => {
    const migrationDir = new URL(
      '../server/database/migrations/',
      import.meta.url,
    )
    const migration = readFileSync(
      new URL('0014_photo_image_variants.sql', migrationDir),
      'utf8',
    )
    const journal = JSON.parse(
      readFileSync(new URL('meta/_journal.json', migrationDir), 'utf8'),
    )

    assert.match(migration, /ADD `image_variants` text/)
    assert.equal(
      journal.entries.some(
        (entry) => entry.tag === '0014_photo_image_variants',
      ),
      true,
    )
  })

  it('registers RAW photo version migrations for SQLite and Postgres', () => {
    const sqliteMigrationDir = new URL(
      '../server/database/migrations/',
      import.meta.url,
    )
    const postgresMigrationDir = new URL(
      '../server/database/migrations/postgres/',
      import.meta.url,
    )
    const sqliteMigration = readFileSync(
      new URL('0015_raw_photo_versions.sql', sqliteMigrationDir),
      'utf8',
    )
    const postgresMigration = readFileSync(
      new URL('0004_raw_photo_versions.sql', postgresMigrationDir),
      'utf8',
    )
    const journal = JSON.parse(
      readFileSync(new URL('meta/_journal.json', sqliteMigrationDir), 'utf8'),
    )

    assert.match(sqliteMigration, /CREATE TABLE `photo_assets`/)
    assert.match(sqliteMigration, /ADD `display_storage_key` text/)
    assert.match(postgresMigration, /CREATE TABLE IF NOT EXISTS "photo_assets"/)
    assert.match(
      postgresMigration,
      /ADD COLUMN IF NOT EXISTS "display_storage_key"/,
    )
    assert.equal(
      journal.entries.some((entry) => entry.tag === '0015_raw_photo_versions'),
      true,
    )
  })
})
