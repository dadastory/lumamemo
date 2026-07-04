import { eq } from 'drizzle-orm'
import { z } from 'zod'

const paramsSchema = z.object({
  taskId: z
    .string()
    .regex(/^\d+$/)
    .transform((value) => Number(value)),
})

const DELETABLE_TASK_STATUSES = ['completed', 'failed']

export default defineEventHandler(async (event) => {
  await requireAdminSession(event)
  const { taskId } = await getValidatedRouterParams(event, paramsSchema.parse)
  const db = useDB()

  const task = await db
    .select()
    .from(tables.pipelineQueue)
    .where(eq(tables.pipelineQueue.id, taskId))
    .get()

  if (!task) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Task not found',
    })
  }

  if (!DELETABLE_TASK_STATUSES.includes(task.status)) {
    throw createError({
      statusCode: 400,
      statusMessage:
        'Only completed or failed tasks can be deleted; pending and in-stages tasks are active',
    })
  }

  await db
    .delete(tables.pipelineQueue)
    .where(eq(tables.pipelineQueue.id, taskId))
    .run()

  return {
    success: true,
    message: `Task ${taskId} deleted`,
    deletedCount: 1,
    taskId,
  }
})
