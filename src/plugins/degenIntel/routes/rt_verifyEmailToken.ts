import { type IAgentRuntime, logger } from '@elizaos/core';
import { verifyEmailToken } from '../utils/emailVerification';

export const rt_verifyEmailToken = async (req: any, res: any, runtime: IAgentRuntime) => {
    try {
        const { email, token } = req.body || {};

        if (!email || !token) {
            return res.status(400).json({
                success: false,
                message: 'Email and token are required'
            });
        }

        logger.info('Verifying email token for:', email);

        const result = await verifyEmailToken(runtime, email, token);

        if (result.success) {
            res.json({
                success: true,
                data: {
                    authToken: result.authToken,
                    message: 'Email token verified successfully',
                    email
                }
            });
        } else {
            res.status(400).json({
                success: false,
                message: result.error || 'Failed to verify email token',
                email
            });
        }
    } catch (error) {
        logger.error('Error in rt_verifyEmailToken route:', error);
        res.status(500).json({
            success: false,
            message: 'Error verifying email token',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}; 