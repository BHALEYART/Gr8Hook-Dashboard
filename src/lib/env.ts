// Demo mode turns on automatically when Supabase isn't configured,
// so the app can be clicked through with sample data before anything is connected.
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
export const isDemo = !SUPABASE_URL || !SUPABASE_ANON_KEY;
