import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { getServiceRoleClient } from "../functions/_db/index.ts";
import { readLogs, totalLogs } from "../functions/_db/logs.ts";
import { getLogDataByHash } from "../functions/_db/logs_data.ts";
import { ensureProfileExists } from "../functions/_citizen-wallet/profiles.ts";
import {
    communityConfig,
    type ERC20TransferData,
    formatERC20TransactionValue,
} from "../functions/_citizen-wallet/index.ts";
import type { CommunityConfig } from "npm:@citizenwallet/sdk";
import {
    type Transaction,
    upsertTransaction,
} from "../functions/_db/transactions.ts";

const processTransactions = async (
    supabaseClient: SupabaseClient,
    community: CommunityConfig,
    chainId: string,
    contractAddress: string,
    limit: number,
    offset: number = 0,
) => {
    console.log(
        `Processing ${limit} transactions from ${offset} until ${
            offset + limit - 1
        }...`,
    );
    const logs = await readLogs(
        supabaseClient,
        chainId,
        contractAddress,
        limit,
        offset,
    );

    for (const log of logs) {
        const erc20TransferData = log.data as unknown as ERC20TransferData;

        await ensureProfileExists(
            supabaseClient,
            community,
            erc20TransferData.from,
        );
        await ensureProfileExists(
            supabaseClient,
            community,
            erc20TransferData.to,
        );

        let description = "";

        const logData = await getLogDataByHash(
            supabaseClient,
            community.primaryToken.chain_id,
            log.hash,
        );

        if (logData) {
            description = logData.data.description;
        }

        const transaction: Transaction = {
            id: log.hash,
            hash: log.tx_hash,
            created_at: log.created_at,
            updated_at: log.created_at,
            from: erc20TransferData.from,
            to: erc20TransferData.to,
            value: formatERC20TransactionValue(
                community,
                erc20TransferData.value,
            ),
            description: description,
            status: log.status,
        };

        const { error } = await upsertTransaction(supabaseClient, transaction);

        if (error) {
            console.error("Error inserting transaction:", error);
        }
    }

    if (logs.length >= limit) {
        await processTransactions(
            supabaseClient,
            community,
            chainId,
            contractAddress,
            limit,
            offset + limit,
        );
    }
};

const main = async () => {
    console.log("Processing transactions...");

    const supabaseClient = getServiceRoleClient();

    const [chainId, contractAddress] = Deno.args;
    if (!chainId || !contractAddress) {
        console.error("Missing chainId or contractAddress");
        Deno.exit(1);
    }

    const total = await totalLogs(
        supabaseClient,
        chainId,
        contractAddress,
    );

    console.log(`Total logs: ${total}`);

    const community = communityConfig();

    const limit = 100;

    await processTransactions(
        supabaseClient,
        community,
        chainId,
        contractAddress,
        limit,
    );

    console.log("Done!");
};

// At the end of the file, add this line:
if (import.meta.main) {
    main();
}
