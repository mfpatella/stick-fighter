alter table public.lobbies
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists expires_at timestamptz not null default (now() + interval '45 minutes');

alter table public.match_results
  add column if not exists match_id uuid not null default gen_random_uuid(),
  add column if not exists opponent_player_id uuid references public.profiles(id) on delete set null,
  add column if not exists verified boolean not null default false;

create unique index if not exists match_results_match_player_idx
  on public.match_results(match_id, player_id);

create index if not exists matchmaking_tickets_search_idx
  on public.matchmaking_tickets(mode, status, created_at);

create index if not exists lobbies_status_expiry_idx
  on public.lobbies(status, expires_at);

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
