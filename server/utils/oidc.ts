import { createHash, randomBytes } from 'node:crypto'

export type OidcDiscovery = {
  issuer: string
  authorization_endpoint: string
  token_endpoint: string
  userinfo_endpoint?: string
}

export type OidcProfile = {
  sub?: string
  email?: string
  name?: string
  preferred_username?: string
  picture?: string
}

export const generateOidcState = () => randomBytes(24).toString('base64url')

export const generatePkceVerifier = () => randomBytes(32).toString('base64url')

export const createPkceChallenge = (verifier: string) =>
  createHash('sha256').update(verifier).digest('base64url')

export const buildOidcAuthorizationUrl = (options: {
  authorizationEndpoint: string
  clientId: string
  redirectUri: string
  scope: string
  state: string
  codeChallenge: string
}) => {
  const url = new URL(options.authorizationEndpoint)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('client_id', options.clientId)
  url.searchParams.set('redirect_uri', options.redirectUri)
  url.searchParams.set('scope', options.scope)
  url.searchParams.set('state', options.state)
  url.searchParams.set('code_challenge_method', 'S256')
  url.searchParams.set('code_challenge', options.codeChallenge)
  return url
}

const decodeJwtPayload = (token: string): Record<string, any> | null => {
  const [, payload] = token.split('.')
  if (!payload) return null
  try {
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
  } catch {
    return null
  }
}

export const normalizeOidcProfile = (profile: OidcProfile) => {
  const email = profile.email?.trim().toLowerCase()
  if (!profile.sub || !email) {
    throw createError({
      statusCode: 401,
      statusMessage: 'OIDC profile must include subject and email',
    })
  }

  return {
    subject: profile.sub,
    email,
    username:
      profile.preferred_username?.trim() ||
      profile.name?.trim() ||
      email.split('@')[0],
    avatar: profile.picture || null,
  }
}

export const discoverOidc = async (issuer: string): Promise<OidcDiscovery> => {
  const normalizedIssuer = issuer.replace(/\/+$/, '')
  const response = await fetch(
    `${normalizedIssuer}/.well-known/openid-configuration`,
  )
  if (!response.ok) {
    throw createError({
      statusCode: 502,
      statusMessage: 'Failed to discover OIDC provider',
    })
  }

  const discovery = (await response.json()) as OidcDiscovery
  if (!discovery.authorization_endpoint || !discovery.token_endpoint) {
    throw createError({
      statusCode: 502,
      statusMessage: 'OIDC provider metadata is incomplete',
    })
  }
  return discovery
}

export const fetchOidcProfile = async (
  discovery: OidcDiscovery,
  accessToken: string,
  idToken?: string,
) => {
  if (discovery.userinfo_endpoint) {
    const response = await fetch(discovery.userinfo_endpoint, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })
    if (response.ok) {
      return normalizeOidcProfile((await response.json()) as OidcProfile)
    }
  }

  const idTokenProfile = idToken ? decodeJwtPayload(idToken) : null
  return normalizeOidcProfile(idTokenProfile || {})
}
