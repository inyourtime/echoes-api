import { defineRelations } from 'drizzle-orm'
import * as schema from './schema.ts'

export const relations = defineRelations(schema, (r) => ({
  oauthAccounts: {
    user: r.one.users({
      from: r.oauthAccounts.userId,
      to: r.users.id,
      optional: false,
    }),
  },
  users: {
    oauthAccounts: r.many.oauthAccounts(),
    pushTokens: r.many.pushTokens(),
    refreshTokens: r.many.refreshTokens(),
    tags: r.many.tags(),
    tracks: r.many.tracks(),
    verificationTokens: r.many.verificationTokens(),
  },
  pushTokens: {
    user: r.one.users({
      from: r.pushTokens.userId,
      to: r.users.id,
      optional: false,
    }),
  },
  refreshTokens: {
    user: r.one.users({
      from: r.refreshTokens.userId,
      to: r.users.id,
      optional: false,
    }),
  },
  tags: {
    user: r.one.users({
      from: r.tags.userId,
      to: r.users.id,
    }),
  },
  userTracks: {
    tags: r.many.tags({
      from: r.userTracks.id.through(r.userTrackTags.userTrackId),
      to: r.tags.id.through(r.userTrackTags.tagId),
    }),
    track: r.one.tracks({
      from: r.userTracks.trackId,
      to: r.tracks.id,
      optional: false,
    }),
  },
  tracks: {
    users: r.many.users({
      from: r.tracks.id.through(r.userTracks.trackId),
      to: r.users.id.through(r.userTracks.userId),
    }),
  },
  verificationTokens: {
    user: r.one.users({
      from: r.verificationTokens.userId,
      to: r.users.id,
      optional: false,
    }),
  },
}))
