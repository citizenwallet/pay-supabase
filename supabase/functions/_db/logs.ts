import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import type { Log } from "jsr:@citizenwallet/sdk";

const TABLE_NAME = "t_logs";

export const totalLogs = async (
    client: SupabaseClient,
    chainId: string,
    contractAddress: string,
): Promise<number> => {
    const { count, error } = await client
        .from(`${TABLE_NAME}_${chainId}`)
        .select("*", { count: "exact", head: true })
        .eq("dest", contractAddress);

    if (error) {
        console.error("Error fetching total logs:", error);
        return 0;
    }

    return count ?? 0;
};

export const readLogs = async (
    client: SupabaseClient,
    chainId: string,
    contractAddress: string,
    limit: number = 100,
    offset: number = 0,
): Promise<Log[]> => {
    const { data, error } = await client
        .from(`${TABLE_NAME}_${chainId}`)
        .select("*")
        .eq("dest", contractAddress)
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);

    if (error) {
        console.error("Error fetching logs:", error);
        return [];
    }

    return data as unknown as Log[];
};

export const getLogByHash = async (
    client: SupabaseClient,
    chainId: number,
    hash: string,
): Promise<Log | null> => {
    const { data, error } = await client.from(`${TABLE_NAME}_${chainId}`)
        .select("*").eq(
            "hash",
            hash,
        ).maybeSingle();
    if (error) {
        console.error("Error fetching log:", error);
        return null;
    }
    return data as Log | null;
};
