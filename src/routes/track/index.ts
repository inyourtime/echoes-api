import Type from 'typebox'
import { defineRoute } from '../../utils/factories.ts'

const route = defineRoute(
  {
    prefix: '/track',
    tags: ['Track'],
  },
  async (app) => {
    app.get(
      '/search',
      {
        config: { auth: true },
        schema: {
          querystring: Type.Object({
            q: Type.String(),
          }),
        },
      },
      async () => {},
    )
  },
)

export default route
