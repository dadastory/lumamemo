import { buildLocalMapStyle, getRequestOrigin } from '~~/server/utils/local-map-style'

export default defineEventHandler((event) => {
  setHeader(event, 'content-type', 'application/json; charset=utf-8')
  setHeader(event, 'cache-control', 'no-store, no-cache, must-revalidate')
  setHeader(event, 'pragma', 'no-cache')
  setHeader(event, 'expires', '0')
  return buildLocalMapStyle(getRequestOrigin(event))
})
