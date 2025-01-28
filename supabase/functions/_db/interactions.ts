import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { Transaction } from "./transactions.ts";

const INTERACTIONS_TABLE = "a_interactions";

export const upsertInteraction = async (
    client: SupabaseClient,
    transaction: Pick<Transaction, "id" | "from" | "to">,
) => {
    const timestamp = new Date().toISOString();

    // First direction: from->to
     await client
        .from(INTERACTIONS_TABLE)
        .upsert(
            {
                transaction_id: transaction.id,
                account: transaction.from,
                with: transaction.to,
                updated_at: timestamp,
                created_at: timestamp,
                new_interaction: true,
            },
            {
                onConflict: "account,with",
                ignoreDuplicates: false,
            },
        )
        .select()
        .single();

    // Second direction: to->from
    await client
        .from(INTERACTIONS_TABLE)
        .upsert({
            transaction_id: transaction.id,
            account: transaction.to,
            with: transaction.from,
            updated_at: timestamp,
            created_at: timestamp,
            new_interaction: true,
        }, {
            onConflict: "account,with",
            ignoreDuplicates: false,
        })
        .select()
        .single();
};
