import fp from 'fastify-plugin'
import type { IConfig } from '../config/index.ts'
import type { FastifyPluginAsyncTypebox } from './type-provider.ts'

export interface RouteOptions {
  [key: string]: unknown
  config: IConfig
}

export function defineRoute({
  prefix,
  tags,
  plugin,
}: {
  prefix?: string
  tags?: readonly string[]
  plugin: FastifyPluginAsyncTypebox<RouteOptions>
}) {
  return Object.assign(plugin, {
    autoPrefix: prefix,
    autoConfig: { preset: { tags } },
  })
}

export function definePlugin<T extends RouteOptions>({
  name,
  dependencies,
  encapsulate,
  plugin,
}: {
  name?: string
  dependencies?: string[]
  encapsulate?: boolean
  plugin: FastifyPluginAsyncTypebox<T>
}) {
  return fp(plugin, { name, dependencies, encapsulate })
}
