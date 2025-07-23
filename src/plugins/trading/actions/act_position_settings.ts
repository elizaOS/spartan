import {
    type Action,
    type ActionExample,
    type Content,
    type HandlerCallback,
    type IAgentRuntime,
    type Memory,
    type State,
    logger,
    createUniqueUuid,
} from '@elizaos/core';
import { v4 as uuidv4 } from 'uuid';
import { takeItPrivate, HasEntityIdFromMessage, getAccountFromMessage, getWalletsFromText } from '../../autonomous-trader/utils'
import { interface_positions_ByAccountIdPosIds, updatePosition } from '../interfaces/int_positions'

/**
 * Interface representing position settings that can be updated
 */
interface PositionSettings {
    stopLossPercentage?: number;
    takeProfitPercentage?: number;
    maxPositionSize?: number;
    slippageTolerance?: number;
    minLiquidity?: number;
    minVolume?: number;
    customSettings?: Record<string, any>;
}

/**
 * Interface representing the content of a position settings update request
 */
interface PositionSettingsContent {
    positionId: string | null;
    walletAddress: string | null;
    settings: PositionSettings;
}

export const positionSettings: Action = {
    name: 'POSITION_SETTINGS',
    similes: [
        'UPDATE_POSITION_SETTINGS',
        'MODIFY_POSITION_SETTINGS',
        'CONFIGURE_POSITION_SETTINGS',
        'SET_POSITION_SETTINGS',
        'ADJUST_POSITION_SETTINGS',
        'CHANGE_POSITION_SETTINGS',
        'POSITION_CONFIG',
        'POSITION_CONFIGURATION',
        'UPDATE_POSITION_CONFIG',
        'MODIFY_POSITION_CONFIG',
        'SET_STOP_LOSS',
        'SET_TAKE_PROFIT',
        'SET_POSITION_SIZE',
        'SET_SLIPPAGE',
        'SET_LIQUIDITY_THRESHOLD',
        'SET_VOLUME_THRESHOLD',
    ],
    description: 'Updates position settings for trading positions, including stop loss, take profit, position size limits, and other trading parameters',
    validate: async (runtime: IAgentRuntime, message: Memory) => {
        if (!await HasEntityIdFromMessage(runtime, message)) {
            console.warn('POSITION_SETTINGS validate - author not found')
            return false
        }

        const account = await getAccountFromMessage(runtime, message)
        if (!account) {
            console.warn('POSITION_SETTINGS validate - account not found')
            return false
        }

        // Check if user has any positions
        const res = await interface_positions_ByAccountIdPosIds(runtime, account.entityId, [])
        if (!res || Object.keys(res.list).length === 0) {
            console.warn('POSITION_SETTINGS validate - no positions found')
            return false
        }

        // Check if message contains position settings keywords
        const messageText = message.content?.text?.toLowerCase() || ''
        const settingsKeywords = [
            'stop loss', 'take profit', 'position size', 'slippage', 'liquidity', 'volume',
            'settings', 'config', 'configure', 'update', 'modify', 'adjust', 'change',
            'limit', 'threshold', 'percentage', 'tolerance'
        ]

        const hasSettingsKeywords = settingsKeywords.some(keyword => messageText.includes(keyword))
        if (!hasSettingsKeywords) {
            return false
        }

        return true
    },
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        _options: { [key: string]: unknown },
        callback?: HandlerCallback,
        responses: Memory[] = []
    ): Promise<boolean> => {
        logger.log('POSITION_SETTINGS Starting handler...')

        // Extract wallet address from message using getWalletsFromText
        const sources = await getWalletsFromText(runtime, message)
        let walletAddress: string | null = null
        if (sources.length === 1) {
            walletAddress = sources[0]
        } else if (sources.length > 1) {
            callback?.(takeItPrivate(runtime, message, 'Too many wallet addresses specified. Please specify only one.'))
            return false
        }

        // Extract position ID from message text (look for UUID pattern)
        const messageText = message.content?.text || ''
        const uuidPattern = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi
        const positionIdMatch = messageText.match(uuidPattern)
        const positionId = positionIdMatch ? positionIdMatch[0] : null

        // Extract settings from message text
        const settings: PositionSettings = {}

        // Extract stop loss percentage
        const stopLossMatch = messageText.match(/(?:stop\s*loss|stop-loss)\s*(?:to|at|of)?\s*(\d+(?:\.\d+)?)\s*%/i)
        if (stopLossMatch) {
            settings.stopLossPercentage = parseFloat(stopLossMatch[1]) / 100
        }

        // Extract take profit percentage
        const takeProfitMatch = messageText.match(/(?:take\s*profit|take-profit)\s*(?:to|at|of)?\s*(\d+(?:\.\d+)?)\s*%/i)
        if (takeProfitMatch) {
            settings.takeProfitPercentage = parseFloat(takeProfitMatch[1]) / 100
        }

        // Extract max position size percentage
        const positionSizeMatch = messageText.match(/(?:max(?:imum)?\s*position\s*size|position\s*size)\s*(?:to|at|of)?\s*(\d+(?:\.\d+)?)\s*%/i)
        if (positionSizeMatch) {
            settings.maxPositionSize = parseFloat(positionSizeMatch[1]) / 100
        }

        // Extract slippage tolerance percentage
        const slippageMatch = messageText.match(/(?:slippage\s*(?:tolerance)?)\s*(?:to|at|of)?\s*(\d+(?:\.\d+)?)\s*%/i)
        if (slippageMatch) {
            settings.slippageTolerance = parseFloat(slippageMatch[1]) / 100
        }

        // Extract minimum liquidity
        const liquidityMatch = messageText.match(/(?:min(?:imum)?\s*liquidity)\s*(?:to|at|of)?\s*\$?(\d+(?:,\d+)*)/i)
        if (liquidityMatch) {
            settings.minLiquidity = parseFloat(liquidityMatch[1].replace(/,/g, ''))
        }

        // Extract minimum volume
        const volumeMatch = messageText.match(/(?:min(?:imum)?\s*volume)\s*(?:to|at|of)?\s*\$?(\d+(?:,\d+)*)/i)
        if (volumeMatch) {
            settings.minVolume = parseFloat(volumeMatch[1].replace(/,/g, ''))
        }

        const content: PositionSettingsContent = {
            positionId,
            walletAddress,
            settings
        }

        // Get user account
        const account = await getAccountFromMessage(runtime, message)
        if (!account) {
            callback?.(takeItPrivate(runtime, message, 'Account not found. Please make sure you are registered.'))
            return false
        }

        // Get all positions for the account
        const res = await interface_positions_ByAccountIdPosIds(runtime, account.entityId, [])
        if (!res || Object.keys(res.list).length === 0) {
            callback?.(takeItPrivate(runtime, message, 'No positions found in your account.'))
            return false
        }

        let positionsToUpdate: any[] = []

        // Filter positions based on positionId or walletAddress
        if (content.positionId) {
            // Update specific position
            const position = res.list[content.positionId]
            if (!position) {
                callback?.(takeItPrivate(runtime, message, `Position with ID ${content.positionId} not found.`))
                return false
            }
            positionsToUpdate.push({ positionId: content.positionId, position: position.pos, mw: position.mw })
        } else if (content.walletAddress) {
            // Update all positions for specific wallet
            for (const [posId, posData] of Object.entries(res.list)) {
                if (posData.mw.keypairs?.solana?.publicKey === content.walletAddress) {
                    positionsToUpdate.push({ positionId: posId, position: posData.pos, mw: posData.mw })
                }
            }
            if (positionsToUpdate.length === 0) {
                callback?.(takeItPrivate(runtime, message, `No positions found for wallet ${content.walletAddress}.`))
                return false
            }
        } else {
            // Update all positions (apply settings globally)
            for (const [posId, posData] of Object.entries(res.list)) {
                positionsToUpdate.push({ positionId: posId, position: posData.pos, mw: posData.mw })
            }
        }

        // Validate settings
        const validatedSettings: PositionSettings = {}
        let hasValidSettings = false

        if (content.settings.stopLossPercentage !== undefined) {
            if (content.settings.stopLossPercentage >= 0 && content.settings.stopLossPercentage <= 1) {
                validatedSettings.stopLossPercentage = content.settings.stopLossPercentage
                hasValidSettings = true
            } else {
                callback?.(takeItPrivate(runtime, message, 'Stop loss percentage must be between 0 and 1 (0% to 100%).'))
                return false
            }
        }

        if (content.settings.takeProfitPercentage !== undefined) {
            if (content.settings.takeProfitPercentage >= 0 && content.settings.takeProfitPercentage <= 1) {
                validatedSettings.takeProfitPercentage = content.settings.takeProfitPercentage
                hasValidSettings = true
            } else {
                callback?.(takeItPrivate(runtime, message, 'Take profit percentage must be between 0 and 1 (0% to 100%).'))
                return false
            }
        }

        if (content.settings.maxPositionSize !== undefined) {
            if (content.settings.maxPositionSize >= 0 && content.settings.maxPositionSize <= 1) {
                validatedSettings.maxPositionSize = content.settings.maxPositionSize
                hasValidSettings = true
            } else {
                callback?.(takeItPrivate(runtime, message, 'Maximum position size must be between 0 and 1 (0% to 100%).'))
                return false
            }
        }

        if (content.settings.slippageTolerance !== undefined) {
            if (content.settings.slippageTolerance >= 0 && content.settings.slippageTolerance <= 1) {
                validatedSettings.slippageTolerance = content.settings.slippageTolerance
                hasValidSettings = true
            } else {
                callback?.(takeItPrivate(runtime, message, 'Slippage tolerance must be between 0 and 1 (0% to 100%).'))
                return false
            }
        }

        if (content.settings.minLiquidity !== undefined) {
            if (content.settings.minLiquidity > 0) {
                validatedSettings.minLiquidity = content.settings.minLiquidity
                hasValidSettings = true
            } else {
                callback?.(takeItPrivate(runtime, message, 'Minimum liquidity must be greater than 0.'))
                return false
            }
        }

        if (content.settings.minVolume !== undefined) {
            if (content.settings.minVolume > 0) {
                validatedSettings.minVolume = content.settings.minVolume
                hasValidSettings = true
            } else {
                callback?.(takeItPrivate(runtime, message, 'Minimum volume must be greater than 0.'))
                return false
            }
        }

        if (content.settings.customSettings) {
            validatedSettings.customSettings = content.settings.customSettings
            hasValidSettings = true
        }

        if (!hasValidSettings) {
            callback?.(takeItPrivate(runtime, message, 'No valid position settings found in your message. Please specify settings like stop loss, take profit, position size, etc.'))
            return false
        }

        // Update positions
        let updatedCount = 0
        let failedCount = 0

        for (const { positionId, position, mw } of positionsToUpdate) {
            try {
                // Check if position has a strategy and if it's "none"
                if (mw.strategy && mw.strategy.toLowerCase() !== 'none') {
                    logger.warn(`Skipping position ${positionId} - strategy is "${mw.strategy}", not "none"`)
                    continue
                }

                // Update the position settings
                const success = await updatePosition(runtime, account.entityId, positionId, validatedSettings)
                if (success) {
                    updatedCount++
                } else {
                    failedCount++
                }
            } catch (error) {
                logger.error(`Failed to update position ${positionId}:`, error)
                failedCount++
            }
        }

        // Generate response
        let responseText = ''
        if (updatedCount > 0) {
            responseText += `✅ Successfully updated ${updatedCount} position${updatedCount > 1 ? 's' : ''}.\n\n`

            if (content.positionId) {
                responseText += `📋 Position ID: ${content.positionId}\n`
            } else if (content.walletAddress) {
                responseText += `👜 Wallet: ${content.walletAddress}\n`
            } else {
                responseText += `🌐 Applied to all positions\n`
            }

            responseText += `⚙️ Updated Settings:\n`
            for (const [key, value] of Object.entries(validatedSettings)) {
                if (key === 'customSettings') {
                    responseText += `  • Custom settings: ${Object.keys(value).length} items\n`
                } else {
                    const displayValue = typeof value === 'number' && key.includes('Percentage')
                        ? `${(value * 100).toFixed(2)}%`
                        : typeof value === 'number' && (key.includes('Liquidity') || key.includes('Volume'))
                            ? `$${value.toLocaleString()}`
                            : value
                    responseText += `  • ${key}: ${displayValue}\n`
                }
            }
        }

        if (failedCount > 0) {
            responseText += `\n❌ Failed to update ${failedCount} position${failedCount > 1 ? 's' : ''}.`
        }

        if (updatedCount === 0 && failedCount === 0) {
            responseText = 'No positions were updated. Make sure your positions are using the "none" strategy to allow manual settings configuration.'
        }

        callback?.(takeItPrivate(runtime, message, responseText))
        return true
    },
    examples: [
        [
            {
                name: '{{name1}}',
                content: {
                    text: 'Set stop loss to 5% and take profit to 20% for my positions',
                },
            },
            {
                name: '{{name2}}',
                content: {
                    text: 'I\'ll update your position settings with those risk management parameters.',
                    actions: ['POSITION_SETTINGS'],
                },
            },
        ],
        [
            {
                name: '{{name1}}',
                content: {
                    text: 'Update position 123e4567-e89b-12d3-a456-426614174000 to have 3% stop loss and 15% take profit',
                },
            },
            {
                name: '{{name2}}',
                content: {
                    text: 'I\'ll update that specific position with your risk settings.',
                    actions: ['POSITION_SETTINGS'],
                },
            },
        ],
        [
            {
                name: '{{name1}}',
                content: {
                    text: 'Set maximum position size to 10% of wallet for all my positions',
                },
            },
            {
                name: '{{name2}}',
                content: {
                    text: 'I\'ll configure the position size limits for your trading.',
                    actions: ['POSITION_SETTINGS'],
                },
            },
        ],
        [
            {
                name: '{{name1}}',
                content: {
                    text: 'Update wallet FcfoYfudjC6hnAWRrGw1zEkb87jSSky79A82hddzBFd1 to have 1% slippage tolerance and minimum $50k liquidity',
                },
            },
            {
                name: '{{name2}}',
                content: {
                    text: 'I\'ll update the trading parameters for that wallet.',
                    actions: ['POSITION_SETTINGS'],
                },
            },
        ],
        [
            {
                name: '{{name1}}',
                content: {
                    text: 'Configure my positions to require minimum $100k volume and 2% slippage tolerance',
                },
            },
            {
                name: '{{name2}}',
                content: {
                    text: 'I\'ll set those volume and slippage requirements for your positions.',
                    actions: ['POSITION_SETTINGS'],
                },
            },
        ],
        [
            {
                name: '{{name1}}',
                content: {
                    text: 'Change position settings to be more conservative - 3% stop loss, 10% take profit, 5% max position size',
                },
            },
            {
                name: '{{name2}}',
                content: {
                    text: 'I\'ll update your position settings to be more conservative.',
                    actions: ['POSITION_SETTINGS'],
                },
            },
        ],
    ] as ActionExample[][],
} as Action