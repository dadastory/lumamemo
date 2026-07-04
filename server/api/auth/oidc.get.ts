import {
  buildOidcAuthorizationUrl,
  createPkceChallenge,
  discoverOidc,
  generateOidcState,
  generatePkceVerifier,
} from '~~/server/utils/oidc'
import { settingsManager } from '~~/server/services/settings/settingsManager'
import { getAuthCookieOptions } from '~~/server/utils/auth-cookie'

const getOidcConfig = async (event: any) => {
  const runtimeConfig = useRuntimeConfig(event) as any

  const enabled = await settingsManager.get<boolean>(
    'system',
    'auth.oidc.enabled' as any,
    Boolean(runtimeConfig.public?.oauth?.oidc?.enabled),
  )
  const issuer = await settingsManager.get<string>(
    'system',
    'auth.oidc.issuer' as any,
    runtimeConfig.oauth?.oidc?.issuer || '',
  )
  const clientId = await settingsManager.get<string>(
    'system',
    'auth.oidc.clientId' as any,
    runtimeConfig.oauth?.oidc?.clientId || '',
  )
  const scope = await settingsManager.get<string>(
    'system',
    'auth.oidc.scope' as any,
    runtimeConfig.oauth?.oidc?.scope || 'openid email profile',
  )

  return { enabled, issuer, clientId, scope }
}

export default eventHandler(async (event) => {
  const config = await getOidcConfig(event)

  if (!config.enabled) {
    throw createError({
      statusCode: 403,
      statusMessage: 'OIDC login is disabled.',
    })
  }

  if (!config.issuer || !config.clientId) {
    throw createError({
      statusCode: 500,
      statusMessage: 'OIDC is enabled but issuer or client ID is missing.',
    })
  }

  const state = generateOidcState()
  const verifier = generatePkceVerifier()
  const redirectUri = `${getRequestURL(event).origin}/api/auth/oidc/callback`
  const discovery = await discoverOidc(config.issuer)
  const authUrl = buildOidcAuthorizationUrl({
    authorizationEndpoint: discovery.authorization_endpoint,
    clientId: config.clientId,
    redirectUri,
    scope: config.scope || 'openid email profile',
    state,
    codeChallenge: createPkceChallenge(verifier),
  })

  setCookie(event, 'cf_oidc_state', state, {
    httpOnly: true,
    sameSite: 'lax',
    ...getAuthCookieOptions(event),
    path: '/',
    maxAge: 600,
  })
  setCookie(event, 'cf_oidc_verifier', verifier, {
    httpOnly: true,
    sameSite: 'lax',
    ...getAuthCookieOptions(event),
    path: '/',
    maxAge: 600,
  })

  return sendRedirect(event, authUrl.toString())
})
