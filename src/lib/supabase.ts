import { createClient } from '@supabase/supabase-js'

// Tras generar los tipos (`npm run tipos`), pasar `Database` como genérico de createClient.
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL as string,
  import.meta.env.VITE_SUPABASE_ANON_KEY as string,
)
