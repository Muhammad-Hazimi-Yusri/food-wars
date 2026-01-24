create table households (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  created_at timestamptz default now() not null,
  owner_id uuid references auth.users(id) on delete cascade not null
);

alter table households enable row level security;

create policy "Users can view own households"
  on households for select
  using (owner_id = auth.uid());

create policy "Users can create households"
  on households for insert
  with check (owner_id = auth.uid());

create policy "Users can update own households"
  on households for update
  using (owner_id = auth.uid());

create policy "Users can delete own households"
  on households for delete
  using (owner_id = auth.uid());