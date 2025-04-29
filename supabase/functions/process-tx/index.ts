// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import {
  communityConfig,
  type ERC20TransferData,
  formatERC20TransactionValue,
} from "../_citizen-wallet/index.ts";
import { getServiceRoleClient } from "../_db/index.ts";
import { type Transaction, upsertTransaction } from "../_db/transactions.ts";
import { upsertInteraction } from "../_db/interactions.ts";
import { ensureProfileExists } from "../_citizen-wallet/profiles.ts";
import {
  createPaidOrder,
  findOrdersWithTxHash,
  updateOrderPaid,
} from "../_db/orders.ts";
import { getPlacesByAccount } from "../_db/places.ts";
import { getLogDataByHash } from "../_db/logs_data.ts";

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

  const community = communityConfig();

  if (dest.toLowerCase() !== community.primaryToken.address.toLowerCase()) {
    return new Response("Only process primary token transfers", {
      status: 200,
    });
  }

  // Initialize Supabase client
  const supabaseClient = getServiceRoleClient();

  const erc20TransferData = data as ERC20TransferData;

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
    created_at,
    updated_at,
    from: erc20TransferData.from,
    to: erc20TransferData.to,
    value: formattedValue,
    description,
    status: status,
  };

  // create order if it doesn't exist and destination is a place
  const { data: orders } = await findOrdersWithTxHash(
    supabaseClient,
    tx_hash,
  );
  if (!orders || orders.length === 0) {
    const { data: places } = await getPlacesByAccount(
      supabaseClient,
      erc20TransferData.to,
    );

    const place = places?.[0] ?? null;
    if (place) {
      await createPaidOrder(
        supabaseClient,
        place.id,
        parseFloat(formattedValue) * 100,
        tx_hash,
        erc20TransferData.from,
        description,
      );
    }
  } else {
    if (orders && orders.length > 0) {
      for (const order of orders) {
        await updateOrderPaid(supabaseClient, order.id, description);
      }
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
