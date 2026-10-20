-- Pengelolaan katalog produk/menu milik mitra resto.
-- Jalankan melalui Supabase CLI/migration pipeline proyek; tidak dijalankan otomatis oleh commit GitHub.

create table if not exists public.merchant_products (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 120),
  description text not null default '' check (char_length(description) <= 1000),
  category text not null default '' check (char_length(category) <= 80),
  price numeric(12,2) not null check (price >= 0),
  image_url text,
  is_available boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists merchant_products_merchant_id_created_at_idx
  on public.merchant_products (merchant_id, created_at desc);

alter table public.merchant_products enable row level security;

drop policy if exists "Public can view available products from approved open restos" on public.merchant_products;
create policy "Public can view available products from approved open restos"
  on public.merchant_products
  for select
  using (
    is_available = true
    and exists (
      select 1
      from public.merchants m
      where m.id = merchant_products.merchant_id
        and m.type = 'official_merchant'
        and m.status = 'approved'
        and m.is_open = true
    )
  );

drop policy if exists "Resto owners can view all own products" on public.merchant_products;
create policy "Resto owners can view all own products"
  on public.merchant_products
  for select
  to authenticated
  using (
    exists (
      select 1 from public.merchants m
      where m.id = merchant_products.merchant_id
        and m.user_id = auth.uid()
    )
  );

drop policy if exists "Approved resto owners can insert own products" on public.merchant_products;
create policy "Approved resto owners can insert own products"
  on public.merchant_products
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.merchants m
      where m.id = merchant_products.merchant_id
        and m.user_id = auth.uid()
        and m.status = 'approved'
        and m.type = 'official_merchant'
    )
  );

drop policy if exists "Approved resto owners can update own products" on public.merchant_products;
create policy "Approved resto owners can update own products"
  on public.merchant_products
  for update
  to authenticated
  using (
    exists (
      select 1 from public.merchants m
      where m.id = merchant_products.merchant_id
        and m.user_id = auth.uid()
        and m.status = 'approved'
        and m.type = 'official_merchant'
    )
  )
  with check (
    exists (
      select 1 from public.merchants m
      where m.id = merchant_products.merchant_id
        and m.user_id = auth.uid()
        and m.status = 'approved'
        and m.type = 'official_merchant'
    )
  );

drop policy if exists "Approved resto owners can delete own products" on public.merchant_products;
create policy "Approved resto owners can delete own products"
  on public.merchant_products
  for delete
  to authenticated
  using (
    exists (
      select 1 from public.merchants m
      where m.id = merchant_products.merchant_id
        and m.user_id = auth.uid()
        and m.status = 'approved'
        and m.type = 'official_merchant'
    )
  );

-- Bucket foto produk. Menggunakan nama bucket yang sudah dipakai foto outlet.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('merchant-assets', 'merchant-assets', true, 5242880, array['image/webp'])
on conflict (id) do update
set public = true,
    file_size_limit = 5242880,
    allowed_mime_types = array['image/webp'];

drop policy if exists "Public can view merchant assets" on storage.objects;
create policy "Public can view merchant assets"
  on storage.objects for select
  using (bucket_id = 'merchant-assets');

drop policy if exists "Users can upload own merchant assets" on storage.objects;
create policy "Users can upload own merchant assets"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'merchant-assets'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can update own merchant assets" on storage.objects;
create policy "Users can update own merchant assets"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'merchant-assets'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'merchant-assets'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can delete own merchant assets" on storage.objects;
create policy "Users can delete own merchant assets"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'merchant-assets'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
