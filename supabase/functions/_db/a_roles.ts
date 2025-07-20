import type {
    PostgrestSingleResponse,
    SupabaseClient,
} from "jsr:@supabase/supabase-js@2";

export interface ARole {
    id: string;
    account_address: string;
    contract_address: string;
    role: string;
    created_at: string;
}

const ROLES_TABLE = "a_roles";

export const upsertRole = async (
    client: SupabaseClient,
    role: Pick<ARole, "account_address" | "contract_address" | "role">,
): Promise<PostgrestSingleResponse<ARole>> => {
    const { data: existingRole } = await client.from(ROLES_TABLE)
        .select("*").eq("account_address", role.account_address).eq(
            "contract_address",
            role.contract_address,
        ).eq("role", role.role).maybeSingle();

    if (existingRole) {
        return client.from(ROLES_TABLE).update({
            created_at: new Date().toISOString(),
        }).eq("id", existingRole.id);
    }

    return client.from(ROLES_TABLE).insert(role);
};

export const deleteRole = async (
    client: SupabaseClient,
    role: Pick<ARole, "account_address" | "contract_address" | "role">,
): Promise<PostgrestSingleResponse<ARole>> => {
    const { data: existingRole } = await client.from(ROLES_TABLE)
        .select("*").eq("account_address", role.account_address).eq(
            "contract_address",
            role.contract_address,
        ).eq("role", role.role).maybeSingle();

    if (existingRole) {
        return client.from(ROLES_TABLE).delete().eq("id", existingRole.id);
    }

    return null;
};
