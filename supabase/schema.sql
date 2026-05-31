-- Starter Supabase schema for Stick Figure Fighter.
-- Apply only after connecting a real Supabase project.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 32),
  favorite_fighter text not null default 'david',
  avatar_frame text not null default 'shepherd' check (avatar_frame in ('shepherd', 'covenant', 'mighty', 'wild')),
  avatar_color text not null default 'olive' check (avatar_color in ('cedar', 'olive', 'gold', 'crimson', 'sky')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Profiles are readable by everyone"
  on public.profiles
  for select
  using (true);

create policy "Players can insert their own profile"
  on public.profiles
  for insert
  with check (auth.uid() = id);

create policy "Players can update their own profile"
  on public.profiles
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create table if not exists public.lobbies (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.profiles(id) on delete cascade,
  room_code text not null unique check (char_length(room_code) between 4 and 12),
  mode text not null default 'casual' check (mode in ('casual', 'ranked', 'private')),
  level_key text not null default 'trainingYard',
  max_players integer not null default 2 check (max_players in (2, 4)),
  status text not null default 'open' check (status in ('open', 'ready', 'in_match', 'closed')),
  created_at timestamptz not null default now()
);

alter table public.lobbies enable row level security;

create policy "Open lobbies are readable"
  on public.lobbies
  for select
  using (status in ('open', 'ready', 'in_match'));

create policy "Authenticated players can create lobbies"
  on public.lobbies
  for insert
  with check (auth.uid() = host_id);

create policy "Hosts can update their lobbies"
  on public.lobbies
  for update
  using (auth.uid() = host_id)
  with check (auth.uid() = host_id);

create table if not exists public.lobby_members (
  lobby_id uuid not null references public.lobbies(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  fighter_key text not null default 'david',
  slot integer not null check (slot between 1 and 4),
  ready boolean not null default false,
  joined_at timestamptz not null default now(),
  primary key (lobby_id, profile_id),
  unique (lobby_id, slot)
);

alter table public.lobby_members enable row level security;

create policy "Lobby members are readable for visible lobbies"
  on public.lobby_members
  for select
  using (
    exists (
      select 1
      from public.lobbies
      where lobbies.id = lobby_members.lobby_id
        and lobbies.status in ('open', 'ready', 'in_match')
    )
  );

create policy "Players can join as themselves"
  on public.lobby_members
  for insert
  with check (auth.uid() = profile_id);

create policy "Players can update their own lobby member row"
  on public.lobby_members
  for update
  using (auth.uid() = profile_id)
  with check (auth.uid() = profile_id);

create policy "Players can leave their own lobby"
  on public.lobby_members
  for delete
  using (auth.uid() = profile_id);

create table if not exists public.matchmaking_tickets (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  fighter_key text not null default 'david',
  level_key text,
  mode text not null default 'casual' check (mode in ('casual', 'ranked', 'private')),
  status text not null default 'searching' check (status in ('searching', 'matched', 'cancelled', 'expired')),
  created_at timestamptz not null default now(),
  matched_lobby_id uuid references public.lobbies(id) on delete set null
);

alter table public.matchmaking_tickets enable row level security;

create policy "Players can read their own matchmaking tickets"
  on public.matchmaking_tickets
  for select
  using (auth.uid() = profile_id);

create policy "Players can create their own matchmaking tickets"
  on public.matchmaking_tickets
  for insert
  with check (auth.uid() = profile_id);

create policy "Players can update their own matchmaking tickets"
  on public.matchmaking_tickets
  for update
  using (auth.uid() = profile_id)
  with check (auth.uid() = profile_id);

create table if not exists public.match_results (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.profiles(id) on delete cascade,
  opponent_kind text not null,
  fighter_key text not null,
  result text not null check (result in ('win', 'loss', 'draw')),
  duration_seconds integer not null check (duration_seconds >= 0),
  created_at timestamptz not null default now()
);

alter table public.match_results enable row level security;

create policy "Players can read their own match results"
  on public.match_results
  for select
  using (auth.uid() = player_id);

create policy "Players can insert their own match results"
  on public.match_results
  for insert
  with check (auth.uid() = player_id);

grant usage on schema public to anon, authenticated;
grant select, insert, update on public.profiles to authenticated;
grant select on public.profiles to anon;
grant select, insert, update on public.lobbies to authenticated;
grant select on public.lobbies to anon;
grant select, insert, update, delete on public.lobby_members to authenticated;
grant select on public.lobby_members to anon;
grant select, insert, update on public.matchmaking_tickets to authenticated;
grant select, insert on public.match_results to authenticated;
