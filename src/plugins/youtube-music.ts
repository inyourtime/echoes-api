import YTMusic from 'ytmusic-api'
import { definePlugin } from '../utils/factories.ts'

declare module 'fastify' {
  interface FastifyInstance {
    youtubeMusic: YoutubeMusicService
  }
}

export class YoutubeMusicService {
  #ytmusic: YTMusic

  constructor(ytmusic: YTMusic) {
    this.#ytmusic = ytmusic
  }

  async getSongByUrl(url: string) {
    // Extract video ID from YouTube URL
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
        videoId: res.videoId,
        title: res.name ?? '',
        artist: res.artist?.name ?? '',
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
    const ytmusic = new YTMusic()
    await ytmusic.initialize()

    app.decorate('youtubeMusic', new YoutubeMusicService(ytmusic))
  },
)

export default plugin
