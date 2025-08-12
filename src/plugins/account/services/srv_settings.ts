import { IAgentRuntime, Service, logger } from '@elizaos/core';
import { interface_accounts_ByIds, interface_account_update } from '../interfaces/int_accounts';

// Settings types
export interface NotificationSettings {
    enabled: boolean;
    intervals: {
        updates: number; // minutes
        summaries: number; // hours  
        reports: number; // hours
    };
    channels: {
        discord: boolean;
        telegram: boolean;
        email: boolean;
    };
    alerts: {
        positionOpened: boolean;
        positionClosed: boolean;
        stopLossTriggered: boolean;
        takeProfitHit: boolean;
        significantGains: boolean;
        significantLosses: boolean;
        marketVolatility: boolean;
    };
    signatures: boolean; // turn off signatures
}

export interface RiskManagementSettings {
    maxTotalExposure: number; // percentage of portfolio in positions
    maxDrawdown: number; // percentage
    dailyLossLimit: number; // percentage
    weeklyLossLimit: number; // percentage
    emergencyStopLoss: number; // percentage
    diversification: {
        maxPerToken: number; // percentage
        maxPerSector: number; // percentage
        minPositions: number;
    };
    maxTradesPerDay: number;
    minimumTrade: number; // percentage of portfolio
    slippageSettings: {
        baseSlippage: number;
        maxSlippage: number;
        liquidityMultiplier: number;
        volumeMultiplier: number;
    };
    liquidity: {
        minLiquidity: number;
        minVolume: number;
        maxPriceChange: number;
    };
    position: {
        maxPositionSize: number; // percentage
        stopLossPercentage: number;
        takeProfitPercentage: number;
    };
    token: {
        minAge: number; // days
        minMarketCap: number;
    };
    volumeSpikeThreshold: number; // percentage
}

export interface TechnicalIndicatorSettings {
    rsi: {
        oversoldThreshold: number;
        overboughtThreshold: number;
        period: number;
    };
    macd: {
        fastPeriod: number;
        slowPeriod: number;
        signalPeriod: number;
    };
    movingAverages: {
        fastMA: number;
        slowMA: number;
        maType: 'SMA' | 'EMA' | 'WMA';
        crossoverStrategy: boolean;
    };
    bollingerBands: {
        period: number;
        standardDeviations: number;
    };
    stochastic: {
        kPeriod: number;
        dPeriod: number;
        oversoldLevel: number;
        overboughtLevel: number;
    };
    atr: {
        period: number;
        volatilityMultiplier: number;
    };
}

export interface GasSettings {
    optimization: boolean;
    priorityFees: 'low' | 'medium' | 'high';
}

export interface PerformanceMonitoringSettings {
    summaryFrequency: 'daily' | 'weekly' | 'monthly';
    rebalancingIntervals: number; // hours
}

export interface TradingSettings {
    enabled: boolean;
    strategy: string;
    buyVsSell: 'buy' | 'sell' | 'both';
    adjustForVolatility: boolean;
    burstMinMax: {
        min: number;
        max: number;
    };
}

export interface AccountSettings {
    accountId: string;
    notifications: NotificationSettings;
    riskManagement: RiskManagementSettings;
    technicalIndicators: TechnicalIndicatorSettings;
    gas: GasSettings;
    performanceMonitoring: PerformanceMonitoringSettings;
    trading: TradingSettings;
    lastUpdated: number;
}

export class InterfaceSettingsService extends Service {
    private isRunning = false;
    private defaultSettings: AccountSettings;

    static serviceType = 'AUTONOMOUS_TRADER_INTERFACE_SETTINGS';
    capabilityDescription = 'Manages account and wallet settings including notifications, trading preferences, risk management, and technical indicators';

    constructor(public runtime: IAgentRuntime) {
        super(runtime);
        logger.log(InterfaceSettingsService.serviceType, 'constructor');

        // Initialize default settings
        this.defaultSettings = this.createDefaultSettings();
    }

    private createDefaultSettings(): AccountSettings {
        return {
            accountId: '',
            notifications: {
                enabled: true,
                intervals: {
                    updates: 15, // 15 minutes
                    summaries: 1, // 1 hour
                    reports: 24, // 24 hours
                },
                channels: {
                    discord: true,
                    telegram: true,
                    email: false,
                },
                alerts: {
                    positionOpened: true,
                    positionClosed: true,
                    stopLossTriggered: true,
                    takeProfitHit: true,
                    significantGains: true,
                    significantLosses: true,
                    marketVolatility: false,
                },
                signatures: true,
            },
            riskManagement: {
                maxTotalExposure: 80, // 80% of portfolio
                maxDrawdown: 10, // 10%
                dailyLossLimit: 5, // 5%
                weeklyLossLimit: 15, // 15%
                emergencyStopLoss: 20, // 20%
                diversification: {
                    maxPerToken: 20, // 20% per token
                    maxPerSector: 40, // 40% per sector
                    minPositions: 3,
                },
                maxTradesPerDay: 10,
                minimumTrade: 0.1, // 0.1% of portfolio
                slippageSettings: {
                    baseSlippage: 0.5,
                    maxSlippage: 1.0,
                    liquidityMultiplier: 1.0,
                    volumeMultiplier: 1.0,
                },
                liquidity: {
                    minLiquidity: 50000,
                    minVolume: 10000,
                    maxPriceChange: 30,
                },
                position: {
                    maxPositionSize: 10, // 10% per position
                    stopLossPercentage: 5, // 5%
                    takeProfitPercentage: 15, // 15%
                },
                token: {
                    minAge: 30, // 30 days
                    minMarketCap: 1000000, // $1M
                },
                volumeSpikeThreshold: 50, // 50%
            },
            technicalIndicators: {
                rsi: {
                    oversoldThreshold: 30,
                    overboughtThreshold: 70,
                    period: 14,
                },
                macd: {
                    fastPeriod: 12,
                    slowPeriod: 26,
                    signalPeriod: 9,
                },
                movingAverages: {
                    fastMA: 20,
                    slowMA: 50,
                    maType: 'SMA',
                    crossoverStrategy: true,
                },
                bollingerBands: {
                    period: 20,
                    standardDeviations: 2,
                },
                stochastic: {
                    kPeriod: 14,
                    dPeriod: 3,
                    oversoldLevel: 20,
                    overboughtLevel: 80,
                },
                atr: {
                    period: 14,
                    volatilityMultiplier: 2,
                },
            },
            gas: {
                optimization: true,
                priorityFees: 'medium',
            },
            performanceMonitoring: {
                summaryFrequency: 'daily',
                rebalancingIntervals: 24, // 24 hours
            },
            trading: {
                enabled: true,
                strategy: 'llm',
                buyVsSell: 'both',
                adjustForVolatility: true,
                burstMinMax: {
                    min: 0.1,
                    max: 5.0,
                },
            },
            lastUpdated: Date.now(),
        };
    }

    /**
     * Get settings for a specific account
     */
    async getAccountSettings(accountId: string): Promise<AccountSettings> {
        try {
            const accounts = await interface_accounts_ByIds(this.runtime, [accountId]);
            const account = accounts[accountId];

            if (!account) {
                logger.warn(`Account ${accountId} not found, returning default settings`);
                return { ...this.defaultSettings, accountId };
            }

            // Check if account has settings component
            if (account.settings) {
                return {
                    ...this.defaultSettings,
                    ...account.settings,
                    accountId,
                    lastUpdated: Date.now(),
                };
            }

            // Return default settings for new account
            return { ...this.defaultSettings, accountId };
        } catch (error) {
            logger.error('Error getting account settings:', error);
            return { ...this.defaultSettings, accountId };
        }
    }

    /**
     * Update settings for a specific account
     */
    async updateAccountSettings(accountId: string, settings: Partial<AccountSettings>): Promise<boolean> {
        try {
            const accounts = await interface_accounts_ByIds(this.runtime, [accountId]);
            const account = accounts[accountId];

            if (!account) {
                logger.error(`Account ${accountId} not found`);
                return false;
            }

            // Merge with existing settings
            const currentSettings = account.settings || this.defaultSettings;
            const updatedSettings = {
                ...currentSettings,
                ...settings,
                accountId,
                lastUpdated: Date.now(),
            };

            // Update the account component
            const updatedComponent = {
                ...account,
                settings: updatedSettings,
            };

            const success = await interface_account_update(this.runtime, updatedComponent);

            if (success) {
                logger.info(`Settings updated for account ${accountId}`);
            } else {
                logger.error(`Failed to update settings for account ${accountId}`);
            }

            return success;
        } catch (error) {
            logger.error('Error updating account settings:', error);
            return false;
        }
    }

    /**
     * Update specific notification settings
     */
    async updateNotificationSettings(accountId: string, notificationSettings: Partial<NotificationSettings>): Promise<boolean> {
        const currentSettings = await this.getAccountSettings(accountId);
        const updatedSettings = {
            ...currentSettings,
            notifications: {
                ...currentSettings.notifications,
                ...notificationSettings,
            },
        };
        return this.updateAccountSettings(accountId, updatedSettings);
    }

    /**
     * Update specific risk management settings
     */
    async updateRiskManagementSettings(accountId: string, riskSettings: Partial<RiskManagementSettings>): Promise<boolean> {
        const currentSettings = await this.getAccountSettings(accountId);
        const updatedSettings = {
            ...currentSettings,
            riskManagement: {
                ...currentSettings.riskManagement,
                ...riskSettings,
            },
        };
        return this.updateAccountSettings(accountId, updatedSettings);
    }

    /**
     * Update specific technical indicator settings
     */
    async updateTechnicalIndicatorSettings(accountId: string, technicalSettings: Partial<TechnicalIndicatorSettings>): Promise<boolean> {
        const currentSettings = await this.getAccountSettings(accountId);
        const updatedSettings = {
            ...currentSettings,
            technicalIndicators: {
                ...currentSettings.technicalIndicators,
                ...technicalSettings,
            },
        };
        return this.updateAccountSettings(accountId, updatedSettings);
    }

    /**
     * Update trading settings
     */
    async updateTradingSettings(accountId: string, tradingSettings: Partial<TradingSettings>): Promise<boolean> {
        const currentSettings = await this.getAccountSettings(accountId);
        const updatedSettings = {
            ...currentSettings,
            trading: {
                ...currentSettings.trading,
                ...tradingSettings,
            },
        };
        return this.updateAccountSettings(accountId, updatedSettings);
    }

    /**
     * Reset settings to defaults for an account
     */
    async resetAccountSettings(accountId: string): Promise<boolean> {
        return this.updateAccountSettings(accountId, this.defaultSettings);
    }

    /**
     * Get settings for multiple accounts
     */
    async getMultipleAccountSettings(accountIds: string[]): Promise<Record<string, AccountSettings>> {
        const settings: Record<string, AccountSettings> = {};

        for (const accountId of accountIds) {
            settings[accountId] = await this.getAccountSettings(accountId);
        }

        return settings;
    }

    /**
     * Validate settings before saving
     */
    validateSettings(settings: AccountSettings): { valid: boolean; errors: string[] } {
        const errors: string[] = [];

        // Validate notification settings
        if (settings.notifications.intervals.updates < 1) {
            errors.push('Notification update interval must be at least 1 minute');
        }
        if (settings.notifications.intervals.summaries < 1) {
            errors.push('Notification summary interval must be at least 1 hour');
        }

        // Validate risk management settings
        if (settings.riskManagement.maxTotalExposure > 100 || settings.riskManagement.maxTotalExposure < 0) {
            errors.push('Max total exposure must be between 0 and 100 percent');
        }
        if (settings.riskManagement.maxDrawdown > 100 || settings.riskManagement.maxDrawdown < 0) {
            errors.push('Max drawdown must be between 0 and 100 percent');
        }
        if (settings.riskManagement.dailyLossLimit > 100 || settings.riskManagement.dailyLossLimit < 0) {
            errors.push('Daily loss limit must be between 0 and 100 percent');
        }
        if (settings.riskManagement.weeklyLossLimit > 100 || settings.riskManagement.weeklyLossLimit < 0) {
            errors.push('Weekly loss limit must be between 0 and 100 percent');
        }
        if (settings.riskManagement.position.maxPositionSize > 100 || settings.riskManagement.position.maxPositionSize < 0) {
            errors.push('Max position size must be between 0 and 100 percent');
        }

        // Validate technical indicator settings
        if (settings.technicalIndicators.rsi.oversoldThreshold >= settings.technicalIndicators.rsi.overboughtThreshold) {
            errors.push('RSI oversold threshold must be less than overbought threshold');
        }
        if (settings.technicalIndicators.macd.fastPeriod >= settings.technicalIndicators.macd.slowPeriod) {
            errors.push('MACD fast period must be less than slow period');
        }

        return {
            valid: errors.length === 0,
            errors,
        };
    }

    /**
     * Start the settings service with the given runtime.
     */
    static async start(runtime: IAgentRuntime) {
        const service = new InterfaceSettingsService(runtime);
        service.start();
        return service;
    }

    /**
     * Stops the settings service associated with the given runtime.
     */
    static async stop(runtime: IAgentRuntime) {
        const service = runtime.getService(this.serviceType);
        if (!service) {
            throw new Error(this.serviceType + ' service not found');
        }
        service.stop();
    }

    async start(): Promise<void> {
        if (this.isRunning) {
            logger.warn('Settings service is already running');
            return;
        }

        try {
            logger.info('Starting settings service...');
            this.isRunning = true;
            logger.info('Settings service started successfully');
        } catch (error) {
            logger.error('Error starting settings service:', error);
            throw error;
        }
    }

    async stop(): Promise<void> {
        if (!this.isRunning) {
            logger.warn('Settings service is not running');
            return;
        }

        try {
            logger.info('Stopping settings service...');
            this.isRunning = false;
            logger.info('Settings service stopped successfully');
        } catch (error) {
            logger.error('Error stopping settings service:', error);
            throw error;
        }
    }

    isServiceRunning(): boolean {
        return this.isRunning;
    }
} 