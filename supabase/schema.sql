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

create table if not exists public.player_stats (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  wins integer not null default 0 check (wins >= 0),
  losses integer not null default 0 check (losses >= 0),
  draws integer not null default 0 check (draws >= 0),
  matches_played integer not null default 0 check (matches_played >= 0),
  current_streak integer not null default 0 check (current_streak >= 0),
  best_streak integer not null default 0 check (best_streak >= 0),
  total_duration_seconds integer not null default 0 check (total_duration_seconds >= 0),
  rating integer not null default 1000 check (rating >= 0),
  updated_at timestamptz not null default now()
);

alter table public.player_stats enable row level security;

create policy "Player stats are readable by everyone"
  on public.player_stats
  for select
  using (true);

create policy "Players can insert their own stats row"
  on public.player_stats
  for insert
  with check (auth.uid() = profile_id);

create policy "Players can update their own stats row"
  on public.player_stats
  for update
  using (auth.uid() = profile_id)
  with check (auth.uid() = profile_id);

create table if not exists public.lobbies (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.profiles(id) on delete cascade,
  room_code text not null unique check (char_length(room_code) between 4 and 12),
  mode text not null default 'casual' check (mode in ('casual', 'ranked', 'private')),
  level_key text not null default 'trainingYard',
  max_players integer not null default 2 check (max_players in (2, 4)),
  status text not null default 'open' check (status in ('open', 'ready', 'in_match', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '45 minutes')
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
  match_id uuid not null default gen_random_uuid(),
  player_id uuid not null references public.profiles(id) on delete cascade,
  opponent_player_id uuid references public.profiles(id) on delete set null,
  opponent_kind text not null,
  fighter_key text not null,
  opponent_fighter_key text,
  level_key text,
  mode text not null default 'casual' check (mode in ('casual', 'ranked', 'private', 'training')),
  result text not null check (result in ('win', 'loss', 'draw')),
  duration_seconds integer not null check (duration_seconds >= 0),
  verified boolean not null default false,
  created_at timestamptz not null default now()
);

create unique index if not exists match_results_match_player_idx
  on public.match_results(match_id, player_id);

create index if not exists matchmaking_tickets_search_idx
  on public.matchmaking_tickets(mode, status, created_at);

create index if not exists lobbies_status_expiry_idx
  on public.lobbies(status, expires_at);

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
grant select, insert, update on public.player_stats to authenticated;
grant select on public.player_stats to anon;
grant select, insert, update on public.lobbies to authenticated;
grant select on public.lobbies to anon;
grant select, insert, update, delete on public.lobby_members to authenticated;
grant select on public.lobby_members to anon;
grant select, insert, update on public.matchmaking_tickets to authenticated;
grant select, insert on public.match_results to authenticated;

create or replace function public.matchmake_stick_fighter_ticket(p_ticket_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_ticket public.matchmaking_tickets%rowtype;
  opponent_ticket public.matchmaking_tickets%rowtype;
  new_lobby_id uuid;
  new_room_code text;
  selected_level text;
begin
  select *
    into current_ticket
    from public.matchmaking_tickets
    where id = p_ticket_id
      and status = 'searching'
    for update;

  if not found then
    return null;
  end if;

  if auth.uid() is null or auth.uid() <> current_ticket.profile_id then
    raise exception 'Only the ticket owner can run matchmaking';
  end if;

  select *
    into opponent_ticket
    from public.matchmaking_tickets
    where id <> current_ticket.id
      and profile_id <> current_ticket.profile_id
      and status = 'searching'
      and mode = current_ticket.mode
      and (
        current_ticket.level_key is null
        or level_key is null
        or level_key = current_ticket.level_key
      )
    order by created_at asc
    for update skip locked
    limit 1;

  if not found then
    return null;
  end if;

  selected_level := coalesce(current_ticket.level_key, opponent_ticket.level_key, 'trainingYard');
  new_room_code := upper(substr(md5(gen_random_uuid()::text), 1, 6));

  insert into public.lobbies (
    host_id,
    room_code,
    mode,
    level_key,
    max_players,
    status,
    updated_at,
    expires_at
  )
  values (
    opponent_ticket.profile_id,
    new_room_code,
    current_ticket.mode,
    selected_level,
    2,
    'ready',
    now(),
    now() + interval '45 minutes'
  )
  returning id into new_lobby_id;

  insert into public.lobby_members (lobby_id, profile_id, fighter_key, ready, slot)
  values
    (new_lobby_id, opponent_ticket.profile_id, opponent_ticket.fighter_key, true, 1),
    (new_lobby_id, current_ticket.profile_id, current_ticket.fighter_key, true, 2);

  update public.matchmaking_tickets
    set status = 'matched',
        matched_lobby_id = new_lobby_id
    where id in (current_ticket.id, opponent_ticket.id);

  return new_lobby_id;
end;
$$;

create or replace function public.record_stick_fighter_match(
  p_match_id uuid,
  p_player_id uuid,
  p_opponent_player_id uuid,
  p_opponent_kind text,
  p_fighter_key text,
  p_opponent_fighter_key text,
  p_level_key text,
  p_mode text,
  p_result text,
  p_duration_seconds integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_result_id uuid;
  win_count integer := case when p_result = 'win' then 1 else 0 end;
  loss_count integer := case when p_result = 'loss' then 1 else 0 end;
  draw_count integer := case when p_result = 'draw' then 1 else 0 end;
begin
  if auth.uid() is null or auth.uid() <> p_player_id then
    raise exception 'Only the current player can record their match result';
  end if;

  if p_result not in ('win', 'loss', 'draw') then
    raise exception 'Invalid match result';
  end if;

  insert into public.match_results (
    match_id,
    player_id,
    opponent_player_id,
    opponent_kind,
    fighter_key,
    opponent_fighter_key,
    level_key,
    mode,
    result,
    duration_seconds,
    verified
  )
  values (
    p_match_id,
    p_player_id,
    p_opponent_player_id,
    p_opponent_kind,
    p_fighter_key,
    p_opponent_fighter_key,
    p_level_key,
    p_mode,
    p_result,
    p_duration_seconds,
    p_opponent_kind = 'cpu'
  )
  on conflict (match_id, player_id) do nothing
  returning id into inserted_result_id;

  if inserted_result_id is null then
    return;
  end if;

  insert into public.player_stats (
    profile_id,
    wins,
    losses,
    draws,
    matches_played,
    current_streak,
    best_streak,
    total_duration_seconds,
    updated_at
  )
  values (
    p_player_id,
    win_count,
    loss_count,
    draw_count,
    1,
    win_count,
    win_count,
    p_duration_seconds,
    now()
  )
  on conflict (profile_id) do update
    set wins = public.player_stats.wins + excluded.wins,
        losses = public.player_stats.losses + excluded.losses,
        draws = public.player_stats.draws + excluded.draws,
        matches_played = public.player_stats.matches_played + 1,
        current_streak = case
          when p_result = 'win' then public.player_stats.current_streak + 1
          when p_result = 'loss' then 0
          else public.player_stats.current_streak
        end,
        best_streak = greatest(
          public.player_stats.best_streak,
          case
            when p_result = 'win' then public.player_stats.current_streak + 1
            when p_result = 'loss' then 0
            else public.player_stats.current_streak
          end
        ),
        total_duration_seconds = public.player_stats.total_duration_seconds + excluded.total_duration_seconds,
        updated_at = now();
end;
$$;
