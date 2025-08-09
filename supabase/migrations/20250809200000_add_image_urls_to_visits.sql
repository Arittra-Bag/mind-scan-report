-- Add image URL columns to visits for storage-backed images
alter table if exists public.visits
  add column if not exists image_url text,
  add column if not exists annotated_image_url text;

-- Optional: simple index for querying by latest with images
create index if not exists idx_visits_image_url on public.visits (image_url);
create index if not exists idx_visits_annotated_image_url on public.visits (annotated_image_url);

