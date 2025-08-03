// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
// import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { communityConfig } from "../_citizen-wallet/index.ts";
import { getServiceRoleClient } from "../_db/index.ts";
import { ensureProfileExists } from "../_citizen-wallet/profiles.ts";
import {
  confirmTreasuryOperations,
  TreasuryOperation,
} from "../_db/treasury_operation.ts";
import { getTreasuryById } from "../_db/treasury.ts";
import { BundlerService, getAccountAddress } from "npm:@citizenwallet/sdk";
import { Wallet } from "npm:ethers";
import { attachTxHashToOrder } from "../_db/orders.ts";

Deno.serve(async (req) => {
  const { record } = await req.json();

  console.log("record", record);

  if (!record || typeof record !== "object") {
    return new Response("Invalid record data", { status: 400 });
  }

  const treasuryOperation = record as TreasuryOperation;

  if (treasuryOperation.status !== "pending") {
    return new Response("Treasury operation is not pending, ignore", {
      status: 200,
    });
  }

  if (!treasuryOperation.account) {
    return new Response("Treasury operation has no account, ignore", {
      status: 200,
    });
  }

  const community = await communityConfig();

  // Initialize Supabase client
  const supabaseClient = getServiceRoleClient();

  const { data: treasury, error: treasuryError } = await getTreasuryById(
    supabaseClient,
    treasuryOperation.treasury_id,
  );

  if (treasuryError) {
    console.error("Error getting treasury:", treasuryError);
    return new Response("Error getting treasury", { status: 500 });
  }

  if (!treasury) {
    return new Response("Treasury not found, ignore", {
      status: 200,
    });
  }

  await ensureProfileExists(
    supabaseClient,
    community,
    treasuryOperation.account,
  );

  const token = community.getToken(treasury.token);

  const bundler = new BundlerService(community);

  const privateKey = Deno.env.get("FAUCET_PRIVATE_KEY");

  if (!privateKey) {
    return new Response("Faucet private key not found, ignore", {
      status: 200,
    });
  }

  const signer = new Wallet(privateKey);

  const account = await getAccountAddress(community, signer.address);
  if (!account) {
    return new Response("Account not found, ignore", {
      status: 200,
    });
  }

  await ensureProfileExists(
    supabaseClient,
    community,
    account,
  );

  const { direction } = treasuryOperation;

  let description = direction === "in"
    ? `top up via: ${treasury.business.name}`
    : `refund via: ${treasury.business.name}`;
  if (
    treasury.sync_strategy === "payg" && treasuryOperation.metadata.description
  ) {
    description = treasuryOperation.metadata.description;
  }

  const operationIds = [treasuryOperation.id];
  let amount = `${treasuryOperation.amount / 100}`;
  if (treasury.sync_strategy === "periodic") {
    const periodicOperation = record as TreasuryOperation<"periodic">;

    operationIds.push(...periodicOperation.metadata.grouped_operations);

    amount = `${periodicOperation.metadata.total_amount / 100}`;
  }

  const txHash = direction === "in"
    ? await bundler.mintERC20Token(
      // deno-lint-ignore no-explicit-any
      signer as unknown as any,
      token.address,
      account,
      treasuryOperation.account,
      amount,
      description,
    )
    : await bundler.burnFromERC20Token(
      // deno-lint-ignore no-explicit-any
      signer as unknown as any,
      token.address,
      account,
      treasuryOperation.account,
      amount,
      description,
    );

  await confirmTreasuryOperations(
    supabaseClient,
    operationIds,
    txHash,
  );

  if (
    treasury.sync_strategy === "payg" && treasuryOperation.metadata.order_id
  ) {
    await attachTxHashToOrder(
      supabaseClient,
      treasuryOperation.metadata.order_id,
      txHash,
      direction === "in" ? "paid" : "refund",
    );
  }

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
