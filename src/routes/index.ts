import { defineRoute } from '../utils/factories.ts'

const route = defineRoute(
  {
    prefix: '/test',
    tags: ['health'],
  },
  async (app) => {
    app.get('/', { config: { auth: false } }, async () => {
      // throw new Error('Test error')
      return true
    })
  },
)

export default route
