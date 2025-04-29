import { PostgrestResponse, SupabaseClient } from "jsr:@supabase/supabase-js@2";

const TABLE_NAME = "orders";

export interface Order {
    id: number;
    created_at: string;
    completed_at: string | null;
    total: number;
    due: number;
    place_id: number;
    items: {
        id: number;
        quantity: number;
    }[];
    status: "pending" | "paid" | "cancelled";
    description: string;
    tx_hash: string;
    account: string | null;
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

export const updateOrderPaid = (
    client: SupabaseClient,
    orderId: number,
    description: string,
): Promise<PostgrestResponse<Order>> => {
    return Promise.resolve(
        client.from(TABLE_NAME).update({
            status: "paid",
            due: 0,
            description,
        }).eq(
            "id",
            orderId,
        ),
    ) as Promise<PostgrestResponse<Order>>;
};
