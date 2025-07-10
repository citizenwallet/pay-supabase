import { PostgrestResponse, SupabaseClient } from "jsr:@supabase/supabase-js@2";

const TABLE_NAME = "places";

export type DisplayMode = "amount" | "menu" | "topup" | "amountAndMenu";

export interface Place {
    id: number;
    created_at: string;
    business_id: number;
    slug: string;
    name: string;
    accounts: string[];
    invite_code: string | null;
    terminal_id: number | null;
    image: string | null;
    description: string | null;
    hidden: boolean;
    archived: boolean;
    display: DisplayMode;
}

export const getPlacesByAccount = async (
    client: SupabaseClient,
    account: string,
): Promise<PostgrestResponse<Place>> => {
    return client
        .from(TABLE_NAME)
        .select("*")
        .contains("accounts", JSON.stringify([account]));
};
