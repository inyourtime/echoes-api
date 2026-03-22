import fastifyRoutePreset from 'fastify-route-preset'
import { definePlugin } from '../utils/factories.ts'

export interface PresetOptions {
  tags?: readonly string[]
}

/**
 * Plugin for route preset
 *
 * @remarks
 * This plugin registers the route preset plugin
 */
const plugin = definePlugin({
  name: 'preset',
  plugin: async (app) => {
    app.register(fastifyRoutePreset, {
      skipHeadRoutes: true,
      onPresetRoute: (routeOptions, presetOptions: PresetOptions) => {
        if (typeof routeOptions.schema === 'object') {
          // use existing tags or preset tags
          routeOptions.schema.tags = routeOptions.schema.tags || presetOptions.tags
        } else {
          routeOptions.schema = {
            tags: presetOptions.tags,
          }
        }
      },
    })
  },
})

export default plugin
