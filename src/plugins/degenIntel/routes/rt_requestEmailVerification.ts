import { type IAgentRuntime, logger } from '@elizaos/core';
import { verifyUserRegistration, createOrUpdateVerificationToken } from '../utils/emailVerification';

export const rt_requestEmailVerification = async (req: any, res: any, runtime: IAgentRuntime) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                error: 'Missing required parameter: email'
            });
        }

        // Verify user registration status
        const registrationStatus = await verifyUserRegistration(runtime, email);

        if (!registrationStatus.isRegistered) {
            return res.status(404).json({
                success: false,
                error: 'EMAIL_NOT_REGISTERED',
                message: 'Email address is not registered with Spartan DeFi'
            });
        }

        // Create or update verification token
        const tokenResult = await createOrUpdateVerificationToken(
            runtime,
            email,
            registrationStatus.accountEntityId!
        );

        if (!tokenResult.success) {
            return res.status(500).json({
                success: false,
                error: 'FAILED_TO_SEND_TOKEN',
                message: tokenResult.error || 'Failed to send verification token'
            });
        }

        res.json({
            success: true,
            data: {
                message: 'Verification token sent successfully',
                email,
                verified: registrationStatus.verified,
                timestamp: new Date().toISOString(),
            },
        });
    } catch (error) {
        console.error('Error requesting email verification:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}; 