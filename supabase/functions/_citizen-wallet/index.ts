import { CommunityConfig, type Profile } from "npm:@citizenwallet/sdk";
import { formatUnits } from "npm:ethers";

export interface Notification {
    title: string;
    body: string;
}

export interface ERC20TransferData {
    from: string;
    to: string;
    value: string;
}

export interface ERC20TransferExtraData {
    description: string;
}

export interface MetadataUpdateData {
    _tokenId: string;
}

interface CommunityT {
    alias: string;
    chain_id: number;
    active: boolean;
    created_at: Date;
    updated_at: Date;
    json: Config;
}

export const communityConfig = async (): Promise<CommunityConfig> => {
    if (!COMMUNITY_CONFIG_URL) {
        throw new Error(
            "COMMUNITY_CONFIG_URL environment variable is not set",
        );
    }

    try {
        const response = await fetch(COMMUNITY_CONFIG_URL);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const community = await response.json() as CommunityT;

        return new CommunityConfig(community.json);
    } catch (error) {
        console.error("Error fetching community:", error);
        throw error;
    }
};

export const formatERC20TransactionValue = (
    config: CommunityConfig,
    value: string,
    options: { decimals?: number } | undefined = undefined,
) => {
    return formatUnits(
        value,
        options?.decimals ?? config.primaryToken.decimals,
    );
};

export const createERC20TransferNotification = (
    config: CommunityConfig,
    data: ERC20TransferData,
    profile?: Profile,
): Notification => {
    const community = config.community;
    const token = config.primaryToken;

    const value = formatUnits(data.value, token.decimals);

    if (profile) {
        return {
            title: community.name,
            body:
                `${value} ${token.symbol} received from ${profile.name} (@${profile.username})`,
        };
    }

    return {
        title: community.name,
        body: `${value} ${token.symbol} received`,
    };
};
