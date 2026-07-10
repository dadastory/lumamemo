import z from 'zod'

export default defineEventHandler(async (event) => {
  const session = await requireActiveUserSession(event)

  try {
    const { taskId } = await getValidatedRouterParams(
      event,
      z.object({
        taskId: z.string().nonempty(),
      }).parse,
    )

    const workerPool = globalThis.__workerPool
    if (!workerPool) {
      throw createError({
        statusCode: 503,
        statusMessage: 'Worker pool not initialized',
      })
    }

    const taskStats = await workerPool.getTaskStatus(Number(taskId))
    if (!taskStats) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Task not found',
      })
    }

    if (taskStats.payload?.ownerUserId !== session.user.id) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Cannot read another user task',
      })
    }

    return taskStats
  } catch (error) {
    if ((error as any).statusCode) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage:
        error instanceof Error ? error.message : 'Failed to get queue status',
    })
  }
})
