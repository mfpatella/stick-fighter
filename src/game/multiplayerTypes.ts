import type { BaseFighterKey } from "./fighterCatalog";

export type AvatarFrame = "shepherd" | "covenant" | "mighty" | "wild";
export type AvatarColor = "cedar" | "olive" | "gold" | "crimson" | "sky";
export type LobbyStatus = "open" | "ready" | "in_match" | "closed";
export type MatchmakingStatus = "searching" | "matched" | "cancelled" | "expired";
export type MatchmakingMode = "casual" | "ranked" | "private";

export type PlayerAvatar = {
  displayName: string;
  frame: AvatarFrame;
  color: AvatarColor;
  favoriteFighter: BaseFighterKey;
};

export type LobbyMember = {
  profileId: string;
  displayName: string;
  fighterKey: BaseFighterKey;
  avatar: PlayerAvatar;
  ready: boolean;
  slot: 1 | 2 | 3 | 4;
};

export type GameLobby = {
  id: string;
  roomCode: string;
  hostId: string;
  status: LobbyStatus;
  levelKey: string;
  mode: MatchmakingMode;
  maxPlayers: 2 | 4;
  members: LobbyMember[];
  createdAt: string;
};

export type MatchmakingTicket = {
  id: string;
  profileId: string;
  fighterKey: BaseFighterKey;
  levelKey: string | null;
  mode: MatchmakingMode;
  status: MatchmakingStatus;
  createdAt: string;
};
