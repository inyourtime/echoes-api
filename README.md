# Echoes API 🎵

A **Music Life Timeline** API that transforms music listening history into a personal journal. Track songs with context, mood tags, and revisit memories through your musical journey.

> **Concept:** *"บันทึกช่วงเวลาของชีวิตผ่านเสียงเพลง"* — Transform your music listening history into a diary that tells the story of which songs entered your life, when, and how they made you feel.

---

## Features

- **Authentication** — OAuth (Google/GitHub), JWT with refresh token rotation
- **User Tracks CRUD** — Add, edit, delete, and view music entries with pagination
- **Tags System** — Create personalized tags with colors for mood/activity tracking
- **Track Deduplication** — Normalized title+artist to prevent duplicate tracks
- **Timeline View** — Chronological display of your music journey
- **Stats Dashboard** — Top artists, monthly activity heatmap, tag distribution
- **Full-text Search** — Ready with tsvector (API coming soon)

---

## Tech Stack

| Component | Technology |
|-----------|------------|
| Framework | [Fastify](https://fastify.dev/) |
| Language | TypeScript (ES Modules) |
| Database | PostgreSQL |
| ORM | [Drizzle ORM](https://orm.drizzle.team/) |
| Validation | [TypeBox](https://github.com/sinclairzx81/typebox) |
| Authentication | OAuth2 + JWT (fast-jwt) |
| Migrations | Drizzle Kit |
| Testing | Node.js Test Runner |
| Linting | Biome |

---

## Getting Started

### Prerequisites

- Node.js 25+
- PostgreSQL (or Docker)

### Installation

1. Clone the repository and install dependencies:

```bash
npm install
```

2. Set up environment variables:

```bash
cp .env.example .env
# Edit .env with your configuration
```

3. Start PostgreSQL (using Docker):

```bash
docker compose up -d
```

4. Run database migrations:

```bash
npm run db:push
```

5. Start the development server:

```bash
npm run dev
```

The API will be available at `http://localhost:3000`.

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with file watching |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm run start` | Build and start production server |
| `npm run test` | Run tests |
| `npm run coverage` | Run tests with coverage report |
| `npm run db:migrate` | Generate new migration files |
| `npm run db:push` | Push schema changes to database |
| `npm run db:dev` | Open Drizzle Studio for database management |

---

## API Structure

```
src/
├── app.ts              # Fastify app builder
├── index.ts            # Entry point
├── config/             # Configuration management
├── db/                 # Database schema and connection
├── plugins/            # Fastify plugins (auth, db, repositories)
└── routes/             # API routes (auto-loaded)
    ├── auth/           # Authentication endpoints
    ├── stats/          # Statistics dashboard
    ├── tag/            # Tag management
    ├── track/          # Track metadata
    └── user-track/     # User's music entries
```

### API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /health` | Health check |
| `/api/v1/auth/*` | OAuth login, token refresh, logout |
| `/api/v1/user-tracks` | CRUD for user music entries |
| `/api/v1/tracks` | Track metadata management |
| `/api/v1/tags` | Tag management |
| `/api/v1/stats/*` | Statistics and insights |

---

## Environment Variables

```env
# Server
PORT=3000
HOST=0.0.0.0

# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/postgres

# JWT
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d

# OAuth (Google & GitHub)
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...

# Email (Resend)
RESEND_API_KEY=...
```

---

## Database Schema

The database uses Drizzle ORM with PostgreSQL. Key entities:

- **users** — User accounts with OAuth info
- **tracks** — Normalized track metadata (title, artist, normalized for deduplication)
- **user_tracks** — User's music entries with dates, notes, YouTube URLs
- **tags** — User-defined tags with colors
- **user_track_tags** — Many-to-many relationship

---

## Testing

Tests use Node.js built-in test runner with Testcontainers for PostgreSQL:

```bash
npm run test
```

---

## Documentation

- `PROJECT.md` — Project concept and vision
- `PLAN.md` — Implementation roadmap
- `FEATURE.md` — Current feature status and backlog

---

## License

MIT
