import { PublicKey } from '@solana/web3.js';

/**
 * Meteora pool information from API
 */
export interface MeteoraPool {
    address: string;
    name: string;
    bin_step: number;
    base_fee_percentage: string;
    max_fee_percentage: string;
    protocol_fee_percentage: string;
    liquidity: string;
    fees_24h: number;
    trade_volume_24h: number;
    current_price: number;
    apr: number;
}

/**
 * Meteora pool result from API
 */
export interface MeteoraPoolResult {
    pairs: MeteoraPool[];
}

/**
 * Meteora pool output with normalized fields
 */
export interface MeteoraPoolOutput {
    address: string;
    name: string;
    bin_step: number;
    base_fee_percentage: string;
    max_fee_percentage: string;
    protocol_fee_percentage: string;
    liquidity: string;
    fees_24h: number;
    trade_volume_24h: number;
    current_price: number;
    apr_percentage: number;
}

/**
 * Meteora position information
 */
export interface MeteoraPosition {
    address: string;
    pair_address: string;
}

/**
 * Meteora position info from API
 */
export interface MeteoraPositionInfo {
    address: string;
    pair_address: string;
}

/**
 * Meteora add liquidity parameters
 */
export interface MeteoraAddLiquidityParams {
    amount: string;
    amountB: string;
    poolAddress: string;
    rangeInterval?: number | null;
}

/**
 * Meteora remove liquidity parameters
 */
export interface MeteoraRemoveLiquidityParams {
    poolAddress: string;
    positionAddress?: string | null;
    shouldClosePosition?: boolean | null;
}

/**
 * Meteora pool parameters
 */
export interface MeteoraPoolParams {
    poolAddress: string;
}

/**
 * Meteora get pools parameters
 */
export interface MeteoraGetPoolsParams {
    asset: string;
    assetB: string;
}

/**
 * Meteora API response for pools
 */
export interface MeteoraPoolsResponse {
    pairs: MeteoraPool[];
}

/**
 * Balance changes from liquidity operations
 */
export interface BalanceChanges {
    liquidityRemoved: [number, number];
    feesClaimed: [number, number];
}

/**
 * Token amount information
 */
export interface TokenAmount {
    amount: string;
    decimals: number;
    uiAmount: number;
    uiAmountString: string;
}

/**
 * Position info from transaction
 */
export interface PositionInfoFromTx {
    positionAddress: string;
    liquidityAdded: [number, number];
}

/**
 * Remove liquidity result
 */
export interface RemoveLiquidityResult {
    liquidityRemoved: [number, number];
    feesClaimed: [number, number];
}

/**
 * Get pools parameters
 */
export interface GetPoolsParameters {
    asset: string;
    assetB: string;
}

/**
 * Pool parameters
 */
export interface PoolParameters {
    poolAddress: string;
}

/**
 * Add liquidity parameters
 */
export interface AddLiquidityParameters {
    amount: string;
    amountB: string;
    poolAddress: string;
    rangeInterval?: number;
}

/**
 * Remove liquidity parameters
 */
export interface RemoveLiquidityParameters {
    poolAddress: string;
    positionAddress?: string;
    shouldClosePosition?: boolean;
}

/**
 * Bin liquidity information
 */
export interface BinLiquidity {
    binId: number;
    price: number;
}

/**
 * LB Position data
 */
export interface LbPosition {
    publicKey: PublicKey;
    positionData: any;
}

/**
 * Position info type
 */
export interface PositionInfo {
    publicKey: PublicKey;
    positionData: any;
} 