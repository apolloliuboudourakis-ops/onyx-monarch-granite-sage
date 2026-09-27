create table if not exists ash_user (
  id text primary key,
  username text not null,
  password_hash text not null,
  rating integer not null default 1000,
  wins integer not null default 0,
  losses integer not null default 0,
  created_at timestamptz not null default now()
);

create unique index if not exists ash_user_name on ash_user (lower(username));

create table if not exists ash_session (
  token text primary key,
  user_id text not null references ash_user (id),
  created_at timestamptz not null default now()
);

create table if not exists ash_friend (
  owner_id text not null references ash_user (id),
  friend_id text not null references ash_user (id),
  status text not null,
  primary key (owner_id, friend_id)
);

create table if not exists ash_room (
  code text primary key,
  map_id text not null,
  host_id text not null references ash_user (id),
  host_name text not null,
  guest_id text references ash_user (id),
  guest_name text,
  state text not null,
  status text not null,
  version integer not null default 1,
  rated boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists ash_invite (
  id text primary key,
  from_id text not null references ash_user (id),
  to_id text not null references ash_user (id),
  code text not null,
  created_at timestamptz not null default now()
);
