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

## Online Roadmap

Phase 1 can use Supabase Realtime for lobbies, presence, ready checks, and
prototype room events.

Phase 2 should move live match combat toward one of these:

- Peer-to-peer input exchange with rollback.
- Authoritative realtime server with prediction and reconciliation.
- A managed realtime game service if we choose one later.

Supabase should remain responsible for accounts, profiles, match records,
leaderboards, and lobby metadata.

## First Combat Features To Carry Forward

- Startup, active, and recovery frames.
- Hitstop on impact.
- Hitstun and blockstun.
- Directional blocking.
- Stamina cost and stamina pressure.
- Input buffering.
- Visible debug hitboxes.
- Fixed-step simulation.

