-- 1. Create Profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  role TEXT DEFAULT 'visitante' CHECK (role IN ('admin', 'pcm', 'gestao', 'visitante')),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. Create RLS Policies
-- Users can view all profiles (needed for sidebar/UI)
CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles
  FOR SELECT USING (true);

-- Users can only update their own profile
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- 4. Create Trigger to handle new user signups
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    new.id, 
    COALESCE(new.raw_user_meta_data->>'full_name', 'Usuário'), 
    COALESCE(new.raw_app_meta_data->>'role', 'visitante')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Trigger call
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 6. Setup Storage for Avatars
-- Note: Create 'avatars' bucket manually in Supabase Dashboard first if it doesn't exist
-- Policy to allow authenticated users to upload their own avatar
-- (Replace 'avatars' with your bucket name if different)
-- CREATE POLICY "Avatar upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.role() = 'authenticated');
-- CREATE POLICY "Avatar update" ON storage.objects FOR UPDATE WITH CHECK (bucket_id = 'avatars' AND auth.role() = 'authenticated');
-- CREATE POLICY "Avatar view" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');

-- 7. Admin Specific Policies (New)
-- Allow admins to update any profile (to change roles)
CREATE POLICY "Admins can update any profile" ON public.profiles
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Allow admins to delete any profile
CREATE POLICY "Admins can delete any profile" ON public.profiles
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
