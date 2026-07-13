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
    assert.match(source, /set \$lumamemo_upstream http:\/\/lumamemo:3000;/)
    assert.match(source, /proxy_pass \$lumamemo_upstream;/)
    assert.match(source, /proxy_pass \$lumamemo_upstream\/api\/maps\/style\.json\$is_args\$args;/)
    assert.doesNotMatch(source, /proxy_pass http:\/\/lumamemo:3000/)
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

  it('keeps third-party services optional from the default compose file', () => {
    const source = readSource('docker-compose.yml')

    assert.doesNotMatch(source, /include:/)
    assert.match(source, /^\s{2}postgres:/m)
    assert.match(source, /^\s{2}minio:/m)
    assert.match(source, /^\s{2}minio-init:/m)
    assert.doesNotMatch(source, /^\s{2}nominatim:/m)
    assert.doesNotMatch(source, /^\s{2}pmtiles:/m)
    assert.doesNotMatch(source, /^\s{2}maplibre:/m)
    assert.doesNotMatch(source, /^\s{2}lumamemo-qdrant:/m)
    assert.doesNotMatch(source, /^\s{2}lumamemo-localai:/m)
  })

  it('keeps optional middleware data under the repository root when explicitly enabled', () => {
    const source = readSource('third-party/middleware/docker-compose.yml')

    assert.match(source, /container_name: lumamemo_nominatim/)
    assert.match(source, /container_name: lumamemo_pmtiles/)
    assert.match(source, /container_name: lumamemo_maplibre/)
    assert.match(source, /\.\/data\/middleware\/nominatim/)
    assert.match(source, /\.\/data\/middleware\/pmtiles/)
    assert.match(source, /\.\/data\/middleware\/maplibre/)
  })
})
