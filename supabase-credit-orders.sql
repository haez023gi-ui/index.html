create table if not exists public.credit_orders (
  id uuid primary key default gen_random_uuid(),
  order_id text unique not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  credit_amount integer not null check (credit_amount > 0),
  amount_try numeric(12,2) not null check (amount_try > 0),
  provider text not null default 'iyzico',
  iyzico_token text,
  status text not null default 'pending' check (status in ('pending','paid','failed')),
  provider_response jsonb,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);
alter table public.credit_orders enable row level security;
create policy "customers can read own credit orders" on public.credit_orders for select using (auth.uid() = user_id);
