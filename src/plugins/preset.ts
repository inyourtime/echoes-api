import type { FastifyInstance, FastifySchema, RouteOptions } from 'fastify'
import fastifyRoutePreset from 'fastify-route-preset'
import { definePlugin } from '../utils/factories.ts'

export interface PresetOptions {
  tags?: readonly string[]
}

function ensureSchema(routeOptions: RouteOptions) {
  routeOptions.schema ??= {}
  return routeOptions.schema
}

function ensureResponseSchema(schema: FastifySchema) {
  schema.response ??= {}
  return schema.response as Record<number, unknown>
}

function applyTags(routeOptions: RouteOptions, presetOptions: PresetOptions) {
  const schema = ensureSchema(routeOptions)
  schema.tags ??= presetOptions.tags
}

function applyAuth(app: FastifyInstance, routeOptions: RouteOptions) {
  const schema = ensureSchema(routeOptions)
  const isAuthEnabled = routeOptions.config?.auth !== false

  if (isAuthEnabled) {
    const existing = routeOptions.onRequest ?? []
    routeOptions.onRequest = [
      // Apply authentication first
      app.authenticate,
      ...(Array.isArray(existing) ? existing : [existing]),
    ]
    schema.security = [{ bearerAuth: [] }]

    // Add 401 response schema for authenticated routes
    const responseSchema = ensureResponseSchema(schema)
    responseSchema[401] = {
      $ref: 'responses#/properties/unauthorized',
      description: 'Unauthorized',
    }
  } else {
    schema.security = []
  }
}

const plugin = definePlugin(
  {
    name: 'preset',
    dependencies: ['auth'],
  },
  async (app) => {
    app.register(fastifyRoutePreset, {
      skipHeadRoutes: true,
      onPresetRoute: (routeOptions, presetOptions: PresetOptions) => {
        applyTags(routeOptions, presetOptions)
        applyAuth(app, routeOptions)
      },
    })
  },
)

export default plugin
