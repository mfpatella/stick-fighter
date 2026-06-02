# Realtime Combat Research

This project should grow toward rollback-friendly online combat, even while the
first playable version stays local.

## Current Direction

Modern realtime fighting games usually rely on these ideas:

- Fixed simulation frames, commonly 60 updates per second.
- Input-first gameplay: save and exchange player inputs, not full renderer
  state.
- Move frame data: startup, active, recovery, hitstun, blockstun, and advantage.
- Client-side prediction for responsiveness.
- Rollback and resimulation when late remote inputs disagree with prediction.
- Small, serializable gameplay state with rendering derived from that state.

References:

- GGPO describes rollback as input prediction plus speculative execution so
  player actions can appear immediately.
- SnapNet recommends prediction/rollback for fighting games because reaction
  time matters, and discusses tuning input delay against rollback cost.
- SnapNet also notes that predicted entities are simulated forward from known
  state using the same logic as the server.
- Gaffer on Games explains deterministic lockstep as sending inputs per frame,
  with the warning that the game must be built around deterministic simulation.

## Local Implementation Rules

The local game should follow these rules now:

1. Run combat at a fixed 60 FPS step.
2. Use input buffers so an attack pressed during recovery can come out when the
   fighter is free.
3. Store combat timing in frame data, then convert to seconds.
4. Keep fighter state serializable: numbers, strings, booleans, and simple
   enums.
5. Keep rendering derived from fighter state.
6. Avoid random gameplay decisions that cannot later be seeded and replayed.
7. Encode controller state into small input bitfields before sending over a
   network channel.
8. Keep complete simulation snapshots so late inputs can be replayed without
   touching Phaser renderer objects.

## Implemented Netplay-Friendly Hooks

- `CombatSimulation.createSnapshot()` captures combat state, RNG seed, CPU
  timers, and loose-part counters for rollback history.
- `CombatSimulation.restoreSnapshot()` restores the pure simulation state for
  deterministic resimulation.
- `encodePlayerInput()` and `decodePlayerInput()` pack player buttons into a
  compact number that can be broadcast or stored per frame.
- The local renderer interpolates between previous and current simulation
  frames, while gameplay remains on a fixed tick.
- Local match records update wins, losses, streaks, total play time, and
  favorite fighter so the UI can be built before cloud auth is connected.

## Online Roadmap

Phase 1 can use Supabase Realtime for lobbies, presence, ready checks, and
prototype room events.

Phase 2 should move live match combat toward one of these:

- Peer-to-peer input exchange with rollback.
- Authoritative realtime server with prediction and reconciliation.
- A managed realtime game service if we choose one later.

Supabase should remain responsible for accounts, profiles, match records,
leaderboards, and lobby metadata.

Current Supabase use should focus on:

- Authenticated profiles and custom avatars.
- Realtime Presence for lobby occupancy, ready checks, and who is online.
- Realtime Broadcast for prototype room messages and input packets.
- Postgres tables for match history and player stats.

Implemented online shell:

- Email/password sign up and sign in through Supabase Auth.
- Profile/avatar upsert after sign in.
- Supabase lobby, lobby member, and matchmaking ticket creation when a signed-in
  player starts a fight.
- Realtime `match:<lobbyId>` rooms with Presence for connected fighters and a
  Broadcast event hook reserved for encoded input frames.

If live fights feel inconsistent over Broadcast, keep Supabase for identity and
persistence, then move the combat packet transport to a dedicated game server or
managed low-latency relay while retaining the same input-frame and snapshot
model.

## First Combat Features To Carry Forward

- Startup, active, and recovery frames.
- Hitstop on impact.
- Hitstun and blockstun.
- Directional blocking.
- Stamina cost and stamina pressure.
- Input buffering.
- Visible debug hitboxes.
- Fixed-step simulation.
