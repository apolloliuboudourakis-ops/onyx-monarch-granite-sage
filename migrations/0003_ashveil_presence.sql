alter table ash_session add column if not exists seen_at timestamptz not null default now();
