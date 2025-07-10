// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
// import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import {
    communityConfig,
    type MetadataUpdateData,
} from "../_citizen-wallet/index.ts";
import { getServiceRoleClient } from "../_db/index.ts";
import { upsertProfile } from "../_db/profiles.ts";
import { getProfileFromId } from "npm:@citizenwallet/sdk";

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

    if (
        dest.toLowerCase() !== community.community.profile.address.toLowerCase()
    ) {
        return new Response("Only process profile updates", {
            status: 200,
        });
    }

    if (status !== "success") {
        return new Response("Transaction status is not success, ignoring", {
            status: 200,
        });
    }

    const metadataUpdateData = data as MetadataUpdateData;

    const ipfsDomain = Deno.env.get("IPFS_DOMAIN");
    if (!ipfsDomain) {
        return new Response("IPFS_DOMAIN is not set", { status: 500 });
    }

    // fetch the profile
    const profile = await getProfileFromId(
        ipfsDomain,
        community,
        metadataUpdateData._tokenId,
    );

    if (!profile) {
        return new Response("Profile not found, ignore", { status: 200 });
    }

    // Initialize Supabase client with service role key
    const supabaseClient = getServiceRoleClient();

    const result = await upsertProfile(
        supabaseClient,
        profile,
    );

    console.log(result);

    if (result.error) {
        console.error(result.error);
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
