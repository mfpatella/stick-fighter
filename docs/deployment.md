# Deployment Plan

The project is local-first, but it is shaped so GitHub, Supabase, and Netlify
can be connected without rewriting the game.

## GitHub

The folder is already a Git repository. When ready:

```bash
git add .
git commit -m "Create local-first game scaffold"
git branch -M main
git remote add origin https://github.com/YOUR_USER/stick-figure-fighter.git
git push -u origin main
```

After that, use feature branches for new lessons and game systems:

```bash
git checkout -b codex/add-player-blocking
```

## Netlify

Netlify can build this as a Vite app.

- Build command: `npm run build`
- Publish directory: `dist`
- Config file: `netlify.toml`

Local preview through Netlify can later use:

```bash
npx netlify dev
```

Deploy preview:

```bash
npx netlify deploy
```

Production deploy:

```bash
npx netlify deploy --prod
```

## Supabase

Supabase should stay optional until the game needs accounts, online presence,
lobbies, match history, or leaderboards.

When we create a Supabase project, add these values to `.env` locally and to
Netlify environment variables:

```text
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
```

Browser code must only use publishable client keys. Never expose a Supabase
service role key in Vite or Netlify public variables.

The starter database shape is in:

```text
supabase/schema.sql
```

Use it as the first schema reference once Supabase CLI or MCP access is
connected.

## Realtime Path

For the first online milestone:

- Presence: who is in a lobby and who is ready
- Broadcast: low-latency room events and prototype combat messages
- Postgres tables: durable profiles, lobbies, and match results

If live fighting needs tighter timing later, keep Supabase for identity and
history, then add a dedicated realtime game server for match simulation.
