import Type from 'typebox'
import { definePlugin } from '../utils/factories.ts'

export const TDate = Type.Unsafe<Date>({ type: 'string', format: 'date-time' })

const plugin = definePlugin(
  {
    name: 'shared-schemas',
  },
  async (app) => {
    app.addSchema(
      Type.Object(
        {
          badRequest: Type.Object(
            {
              statusCode: Type.Literal(400),
              error: Type.Literal('Bad Request'),
              message: Type.String({ examples: ['Bad Request'] }),
            },
            { title: '400 Bad Request' },
          ),
          unauthorized: Type.Object(
            {
              statusCode: Type.Literal(401),
              error: Type.Literal('Unauthorized'),
              message: Type.String({ examples: ['Unauthorized'] }),
            },
            { title: '401 Unauthorized' },
          ),
          internalServerError: Type.Object(
            {
              statusCode: Type.Literal(500),
              error: Type.Literal('Internal Server Error'),
              message: Type.String({ examples: ['Internal server error'] }),
            },
            { title: '500 Internal Server Error' },
          ),
          conflict: Type.Object(
            {
              statusCode: Type.Literal(409),
              error: Type.Literal('Conflict'),
              message: Type.String({ examples: ['Conflict'] }),
            },
            { title: '409 Conflict' },
          ),
          notFound: Type.Object(
            {
              statusCode: Type.Literal(404),
              error: Type.Literal('Not Found'),
              message: Type.String({ examples: ['Not Found'] }),
            },
            { title: '404 Not Found' },
          ),
          forbidden: Type.Object(
            {
              statusCode: Type.Literal(403),
              error: Type.Literal('Forbidden'),
              message: Type.String({ examples: ['Forbidden'] }),
            },
            { title: '403 Forbidden' },
          ),
        },
        {
          $id: 'responses',
          title: 'Responses',
          description: 'Common response schemas',
        },
      ),
    )
  },
)

export default plugin
