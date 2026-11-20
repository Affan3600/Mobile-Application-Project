// Runtime configuration. Values prefixed EXPO_PUBLIC_ are read from .env at build time.
// NOTE: anything EXPO_PUBLIC_ is bundled into the app and visible to users.
// For production, point EXPO_PUBLIC_STT_PROXY_URL at your own server so the OpenAI key never ships in the app.
// The Supabase anon key is meant to be public; the row level security policies in supabase/schema.sql protect the data.
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const config = {
  sttProvider: (process.env.EXPO_PUBLIC_STT_PROVIDER ?? 'whisper') as 'whisper' | 'google',
  openAiKey: process.env.EXPO_PUBLIC_OPENAI_API_KEY ?? '',
  sttProxyUrl: process.env.EXPO_PUBLIC_STT_PROXY_URL ?? '',
  supabaseUrl,
  supabaseAnonKey,
  useSupabase: !!supabaseUrl && !!supabaseAnonKey,
  mockLatencyMs: 250,
};
