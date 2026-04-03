import { definePlugin } from '../utils/factories.ts'

declare module 'fastify' {
  interface FastifyInstance {
    youtubeMusic: YoutubeMusicService
  }
}

interface YoutubeMusicConfig {
  DEVICE?: string
  GL?: string
  HL?: string
  INNERTUBE_API_KEY: string
  INNERTUBE_API_VERSION: string
  INNERTUBE_CLIENT_NAME: string
  INNERTUBE_CLIENT_VERSION: string
  INNERTUBE_CONTEXT_CLIENT_NAME?: string
  PAGE_BUILD_LABEL?: string
  PAGE_CL?: string
  VISITOR_DATA?: string
}

interface YoutubeMusicSong {
  artist: {
    artistId: string | null
    name: string
  }
  name: string
  videoId: string
}

class YoutubeMusicClient {
  static readonly #baseUrl = 'https://music.youtube.com'
  static readonly #userAgent =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/81.0.4044.129 Safari/537.36'

  #config: YoutubeMusicConfig | null = null

  async initialize() {
    const response = await fetch(`${YoutubeMusicClient.#baseUrl}/`, {
      headers: {
        'accept-language': 'en-US,en;q=0.5',
        'user-agent': YoutubeMusicClient.#userAgent,
      },
    })

    if (!response.ok) {
      throw new Error(`Failed to initialize YouTube Music client: ${response.status}`)
    }

    const html = await response.text()
    const configMatches = html.match(/ytcfg\.set\(.*?\);/g) ?? []
    const mergedConfig: Record<string, unknown> = {}

    for (const match of configMatches) {
      try {
        const parsed = JSON.parse(match.slice(10, -2)) as Record<string, unknown>
        Object.assign(mergedConfig, parsed)
      } catch {
        // Ignore malformed config blobs and continue with the next one.
      }
    }

    if (
      typeof mergedConfig.INNERTUBE_API_KEY !== 'string' ||
      typeof mergedConfig.INNERTUBE_API_VERSION !== 'string' ||
      typeof mergedConfig.INNERTUBE_CLIENT_NAME !== 'string' ||
      typeof mergedConfig.INNERTUBE_CLIENT_VERSION !== 'string'
    ) {
      throw new Error('Failed to extract YouTube Music client configuration')
    }

    this.#config = {
      DEVICE: typeof mergedConfig.DEVICE === 'string' ? mergedConfig.DEVICE : undefined,
      GL: typeof mergedConfig.GL === 'string' ? mergedConfig.GL : 'US',
      HL: typeof mergedConfig.HL === 'string' ? mergedConfig.HL : 'en',
      INNERTUBE_API_KEY: mergedConfig.INNERTUBE_API_KEY,
      INNERTUBE_API_VERSION: mergedConfig.INNERTUBE_API_VERSION,
      INNERTUBE_CLIENT_NAME: mergedConfig.INNERTUBE_CLIENT_NAME,
      INNERTUBE_CLIENT_VERSION: mergedConfig.INNERTUBE_CLIENT_VERSION,
      INNERTUBE_CONTEXT_CLIENT_NAME:
        typeof mergedConfig.INNERTUBE_CONTEXT_CLIENT_NAME === 'string'
          ? mergedConfig.INNERTUBE_CONTEXT_CLIENT_NAME
          : undefined,
      PAGE_BUILD_LABEL:
        typeof mergedConfig.PAGE_BUILD_LABEL === 'string'
          ? mergedConfig.PAGE_BUILD_LABEL
          : undefined,
      PAGE_CL: typeof mergedConfig.PAGE_CL === 'string' ? mergedConfig.PAGE_CL : undefined,
      VISITOR_DATA:
        typeof mergedConfig.VISITOR_DATA === 'string' ? mergedConfig.VISITOR_DATA : undefined,
    }
  }

  async getSong(videoId: string) {
    if (!videoId.match(/^[a-zA-Z0-9_-]{11}$/)) {
      throw new Error('Invalid videoId')
    }

    const data = await this.#constructRequest('player', { videoId })
    const song = this.#parseSong(data)

    if (song.videoId !== videoId) {
      throw new Error('Invalid videoId')
    }

    return song
  }

  async #constructRequest(endpoint: string, body: Record<string, unknown>) {
    if (!this.#config) {
      throw new Error('YouTube Music client is not initialized')
    }

    const searchParams = new URLSearchParams({
      alt: 'json',
      key: this.#config.INNERTUBE_API_KEY,
    })

    const response = await fetch(
      `${YoutubeMusicClient.#baseUrl}/youtubei/${this.#config.INNERTUBE_API_VERSION}/${endpoint}?${searchParams.toString()}`,
      {
        method: 'POST',
        headers: {
          'accept-language': 'en-US,en;q=0.5',
          'content-type': 'application/json',
          'user-agent': YoutubeMusicClient.#userAgent,
          'x-goog-visitor-id': this.#config.VISITOR_DATA ?? '',
          'x-origin': YoutubeMusicClient.#baseUrl,
          'x-youtube-client-name':
            this.#config.INNERTUBE_CONTEXT_CLIENT_NAME ?? this.#config.INNERTUBE_CLIENT_NAME,
          'x-youtube-client-version': this.#config.INNERTUBE_CLIENT_VERSION,
          'x-youtube-device': this.#config.DEVICE ?? '',
          'x-youtube-page-cl': this.#config.PAGE_CL ?? '',
          'x-youtube-page-label': this.#config.PAGE_BUILD_LABEL ?? '',
          'x-youtube-time-zone': new Intl.DateTimeFormat().resolvedOptions().timeZone,
          'x-youtube-utc-offset': String(-new Date().getTimezoneOffset()),
        },
        body: JSON.stringify({
          context: {
            capabilities: {},
            client: {
              clientName: this.#config.INNERTUBE_CLIENT_NAME,
              clientVersion: this.#config.INNERTUBE_CLIENT_VERSION,
              experimentIds: [],
              experimentsToken: '',
              gl: this.#config.GL ?? 'US',
              hl: this.#config.HL ?? 'en',
              locationInfo: {
                locationPermissionAuthorizationStatus:
                  'LOCATION_PERMISSION_AUTHORIZATION_STATUS_UNSUPPORTED',
              },
              musicAppInfo: {
                musicActivityMasterSwitch: 'MUSIC_ACTIVITY_MASTER_SWITCH_INDETERMINATE',
                musicLocationMasterSwitch: 'MUSIC_LOCATION_MASTER_SWITCH_INDETERMINATE',
                pwaInstallabilityStatus: 'PWA_INSTALLABILITY_STATUS_UNKNOWN',
              },
              utcOffsetMinutes: -new Date().getTimezoneOffset(),
            },
            request: {
              internalExperimentFlags: [
                {
                  key: 'force_music_enable_outertube_tastebuilder_browse',
                  value: 'true',
                },
                {
                  key: 'force_music_enable_outertube_playlist_detail_browse',
                  value: 'true',
                },
                {
                  key: 'force_music_enable_outertube_search_suggestions',
                  value: 'true',
                },
              ],
              sessionIndex: {},
            },
            user: {
              enableSafetyMode: false,
            },
          },
          ...body,
        }),
      },
    )

    if (!response.ok) {
      throw new Error(`YouTube Music request failed: ${response.status}`)
    }

    return (await response.json()) as Record<string, unknown>
  }

  #parseSong(data: Record<string, unknown>): YoutubeMusicSong {
    const videoDetails =
      data.videoDetails && typeof data.videoDetails === 'object'
        ? (data.videoDetails as Record<string, unknown>)
        : null

    const videoId = typeof videoDetails?.videoId === 'string' ? videoDetails.videoId : ''
    const name = typeof videoDetails?.title === 'string' ? videoDetails.title : ''
    const artistId = typeof videoDetails?.channelId === 'string' ? videoDetails.channelId : null
    const artistName =
      typeof videoDetails?.author === 'string'
        ? videoDetails.author
        : typeof data.author === 'string'
          ? data.author
          : ''

    return {
      artist: {
        artistId,
        name: artistName,
      },
      name,
      videoId,
    }
  }
}

export class YoutubeMusicService {
  #ytmusic: YoutubeMusicClient

  constructor(ytmusic: YoutubeMusicClient) {
    this.#ytmusic = ytmusic
  }

  async getSongByUrl(url: string) {
    const videoId = this.#extractVideoId(url)
    if (!videoId) return null
    return this.getSongById(videoId)
  }

  #extractVideoId(url: string): string | null {
    const patterns = [
      /youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
      /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
      /youtu\.be\/([a-zA-Z0-9_-]{11})/,
      /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
    ]

    for (const pattern of patterns) {
      const match = url.match(pattern)
      if (match) return match[1]
    }

    return null
  }

  async getSongById(id: string) {
    try {
      const res = await this.#ytmusic.getSong(id)

      return {
        artist: res.artist.name,
        title: res.name,
        videoId: res.videoId,
      }
    } catch {
      return null
    }
  }
}

const plugin = definePlugin(
  {
    name: 'youtube-music',
  },
  async (app) => {
    const ytmusic = new YoutubeMusicClient()
    await ytmusic.initialize()

    app.decorate('youtubeMusic', new YoutubeMusicService(ytmusic))
  },
)

export default plugin
