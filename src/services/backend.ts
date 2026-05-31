import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { BaseFighterKey } from "../game/fighterCatalog";
import type { LevelKey } from "../game/levels";
import type {
  GameLobby,
  MatchmakingMode,
  MatchmakingTicket,
  MatchResultKind,
  PlayerAvatar,
  PlayerStats
} from "../game/multiplayerTypes";

type MatchResult = {
  result: MatchResultKind;
  fighterKey: BaseFighterKey;
  opponentKind: string;
  opponentFighterKey?: BaseFighterKey;
  levelKey?: LevelKey;
  mode?: MatchmakingMode | "training";
  durationSeconds: number;
  recordedAt?: string;
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
const localResultsKey = "sff.local.matchResults";
const localStatsKey = "sff.local.playerStats";

export function recordLocalMatch(match: MatchResult): PlayerStats {
  const recordedAt = new Date().toISOString();
  const previous = readLocalJson<MatchResult[]>(localResultsKey, []);
  const storedMatch = {
    ...match,
    recordedAt
  };
  const next = [
    ...previous,
    storedMatch
  ].slice(-25);

  window.localStorage.setItem(localResultsKey, JSON.stringify(next));
  const stats = applyMatchToStats(loadLocalPlayerStats(), storedMatch, recordedAt);
  window.localStorage.setItem(localStatsKey, JSON.stringify(stats));
  window.dispatchEvent(new CustomEvent("sff:stats-updated"));

  return stats;
}

export async function recordMatch(match: MatchResult) {
  const stats = recordLocalMatch(match);

  if (!supabase) {
    return;
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return;
  }

  const matchInsert = {
    player_id: user.id,
    opponent_kind: match.opponentKind,
    fighter_key: match.fighterKey,
    opponent_fighter_key: match.opponentFighterKey ?? null,
    level_key: match.levelKey ?? null,
    mode: match.mode ?? "training",
    result: match.result,
    duration_seconds: match.durationSeconds
  };

  const statsUpsert = {
    profile_id: user.id,
    wins: stats.wins,
    losses: stats.losses,
    draws: stats.draws,
    matches_played: stats.matchesPlayed,
    current_streak: stats.currentStreak,
    best_streak: stats.bestStreak,
    total_duration_seconds: stats.totalDurationSeconds,
    updated_at: stats.updatedAt
  };

  const { error: matchError } = await supabase.from("match_results").insert(matchInsert);
  const { error: statsError } = await supabase.from("player_stats").upsert(statsUpsert);
  if (matchError || statsError) {
    console.warn("Supabase match tracking skipped", matchError ?? statsError);
  }
}

export function saveLocalProfile(avatar: PlayerAvatar) {
  window.localStorage.setItem(
    localProfileKey,
    JSON.stringify({
      ...avatar,
      updatedAt: new Date().toISOString()
    })
  );
}

export function loadLocalProfile(): PlayerAvatar | null {
  return readLocalJson<PlayerAvatar | null>(localProfileKey, null);
}

export function loadLocalPlayerStats(): PlayerStats {
  return readLocalJson<PlayerStats | null>(localStatsKey, null) ?? createEmptyStats();
}

export function loadLocalMatchResults(): MatchResult[] {
  return readLocalJson<MatchResult[]>(localResultsKey, []);
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

function createEmptyStats(): PlayerStats {
  return {
    wins: 0,
    losses: 0,
    draws: 0,
    matchesPlayed: 0,
    currentStreak: 0,
    bestStreak: 0,
    totalDurationSeconds: 0,
    favoriteFighter: "david",
    updatedAt: new Date().toISOString()
  };
}

function applyMatchToStats(stats: PlayerStats, match: MatchResult, updatedAt: string): PlayerStats {
  const nextStreak = match.result === "win" ? stats.currentStreak + 1 : match.result === "loss" ? 0 : stats.currentStreak;

  return {
    wins: stats.wins + (match.result === "win" ? 1 : 0),
    losses: stats.losses + (match.result === "loss" ? 1 : 0),
    draws: stats.draws + (match.result === "draw" ? 1 : 0),
    matchesPlayed: stats.matchesPlayed + 1,
    currentStreak: nextStreak,
    bestStreak: Math.max(stats.bestStreak, nextStreak),
    totalDurationSeconds: stats.totalDurationSeconds + match.durationSeconds,
    favoriteFighter: match.fighterKey,
    updatedAt
  };
}

function readLocalJson<T>(key: string, fallback: T): T {
  const stored = window.localStorage.getItem(key);
  if (!stored) {
    return fallback;
  }

  try {
    return JSON.parse(stored) as T;
  } catch {
    return fallback;
  }
}
