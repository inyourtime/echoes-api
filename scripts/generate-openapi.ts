#!/usr/bin/env node
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildApp } from '../src/app.ts'
import getConfig from '../src/config/index.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = join(__dirname, '..')

const config = getConfig()
const app = await buildApp({ ...config, enableDbConnection: false })

// Wait for plugins to be fully registered
await app.ready()

const openApiSpec = app.swagger({ yaml: true })

const outputPath = join(projectRoot, 'openapi.yaml')

writeFileSync(outputPath, openApiSpec)

console.log(`✓ OpenAPI spec generated at: ${outputPath}`)

await app.close()
