-- Additive schema for editable app branding and independent announcements.
CREATE TABLE IF NOT EXISTS public.app_branding (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  app_name text NOT NULL DEFAULT 'Mider',
  logo_url text,
  favicon_url text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);
INSERT INTO public.app_branding (id, app_name) VALUES (1, 'Mider') ON CONFLICT (id) DO NOTHING;
ALTER TABLE public.app_branding ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can read app branding" ON public.app_branding FOR SELECT USING (true);
CREATE POLICY "Superadmins manage app branding" ON public.app_branding FOR ALL
  USING (public.has_role('superadmin'::public.app_role, auth.uid()))
  WITH CHECK (public.has_role('superadmin'::public.app_role, auth.uid()));

CREATE TABLE IF NOT EXISTS public.app_announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  message text NOT NULL,
  audience text NOT NULL DEFAULT 'all' CHECK (audience IN ('all', 'driver', 'user', 'mitra')),
  announcement_type text NOT NULL DEFAULT 'info' CHECK (announcement_type IN ('info', 'important', 'maintenance', 'promotion')),
  placement text NOT NULL DEFAULT 'banner' CHECK (placement IN ('banner', 'popup', 'inbox')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'disabled')),
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT app_announcements_valid_dates CHECK (ends_at IS NULL OR ends_at > starts_at)
);
CREATE INDEX app_announcements_active_idx ON public.app_announcements (status, starts_at, ends_at, audience);
ALTER TABLE public.app_announcements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read published announcements" ON public.app_announcements FOR SELECT USING (
 status = 'published' AND starts_at <= now() AND (ends_at IS NULL OR ends_at > now()) AND (
 audience = 'all'
 OR (audience = 'driver' AND public.has_role('driver'::public.app_role, auth.uid()))
 OR (audience = 'mitra' AND public.has_role('mitra'::public.app_role, auth.uid()))
 OR (audience = 'user' AND auth.uid() IS NOT NULL
     AND NOT public.has_role('driver'::public.app_role, auth.uid())
     AND NOT public.has_role('mitra'::public.app_role, auth.uid())
     AND NOT public.has_role('superadmin'::public.app_role, auth.uid()))
 ));
CREATE POLICY "Superadmins manage announcements" ON public.app_announcements FOR ALL
 USING (public.has_role('superadmin'::public.app_role, auth.uid()))
 WITH CHECK (public.has_role('superadmin'::public.app_role, auth.uid()));

CREATE TABLE IF NOT EXISTS public.announcement_reads (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 announcement_id uuid NOT NULL REFERENCES public.app_announcements(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 read_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (announcement_id, user_id)
);
ALTER TABLE public.announcement_reads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own announcement reads" ON public.announcement_reads FOR ALL
 USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('app-branding', 'app-branding', true, 5242880, ARRAY['image/png','image/jpeg','image/webp','image/svg+xml','image/x-icon','image/vnd.microsoft.icon'])
ON CONFLICT (id) DO NOTHING;
CREATE POLICY "Public read app branding assets" ON storage.objects FOR SELECT USING (bucket_id = 'app-branding');
CREATE POLICY "Superadmins upload app branding assets" ON storage.objects FOR INSERT
 WITH CHECK (bucket_id = 'app-branding' AND public.has_role('superadmin'::public.app_role, auth.uid()));
CREATE POLICY "Superadmins update app branding assets" ON storage.objects FOR UPDATE
 USING (bucket_id = 'app-branding' AND public.has_role('superadmin'::public.app_role, auth.uid()))
 WITH CHECK (bucket_id = 'app-branding' AND public.has_role('superadmin'::public.app_role, auth.uid()));
CREATE POLICY "Superadmins delete app branding assets" ON storage.objects FOR DELETE
 USING (bucket_id = 'app-branding' AND public.has_role('superadmin'::public.app_role, auth.uid()));
