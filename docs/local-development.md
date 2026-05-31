# Local Development

The first development target is local-only. You can run the game, test combat,
and learn programming concepts without creating cloud accounts.

## Setup

```bash
npm install
npm run dev
```

The Vite dev server opens at:

```text
http://127.0.0.1:5200
```

## Local Mode

If `.env` is missing or the Supabase values are blank, the game uses local mode.
Local mode stores simple match results in browser `localStorage` and does not
call Supabase.

To create your local environment file:

```bash
copy .env.example .env
```

Leave the values blank until we connect a real Supabase project.

## Useful Commands

```bash
npm run dev
npm run typecheck
npm run build
npm run preview
```

## Learning Loop

Each local milestone should be small:

1. Change a number, such as movement speed or jump height.
2. Run the game.
3. Observe the effect.
4. Commit the change with a short message.
