import {
  boolean,
  doublePrecision,
  integer,
  jsonb,
  pgTable,
  real,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core'
import type { NeededExif, PhotoImageVariants } from '~~/shared/types/photo'
import type { StorageConfig } from '../../services/storage'

type PipelineQueuePayload =
  | {
      type: 'photo'
      storageKey: string
      eraseLocation?: boolean
      ownerUserId?: number | null
    }
  | {
      type: 'live-photo-video'
      storageKey: string
      ownerUserId?: number | null
    }
  | {
      type: 'photo-reverse-geocoding'
      photoId: string
      latitude?: number | null
      longitude?: number | null
    }
  | {
      type: 'photo-erase-location'
      photoId: string
    }
  | {
      type: 'photo-variants'
      photoId: string
    }

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  username: text('name').notNull().unique(),
  email: text('email').notNull().unique(),
  password: text('password'),
  publicId: text('public_id').unique(),
  displayName: text('display_name'),
  profileTitle: text('profile_title'),
  profileSlogan: text('profile_slogan'),
  profileBio: text('profile_bio'),
  homepageVisibility: text('homepage_visibility', {
    enum: ['private', 'public'],
  })
    .default('private')
    .notNull(),
  avatar: text('avatar'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  isAdmin: integer('is_admin').default(0).notNull(),
  role: text('role', { enum: ['admin', 'user'] })
    .default('user')
    .notNull(),
  disabledAt: timestamp('disabled_at', { withTimezone: true }),
})

export const userInvites = pgTable('user_invites', {
  id: serial('id').primaryKey(),
  email: text('email').notNull(),
  tokenHash: text('token_hash').notNull().unique(),
  role: text('role', { enum: ['admin', 'user'] })
    .default('user')
    .notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  acceptedAt: timestamp('accepted_at', { withTimezone: true }),
  acceptedByUserId: integer('accepted_by_user_id').references(() => users.id, {
    onDelete: 'set null',
  }),
  createdByUserId: integer('created_by_user_id').references(() => users.id, {
    onDelete: 'set null',
  }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
})

export const photos = pgTable('photos', {
  id: text('id').primaryKey().unique(),
  title: text('title'),
  description: text('description'),
  width: integer('width'),
  height: integer('height'),
  aspectRatio: real('aspect_ratio'),
  dateTaken: text('date_taken'),
  storageKey: text('storage_key'),
  thumbnailKey: text('thumbnail_key'),
  fileSize: integer('file_size'),
  lastModified: text('last_modified'),
  originalUrl: text('original_url'),
  thumbnailUrl: text('thumbnail_url'),
  thumbnailHash: text('thumbnail_hash'),
  imageVariants: jsonb('image_variants').$type<PhotoImageVariants>(),
  tags: jsonb('tags').$type<string[]>(),
  exif: jsonb('exif').$type<NeededExif>(),
  latitude: doublePrecision('latitude'),
  longitude: doublePrecision('longitude'),
  country: text('country'),
  city: text('city'),
  locationName: text('location_name'),
  isLivePhoto: integer('is_live_photo').default(0).notNull(),
  livePhotoVideoUrl: text('live_photo_video_url'),
  livePhotoVideoKey: text('live_photo_video_key'),
  ownerUserId: integer('owner_user_id').references(() => users.id, {
    onDelete: 'set null',
  }),
  visibility: text('visibility', { enum: ['private', 'public'] })
    .default('private')
    .notNull(),
})

export const pipelineQueue = pgTable('pipeline_queue', {
  id: serial('id').primaryKey(),
  payload: jsonb('payload')
    .$type<PipelineQueuePayload>()
    .notNull()
    .default({
      type: 'photo',
      storageKey: '',
    } satisfies PipelineQueuePayload),
  priority: integer('priority').default(0).notNull(),
  attempts: integer('attempts').default(0).notNull(),
  maxAttempts: integer('max_attempts').default(3).notNull(),
  status: text('status', {
    enum: ['pending', 'in-stages', 'completed', 'failed'],
  })
    .notNull()
    .default('pending'),
  statusStage: text('status_stage', {
    enum: [
      'preprocessing',
      'metadata',
      'thumbnail',
      'variants',
      'exif',
      'motion-photo',
      'reverse-geocoding',
      'live-photo',
      'location-erase',
    ],
  }),
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
})

export const photoReactions = pgTable('photo_reactions', {
  id: serial('id').primaryKey(),
  photoId: text('photo_id')
    .notNull()
    .references(() => photos.id, { onDelete: 'cascade' }),
  reactionType: text('reaction_type', {
    enum: ['like', 'love', 'amazing', 'funny', 'wow', 'sad', 'fire', 'sparkle'],
  }).notNull(),
  fingerprint: text('fingerprint').notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
})

export const albums = pgTable('albums', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  description: text('description'),
  coverPhotoId: text('cover_photo_id').references(() => photos.id, {
    onDelete: 'set null',
  }),
  ownerUserId: integer('owner_user_id').references(() => users.id, {
    onDelete: 'set null',
  }),
  isHidden: boolean('is_hidden').default(false).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
})

export const albumPhotos = pgTable('album_photos', {
  id: serial('id').primaryKey(),
  albumId: integer('album_id')
    .notNull()
    .references(() => albums.id, { onDelete: 'cascade' }),
  photoId: text('photo_id')
    .notNull()
    .references(() => photos.id, { onDelete: 'cascade' }),
  position: real('position').notNull().default(1000000),
  addedAt: timestamp('added_at', { withTimezone: true }).notNull().defaultNow(),
})

export const settings = pgTable(
  'settings',
  {
    id: serial('id').primaryKey(),
    namespace: text('namespace').notNull().default('common'),
    key: text('key').notNull(),
    type: text('type', {
      enum: ['string', 'number', 'boolean', 'json'],
    }).notNull(),
    value: text('value'),
    defaultValue: text('default_value'),
    label: text('label'),
    description: text('description'),
    isPublic: boolean('is_public').default(false).notNull(),
    isReadonly: boolean('is_readonly').default(false).notNull(),
    isSecret: boolean('is_secret').default(false).notNull(),
    enum: jsonb('enum').$type<string[] | null>(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedBy: integer('updated_by').references(() => users.id, {
      onDelete: 'set null',
    }),
  },
  (t) => [uniqueIndex('idx_namespace_key').on(t.namespace, t.key)],
)

export const settings_storage_providers = pgTable(
  'settings_storage_providers',
  {
    id: serial('id').primaryKey(),
    name: text('name').notNull(),
    provider: text('provider', {
      enum: ['s3', 'local', 'openlist'],
    }).notNull(),
    config: jsonb('config').$type<StorageConfig>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
)
