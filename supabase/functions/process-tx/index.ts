// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
// import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import {
  communityConfig,
  type ERC20TransferData,
  formatERC20TransactionValue,
} from "../_citizen-wallet/index.ts";
import { getServiceRoleClient } from "../_db/index.ts";
import { type Transaction, upsertTransaction } from "../_db/transactions.ts";
import { upsertInteraction } from "../_db/interactions.ts";
import { ensureProfileExists } from "../_citizen-wallet/profiles.ts";
import { finalizeOrder, findOrdersWithTxHash } from "../_db/orders.ts";
import { getPlacesByAccount } from "../_db/places.ts";
import { getLogDataByHash } from "../_db/logs_data.ts";
import { tokenTransferEventTopic } from "npm:@citizenwallet/sdk";
import { confirmTreasuryOperationsByTxHash } from "../_db/treasury_operation.ts";

Deno.serve(async (req) => {
  const { record } = await req.json();

  console.log("record", record);

  if (!record || typeof record !== "object") {
    return new Response("Invalid record data", { status: 400 });
  }

  const {
    hash,
    tx_hash,
    created_at,
    updated_at,
    dest,
    status,
    data,
  } = record;

  if (!dest || typeof dest !== "string") {
    return new Response(
      "Destination address is required and must be a string",
      { status: 400 },
    );
  }

  if (status !== "success") {
    return new Response("Transaction is not successful, ignore", {
      status: 200,
    });
  }

  const community = communityConfig();

  // Initialize Supabase client
  const supabaseClient = getServiceRoleClient();

  const erc20TransferData = data as ERC20TransferData;

  if (tokenTransferEventTopic !== data.topic) {
    return new Response("Not a token transfer", {
      status: 200,
    });
  }

  await ensureProfileExists(supabaseClient, community, erc20TransferData.from);
  await ensureProfileExists(supabaseClient, community, erc20TransferData.to);

  const formattedValue = formatERC20TransactionValue(
    community,
    erc20TransferData.value,
  );

  let description = "";

  const logData = await getLogDataByHash(
    supabaseClient,
    community.primaryToken.chain_id,
    hash,
  );

  if (logData) {
    description = logData.data.description;
  }

  // insert transaction into db
  const transaction: Transaction = {
    id: hash,
    hash: tx_hash,
    contract: dest,
    created_at,
    updated_at,
    from: erc20TransferData.from,
    to: erc20TransferData.to,
    value: formattedValue,
    description,
    status: status,
  };

  // only update an order, don't create a new one
  const { data: orders } = await findOrdersWithTxHash(
    supabaseClient,
    tx_hash,
  );
  if (orders && orders.length > 0) {
    for (const order of orders) {
      await finalizeOrder(
        supabaseClient,
        order.id,
        description,
        order.status === "refund" ? "refund" : "paid",
      );
    }
  }

  const { error } = await upsertTransaction(supabaseClient, transaction);

  if (error) {
    console.error("Error inserting transaction:", error);
  }

  let { data: accountPlaces } = await getPlacesByAccount(
    supabaseClient,
    erc20TransferData.to,
  );
  if (!accountPlaces || accountPlaces.length === 0) {
    ({ data: accountPlaces } = await getPlacesByAccount(
      supabaseClient,
      erc20TransferData.from,
    ));
  }

  const placeId = accountPlaces?.[0]?.id ?? null;

  await confirmTreasuryOperationsByTxHash(supabaseClient, tx_hash);

  await upsertInteraction(
    supabaseClient,
    transaction,
    placeId,
  );

  return new Response("transaction processed", { status: 200 });
});

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/notify-successful-transaction' \
    --header 'Authorization: Bearer ' \
    --header 'Content-Type: application/json' \
    --data '{"name":"Functions"}'

*/
