import {
  PostgrestResponse,
  PostgrestSingleResponse,
  SupabaseClient,
} from "jsr:@supabase/supabase-js@2";
import { SyncStrategy } from "./treasury.ts";

export type TreasuryOperationStatus =
  | "requesting"
  | "pending"
  | "pending-periodic"
  | "confirming"
  | "processed"
  | "processed-account-not-found";

export interface PeriodicOperationMetadata {
  grouped_operations: string[];
  total_amount: number;
}

export interface PaygOperationMetadata {
  order_id?: number;
  description?: string;
}

export interface TreasuryOperation<S extends SyncStrategy = "payg"> {
  id: string;
  treasury_id: number;
  created_at: string;
  updated_at: string;
  direction: "in" | "out";
  amount: number;
  status: TreasuryOperationStatus;
  message: string;
  metadata: S extends "periodic" ? PeriodicOperationMetadata
    : S extends "payg" ? PaygOperationMetadata
    : Record<string, string>;
  tx_hash: string | null;
  account: string | null;
}

export const confirmTreasuryOperations = async (
  client: SupabaseClient,
  ids: string[],
  txHash: string,
): Promise<PostgrestSingleResponse<null>> => {
  const now = new Date().toISOString();
  return client
    .from("treasury_operations")
    .update({ status: "confirming", tx_hash: txHash, updated_at: now })
    .in("id", ids);
};

export const insertTreasuryOperations = async (
  client: SupabaseClient,
  operations: TreasuryOperation[],
): Promise<PostgrestSingleResponse<null>> => {
  return client.from("treasury_operations").upsert(operations, {
    onConflict: "id",
    ignoreDuplicates: true,
  });
};

export const confirmTreasuryOperationsByTxHash = async (
  client: SupabaseClient,
  txHash: string,
): Promise<PostgrestSingleResponse<null>> => {
  const now = new Date().toISOString();
  return client
    .from("treasury_operations")
    .update({ status: "processed", updated_at: now })
    .eq("status", "confirming")
    .eq("tx_hash", txHash);
};

export const getPendingTreasuryOperations = async (
  client: SupabaseClient,
  treasuryId: number,
  limit: number = 100,
  offset: number = 0,
): Promise<PostgrestResponse<TreasuryOperation[]>> => {
  return client
    .from("treasury_operations")
    .select("*")
    .eq("treasury_id", treasuryId)
    .eq("status", "pending")
    .neq("account", null)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);
};
