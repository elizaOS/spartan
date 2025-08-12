import { type IAgentRuntime, logger, createUniqueUuid } from '@elizaos/core';

// Validate auth token function implementation
async function validateAuthToken(
    runtime: IAgentRuntime,
    email: string,
    authToken: string
): Promise<{ valid: boolean; userEntityId?: string; error?: string }> {
    try {
        const authTokenKey = `auth_token_${email}`;
        const cachedAuthData = await runtime.getCache(authTokenKey);

        if (!cachedAuthData) {
            return { valid: false, error: 'No auth token found' };
        }

        const { authToken: storedAuthToken, expiry, userEntityId } = cachedAuthData as any;

        // Check if token is expired
        if (Date.now() > expiry) {
            await runtime.deleteCache(authTokenKey);
            return { valid: false, error: 'Auth token has expired' };
        }

        // Check if token matches
        if (authToken !== storedAuthToken) {
            return { valid: false, error: 'Invalid auth token' };
        }

        return { valid: true, userEntityId };
    } catch (error) {
        logger.error('Error validating auth token:', error);
        return { valid: false, error: 'Failed to validate auth token' };
    }
}

export const rt_validateAuthToken = async (req: any, res: any, runtime: IAgentRuntime) => {
    try {
        const { email } = req.body || {};
        const authToken = req.headers.authorization?.replace('Bearer ', '') || req.body?.authToken;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'Email is required'
            });
        }

        if (!authToken) {
            return res.status(400).json({
                success: false,
                message: 'Auth token is required (send in Authorization header or request body)'
            });
        }

        logger.info('Validating auth token for:', email);

        const result = await validateAuthToken(runtime, email, authToken);

        if (result.valid) {
            // Get user's associated wallets
            const emailEntityId = createUniqueUuid(runtime, email);
            const intAccountService = runtime.getService('AUTONOMOUS_TRADER_INTERFACE_ACCOUNTS') as any;
            let wallets = [];

            if (intAccountService) {
                try {
                    const components = await intAccountService.interface_accounts_ByIds([emailEntityId]);
                    const component = components[emailEntityId];

                    if (component && component.metawallets) {
                        console.log('component.metawallets', component.metawallets);

                        // for each metawallets
                        for (const mw of component.metawallets) {
                            // get a wallet for each chain
                            for (const chain in mw.keypairs) {
                                const kp = mw.keypairs[chain];
                                console.log(chain, kp);
                                wallets.push({
                                    address: kp.publicKey,
                                    name: kp.publicKey.slice(0, 8) + '...',
                                    type: chain,
                                    verified: true, // this really isn't a thing
                                });
                            }
                        }
                        console.log('wallets', wallets);
                    }
                } catch (error) {
                    console.error('Error fetching user wallets:', error);
                }
            }

            const accountData = {
                type: 'email',
                address: email,
                verified: true,
                registrationDate: new Date().toISOString(),
                wallets: wallets
            };

            res.json({
                success: true,
                data: {
                    userEntityId: result.userEntityId,
                    message: 'Auth token is valid',
                    email,
                    isValid: true,
                    account: accountData
                }
            });
        } else {
            res.status(401).json({
                success: false,
                message: result.error || 'Invalid auth token',
                email
            });
        }
    } catch (error) {
        logger.error('Error in rt_validateAuthToken route:', error);
        res.status(500).json({
            success: false,
            message: 'Error validating auth token',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}; 