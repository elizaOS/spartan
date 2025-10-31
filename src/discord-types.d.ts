/**
 * Minimal Discord.js type declarations for spartan
 * This avoids loading the full discord.js typings which have conflicts
 */

declare module 'discord.js' {
    export interface Guild {
        id: string;
        name: string;
        icon: string | null;
        splash: string | null;
        discoverySplash: string | null;
        owner?: boolean;
        ownerId: string;
        permissions?: string;
        region?: string;
        afkChannelId: string | null;
        afkTimeout: number;
        widgetEnabled?: boolean;
        widgetChannelId?: string | null;
        verificationLevel: number;
        defaultMessageNotifications: number;
        explicitContentFilter: number;
        roles: any[];
        emojis: any[];
        features: string[];
        mfaLevel: number;
        applicationId: string | null;
        systemChannelId: string | null;
        systemChannelFlags: number;
        rulesChannelId: string | null;
        maxPresences?: number | null;
        maxMembers?: number;
        vanityUrlCode: string | null;
        description: string | null;
        banner: string | null;
        premiumTier: number;
        premiumSubscriptionCount?: number;
        preferredLocale: string;
        publicUpdatesChannelId: string | null;
        maxVideoChannelUsers?: number;
        approximateMemberCount?: number;
        approximatePresenceCount?: number;
        welcomeScreen?: any;
        nsfwLevel: number;
        stickers?: any[];
        premiumProgressBarEnabled: boolean;
        members?: any;
        [key: string]: any;
    }

    export interface Message {
        id: string;
        [key: string]: any;
    }

    export interface Client {
        user?: any;
        [key: string]: any;
    }

    export interface Channel {
        id: string;
        type: number;
        [key: string]: any;
    }

    export interface VoiceState {
        id?: string;
        [key: string]: any;
    }

    export interface BaseGuildVoiceChannel {
        id: string;
        [key: string]: any;
    }

    export const Events: any;
    export const ChannelType: any;
}

