import { formatProfileImageLinks, type Profile } from "jsr:@citizenwallet/sdk";
import type {
    PostgrestSingleResponse,
    SupabaseClient,
} from "jsr:@supabase/supabase-js@2";
import { Place } from "./places.ts";

export interface ProfileWithTokenId extends Profile {
    token_id: string;
}

const PROFILES_TABLE = "a_profiles";

export const insertAnonymousProfile = async (
    client: SupabaseClient,
    account: string,
): Promise<PostgrestSingleResponse<null>> => {
    const defaultProfileImageIpfsHash = Deno.env.get(
        "DEFAULT_PROFILE_IMAGE_IPFS_HASH",
    );
    if (!defaultProfileImageIpfsHash) {
        throw new Error("DEFAULT_PROFILE_IMAGE_IPFS_HASH is not set");
    }

    const ipfsUrl = Deno.env.get("IPFS_URL");
    if (!ipfsUrl) {
        throw new Error("IPFS_URL is not set");
    }

    const profile: Profile = formatProfileImageLinks(ipfsUrl, {
        account,
        username: "anonymous",
        name: "Anonymous",
        description: "This user does not have a profile",
        image: defaultProfileImageIpfsHash,
        image_medium: defaultProfileImageIpfsHash,
        image_small: defaultProfileImageIpfsHash,
    });
    return client.from(PROFILES_TABLE).insert(profile);
};

export const insertPlaceProfile = async (
    client: SupabaseClient,
    place: Place,
): Promise<PostgrestSingleResponse<null>> => {
    const defaultProfileImageIpfsHash = Deno.env.get(
        "DEFAULT_PROFILE_IMAGE_IPFS_HASH",
    );
    if (!defaultProfileImageIpfsHash) {
        throw new Error("DEFAULT_PROFILE_IMAGE_IPFS_HASH is not set");
    }

    const ipfsUrl = Deno.env.get("IPFS_URL");
    if (!ipfsUrl) {
        throw new Error("IPFS_URL is not set");
    }

    const profile: Profile = formatProfileImageLinks(ipfsUrl, {
        account: place.accounts[0],
        username: place.name,
        name: place.name,
        description: place.description ?? "",
        image: place.image ?? defaultProfileImageIpfsHash,
        image_medium: place.image ?? defaultProfileImageIpfsHash,
        image_small: place.image ?? defaultProfileImageIpfsHash,
    });
    return client.from(PROFILES_TABLE).insert(profile);
};

export const upsertProfile = async (
    client: SupabaseClient,
    profile: ProfileWithTokenId,
): Promise<PostgrestSingleResponse<null>> => {
    return client
        .from(PROFILES_TABLE)
        .upsert(profile, {
            onConflict: "account",
        });
};

export const getProfile = async (
    client: SupabaseClient,
    account: string,
): Promise<PostgrestSingleResponse<Profile | null>> => {
    return client.from(PROFILES_TABLE).select().eq("account", account)
        .maybeSingle();
};
