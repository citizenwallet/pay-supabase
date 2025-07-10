import type { SupabaseClient } from "jsr:@supabase/supabase-js";

const TABLE_NAME = "t_logs_data";

interface LogExtraData {
    hash: string;
    data: {
        description: string;
    };
    created_at: string;
    updated_at: string;
}

export const getLogDataByHash = async (
    client: SupabaseClient,
    chainId: number,
    hash: string,
): Promise<LogExtraData | null> => {
    const { data, error } = await client.from(`${TABLE_NAME}_${chainId}`)
        .select("*").eq(
            "hash",
            hash,
        ).maybeSingle();
    if (error) {
        console.error("Error fetching log data:", error);
        return null;
    }
    return data as LogExtraData | null;
};
