import type { TypedRoutePlugin } from '../utils/factories.ts'

const route: TypedRoutePlugin = async (app) => {
  app.get('/test', { config: { auth: false } }, async () => {
    // throw new Error('Test error')
    return { success: true, message: 'ok' }
  })
}

export default route
