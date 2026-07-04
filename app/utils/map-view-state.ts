export interface GlobeMapViewState {
  longitude: number
  latitude: number
  zoom: number
}

export interface LocatedPoint {
  longitude?: number | null
  latitude?: number | null
}

const defaultGlobeMapViewState: GlobeMapViewState = {
  longitude: -122.4,
  latitude: 37.8,
  zoom: 2,
}

const getZoomForCoordinateSpan = (maxDiff: number) => {
  if (maxDiff < 0.005) return 16
  if (maxDiff < 0.02) return 14
  if (maxDiff < 0.05) return 12
  if (maxDiff < 0.2) return 10
  if (maxDiff < 1) return 8
  if (maxDiff < 5) return 6
  if (maxDiff < 20) return 5
  if (maxDiff < 50) return 4
  return 2
}

const getPointsViewState = (points: LocatedPoint[]): GlobeMapViewState => {
  const locatedPoints = points.filter(
    (point) =>
      Number.isFinite(point.longitude) && Number.isFinite(point.latitude),
  )

  if (locatedPoints.length === 0) {
    return defaultGlobeMapViewState
  }

  if (locatedPoints.length === 1) {
    const point = locatedPoints[0]!
    return {
      longitude: point.longitude!,
      latitude: point.latitude!,
      zoom: getZoomForCoordinateSpan(0),
    }
  }

  const latitudes = locatedPoints.map((point) => point.latitude!)
  const longitudes = locatedPoints.map((point) => point.longitude!)

  const minLat = Math.min(...latitudes)
  const maxLat = Math.max(...latitudes)
  const minLng = Math.min(...longitudes)
  const maxLng = Math.max(...longitudes)

  return {
    longitude: (minLng + maxLng) / 2,
    latitude: (minLat + maxLat) / 2,
    zoom: getZoomForCoordinateSpan(Math.max(maxLat - minLat, maxLng - minLng)),
  }
}

export const getGlobeMapViewState = (points: LocatedPoint[]): GlobeMapViewState =>
  getPointsViewState(points)
