import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { getGlobeMapViewState } from '../app/utils/map-view-state.ts'

const assertViewState = (actual, expected) => {
  assert.equal(actual.zoom, expected.zoom)
  assert.ok(Math.abs(actual.longitude - expected.longitude) < 0.000001)
  assert.ok(Math.abs(actual.latitude - expected.latitude) < 0.000001)
}

describe('globe map view state', () => {
  it('centers on the only located photo with the main branch close zoom', () => {
    assertViewState(
      getGlobeMapViewState([{ longitude: 11.885127, latitude: 43.467448 }]),
      {
        longitude: 11.885127,
        latitude: 43.467448,
        zoom: 16,
      },
    )
  })

  it('uses main branch zoom thresholds for close photo groups', () => {
    assertViewState(
      getGlobeMapViewState([
        { longitude: 11.885127, latitude: 43.467448 },
        { longitude: 11.887127, latitude: 43.468448 },
      ]),
      {
        longitude: 11.886127,
        latitude: 43.467948,
        zoom: 16,
      },
    )
  })

  it('fits multiple located photos without using local map bounds', () => {
    assertViewState(
      getGlobeMapViewState([
        { longitude: 116.4, latitude: 39.9 },
        { longitude: 11.885127, latitude: 43.467448 },
      ]),
      {
        longitude: 64.1425635,
        latitude: 41.683724,
        zoom: 2,
      },
    )
  })

  it('uses a global fallback when there are no located photos', () => {
    assertViewState(getGlobeMapViewState([]), {
      longitude: -122.4,
      latitude: 37.8,
      zoom: 2,
    })
  })
})
