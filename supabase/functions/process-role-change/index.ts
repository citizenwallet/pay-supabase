// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import {
  communityConfig,
  type RoleChangeData,
} from "../_citizen-wallet/index.ts";
import { getServiceRoleClient } from "../_db/index.ts";
import { ensureProfileExists } from "../_citizen-wallet/profiles.ts";
import { id } from "npm:ethers";
import { deleteRole, upsertRole } from "../_db/a_roles.ts";

/**
 * Example record: Role Granted
 * {
 *   "data": {
 *     "role": "0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6",
 *     "topic": "0x2f8788117e7eff1d82e926ec794901d17c78024a50270940304540a733656f0d",
 *     "sender": "0x85961775FF2e55e961b21baE2BfB74C02Ed5eb2C",
 *     "account": "0xe60FAF454027C344F61AA3eDc1b9E3A6162cFA4a"
 *   },
 *   "dest": "0x83DfEB42347a7Ce46F1497F307a5c156D1f19CB2",
 *   "hash": "0x65493e5ad323fe29b066f3a0a5b2725a69956f51c63fdae08c1e110fb57b3ac7",
 *   "nonce": 0,
 *   "value": "0",
 *   "sender": "",
 *   "status": "success",
 *   "tx_hash": "0x87028009822b554cfecd2a190a26bc893c510f2626d6abb47e39d00aa71fb31d",
 *   "created_at": "2025-04-30T09:59:02",
 *   "extra_data": null,
 *   "updated_at": "2025-04-30T09:59:02.758322"
 * }
 */

const chainId = Deno.env.get("CHAIN_ID");
export const roleGrantedEventTopic = id("RoleGranted(bytes32,address,address)");
export const roleRevokedEventTopic = id("RoleRevoked(bytes32,address,address)");

Deno.serve(async (req) => {
  const { record } = await req.json();

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

  const roleChangeData = data as RoleChangeData;

  if (!dest || typeof dest !== "string") {
    return new Response(
      "Destination address is required and must be a string",
      { status: 400 },
    );
  }

  const skip = roleChangeData.topic !== roleGrantedEventTopic &&
    roleChangeData.topic !== roleRevokedEventTopic;

  if (skip) {
    return new Response("Does not role change event, skip", { status: 200 });
  }

  const tokenContract = dest;

  const community = communityConfig();

  // Initialize Supabase client
  const supabaseClient = getServiceRoleClient();

  await ensureProfileExists(
    supabaseClient,
    community,
    roleChangeData.account,
  );

  if (roleChangeData.topic === roleGrantedEventTopic) {
    await upsertRole(supabaseClient, {
      account_address: roleChangeData.account,
      contract_address: tokenContract,
      role: roleChangeData.role,
    });
  }

  if (roleChangeData.topic === roleRevokedEventTopic) {
    await deleteRole(supabaseClient, {
      account_address: roleChangeData.account,
      contract_address: tokenContract,
      role: roleChangeData.role,
    });
  }

  return new Response("process-role-change event", { status: 200 });
});