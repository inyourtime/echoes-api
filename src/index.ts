import closeWithGrace from 'close-with-grace'
import { buildApp } from './app.ts'
import getConfig from './config/index.ts'

const config = getConfig()
const app = await buildApp(config)

closeWithGrace({ delay: 1000 }, async ({ signal, err }) => {
  if (err) {
    app.log.error({ err }, 'Server closing due to error')
  } else {
    app.log.info({ signal }, 'Server shutting down')
  }
  await app.close()
})

try {
  await app.listen({ port: config.port, host: config.host })
} catch (err) {
  app.log.error(err)
  throw err
}
