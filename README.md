# Stick Figure Fighter

A browser-based stick figure fighting game inspired by the life of David,
Jonathan, and David's mighty men.

## Vision

Build a fast, readable 2D fighter where players can duel the computer or other
players online while moving through a biblical story framework. The game should
teach programming concepts as it grows: state machines, animation, collision,
AI, networking, databases, deployment, and source control.

## Local First

The game runs locally without any cloud accounts:

```bash
npm install
npm run dev
```

Cloud services are optional until we are ready:

- Leave `.env` empty to use local browser storage and local-only play.
- Add Supabase values to `.env` when we are ready for auth, profiles, lobbies,
  and match history.
- Netlify can build the app with `npm run build` and publish `dist`.

## Phone Install

The app is configured as an installable PWA with a manifest, Android maskable
icons, iOS touch icon metadata, and a service worker for cached app shell
loading.

- Android Chrome/Edge: open the deployed HTTPS site and use the in-app
  "Install" prompt when it appears.
- iPhone/iPad Safari: open the deployed HTTPS site, tap Share, then Add to Home
  Screen.
- Localhost is useful for development, but real phone install testing should use
  the Netlify HTTPS URL.

## Planned Stack

- Phaser 3, TypeScript, and Vite for the game client
- Supabase for auth, player profiles, lobbies, match history, and presence
- Netlify for hosting and deploy previews
- GitHub for branches, issues, pull requests, and release history

## Core Modes

- Training: learn controls, timing, spacing, and hitboxes
- Story: play through David-focused encounters and loyalty tests
- Versus CPU: fight computer-controlled opponents
- Online Versus: invite a friend or match with another player

## Multiplayer Foundation

The local menu already models the online shape:

- display name and avatar choices
- base fighter selection with different stats
- level selection
- private, casual, and ranked matchmaking intent
- local lobby and matchmaking ticket records in browser storage
- custom avatar profile persistence
- local wins, losses, streaks, match count, and match history
- rollback-ready simulation snapshots and encoded input frames

Supabase schema support for profiles, avatars, lobbies, lobby members,
matchmaking tickets, player stats, and match results lives in `supabase/schema.sql`.

## Development Style

Each milestone should introduce one game feature and one programming concept.
The project is designed so the player can also be a learner and co-designer.

## Project Docs

- [Game design](docs/game-design.md)
- [Local development](docs/local-development.md)
- [Deployment plan](docs/deployment.md)
- [Realtime combat research](docs/realtime-combat-research.md)
- [Asset credits](docs/asset-credits.md)
