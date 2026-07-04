import { settingsManager } from '~~/server/services/settings/settingsManager'
import { discoverOidc, fetchOidcProfile } from '~~/server/utils/oidc'
import {
  ensureUserPublicProfile,
  getUniqueUsername,
  prepareNewUserRecord,
} from '~~/server/utils/users'
import { getAuthCookieOptions } from '~~/server/utils/auth-cookie'

const getOidcConfig = async (event: any) => {
  const runtimeConfig = useRuntimeConfig(event) as any
  return {
    issuer: await settingsManager.get<string>(
      'system',
      'auth.oidc.issuer' as any,
      runtimeConfig.oauth?.oidc?.issuer || '',
    ),
    clientId: await settingsManager.get<string>(
      'system',
      'auth.oidc.clientId' as any,
      runtimeConfig.oauth?.oidc?.clientId || '',
    ),
    clientSecret: await settingsManager.get<string>(
      'system',
      'auth.oidc.clientSecret' as any,
      runtimeConfig.oauth?.oidc?.clientSecret || '',
    ),
    clientAuthMethod:
      (await settingsManager.get<string>(
        'system',
        'auth.oidc.clientAuthMethod' as any,
        runtimeConfig.oauth?.oidc?.clientAuthMethod || 'client_secret_post',
      )) || 'client_secret_post',
  }
}

const exchangeCode = async (
  endpoint: string,
  config: Awaited<ReturnType<typeof getOidcConfig>>,
  code: string,
  redirectUri: string,
  verifier: string,
) => {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    client_id: config.clientId || '',
    code_verifier: verifier,
  })
  const headers: Record<string, string> = {
    'content-type': 'application/x-www-form-urlencoded',
  }

  if (config.clientSecret) {
    if (config.clientAuthMethod === 'client_secret_basic') {
      headers.Authorization = `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64')}`
    } else {
      body.set('client_secret', config.clientSecret)
    }
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body,
  })

  if (!response.ok) {
    throw createError({
      statusCode: 401,
      statusMessage: 'OIDC token exchange failed',
    })
  }

  return (await response.json()) as {
    access_token: string
    id_token?: string
  }
}

export default eventHandler(async (event) => {
  const query = getQuery(event)
  const code = typeof query.code === 'string' ? query.code : ''
  const state = typeof query.state === 'string' ? query.state : ''
  const expectedState = getCookie(event, 'cf_oidc_state')
  const verifier = getCookie(event, 'cf_oidc_verifier')

  deleteCookie(event, 'cf_oidc_state', { path: '/' })
  deleteCookie(event, 'cf_oidc_verifier', { path: '/' })

  if (
    !code ||
    !state ||
    !expectedState ||
    state !== expectedState ||
    !verifier
  ) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Invalid OIDC callback state',
    })
  }

  const config = await getOidcConfig(event)
  if (!config.issuer || !config.clientId) {
    throw createError({
      statusCode: 500,
      statusMessage: 'OIDC configuration is incomplete',
    })
  }

  const redirectUri = `${getRequestURL(event).origin}/api/auth/oidc/callback`
  const discovery = await discoverOidc(config.issuer)
  const tokens = await exchangeCode(
    discovery.token_endpoint,
    config,
    code,
    redirectUri,
    verifier,
  )
  const profile = await fetchOidcProfile(
    discovery,
    tokens.access_token,
    tokens.id_token,
  )
  const db = useDB()

  const existingUser = await db
    .select()
    .from(tables.users)
    .where(eq(tables.users.email, profile.email))
    .get()

  if (!existingUser) {
    const createdUser = await db
      .insert(tables.users)
      .values(
        await prepareNewUserRecord(db, {
          email: profile.email,
          username: await getUniqueUsername(db, profile.username),
          avatar: profile.avatar,
          createdAt: new Date(),
          role: 'user',
          isAdmin: 0,
          disabledAt: new Date(),
        }),
      )
      .returning()
      .get()
    await ensureUserPublicProfile(db, createdUser)

    throw createError({
      statusCode: 403,
      statusMessage:
        'OIDC account created and is waiting for administrator approval.',
    })
  }

  if (isDisabledUser(existingUser)) {
    throw createError({
      statusCode: 403,
      statusMessage: 'User is disabled',
    })
  }

  await setUserSession(
    event,
    { user: sanitizeSessionUser(existingUser) },
    {
      cookie: {
        ...getAuthCookieOptions(event),
      },
    },
  )

  return sendRedirect(event, '/')
})
