import { z } from 'zod'
import { settingsManager } from '~~/server/services/settings/settingsManager'

export default eventHandler(async (event) => {
  await requireFirstLaunch(event)

  const body = await readValidatedBody(
    event,
    z
      .object({
        provider: z.enum(['mapbox', 'maplibre']),
        token: z.string().optional().default(''),
        style: z.string().optional(),
      })
      .superRefine((map, ctx) => {
        if (map.provider === 'mapbox' && !map.token) {
          ctx.addIssue({
            code: 'custom',
            path: ['token'],
            message: 'Mapbox token is required',
          })
        }
      }).parse,
  )

  await settingsManager.set('map', 'provider', body.provider)

  if (body.provider === 'mapbox') {
    await settingsManager.set('map', 'mapbox.token', body.token)
    if (body.style) await settingsManager.set('map', 'mapbox.style', body.style)
  } else {
    await settingsManager.set('map', 'maplibre.token', body.token || '')
    if (body.style)
      await settingsManager.set('map', 'maplibre.style', body.style)
  }

  return { success: true }
})
