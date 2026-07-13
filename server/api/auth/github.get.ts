import { settingsManager } from '~~/server/services/settings/settingsManager'
import {
  ensureUserPublicProfile,
  getUniqueUsername,
  prepareNewUserRecord,
} from '~~/server/utils/users'
import { getAuthCookieOptions } from '~~/server/utils/auth-cookie'

const _accessDeniedError = createError({
  statusCode: 403,
  statusMessage:
    'Access denied. Please contact the administrator to activate your account.',
})

async function onGithubOAuthSuccess(event: any, { user }: { user: any }) {
  const db = useDB()
  const userFromEmail = await db
    .select()
    .from(tables.users)
    .where(eq(tables.users.email, user.email || ''))
    .get()

  logger.app.info(
    'GitHub OAuth login:',
    user.email,
    userFromEmail ? 'Existing user' : 'New user',
  )

  if (!userFromEmail) {
    // create a new user without admin permission
    const createdUser = await db
      .insert(tables.users)
      .values(
        await prepareNewUserRecord(db, {
          username: await getUniqueUsername(
            db,
            user.name || user.login || 'user',
          ),
          email: user.email || '',
          avatar: user.avatar_url || null,
          createdAt: new Date(),
          role: 'user',
          isAdmin: 0,
          disabledAt: new Date(),
        }),
      )
      .returning()
      .get()
    await ensureUserPublicProfile(db, createdUser)
    // then reject login
    throw _accessDeniedError
  } else if (isDisabledUser(userFromEmail)) {
    throw _accessDeniedError
  } else {
    await setUserSession(
      event,
      { user: sanitizeSessionUser(userFromEmail) },
      {
        cookie: {
          ...getAuthCookieOptions(event),
        },
      },
    )
  }
  return sendRedirect(event, '/')
}

function onGithubOAuthError(_event: any, error: any) {
  logger.app.warn('GitHub OAuth login failed', error)
  throw createError({
    statusCode: 401,
    statusMessage: `Authentication failed: ${error.message || 'Unknown error'}`,
  })
}

export default eventHandler(async (event) => {
  const runtimeConfig = useRuntimeConfig(event) as any

  const enabled = await settingsManager.get<boolean>(
    'system',
    'auth.github.enabled' as any,
    Boolean(runtimeConfig.public?.oauth?.github?.enabled),
  )
  const clientIdFromSettings = await settingsManager.get<string>(
    'system',
    'auth.github.clientId' as any,
    '',
  )
  const clientSecretFromSettings = await settingsManager.get<string>(
    'system',
    'auth.github.clientSecret' as any,
    '',
  )

  const clientId =
    clientIdFromSettings ||
    runtimeConfig.oauth?.github?.clientId ||
    process.env.NUXT_OAUTH_GITHUB_CLIENT_ID ||
    ''
  const clientSecret =
    clientSecretFromSettings ||
    runtimeConfig.oauth?.github?.clientSecret ||
    process.env.NUXT_OAUTH_GITHUB_CLIENT_SECRET ||
    ''

  if (!enabled) {
    throw createError({
      statusCode: 403,
      statusMessage: 'GitHub OAuth login is disabled.',
    })
  }

  if (!clientId || !clientSecret) {
    throw createError({
      statusCode: 500,
      statusMessage:
        'GitHub OAuth is enabled but credentials are missing in system settings.',
    })
  }

  const handler = defineOAuthGitHubEventHandler({
    config: {
      clientId,
      clientSecret,
      emailRequired: true,
    },
    onSuccess: onGithubOAuthSuccess,
    onError: onGithubOAuthError,
  })

  return handler(event)
})
