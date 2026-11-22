-- Postharvest Storage Monitor: Supabase PostgreSQL Schema & RLS Policies
-- Scope: profiles, storage_rooms, batches, alerts with cooperative_id isolation

create extension if not exists pgcrypto;

-- Helper: resolve authenticated user's cooperative_id safely inside RLS policies
create or replace function public.current_cooperative_id()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select cooperative_id
  from public.profiles
  where id = auth.uid();
$$;

-- 1. User profiles & persisted UI / notification preferences
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  cooperative_id text not null,
  full_name text not null,
  email text not null,
  cooperative_name text not null,
  role text not null check (
    role in ('Facility Manager', 'Cold-Chain Operator', 'Quality Inspector')
  ),
  language text not null default 'en' check (language in ('en', 'fil')),
  theme_prefs jsonb not null default '{"theme":"light","blurPx":24,"frostPct":68,"depthScale":1,"dispersionPct":100}'::jsonb,
  notification_prefs jsonb not null default '{"criticalTemp":true,"sensorOffline":true,"fefoReminders":true,"audibleChime":false}'::jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists idx_profiles_cooperative_id
  on public.profiles (cooperative_id);

-- 2. Storage rooms & telemetry / threshold / equipment state
create table if not exists public.storage_rooms (
  id text primary key,
  cooperative_id text not null,
  cooperative_name text not null,
  name text not null,
  crop text not null check (crop in ('Tomato', 'Broccoli')),
  temp_c numeric not null,
  humidity_pct numeric not null,
  co2_ppm numeric not null,
  gas_index numeric not null,
  min_temp numeric not null,
  max_temp numeric not null,
  min_humidity numeric not null default 90,
  max_humidity numeric not null default 98,
  co2_max numeric not null default 1500,
  gas_index_max numeric not null default 1.8,
  equipment_mode text not null default 'auto' check (
    equipment_mode in ('auto', 'boost', 'standby')
  ),
  defrost_active boolean not null default false,
  sensor_online boolean not null default true,
  updated_at timestamptz not null default now()
);

create index if not exists idx_storage_rooms_cooperative_id
  on public.storage_rooms (cooperative_id);

-- 3. Inventory batches & FEFO release state
create table if not exists public.batches (
  id text primary key,
  cooperative_id text not null,
  room_id text not null references public.storage_rooms(id) on delete cascade,
  rack_id text not null default 'R1',
  crop text not null check (crop in ('Tomato', 'Broccoli')),
  quantity_kg numeric not null check (quantity_kg >= 0),
  shelf_life_days integer not null check (shelf_life_days >= 0),
  shelf_life_limit integer not null check (shelf_life_limit >= 1),
  current_price_php numeric not null check (current_price_php > 0),
  target_price_php numeric not null check (target_price_php > 0),
  status text not null default 'active' check (
    status in ('active', 'hold', 'released')
  ),
  release_note text,
  created_at timestamptz not null default now()
);

create index if not exists idx_batches_cooperative_id
  on public.batches (cooperative_id);
create index if not exists idx_batches_room_id
  on public.batches (room_id);

-- 4. Operational alert log
create table if not exists public.alerts (
  id uuid primary key default gen_random_uuid(),
  cooperative_id text not null,
  room_id text not null references public.storage_rooms(id) on delete cascade,
  type text not null,
  severity text not null check (severity in ('critical', 'warning', 'no_data')),
  message text not null,
  acknowledged boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_alerts_cooperative_id
  on public.alerts (cooperative_id);
create index if not exists idx_alerts_room_id
  on public.alerts (room_id);

-- Enable Row-Level Security across all operational tables
alter table public.profiles enable row level security;
alter table public.storage_rooms enable row level security;
alter table public.batches enable row level security;
alter table public.alerts enable row level security;

-- Profiles RLS: strictly self-scoped to auth.uid()
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles for insert
  with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Storage rooms RLS: cooperative-scoped
drop policy if exists "storage_rooms_select_coop" on public.storage_rooms;
create policy "storage_rooms_select_coop"
  on public.storage_rooms for select
  using (cooperative_id = public.current_cooperative_id());

drop policy if exists "storage_rooms_insert_coop" on public.storage_rooms;
create policy "storage_rooms_insert_coop"
  on public.storage_rooms for insert
  with check (cooperative_id = public.current_cooperative_id());

drop policy if exists "storage_rooms_update_coop" on public.storage_rooms;
create policy "storage_rooms_update_coop"
  on public.storage_rooms for update
  using (cooperative_id = public.current_cooperative_id())
  with check (cooperative_id = public.current_cooperative_id());

drop policy if exists "storage_rooms_delete_coop" on public.storage_rooms;
create policy "storage_rooms_delete_coop"
  on public.storage_rooms for delete
  using (cooperative_id = public.current_cooperative_id());

-- Batches RLS: cooperative-scoped
drop policy if exists "batches_select_coop" on public.batches;
create policy "batches_select_coop"
  on public.batches for select
  using (cooperative_id = public.current_cooperative_id());

drop policy if exists "batches_insert_coop" on public.batches;
create policy "batches_insert_coop"
  on public.batches for insert
  with check (cooperative_id = public.current_cooperative_id());

drop policy if exists "batches_update_coop" on public.batches;
create policy "batches_update_coop"
  on public.batches for update
  using (cooperative_id = public.current_cooperative_id())
  with check (cooperative_id = public.current_cooperative_id());

drop policy if exists "batches_delete_coop" on public.batches;
create policy "batches_delete_coop"
  on public.batches for delete
  using (cooperative_id = public.current_cooperative_id());

-- Alerts RLS: cooperative-scoped
drop policy if exists "alerts_select_coop" on public.alerts;
create policy "alerts_select_coop"
  on public.alerts for select
  using (cooperative_id = public.current_cooperative_id());

drop policy if exists "alerts_insert_coop" on public.alerts;
create policy "alerts_insert_coop"
  on public.alerts for insert
  with check (cooperative_id = public.current_cooperative_id());

drop policy if exists "alerts_update_coop" on public.alerts;
create policy "alerts_update_coop"
  on public.alerts for update
  using (cooperative_id = public.current_cooperative_id())
  with check (cooperative_id = public.current_cooperative_id());

drop policy if exists "alerts_delete_coop" on public.alerts;
create policy "alerts_delete_coop"
  on public.alerts for delete
  using (cooperative_id = public.current_cooperative_id());

-- Realtime publication for live cross-session sync
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'storage_rooms'
  ) then
    alter publication supabase_realtime add table public.storage_rooms;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'batches'
  ) then
    alter publication supabase_realtime add table public.batches;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'alerts'
  ) then
    alter publication supabase_realtime add table public.alerts;
  end if;
end $$;

-- Idempotent baseline seed data for Benguet Highland Cooperative (Tomato & Broccoli)
insert into public.storage_rooms (
  id,
  cooperative_id,
  cooperative_name,
  name,
  crop,
  temp_c,
  humidity_pct,
  co2_ppm,
  gas_index,
  min_temp,
  max_temp,
  min_humidity,
  max_humidity,
  co2_max,
  gas_index_max,
  equipment_mode,
  defrost_active,
  sensor_online
)
values
  ('benguet-highland-room-a', 'benguet-highland', 'Benguet Highland', 'Room A', 'Broccoli', 4.6, 96.0, 710, 1.1, 0.0, 2.0, 95, 98, 1000, 1.2, 'boost', false, true),
  ('benguet-highland-room-b', 'benguet-highland', 'Benguet Highland', 'Room B', 'Broccoli', 1.4, 96.0, 490, 0.6, 0.0, 2.0, 95, 98, 1000, 1.2, 'auto', false, true),
  ('benguet-highland-room-c', 'benguet-highland', 'Benguet Highland', 'Room C', 'Tomato', 15.4, 91.2, 980, 1.6, 10.0, 12.5, 90, 95, 1500, 1.8, 'boost', false, true),
  ('benguet-highland-room-d', 'benguet-highland', 'Benguet Highland', 'Room D', 'Tomato', 11.2, 92.5, 640, 0.9, 10.0, 12.5, 90, 95, 1500, 1.8, 'standby', false, false)
on conflict (id) do update set
  crop = excluded.crop,
  temp_c = excluded.temp_c,
  humidity_pct = excluded.humidity_pct,
  co2_ppm = excluded.co2_ppm,
  gas_index = excluded.gas_index,
  min_temp = excluded.min_temp,
  max_temp = excluded.max_temp,
  min_humidity = excluded.min_humidity,
  max_humidity = excluded.max_humidity,
  co2_max = excluded.co2_max,
  gas_index_max = excluded.gas_index_max,
  equipment_mode = excluded.equipment_mode,
  sensor_online = excluded.sensor_online;

insert into public.batches (
  id,
  cooperative_id,
  room_id,
  rack_id,
  crop,
  quantity_kg,
  shelf_life_days,
  shelf_life_limit,
  current_price_php,
  target_price_php,
  status
)
values
  ('benguet-highland-B-001', 'benguet-highland', 'benguet-highland-room-a', 'R1', 'Broccoli', 420, 2, 10, 158, 145, 'active'),
  ('benguet-highland-B-002', 'benguet-highland', 'benguet-highland-room-a', 'R2', 'Broccoli', 360, 4, 10, 152, 145, 'active'),
  ('benguet-highland-B-003', 'benguet-highland', 'benguet-highland-room-c', 'R1', 'Tomato', 680, 3, 14, 88, 82, 'active'),
  ('benguet-highland-B-004', 'benguet-highland', 'benguet-highland-room-c', 'R2', 'Tomato', 590, 6, 14, 84, 82, 'active'),
  ('benguet-highland-B-005', 'benguet-highland', 'benguet-highland-room-b', 'R1', 'Broccoli', 510, 8, 10, 134, 148, 'active'),
  ('benguet-highland-B-006', 'benguet-highland', 'benguet-highland-room-d', 'R1', 'Tomato', 920, 11, 14, 72, 85, 'active'),
  ('benguet-highland-B-007', 'benguet-highland', 'benguet-highland-room-b', 'R2', 'Broccoli', 440, 9, 10, 128, 148, 'active')
on conflict (id) do update set
  room_id = excluded.room_id,
  rack_id = excluded.rack_id,
  crop = excluded.crop,
  quantity_kg = excluded.quantity_kg,
  shelf_life_days = excluded.shelf_life_days,
  shelf_life_limit = excluded.shelf_life_limit,
  current_price_php = excluded.current_price_php,
  target_price_php = excluded.target_price_php;

insert into public.alerts (
  id,
  cooperative_id,
  room_id,
  type,
  severity,
  message,
  acknowledged
)
values
  ('10000000-0000-4000-8000-000000000001', 'benguet-highland', 'benguet-highland-room-a', 'Temperature high', 'critical', 'Room A temperature above range (4.6 °C, floret yellowing risk)', false),
  ('10000000-0000-4000-8000-000000000002', 'benguet-highland', 'benguet-highland-room-c', 'Temperature high', 'critical', 'Room C temperature above range (15.4 °C, accelerated ripening risk)', false),
  ('10000000-0000-4000-8000-000000000003', 'benguet-highland', 'benguet-highland-room-d', 'Sensor offline', 'no_data', 'Room D sensor offline since 05:14', false)
on conflict (id) do update set
  room_id = excluded.room_id,
  type = excluded.type,
  severity = excluded.severity,
  message = excluded.message;
