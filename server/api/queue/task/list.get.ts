import { z } from 'zod'
import { desc, eq } from 'drizzle-orm'

/**
 * 获取所有队列任务记录列表
 */
export default defineEventHandler(async (event) => {
  await requireAdminSession(event)

  try {
    const query = getQuery(event)
    const { status, type } = await z
      .object({
        status: z
          .enum(['pending', 'in-stages', 'completed', 'failed'])
          .optional(),
        type: z
          .enum([
            'photo',
            'live-photo-video',
            'photo-reverse-geocoding',
            'photo-variants',
            'photo-erase-location',
          ])
          .optional(),
      })
      .parseAsync(query)

    const db = useDB()

    // 构建查询条件
    const conditions = []

    if (status) {
      conditions.push(eq(tables.pipelineQueue.status, status))
    }

    const whereCondition = conditions.length > 0 ? conditions[0] : undefined

    // 构建查询
    const queryBuilder = db
      .select({
        id: tables.pipelineQueue.id,
        payload: tables.pipelineQueue.payload,
        priority: tables.pipelineQueue.priority,
        attempts: tables.pipelineQueue.attempts,
        maxAttempts: tables.pipelineQueue.maxAttempts,
        status: tables.pipelineQueue.status,
        statusStage: tables.pipelineQueue.statusStage,
        errorMessage: tables.pipelineQueue.errorMessage,
        createdAt: tables.pipelineQueue.createdAt,
        completedAt: tables.pipelineQueue.completedAt,
      })
      .from(tables.pipelineQueue)
      .orderBy(desc(tables.pipelineQueue.createdAt))

    const tasks = await (
      whereCondition ? queryBuilder.where(whereCondition) : queryBuilder
    ).all()

    return {
      success: true,
      data: type ? tasks.filter((task) => task.payload?.type === type) : tasks,
    }
  } catch (error) {
    console.error('Failed to fetch task list:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch task list',
    })
  }
})
