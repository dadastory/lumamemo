import assert from 'node:assert/strict'
import { access, readFile } from 'node:fs/promises'
import { describe, it } from 'node:test'

const rootProfilePage = new URL('../app/pages/u/[publicId].vue', import.meta.url)
const indexProfilePage = new URL(
  '../app/pages/u/[publicId]/index.vue',
  import.meta.url,
)

describe('public profile page structure', () => {
  it('uses an index page so user-scoped child routes can render', async () => {
    await assert.rejects(access(rootProfilePage), { code: 'ENOENT' })
    await assert.doesNotReject(access(indexProfilePage))

    const indexPage = await readFile(indexProfilePage, 'utf8')
    assert.match(indexPage, /<PublicProfileMasonry\s+:public-id="publicId"/)
  })
})
