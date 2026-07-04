import { z } from 'zod'
import { getAuthCookieOptions } from '~~/server/utils/auth-cookie'

const _invalidCredentialsError = createError({
  statusCode: 401,
  message: 'Invalid credentials',
})

export default eventHandler(async (event) => {
  const db = useDB()
  const { email, password } = await readValidatedBody(
    event,
    z.object({
      email: z.email(),
      password: z.string().min(6),
    }).parse,
  )

  const user = await db
    .select()
    .from(tables.users)
    .where(eq(tables.users.email, email))
    .get()

  if (!user) {
    throw _invalidCredentialsError
  }

  if (isDisabledUser(user)) {
    throw createError({
      statusCode: 403,
      message: 'User is disabled',
    })
  }

  if (!(await verifyPassword(user.password || '', password))) {
    throw _invalidCredentialsError
  }

  await setUserSession(
    event,
    { user: sanitizeSessionUser(user) },
    {
      cookie: {
        ...getAuthCookieOptions(event),
      },
    },
  )

  return setResponseStatus(event, 201)
})
