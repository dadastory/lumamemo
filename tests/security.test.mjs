import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  sanitizeSessionUser,
  serializeAdminPhoto,
  serializePublicPhoto,
} from '../server/utils/security.ts'

describe('security serializers', () => {
  const photo = {
    id: 'photo-1',
    title: 'Public photo',
    description: 'Visible description',
    width: 4000,
    height: 3000,
    aspectRatio: 1.333,
    dateTaken: '2024-01-02T03:04:05.000Z',
    storageKey: 'photos/private/original.jpg',
    thumbnailKey: 'photos/private/thumb.webp',
    fileSize: 123456,
    lastModified: '2024-01-03T00:00:00.000Z',
    originalUrl: '/storage/photos/private/original.jpg',
    thumbnailUrl: '/storage/photos/private/thumb.webp',
    thumbnailHash: 'thumbhash',
    tags: ['travel'],
    exif: {
      Make: 'Nikon',
      Model: 'P6000',
      FNumber: 2.7,
      ExposureTime: '1/125',
      ISO: 64,
      GPSLatitude: 43.4674,
      GPSLongitude: 11.8851,
      UserComment: 'private note',
      MotionPhoto: true,
    },
    latitude: 43.4674,
    longitude: 11.8851,
    country: 'Italy',
    city: 'Arezzo',
    locationName: 'Arezzo',
    isLivePhoto: false,
    livePhotoVideoUrl: '/storage/photos/private/video.mov',
    livePhotoVideoKey: 'photos/private/video.mov',
  }

  it('removes credentials from session users', () => {
    const safeUser = sanitizeSessionUser({
      id: 1,
      email: 'admin@example.com',
      username: 'admin',
      password: 'hashed-password',
      avatar: null,
      isAdmin: 1,
      createdAt: new Date('2024-01-01T00:00:00.000Z'),
    })

    assert.deepEqual(Object.keys(safeUser).sort(), [
      'avatar',
      'createdAt',
      'email',
      'id',
      'isAdmin',
      'username',
    ])
    assert.equal('password' in safeUser, false)
  })

  it('public photo serialization keeps display metadata without storage internals', () => {
    const publicPhoto = serializePublicPhoto(photo)

    assert.equal(publicPhoto.id, 'photo-1')
    assert.equal(publicPhoto.thumbnailUrl, '/image/photos/private/thumb.webp')
    assert.equal(publicPhoto.originalUrl, '/image/photos/private/original.jpg')
    assert.equal(publicPhoto.latitude, 43.4674)
    assert.equal(publicPhoto.longitude, 11.8851)
    assert.equal(publicPhoto.exif.Make, 'Nikon')
    assert.equal(publicPhoto.exif.Model, 'P6000')
    assert.equal(publicPhoto.exif.UserComment, undefined)
    assert.equal(publicPhoto.exif.MotionPhoto, undefined)
    assert.equal('storageKey' in publicPhoto, false)
    assert.equal('thumbnailKey' in publicPhoto, false)
    assert.equal('livePhotoVideoKey' in publicPhoto, false)
  })

  it('admin photo serialization preserves full fields', () => {
    const adminPhoto = serializeAdminPhoto(photo)

    assert.equal(adminPhoto.storageKey, 'photos/private/original.jpg')
    assert.equal(adminPhoto.thumbnailKey, 'photos/private/thumb.webp')
    assert.equal(adminPhoto.livePhotoVideoKey, 'photos/private/video.mov')
    assert.equal(adminPhoto.exif.UserComment, 'private note')
    assert.equal(adminPhoto.exif.MotionPhoto, true)
  })
})
