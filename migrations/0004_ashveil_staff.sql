alter table ash_user add column if not exists operator boolean not null default false;
alter table ash_user add column if not exists dev boolean not null default false;
