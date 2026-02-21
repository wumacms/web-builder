import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let _admin: SupabaseClient | null = null;

function getAdmin(): SupabaseClient {
  if (!_admin) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    _admin = createClient(url, key, { auth: { persistSession: false } });
  }
  return _admin;
}

/** 仅服务端使用，具备 Database + Storage 完整权限，勿暴露到前端 */
export const supabaseAdmin = new Proxy({} as SupabaseClient, {
  get(_, prop) {
    return (getAdmin() as unknown as Record<string | symbol, unknown>)[prop];
  },
});

export function getStorageBucket(): string {
  return process.env.SUPABASE_STORAGE_BUCKET_SITES ?? "sites";
}
