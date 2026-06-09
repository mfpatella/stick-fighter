import {
  createClient,
  type RealtimeChannel,
  type Session,
  type SupabaseClient,
  type User
} from "@supabase/supabase-js";
import type { BaseFighterKey } from "../game/fighterCatalog";
import type { EncodedPlayerInput } from "../game/combatSimulation";
import type { GameLaunchSettings } from "../game/gameSettings";
import type { LevelKey } from "../game/levels";
import type {
  GameLobby,
  LobbyMember,
  MatchmakingMode,
  MatchmakingTicket,
  MatchResultKind,
  PlayerAvatar,
  PlayerStats
} from "../game/multiplayerTypes";

export type MatchResult = {
  matchId?: string;
  result: MatchResultKind;
  fighterKey: BaseFighterKey;
  opponentKind: string;
  opponentPlayerId?: string | null;
  opponentFighterKey?: BaseFighterKey;
  levelKey?: LevelKey;
  mode?: MatchmakingMode | "training";
  durationSeconds: number;
  recordedAt?: string;
  telemetry?: MatchTelemetry;
};

export type MatchTelemetry = {
  playerHits: number;
  opponentHits: number;
  blocks: number;
  parries: number;
  parryCounters: number;
  counterHits: number;
  guardCrushes: number;
  projectileReturns: number;
  staleHits: number;
  maxCombo: number;
  longestHitDistance: number;
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

export type AuthSnapshot = {
  user: User | null;
  session: Session | null;
};

export type AuthCredentials = {
  email: string;
  password: string;
};

export type OnlineLobbyResult = {
  lobby: GameLobby;
  source: "supabase" | "local";
};

export type RealtimeRoomState = {
  lobbyId: string;
  onlineCount: number;
  status: "subscribing" | "online" | "closed" | "error";
  participants: RealtimeParticipant[];
};

export type RealtimeParticipant = {
  profileId: string;
  displayName: string;
  fighterKey: BaseFighterKey;
  ready: boolean;
  slot: 1 | 2 | 3 | 4;
};

export type RealtimeInputFrame = {
  profileId: string;
  frame: number;
  side: "player" | "opponent";
  input: EncodedPlayerInput;
  sentAt: number;
  receivedAt?: number;
};

export type RealtimeMatchStart = {
  matchId: string;
  lobbyId: string;
  hostProfileId: string;
  startAt: number;
  inputDelayFrames: number;
  settings: GameLaunchSettings;
};

export type RealtimeLobbySync = {
  lobbyId: string;
  reason: "ready" | "refresh" | "join" | "leave";
  sentAt: number;
};

let activeRealtimeChannel: RealtimeChannel | null = null;

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
    match_id: match.matchId ?? crypto.randomUUID(),
    player_id: user.id,
    opponent_player_id: match.opponentPlayerId ?? null,
    opponent_kind: match.opponentKind,
    fighter_key: match.fighterKey,
    opponent_fighter_key: match.opponentFighterKey ?? null,
    level_key: match.levelKey ?? null,
    mode: match.mode ?? "training",
    result: match.result,
    duration_seconds: match.durationSeconds
  };

  const { error: rpcError } = await supabase.rpc("record_stick_fighter_match", {
    p_match_id: matchInsert.match_id,
    p_player_id: matchInsert.player_id,
    p_opponent_player_id: matchInsert.opponent_player_id,
    p_opponent_kind: matchInsert.opponent_kind,
    p_fighter_key: matchInsert.fighter_key,
    p_opponent_fighter_key: matchInsert.opponent_fighter_key,
    p_level_key: matchInsert.level_key,
    p_mode: matchInsert.mode,
    p_result: matchInsert.result,
    p_duration_seconds: matchInsert.duration_seconds
  });
  if (!rpcError) {
    return;
  }

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

export async function getAuthSnapshot(): Promise<AuthSnapshot> {
  if (!supabase) {
    return {
      user: null,
      session: null
    };
  }

  const { data } = await supabase.auth.getSession();
  return {
    user: data.session?.user ?? null,
    session: data.session
  };
}

export function onAuthChanged(callback: (snapshot: AuthSnapshot) => void) {
  if (!supabase) {
    return () => undefined;
  }

  const {
    data: { subscription }
  } = supabase.auth.onAuthStateChange((_event, session) => {
    callback({
      user: session?.user ?? null,
      session
    });
  });

  return () => subscription.unsubscribe();
}

export async function signUpWithEmail(credentials: AuthCredentials) {
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const { data, error } = await supabase.auth.signUp({
    email: credentials.email,
    password: credentials.password,
    options: {
      emailRedirectTo: window.location.origin
    }
  });

  if (error) {
    throw error;
  }

  return data;
}

export async function signInWithEmail(credentials: AuthCredentials) {
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const { data, error } = await supabase.auth.signInWithPassword(credentials);
  if (error) {
    throw error;
  }

  return data;
}

export async function signOutOnline() {
  if (!supabase) {
    return;
  }

  leaveRealtimeRoom();
  const { error } = await supabase.auth.signOut();
  if (error) {
    throw error;
  }
}

export async function savePlayerProfile(avatar: PlayerAvatar) {
  saveLocalProfile(avatar);

  if (!supabase) {
    return {
      source: "local" as const,
      avatar
    };
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      source: "local" as const,
      avatar
    };
  }

  const { error } = await supabase.from("profiles").upsert({
    id: user.id,
    display_name: avatar.displayName,
    favorite_fighter: avatar.favoriteFighter,
    avatar_frame: avatar.frame,
    avatar_color: avatar.color,
    updated_at: new Date().toISOString()
  });

  if (error) {
    throw error;
  }

  return {
    source: "supabase" as const,
    avatar
  };
}

export async function loadPlayerStats(): Promise<PlayerStats> {
  if (!supabase) {
    return loadLocalPlayerStats();
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return loadLocalPlayerStats();
  }

  const { data, error } = await supabase
    .from("player_stats")
    .select("wins, losses, draws, matches_played, current_streak, best_streak, total_duration_seconds, updated_at")
    .eq("profile_id", user.id)
    .maybeSingle();

  if (error || !data) {
    return loadLocalPlayerStats();
  }

  const localProfile = loadLocalProfile();
  return {
    wins: data.wins,
    losses: data.losses,
    draws: data.draws,
    matchesPlayed: data.matches_played,
    currentStreak: data.current_streak,
    bestStreak: data.best_streak,
    totalDurationSeconds: data.total_duration_seconds,
    favoriteFighter: localProfile?.favoriteFighter ?? "david",
    updatedAt: data.updated_at
  };
}

export async function fetchLobbyById(lobbyId: string): Promise<GameLobby | null> {
  if (!supabase) {
    const lobby = readLocalJson<GameLobby | null>(localLobbyKey, null);
    return lobby?.id === lobbyId ? lobby : null;
  }

  const { data: lobbyRow, error: lobbyError } = await supabase
    .from("lobbies")
    .select("id, room_code, host_id, status, level_key, mode, max_players, created_at")
    .eq("id", lobbyId)
    .maybeSingle();

  if (lobbyError) {
    throw lobbyError;
  }

  if (!lobbyRow) {
    return null;
  }

  return hydrateLobby(lobbyRow);
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

export async function createGameLobby(input: {
  avatar: PlayerAvatar;
  fighterKey: BaseFighterKey;
  levelKey: LevelKey;
  matchmakingMode: MatchmakingMode;
  maxPlayers: 2 | 4;
}): Promise<OnlineLobbyResult> {
  if (!supabase) {
    return {
      lobby: createLocalLobby(input),
      source: "local"
    };
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      lobby: createLocalLobby(input),
      source: "local"
    };
  }

  await savePlayerProfile(input.avatar);

  const { data: lobbyRow, error: lobbyError } = await supabase
    .from("lobbies")
    .insert({
      host_id: user.id,
      room_code: createRoomCode(),
      mode: input.matchmakingMode,
      level_key: input.levelKey,
      max_players: input.maxPlayers,
      status: "open"
    })
    .select("id, room_code, host_id, status, level_key, mode, max_players, created_at")
    .single();

  if (lobbyError) {
    throw lobbyError;
  }

  const { error: memberError } = await supabase.from("lobby_members").insert({
    lobby_id: lobbyRow.id,
    profile_id: user.id,
    fighter_key: input.fighterKey,
    ready: true,
    slot: 1
  });

  if (memberError) {
    throw memberError;
  }

  const lobby: GameLobby = {
    id: lobbyRow.id,
    roomCode: lobbyRow.room_code,
    hostId: lobbyRow.host_id,
    status: lobbyRow.status,
    levelKey: lobbyRow.level_key,
    mode: lobbyRow.mode,
    maxPlayers: lobbyRow.max_players,
    members: [
      {
        profileId: user.id,
        displayName: input.avatar.displayName,
        fighterKey: input.fighterKey,
        avatar: input.avatar,
        ready: true,
        slot: 1
      }
    ],
    createdAt: lobbyRow.created_at
  };

  window.localStorage.setItem(localLobbyKey, JSON.stringify(lobby));
  return {
    lobby,
    source: "supabase"
  };
}

export async function setLobbyMemberReady(lobbyId: string, ready: boolean) {
  if (!supabase) {
    const lobby = readLocalJson<GameLobby | null>(localLobbyKey, null);
    if (lobby) {
      lobby.members = lobby.members.map((member) =>
        member.profileId === "local-player"
          ? {
              ...member,
              ready
            }
          : member
      );
      window.localStorage.setItem(localLobbyKey, JSON.stringify(lobby));
    }
    return;
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return;
  }

  const { error } = await supabase
    .from("lobby_members")
    .update({ ready })
    .eq("lobby_id", lobbyId)
    .eq("profile_id", user.id);

  if (error) {
    throw error;
  }

  await refreshLobbyStatus(lobbyId);
}

export async function markLobbyInMatch(lobbyId: string) {
  await updateHostLobbyStatus(lobbyId, "in_match");
}

export async function markLobbyOpen(lobbyId: string) {
  await updateHostLobbyStatus(lobbyId, "open");
}

export async function closeLobby(lobbyId: string) {
  await updateHostLobbyStatus(lobbyId, "closed");
}

export async function leaveLobby(lobbyId: string) {
  if (!supabase) {
    window.localStorage.removeItem(localLobbyKey);
    return;
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return;
  }

  const lobby = await fetchLobbyById(lobbyId);
  const { error } = await supabase
    .from("lobby_members")
    .delete()
    .eq("lobby_id", lobbyId)
    .eq("profile_id", user.id);

  if (error) {
    throw error;
  }

  if (lobby?.hostId === user.id) {
    await closeLobby(lobbyId);
  } else {
    await refreshLobbyStatus(lobbyId);
  }
}

export async function joinLobbyByRoomCode(input: {
  roomCode: string;
  avatar: PlayerAvatar;
  fighterKey: BaseFighterKey;
}): Promise<GameLobby> {
  if (!supabase) {
    return joinLocalLobbyByRoomCode(input);
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Sign in before joining an online lobby.");
  }

  await savePlayerProfile(input.avatar);

  const normalizedRoomCode = input.roomCode.trim().toUpperCase();
  const { data: lobbyRow, error: lobbyError } = await supabase
    .from("lobbies")
    .select("id, room_code, host_id, status, level_key, mode, max_players, created_at")
    .eq("room_code", normalizedRoomCode)
    .in("status", ["open", "ready"])
    .maybeSingle();

  if (lobbyError) {
    throw lobbyError;
  }

  if (!lobbyRow) {
    throw new Error(`Lobby ${normalizedRoomCode} was not found.`);
  }

  const { data: memberRows, error: membersError } = await supabase
    .from("lobby_members")
    .select("profile_id, fighter_key, slot, ready")
    .eq("lobby_id", lobbyRow.id);

  if (membersError) {
    throw membersError;
  }

  const existingMember = memberRows.find((member) => member.profile_id === user.id);
  const usedSlots = new Set(memberRows.map((member) => member.slot));
  const slot = existingMember?.slot ?? findOpenSlot(usedSlots, lobbyRow.max_players);

  if (!slot) {
    throw new Error(`Lobby ${normalizedRoomCode} is full.`);
  }

  const { error: joinError } = await supabase.from("lobby_members").upsert({
    lobby_id: lobbyRow.id,
    profile_id: user.id,
    fighter_key: input.fighterKey,
    ready: true,
    slot
  });

  if (joinError) {
    throw joinError;
  }

  const hydratedLobby = await fetchLobbyById(lobbyRow.id);
  if (hydratedLobby) {
    window.localStorage.setItem(localLobbyKey, JSON.stringify(hydratedLobby));
    return hydratedLobby;
  }

  const lobby: GameLobby = {
    id: lobbyRow.id,
    roomCode: lobbyRow.room_code,
    hostId: lobbyRow.host_id,
    status: lobbyRow.status,
    levelKey: lobbyRow.level_key,
    mode: lobbyRow.mode,
    maxPlayers: lobbyRow.max_players,
    members: [
      ...memberRows
        .filter((member) => member.profile_id !== user.id)
        .map((member) => ({
          profileId: member.profile_id,
          displayName: "Player",
          fighterKey: member.fighter_key as BaseFighterKey,
          avatar: {
            displayName: "Player",
            frame: "shepherd" as const,
            color: "olive" as const,
            favoriteFighter: member.fighter_key as BaseFighterKey
          },
          ready: member.ready,
          slot: member.slot as 1 | 2 | 3 | 4
        })),
      {
        profileId: user.id,
        displayName: input.avatar.displayName,
        fighterKey: input.fighterKey,
        avatar: input.avatar,
        ready: true,
        slot: slot as 1 | 2 | 3 | 4
      }
    ],
    createdAt: lobbyRow.created_at
  };

  window.localStorage.setItem(localLobbyKey, JSON.stringify(lobby));
  return lobby;
}

function joinLocalLobbyByRoomCode(input: {
  roomCode: string;
  avatar: PlayerAvatar;
  fighterKey: BaseFighterKey;
}): GameLobby {
  const normalizedRoomCode = input.roomCode.trim().toUpperCase();
  const lobby = readLocalJson<GameLobby | null>(localLobbyKey, null);

  if (!lobby || lobby.roomCode !== normalizedRoomCode || (lobby.status !== "open" && lobby.status !== "ready")) {
    throw new Error(`Local lobby ${normalizedRoomCode} was not found.`);
  }

  const existingGuest = lobby.members.find(
    (member) => member.profileId.startsWith("local-guest") && member.displayName === input.avatar.displayName
  );
  const usedSlots = new Set(lobby.members.map((member) => member.slot));
  const slot = existingGuest?.slot ?? findOpenSlot(usedSlots, lobby.maxPlayers);

  if (!slot) {
    throw new Error(`Local lobby ${normalizedRoomCode} is full.`);
  }

  const guestMember: LobbyMember = {
    profileId: existingGuest?.profileId ?? `local-guest-${slot}`,
    displayName: input.avatar.displayName || `Local Guest ${slot}`,
    fighterKey: input.fighterKey,
    avatar: input.avatar,
    ready: true,
    slot
  };

  lobby.members = [
    ...lobby.members.filter((member) => member.profileId !== guestMember.profileId),
    guestMember
  ].sort((left, right) => left.slot - right.slot);
  lobby.status = lobby.members.length >= 2 && lobby.members.every((member) => member.ready) ? "ready" : "open";

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

export async function createMatchmakingTicket(input: {
  fighterKey: BaseFighterKey;
  levelKey: LevelKey | null;
  mode: MatchmakingMode;
}): Promise<MatchmakingTicket | null> {
  if (!supabase) {
    return createLocalMatchmakingTicket(input);
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return createLocalMatchmakingTicket(input);
  }

  const { data, error } = await supabase
    .from("matchmaking_tickets")
    .insert({
      profile_id: user.id,
      fighter_key: input.fighterKey,
      level_key: input.levelKey,
      mode: input.mode,
      status: "searching"
    })
    .select("id, profile_id, fighter_key, level_key, mode, status, created_at")
    .single();

  if (error) {
    throw error;
  }

  const ticket: MatchmakingTicket = {
    id: data.id,
    profileId: data.profile_id,
    fighterKey: data.fighter_key,
    levelKey: data.level_key,
    mode: data.mode,
    status: data.status,
    createdAt: data.created_at
  };

  window.localStorage.setItem(localTicketKey, JSON.stringify(ticket));
  return ticket;
}

export async function cancelMatchmakingTicket(ticketId: string | null) {
  if (!ticketId) {
    return;
  }

  window.localStorage.removeItem(localTicketKey);

  if (!supabase) {
    return;
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return;
  }

  const { error } = await supabase
    .from("matchmaking_tickets")
    .update({ status: "cancelled" })
    .eq("id", ticketId)
    .eq("profile_id", user.id)
    .eq("status", "searching");

  if (error) {
    console.warn("Matchmaking cancel skipped", error);
  }
}

export async function tryMatchmaking(ticketId: string, avatar: PlayerAvatar): Promise<GameLobby | null> {
  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase.rpc("matchmake_stick_fighter_ticket", {
    p_ticket_id: ticketId
  });

  if (error || typeof data !== "string") {
    if (error) {
      console.warn("Matchmaking skipped", error);
    }
    return null;
  }

  const lobby = await fetchLobbyById(data);
  if (!lobby) {
    return null;
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (user && !lobby.members.some((member) => member.profileId === user.id)) {
    const usedSlots = new Set(lobby.members.map((member) => member.slot));
    const slot = findOpenSlot(usedSlots, lobby.maxPlayers);
    if (!slot) {
      return lobby;
    }

    const { error: joinError } = await supabase.from("lobby_members").upsert({
      lobby_id: lobby.id,
      profile_id: user.id,
      fighter_key: avatar.favoriteFighter,
      ready: true,
      slot
    });

    if (joinError) {
      throw joinError;
    }

    return fetchLobbyById(lobby.id);
  }

  return lobby;
}

export async function joinRealtimeRoom(input: {
  lobby: GameLobby;
  avatar: PlayerAvatar;
  fighterKey: BaseFighterKey;
  onState: (state: RealtimeRoomState) => void;
  onInputFrame?: (frame: RealtimeInputFrame) => void;
  onMatchStart?: (match: RealtimeMatchStart) => void;
  onLobbySync?: (sync: RealtimeLobbySync) => void;
}) {
  if (!supabase) {
    input.onState({
      lobbyId: input.lobby.id,
      onlineCount: Math.max(1, input.lobby.members.length),
      status: "closed",
      participants: input.lobby.members.map((member) => ({
        profileId: member.profileId,
        displayName: member.displayName,
        fighterKey: member.fighterKey,
        ready: member.ready,
        slot: member.slot
      }))
    });
    return () => undefined;
  }

  leaveRealtimeRoom();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    input.onState({
      lobbyId: input.lobby.id,
      onlineCount: 1,
      status: "closed",
      participants: []
    });
    return () => undefined;
  }

  const channel = supabase.channel(`match:${input.lobby.id}`, {
    config: {
      broadcast: {
        ack: false,
        self: false
      },
      presence: {
        key: user.id
      }
    }
  });

  activeRealtimeChannel = channel;
  input.onState({
    lobbyId: input.lobby.id,
    onlineCount: 1,
    status: "subscribing",
    participants: []
  });

  channel.on("presence", { event: "sync" }, () => {
    const participants = readPresenceParticipants(channel);
    input.onState({
      lobbyId: input.lobby.id,
      onlineCount: participants.length,
      status: "online",
      participants
    });
  });

  channel.on("broadcast", { event: "input-frame" }, (message) => {
    const frame = message.payload as RealtimeInputFrame;
    if (frame.profileId !== user.id) {
      input.onInputFrame?.({
        ...frame,
        receivedAt: Date.now()
      });
    }
  });

  channel.on("broadcast", { event: "match-start" }, (message) => {
    const match = message.payload as RealtimeMatchStart;
    if (match.hostProfileId !== user.id) {
      input.onMatchStart?.(match);
    }
  });

  channel.on("broadcast", { event: "lobby-sync" }, (message) => {
    const sync = message.payload as RealtimeLobbySync;
    if (sync.lobbyId === input.lobby.id) {
      input.onLobbySync?.(sync);
    }
  });

  channel.subscribe(async (status) => {
    if (status === "SUBSCRIBED") {
      await channel.track({
        profileId: user.id,
        displayName: input.avatar.displayName,
        fighterKey: input.fighterKey,
        ready: input.lobby.members.find((member) => member.profileId === user.id)?.ready ?? true,
        slot: input.lobby.members.find((member) => member.profileId === user.id)?.slot ?? 1,
        avatar: input.avatar,
        joinedAt: new Date().toISOString()
      });
      const participants = readPresenceParticipants(channel);
      input.onState({
        lobbyId: input.lobby.id,
        onlineCount: participants.length || 1,
        status: "online",
        participants
      });
      return;
    }

    if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
      input.onState({
        lobbyId: input.lobby.id,
        onlineCount: 1,
        status: "error",
        participants: readPresenceParticipants(channel)
      });
    }
  });

  return () => leaveRealtimeRoom();
}

export function leaveRealtimeRoom() {
  if (activeRealtimeChannel && supabase) {
    void supabase.removeChannel(activeRealtimeChannel);
  }
  activeRealtimeChannel = null;
}

export async function broadcastRealtimeInputFrame(frame: RealtimeInputFrame) {
  if (!activeRealtimeChannel) {
    return;
  }

  await activeRealtimeChannel.send({
    type: "broadcast",
    event: "input-frame",
    payload: frame
  });
}

export async function broadcastRealtimeMatchStart(match: RealtimeMatchStart) {
  if (!activeRealtimeChannel) {
    return;
  }

  await activeRealtimeChannel.send({
    type: "broadcast",
    event: "match-start",
    payload: match
  });
}

export async function broadcastRealtimeLobbySync(sync: RealtimeLobbySync) {
  if (!activeRealtimeChannel) {
    return;
  }

  await activeRealtimeChannel.send({
    type: "broadcast",
    event: "lobby-sync",
    payload: sync
  });
}

function readPresenceParticipants(channel: RealtimeChannel): RealtimeParticipant[] {
  return Object.values(channel.presenceState()).flatMap((entries) =>
    entries
      .map((entry) => {
        const participant = entry as Record<string, unknown>;
        const profileId = typeof participant.profileId === "string" ? participant.profileId : "";
        const displayName = typeof participant.displayName === "string" ? participant.displayName : "Player";
        const fighterKey = typeof participant.fighterKey === "string" ? (participant.fighterKey as BaseFighterKey) : "david";
        const ready = typeof participant.ready === "boolean" ? participant.ready : true;
        const rawSlot = typeof participant.slot === "number" ? participant.slot : 1;
        const slot = rawSlot >= 1 && rawSlot <= 4 ? (rawSlot as 1 | 2 | 3 | 4) : 1;

        return profileId
          ? {
              profileId,
              displayName,
              fighterKey,
              ready,
              slot
            }
          : null;
      })
      .filter((participant): participant is RealtimeParticipant => Boolean(participant))
  );
}

async function hydrateLobby(lobbyRow: {
  id: string;
  room_code: string;
  host_id: string;
  status: GameLobby["status"];
  level_key: string;
  mode: MatchmakingMode;
  max_players: 2 | 4;
  created_at: string;
}): Promise<GameLobby> {
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const { data: memberRows, error: memberError } = await supabase
    .from("lobby_members")
    .select("profile_id, fighter_key, slot, ready")
    .eq("lobby_id", lobbyRow.id)
    .order("slot", { ascending: true });

  if (memberError) {
    throw memberError;
  }

  const profileIds = memberRows.map((member) => member.profile_id);
  const { data: profileRows } =
    profileIds.length > 0
      ? await supabase
          .from("profiles")
          .select("id, display_name, favorite_fighter, avatar_frame, avatar_color")
          .in("id", profileIds)
      : { data: [] };
  const profiles = new Map((profileRows ?? []).map((profile) => [profile.id, profile]));

  return {
    id: lobbyRow.id,
    roomCode: lobbyRow.room_code,
    hostId: lobbyRow.host_id,
    status: lobbyRow.status,
    levelKey: lobbyRow.level_key,
    mode: lobbyRow.mode,
    maxPlayers: lobbyRow.max_players,
    members: memberRows.map((member) => {
      const profile = profiles.get(member.profile_id);
      const fighterKey = member.fighter_key as BaseFighterKey;
      return {
        profileId: member.profile_id,
        displayName: profile?.display_name ?? "Player",
        fighterKey,
        avatar: {
          displayName: profile?.display_name ?? "Player",
          frame: profile?.avatar_frame ?? "shepherd",
          color: profile?.avatar_color ?? "olive",
          favoriteFighter: profile?.favorite_fighter ?? fighterKey
        },
        ready: member.ready,
        slot: member.slot as 1 | 2 | 3 | 4
      };
    }),
    createdAt: lobbyRow.created_at
  };
}

async function refreshLobbyStatus(lobbyId: string) {
  if (!supabase) {
    return;
  }

  const lobby = await fetchLobbyById(lobbyId);
  if (!lobby || lobby.status === "in_match" || lobby.status === "closed") {
    return;
  }

  const nextStatus = lobby.members.length >= 2 && lobby.members.every((member) => member.ready) ? "ready" : "open";
  await updateHostLobbyStatus(lobbyId, nextStatus);
}

async function updateHostLobbyStatus(lobbyId: string, status: GameLobby["status"]) {
  if (!supabase) {
    return;
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return;
  }

  const { error } = await supabase
    .from("lobbies")
    .update({
      status,
      updated_at: new Date().toISOString()
    })
    .eq("id", lobbyId)
    .eq("host_id", user.id);

  if (error) {
    console.warn("Lobby status update skipped", error);
  }
}

function createRoomCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function findOpenSlot(usedSlots: Set<number>, maxPlayers: 2 | 4): LobbyMember["slot"] | null {
  for (let slot = 1; slot <= maxPlayers; slot += 1) {
    if (!usedSlots.has(slot)) {
      return slot as LobbyMember["slot"];
    }
  }

  return null;
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
