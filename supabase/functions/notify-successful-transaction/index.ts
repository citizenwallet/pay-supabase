// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
// import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { sendNotification } from "../_firebase/index.ts";
import {
  communityConfig,
  createERC20TransferNotification,
  type ERC20TransferData,
} from "../_citizen-wallet/index.ts";
import type { Profile } from "npm:@citizenwallet/sdk";
import { getServiceRoleClient } from "../_db/index.ts";
import { getTokensForAddress } from "../_db/tokens.ts";
import { getProfile } from "../_db/profiles.ts";

Deno.serve(async (req) => {
  const { record } = await req.json();

  console.log("record", record);

  if (!record || typeof record !== "object") {
    return new Response("Invalid record data", { status: 400 });
  }

  const { dest, status, data } = record;

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

  if (status !== "success") {
    return new Response("Transaction status is not success, ignoring", {
      status: 200,
    });
  }

  // Initialize Supabase client
  const supabaseClient = getServiceRoleClient();

  const chainId = Deno.env.get("CHAIN_ID");
  if (!chainId) {
    return new Response("CHAIN_ID is required", { status: 500 });
  }

  const erc20TransferData = data as ERC20TransferData;

  // Fetch tokens for the destination address (contract interacted with)
  const { data: tokens, error } = await getTokensForAddress(
    supabaseClient,
    chainId,
    dest,
    erc20TransferData.to,
  );

  if (error) {
    console.error("Error fetching tokens:", error);
    return new Response("Error fetching tokens", { status: 500 });
  }

  if (!tokens || tokens.length === 0) {
    return new Response("No tokens found for the account", { status: 200 });
  }

  let profile: Profile | undefined;
  const { data: profileData, error: profileError } = await getProfile(
    supabaseClient,
    erc20TransferData.from,
  );

  if (profileError || !profileData) {
    console.error("Error fetching profile:", profileError);
  } else {
    profile = profileData;
  }

  const notification = createERC20TransferNotification(
    community,
    erc20TransferData,
    profile,
  );

  // Prepare the notification message
  const message = {
    tokens: tokens.map((t) => t.token),
    notification,
    android: {
      priority: "high" as const, // Ensure notifications are always sent with high priority
    },
    apns: {
      payload: {
        aps: {
          sound: "default", // Ensure notifications trigger a sound on iOS
        },
      },
    },
  };

  // Send the notification
  const failedTokens = await sendNotification(message);

  // Optionally, you can handle failed tokens here
  if (failedTokens.length > 0) {
    console.warn("Failed to send notifications to some tokens:", failedTokens);
  }

  return new Response("notification sent", { status: 200 });
});

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/notify-successful-transaction' \
    --header 'Authorization: Bearer ' \
    --header 'Content-Type: application/json' \
    --data '{"name":"Functions"}'

*/
