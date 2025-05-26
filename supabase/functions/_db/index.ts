import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

export const getServiceRoleClient = (): SupabaseClient => {
    return createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
        {
            auth: {
                autoRefreshToken: false,
                persistSession: false,
            },
        },
    );
};
