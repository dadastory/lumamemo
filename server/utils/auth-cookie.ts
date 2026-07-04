export const getAuthCookieOptions = (event: any) => {
  const config = useRuntimeConfig(event) as any
  const forwardedProto = String(getHeader(event, 'x-forwarded-proto') || '')
    .split(',')[0]
    .trim()
    .toLowerCase()
  const requestProtocol = getRequestURL(event).protocol
  const isHttps = forwardedProto === 'https' || requestProtocol === 'https:'
  const allowInsecureCookie =
    Boolean(config.allowInsecureCookie) ||
    process.env.NUXT_ALLOW_INSECURE_COOKIE === 'true'

  return {
    secure: !allowInsecureCookie && isHttps,
  }
}
