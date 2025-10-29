/**
 * Reusable validators for route parameter validation
 * These run BEFORE payment verification to prevent charging for invalid requests
 */

import type { ValidationResult } from './payment-wrapper';

/**
 * Validate that required fields exist in request body
 * @param req - Express request object
 * @param requiredFields - Array of field names that must be present
 * @returns ValidationResult
 */
export function validateRequiredBodyFields(
    req: any,
    requiredFields: string[]
): ValidationResult {
    const body = req.body || {};
    const missing: string[] = [];

    for (const field of requiredFields) {
        if (body[field] === undefined || body[field] === null || body[field] === '') {
            missing.push(field);
        }
    }

    if (missing.length > 0) {
        return {
            valid: false,
            error: {
                status: 400,
                message: `Missing required fields: ${missing.join(', ')}`,
                details: { missing }
            }
        };
    }

    return { valid: true };
}

/**
 * Validate that required query parameters exist
 * @param req - Express request object
 * @param requiredParams - Array of param names that must be present
 * @returns ValidationResult
 */
export function validateRequiredQueryParams(
    req: any,
    requiredParams: string[]
): ValidationResult {
    const query = req.query || {};
    const missing: string[] = [];

    for (const param of requiredParams) {
        if (query[param] === undefined || query[param] === null || query[param] === '') {
            missing.push(param);
        }
    }

    if (missing.length > 0) {
        return {
            valid: false,
            error: {
                status: 400,
                message: `Missing required query parameters: ${missing.join(', ')}`,
                details: { missing }
            }
        };
    }

    return { valid: true };
}

/**
 * Validate that a field is a valid Solana address
 * @param address - The address to validate
 * @returns boolean
 */
export function isValidSolanaAddress(address: string): boolean {
    if (!address || typeof address !== 'string') {
        return false;
    }
    // Solana addresses are base58 encoded and typically 32-44 characters
    return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
}

/**
 * Validate that a field is a valid EVM address
 * @param address - The address to validate
 * @returns boolean
 */
export function isValidEvmAddress(address: string): boolean {
    if (!address || typeof address !== 'string') {
        return false;
    }
    // EVM addresses are 0x followed by 40 hex characters
    return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * Validate that a value is a positive number
 * @param value - The value to validate
 * @returns boolean
 */
export function isPositiveNumber(value: any): boolean {
    const num = Number(value);
    return !isNaN(num) && num > 0;
}

/**
 * Create a validator for token-related endpoints
 * Validates that tokenMint is present and valid
 */
export function createTokenMintValidator(): (req: any) => ValidationResult {
    return (req: any) => {
        const { tokenMint } = req.body || {};

        if (!tokenMint) {
            return {
                valid: false,
                error: {
                    status: 400,
                    message: 'tokenMint is required'
                }
            };
        }

        if (!isValidSolanaAddress(tokenMint)) {
            return {
                valid: false,
                error: {
                    status: 400,
                    message: 'tokenMint must be a valid Solana address',
                    details: { tokenMint }
                }
            };
        }

        return { valid: true };
    };
}

/**
 * Create a validator for swap quote endpoints
 * Validates inputMint, outputMint, and amount
 */
export function createSwapQuoteValidator(): (req: any) => ValidationResult {
    return (req: any) => {
        const { inputMint, outputMint, amount } = req.body || {};

        // Check required fields
        const missing: string[] = [];
        if (!inputMint) missing.push('inputMint');
        if (!outputMint) missing.push('outputMint');
        if (!amount) missing.push('amount');

        if (missing.length > 0) {
            return {
                valid: false,
                error: {
                    status: 400,
                    message: `Missing required fields: ${missing.join(', ')}`,
                    details: { missing }
                }
            };
        }

        // Validate addresses
        if (!isValidSolanaAddress(inputMint)) {
            return {
                valid: false,
                error: {
                    status: 400,
                    message: 'inputMint must be a valid Solana address',
                    details: { inputMint }
                }
            };
        }

        if (!isValidSolanaAddress(outputMint)) {
            return {
                valid: false,
                error: {
                    status: 400,
                    message: 'outputMint must be a valid Solana address',
                    details: { outputMint }
                }
            };
        }

        // Validate amount
        if (!isPositiveNumber(amount)) {
            return {
                valid: false,
                error: {
                    status: 400,
                    message: 'amount must be a positive number',
                    details: { amount }
                }
            };
        }

        return { valid: true };
    };
}

/**
 * Create a validator for wallet balance endpoints
 * Validates that wallet address is present and valid
 */
export function createWalletValidator(network: 'solana' | 'evm' = 'solana'): (req: any) => ValidationResult {
    return (req: any) => {
        const { wallet } = req.query || {};

        if (!wallet) {
            return {
                valid: false,
                error: {
                    status: 400,
                    message: 'wallet address is required'
                }
            };
        }

        const isValid = network === 'solana'
            ? isValidSolanaAddress(wallet as string)
            : isValidEvmAddress(wallet as string);

        if (!isValid) {
            return {
                valid: false,
                error: {
                    status: 400,
                    message: `wallet must be a valid ${network === 'solana' ? 'Solana' : 'EVM'} address`,
                    details: { wallet }
                }
            };
        }

        return { valid: true };
    };
}

/**
 * Compose multiple validators into a single validator
 * All validators must pass for the result to be valid
 */
export function composeValidators(...validators: Array<(req: any) => ValidationResult | Promise<ValidationResult>>) {
    return async (req: any): Promise<ValidationResult> => {
        for (const validator of validators) {
            const result = await validator(req);
            if (!result.valid) {
                return result;
            }
        }
        return { valid: true };
    };
}

