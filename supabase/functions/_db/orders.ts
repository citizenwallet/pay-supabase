import {
    PostgrestResponse,
    PostgrestSingleResponse,
    SupabaseClient,
} from "jsr:@supabase/supabase-js@2";

const TABLE_NAME = "orders";

export type OrderStatus =
    | "pending"
    | "paid"
    | "cancelled"
    | "needs_minting"
    | "needs_burning"
    | "refunded"
    | "refund_pending"
    | "refund"
    | "correction";

export interface Order {
    id: number;
    created_at: string;
    completed_at: string | null;
    total: number;
    due: number;
    fees: number;
    place_id: number;
    items: {
        id: number;
        quantity: number;
    }[];
    status: OrderStatus;
    description: string;
    tx_hash: string | null;
    type: "web" | "app" | "terminal" | null;
    account: string | null;
    payout_id: number | null;
    pos: string | null;
    processor_tx: number | null;
    refund_id: number | null;
    token: string | null;
}

export const findOrdersWithTxHash = (
    client: SupabaseClient,
    txHash: string,
): Promise<PostgrestResponse<Order>> => {
    return Promise.resolve(
        client.from(TABLE_NAME).select("*").eq("tx_hash", txHash),
    ) as Promise<PostgrestResponse<Order>>;
};

export const createPaidOrder = (
    client: SupabaseClient,
    placeId: number,
    total: number,
    txHash: string,
    account: string | null,
    description: string,
): Promise<PostgrestResponse<Order>> => {
    return Promise.resolve(
        client.from(TABLE_NAME).insert({
            place_id: placeId,
            total,
            due: 0,
            items: [],
            status: "paid",
            tx_hash: txHash,
            type: "app",
            account,
            description,
        }),
    ) as Promise<PostgrestResponse<Order>>;
};

export const setOrderDescription = (
    client: SupabaseClient,
    orderId: number,
    description: string,
): Promise<PostgrestResponse<Order>> => {
    return Promise.resolve(
        client.from(TABLE_NAME).update({ description }).eq("id", orderId),
    ) as Promise<PostgrestResponse<Order>>;
};

export const finalizeOrder = (
    client: SupabaseClient,
    orderId: number,
    description: string,
    status: OrderStatus = "paid",
): Promise<PostgrestResponse<Order>> => {
    return Promise.resolve(
        client.from(TABLE_NAME).update({
            status,
            due: 0,
            description,
        }).eq(
            "id",
            orderId,
        ),
    ) as Promise<PostgrestResponse<Order>>;
};

export const attachTxHashToOrder = async (
    client: SupabaseClient,
    orderId: number,
    txHash: string,
    status: string = "paid",
): Promise<PostgrestSingleResponse<Order>> => {
    return client
        .from(TABLE_NAME)
        .update({ tx_hash: txHash, status })
        .eq("id", orderId)
        .single();
};
