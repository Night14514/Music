create table if not exists public.tracks (
  id bigserial primary key,
  title text not null,
  artist text not null,
  file text not null,
  start integer not null check (start >= 0)
);

create index if not exists tracks_title_idx on public.tracks (title);
create index if not exists tracks_artist_idx on public.tracks (artist);

-- Optional: RLS can be enabled if you expose anon key access.
-- For this architecture, Next.js API and bot use service-role key.

