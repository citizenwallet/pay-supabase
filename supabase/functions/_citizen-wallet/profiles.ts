import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import {
    type CommunityConfig,
    getProfileFromAddress,
} from "npm:@citizenwallet/sdk";
import {
    getProfile,
    insertAnonymousProfile,
    insertPlaceProfile,
    upsertProfile,
} from "../_db/profiles.ts";
import { getPlacesByAccount } from "../_db/places.ts";

export const ensureProfileExists = async (
    client: SupabaseClient,
    config: CommunityConfig,
    address: string,
) => {
    const { data, error } = await getProfile(
        client,
        address,
    );
    if (!error && data) {
        return;
    }

    const ipfsDomain = Deno.env.get("IPFS_DOMAIN");
    if (!ipfsDomain) {
        throw new Error("IPFS_DOMAIN is not set");
    }

    // Check the smart contract for a profile
    const profile = await getProfileFromAddress(
        ipfsDomain,
        config,
        address,
    );

    if (profile) {
        await upsertProfile(client, profile);
        return;
    }

    const { data: placeData, error: placeError } = await getPlacesByAccount(
        client,
        address,
    );

    if (placeError || !placeData) {
        // There is none, let's create an anonymous profile in the database
        await insertAnonymousProfile(
            client,
            address,
        );
        return;
    }

    for (const place of placeData) {
        await insertPlaceProfile(client, place);
    }
};
