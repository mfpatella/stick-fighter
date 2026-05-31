import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { BaseFighterKey } from "../game/fighterCatalog";
import type { LevelKey } from "../game/levels";
import type { GameLobby, MatchmakingMode, MatchmakingTicket, PlayerAvatar } from "../game/multiplayerTypes";

type MatchResult = {
  result: "win" | "loss";
  fighterKey: string;
  opponentKind: string;
  durationSeconds: number;
};

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const backendMode = supabaseUrl && supabasePublishableKey ? "supabase" : "local";
export const backendModeLabel = backendMode === "supabase" ? "Supabase mode" : "Local mode";

export const supabase: SupabaseClient | null =
  backendMode === "supabase" ? createClient(supabaseUrl, supabasePublishableKey) : null;

const localProfileKey = "sff.local.profile";
const localLobbyKey = "sff.local.lobby";
const localTicketKey = "sff.local.matchmakingTicket";

export function recordLocalMatch(match: MatchResult) {
  const key = "sff.local.matchResults";
  const previous = JSON.parse(window.localStorage.getItem(key) ?? "[]") as MatchResult[];
  const next = [
    ...previous,
    {
      ...match,
      recordedAt: new Date().toISOString()
    }
  ].slice(-25);

  window.localStorage.setItem(key, JSON.stringify(next));
}

export function saveLocalProfile(avatar: PlayerAvatar) {
  window.localStorage.setItem(localProfileKey, JSON.stringify(avatar));
}

export function loadLocalProfile(): PlayerAvatar | null {
  const stored = window.localStorage.getItem(localProfileKey);
  return stored ? (JSON.parse(stored) as PlayerAvatar) : null;
}

export function createLocalLobby(input: {
  avatar: PlayerAvatar;
  fighterKey: BaseFighterKey;
  levelKey: LevelKey;
  matchmakingMode: MatchmakingMode;
  maxPlayers: 2 | 4;
}): GameLobby {
  const lobby: GameLobby = {
    id: crypto.randomUUID(),
    roomCode: createRoomCode(),
    hostId: "local-player",
    status: "open",
    levelKey: input.levelKey,
    mode: input.matchmakingMode,
    maxPlayers: input.maxPlayers,
    members: [
      {
        profileId: "local-player",
        displayName: input.avatar.displayName,
        fighterKey: input.fighterKey,
        avatar: input.avatar,
        ready: true,
        slot: 1
      }
    ],
    createdAt: new Date().toISOString()
  };

  window.localStorage.setItem(localLobbyKey, JSON.stringify(lobby));
  return lobby;
}

export function createLocalMatchmakingTicket(input: {
  fighterKey: BaseFighterKey;
  levelKey: LevelKey | null;
  mode: MatchmakingMode;
}): MatchmakingTicket {
  const ticket: MatchmakingTicket = {
    id: crypto.randomUUID(),
    profileId: "local-player",
    fighterKey: input.fighterKey,
    levelKey: input.levelKey,
    mode: input.mode,
    status: "searching",
    createdAt: new Date().toISOString()
  };

  window.localStorage.setItem(localTicketKey, JSON.stringify(ticket));
  return ticket;
}

function createRoomCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}
