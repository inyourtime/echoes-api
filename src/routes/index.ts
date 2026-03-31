import { defineRoute } from '#utils/factories'

const route = defineRoute(
  {
    prefix: '/test',
    tags: ['health'],
  },
  async (app) => {
    app.get('/', { config: { auth: false } }, async () => {
      // throw new Error('Test error')
      return { success: true, message: 'ok' }
    })
  },
)

export default route
