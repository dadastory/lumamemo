import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

import {
  buildInternalUploadTarget,
  shouldUseBrowserDirectUpload,
} from '../server/utils/upload-target.ts'
import { resolveS3ObjectKey } from '../server/services/storage/providers/s3.ts'

const readSource = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

describe('single gateway upload routing', () => {
  it('builds same-origin upload targets for browser uploads', () => {
    assert.deepEqual(buildInternalUploadTarget('photos/users/1/a b.jpg'), {
      signedUrl: '/api/photos/upload?key=photos%2Fusers%2F1%2Fa%20b.jpg',
      fileKey: 'photos/users/1/a b.jpg',
      expiresIn: 3600,
    })
  })

  it('does not use browser-direct S3 uploads in single-origin mode', () => {
    assert.equal(
      shouldUseBrowserDirectUpload({
        config: { provider: 's3', endpoint: 'http://minio:9000' },
        getSignedUrl: async () => 'http://minio:9000/bucket/key',
      }),
      false,
    )
  })

  it('does not duplicate the configured S3 prefix when uploading internally', () => {
    assert.equal(
      resolveS3ObjectKey('photos/', 'photos/users/1/a.jpg'),
      'photos/users/1/a.jpg',
    )
    assert.equal(
      resolveS3ObjectKey('photos/', 'users/1/a.jpg'),
      'photos/users/1/a.jpg',
    )
  })

  it('resolves Docker service upstreams dynamically after app container rebuilds', () => {
    const source = readSource('third-party/middleware/gateway/nginx.conf')

    assert.match(source, /resolver 127\.0\.0\.11/)
    assert.match(source, /set \$chronoframe_upstream http:\/\/chronoframe:3000;/)
    assert.match(source, /proxy_pass \$chronoframe_upstream;/)
    assert.match(source, /proxy_pass \$chronoframe_upstream\/api\/maps\/style\.json\$is_args\$args;/)
    assert.doesNotMatch(source, /proxy_pass http:\/\/chronoframe:3000/)
  })

  it('resolves the local Nominatim upstream dynamically after service rebuilds', () => {
    const source = readSource('third-party/middleware/gateway/nginx.conf')

    assert.match(source, /set \$nominatim_upstream http:\/\/nominatim:8080;/)
    assert.match(source, /location \/nominatim\//)
    assert.match(source, /rewrite \^\/nominatim\/\(\.\*\)\$ \/\$1 break;/)
    assert.match(source, /proxy_pass \$nominatim_upstream;/)
    assert.doesNotMatch(source, /proxy_pass http:\/\/nominatim:8080\//)
  })

  it('keeps local middleware data out of the Docker build context', () => {
    const source = readSource('.dockerignore')

    assert.match(source, /^data\/$/m)
    assert.match(source, /^third-party\/middleware\/data\/$/m)
  })

  it('includes middleware services from the repository root data directory', () => {
    const source = readSource('docker-compose.yml')

    assert.match(source, /include:\s*\n\s+- path: third-party\/middleware\/docker-compose\.yml/)
    assert.match(source, /project_directory: \./)
    assert.doesNotMatch(
      source,
      /include:\s*\n\s+- third-party\/middleware\/docker-compose\.yml/,
    )
  })
})
