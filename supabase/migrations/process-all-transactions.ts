import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { getServiceRoleClient } from "../functions/_db/index.ts";
import { readLogs, totalLogs } from "../functions/_db/logs.ts";
import { ensureProfileExists } from "../functions/_citizen-wallet/profiles.ts";
import {
    communityConfig,
    type ERC20TransferData,
    type ERC20TransferExtraData,
    formatERC20TransactionValue,
} from "../functions/_citizen-wallet/index.ts";
import type { CommunityConfig } from "jsr:@citizenwallet/sdk";
import {
    type Transaction,
    type TransactionWithDescription,
    upsertTransaction,
    upsertTransactionWithDescription,
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

    console.log(`Found ${logs.length} logs`);

    for (const log of logs) {
        const erc20TransferData = log.data as ERC20TransferData;

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

        let erc20TransferExtraData: ERC20TransferExtraData = {
            description: "",
        };
        if (log.extra_data) {
            erc20TransferExtraData = log.extra_data as ERC20TransferExtraData;
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
            status: log.status,
        };

        const transactionWithDescription: TransactionWithDescription = {
            id: log.hash,
            description: erc20TransferExtraData.description || "",
        };

        await upsertTransaction(supabaseClient, transaction);
        await upsertTransactionWithDescription(
            supabaseClient,
            transactionWithDescription,
        );
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
