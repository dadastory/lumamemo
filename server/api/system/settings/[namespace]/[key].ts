import { z } from 'zod'
import {
  settingKeys,
  settingNamespaces,
} from '~~/server/services/settings/contants'
import { settingsManager } from '~~/server/services/settings/settingsManager'
import { assertMachineLearningCanBeEnabled } from '~~/server/utils/ml-capabilities'
import { useDB, tables, eq } from '~~/server/utils/db'
import { validateStorageQuotaGB } from '~~/server/services/storage/quota'

export default eventHandler(async (event) => {
  const { namespace, key } = await getValidatedRouterParams(
    event,
    z.object({
      namespace: z.enum([...settingNamespaces]),
      key: z.enum([...settingKeys]),
    }).parse,
  )

  if (event.method === 'GET') {
    await requireAdminSession(event)

    try {
      const value = await settingsManager.get(namespace, key)
      return { namespace, key, value }
    } catch {
      throw createError({
        statusCode: 404,
        statusMessage: `Setting ${namespace}:${key} not found`,
      })
    }
  }

  if (event.method === 'PUT') {
    const session = await requireAdminSession(event)
    if (!session || !session.user.isAdmin) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Admin privileges required',
      })
    }

    const { value } = await readValidatedBody(
      event,
      z.object({
        value: z.any(),
      }).parse,
    )

    // 获取当前用户ID，如果用户不存在于数据库则返回null
    const db = useDB()
    const currentUser = session.user.id
      ? await db
          .select()
          .from(tables.users)
          .where(eq(tables.users.id, session.user.id))
          .get()
      : null
    const updatedBy = currentUser ? currentUser.id : undefined

    try {
      if (namespace === 'system' && key === 'storage.defaultUserQuotaGB') {
        validateStorageQuotaGB(value)
      }
      await assertMachineLearningCanBeEnabled(namespace, key, value)
      await settingsManager.set(namespace, key, value, updatedBy)
      return { namespace, key, value }
    } catch (err) {
      throw createError({
        statusCode: 400,
        statusMessage: (err as Error).message || 'Failed to update setting',
      })
    }
  }

  throw createError({ statusCode: 405 })
})
