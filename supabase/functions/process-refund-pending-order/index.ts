// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
// import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { communityConfig } from "../_citizen-wallet/index.ts";
import { getServiceRoleClient } from "../_db/index.ts";
import { ensureProfileExists } from "../_citizen-wallet/profiles.ts";
import {
  BundlerService,
  callOnCardCallData,
  getAccountAddress,
  getCardAddress,
  tokenTransferCallData,
  tokenTransferEventTopic,
  UserOpData,
  UserOpExtraData,
} from "npm:@citizenwallet/sdk";
import { id, parseUnits, Wallet } from "npm:ethers";
import { attachTxHashToOrder, Order } from "../_db/orders.ts";
import { getPlaceById } from "../_db/places.ts";

Deno.serve(async (req) => {
  const { record } = await req.json();

  console.log("record", record);

  if (!record || typeof record !== "object") {
    return new Response("Invalid record data", { status: 400 });
  }

  const order = record as Order;

  if (order.status !== "refund_pending") {
    return new Response("Order is not refund pending, ignore", {
      status: 200,
    });
  }

  if (!order.account) {
    return new Response("Order has no account, ignore", {
      status: 200,
    });
  }

  const community = communityConfig();

  // Initialize Supabase client
  const supabaseClient = getServiceRoleClient();

  const { data: place, error: placeError } = await getPlaceById(
    supabaseClient,
    order.place_id,
  );

  if (placeError) {
    console.error("Error getting place:", placeError);
    return new Response("Error getting place", { status: 500 });
  }

  if (!place) {
    return new Response("Place not found, ignore", {
      status: 500,
    });
  }

  const [placeAccount] = place.accounts;

  const hashedSerial = id(`${place.business_id}:${place.id}`);
  const placeAccountAddress = await getCardAddress(community, hashedSerial);
  if (!placeAccountAddress) {
    return new Response("Place account not found", {
      status: 500,
    });
  }

  if (placeAccountAddress.toLowerCase() !== placeAccount.toLowerCase()) {
    return new Response("Place account mismatch", {
      status: 500,
    });
  }

  const senderAccount = order.account;

  await ensureProfileExists(
    supabaseClient,
    community,
    placeAccount,
  );

  await ensureProfileExists(
    supabaseClient,
    community,
    senderAccount,
  );

  const token = community.getToken(order.token ?? undefined);

  const bundler = new BundlerService(community);

  const privateKey = Deno.env.get("CARD_MANAGER_PRIVATE_KEY");

  if (!privateKey) {
    return new Response("Faucet private key not found, ignore", {
      status: 200,
    });
  }

  const signer = new Wallet(privateKey);

  const signerAccountAddress = await getAccountAddress(
    community,
    signer.address,
  );
  if (!signerAccountAddress) {
    return new Response("Account not found", {
      status: 500,
    });
  }

  await ensureProfileExists(
    supabaseClient,
    community,
    signerAccountAddress,
  );

  let amount = order.total - order.fees;
  if (amount < 0) {
    amount = 0;
  }

  const formattedAmount = parseUnits(
    (amount / 100).toFixed(2),
    token.decimals,
  );

  const transferCallData = tokenTransferCallData(
    senderAccount,
    formattedAmount,
  );

  const calldata = callOnCardCallData(
    community,
    hashedSerial,
    token.address,
    BigInt(0),
    transferCallData,
  );

  const cardConfig = community.primarySafeCardConfig;

  const userOpData: UserOpData = {
    topic: tokenTransferEventTopic,
    from: placeAccount,
    to: senderAccount,
    value: formattedAmount.toString(),
  };

  const description = `refund from: ${place.name} for order #${order.id}`;

  let extraData: UserOpExtraData | undefined;
  if (order.description) {
    extraData = {
      description,
    };
  }

  const hash = await bundler.call(
    // deno-lint-ignore no-explicit-any
    signer as unknown as any,
    cardConfig.address,
    signerAccountAddress,
    calldata,
    BigInt(0),
    userOpData,
    extraData,
  );
  if (!hash) {
    return new Response("Failed to call on card", {
      status: 500,
    });
  }

  await attachTxHashToOrder(
    supabaseClient,
    order.id,
    hash,
    "refund",
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
