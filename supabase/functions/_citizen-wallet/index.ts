import { CommunityConfig, type Profile } from "npm:@citizenwallet/sdk";
import { formatUnits } from "npm:ethers";

import communityJson from "./community.json" with {
    type: "json",
};

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

export const communityConfig = () => {
    return new CommunityConfig(communityJson);
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
