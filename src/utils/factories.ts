import assert from 'node:assert'
import fp from 'fastify-plugin'
import type { IConfig } from '../config/index.ts'
import type { FastifyPluginAsyncTypebox } from './type-provider.ts'

export interface RouteOptions {
  [key: string]: unknown
  config: IConfig
}

export interface RoutePluginOptions {
  prefix?: string
  tags?: readonly string[]
}

export interface PluginOptions {
  name?: string
  dependencies?: string[]
  encapsulate?: boolean
}

type Plugin<T extends RouteOptions = RouteOptions> = FastifyPluginAsyncTypebox<T>

const isPlugin = <T extends RouteOptions>(value: unknown): value is Plugin<T> =>
  typeof value === 'function'

function defineRoute(plugin: Plugin): Plugin
function defineRoute(options: RoutePluginOptions, plugin: Plugin): Plugin
function defineRoute(optionsOrPlugin: RoutePluginOptions | Plugin, plugin?: Plugin): Plugin {
  if (isPlugin(optionsOrPlugin)) {
    return optionsOrPlugin
  }

  assert(plugin, 'defineRoute requires a plugin when options are provided')

  return Object.assign(plugin, {
    autoPrefix: optionsOrPlugin.prefix,
    autoConfig: { preset: { tags: optionsOrPlugin.tags } },
  })
}

function definePlugin<T extends RouteOptions>(plugin: Plugin<T>): Plugin<T>
function definePlugin<T extends RouteOptions>(options: PluginOptions, plugin: Plugin<T>): Plugin<T>
function definePlugin<T extends RouteOptions>(
  optionsOrPlugin: PluginOptions | Plugin<T>,
  plugin?: Plugin<T>,
): Plugin<T> {
  if (isPlugin<T>(optionsOrPlugin)) {
    return fp(optionsOrPlugin)
  }

  assert(plugin, 'definePlugin requires a plugin when options are provided')

  return fp(plugin, optionsOrPlugin)
}

export { definePlugin, defineRoute }
