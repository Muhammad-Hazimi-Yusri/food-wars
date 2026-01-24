create type item_category as enum ('fridge', 'freezer', 'pantry', 'spices');

create table inventory_items (
  id uuid default gen_random_uuid() primary key,
  household_id uuid references households(id) on delete cascade not null,
  name text not null,
  quantity numeric not null default 1,
  unit text not null default 'pc',
  category item_category not null default 'fridge',
  expiry_date date,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

alter table inventory_items enable row level security;

create policy "Users can view household items"
  on inventory_items for select
  using (
    household_id in (
      select id from households where owner_id = auth.uid()
    )
  );

create policy "Users can create household items"
  on inventory_items for insert
  with check (
    household_id in (
      select id from households where owner_id = auth.uid()
    )
  );

create policy "Users can update household items"
  on inventory_items for update
  using (
    household_id in (
      select id from households where owner_id = auth.uid()
    )
  );

create policy "Users can delete household items"
  on inventory_items for delete
  using (
    household_id in (
      select id from households where owner_id = auth.uid()
    )
  );