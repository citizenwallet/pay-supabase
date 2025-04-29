import type {
    PostgrestResponse,
    SupabaseClient,
} from "jsr:@supabase/supabase-js@2";

const TOKENS_TABLE = "t_push_token";

interface Token {
    token: string;
    account: string;
    created_at: string;
    updated_at: string;
}

export const getTokensForAddress = (
    client: SupabaseClient,
    chainId: string,
    contractAddress: string,
    address: string,
): Promise<PostgrestResponse<Token>> => {
    return Promise.resolve(
        client
            .from(`${TOKENS_TABLE}_${chainId}_${contractAddress.toLowerCase()}`)
            .select("token")
            .eq("account", address),
    ) as Promise<PostgrestResponse<Token>>;
};
