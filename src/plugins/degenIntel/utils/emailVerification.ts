import { type IAgentRuntime, logger, createUniqueUuid } from '@elizaos/core';
import { generateRandomString } from '../../autonomous-trader/utils';
import CONSTANTS from '../../autonomous-trader/constants';
import { v4 as uuidv4 } from 'uuid';

// User registration verification function implementation
export async function verifyUserRegistration(runtime: IAgentRuntime, email: string): Promise<{
    isRegistered: boolean;
    userEntityId?: string;
    accountEntityId?: string;
    verified?: boolean;
}> {
    try {
        const emailEntityId = createUniqueUuid(runtime, email);
        const intAccountService = runtime.getService('AUTONOMOUS_TRADER_INTERFACE_ACCOUNTS') as any;

        if (!intAccountService) {
            logger.warn('User interface service not available');
            return { isRegistered: false };
        }

        const components = await intAccountService.interface_accounts_ByIds([emailEntityId]);
        const component = components[emailEntityId];

        if (component) {
            return {
                isRegistered: true,
                accountEntityId: emailEntityId,
            };
        }

        return { isRegistered: false };
    } catch (error) {
        logger.error('Error verifying user registration:', error as any);
        return { isRegistered: false };
    }
}

// Email verification function implementation
export async function sendVerificationEmail(email: string, token: string): Promise<boolean> {
    try {
        const nodemailer = await import('nodemailer');

        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: parseInt(process.env.SMTP_PORT || '587'),
            secure: false,
            auth: {
                user: process.env.SMTP_USERNAME,
                pass: process.env.SMTP_PASSWORD
            }
        });

        const mailOptions = {
            from: process.env.SMTP_FROM || 'noreply@spartan.com',
            to: email,
            subject: 'Spartan DeFi - Email Verification',
            html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #3b82f6;">Spartan DeFi Email Verification</h2>
          <p>Hello!</p>
          <p>You're trying to access Spartan DeFi services. Please use the following verification code:</p>
          <div style="background: #f3f4f6; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
            <h1 style="color: #1f2937; font-size: 32px; letter-spacing: 4px; margin: 0;">${token}</h1>
          </div>
          <p>This code will expire in 10 minutes.</p>
          <p>If you didn't request this verification, please ignore this email.</p>
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
          <p style="color: #6b7280; font-size: 12px;">Spartan DeFi - Your AI-powered DeFi assistant</p>
        </div>
      `,
            text: `Spartan DeFi Email Verification\n\nYour verification code is: ${token}\n\nThis code will expire in 10 minutes.\n\nIf you didn't request this verification, please ignore this email.`
        };

        const info = await transporter.sendMail(mailOptions);
        logger.info('Verification email sent:', info.envelope);
        return true;
    } catch (error) {
        logger.error('Error sending verification email:', error as any);
        return false;
    }
}

// Create or update verification token function implementation
export async function createOrUpdateVerificationToken(
    runtime: IAgentRuntime,
    email: string,
    accountEntityId: string
): Promise<{ success: boolean; token?: string; error?: string }> {
    try {
        console.log('createOrUpdateVerificationToken called with:');
        console.log('Email:', email);
        console.log('accountEntityId:', accountEntityId);

        const token = generateRandomString(CONSTANTS.useCodeLength);
        console.log('Generated token:', token);

        const tokenExpiry = Date.now() + (10 * 60 * 1000); // 10 minutes
        console.log('Token expiry:', new Date(tokenExpiry));

        const tokenKey = `verification_token_${email}`;
        console.log('Token key for storage:', tokenKey);

        const tokenData = {
            token,
            email,
            accountEntityId,
            expiry: tokenExpiry,
            createdAt: Date.now()
        };
        console.log('Token data to store:', tokenData);

        await runtime.setCache(tokenKey, tokenData);
        console.log('Token stored in cache successfully');

        const emailSent = await sendVerificationEmail(email, token);

        if (!emailSent) {
            return { success: false, error: 'Failed to send verification email' };
        }

        return { success: true, token };
    } catch (error) {
        logger.error('Error creating verification token:', error as any);
        return { success: false, error: 'Failed to create verification token' };
    }
}

// Verify email token function implementation
export async function verifyEmailToken(
    runtime: IAgentRuntime,
    email: string,
    token: string
): Promise<{ success: boolean; authToken?: string; error?: string }> {
    try {
        console.log('verifyEmailToken called with:');
        console.log('Email:', email);
        console.log('Token:', token);

        const tokenKey = `verification_token_${email}`;
        console.log('Token key:', tokenKey);

        const cachedTokenData = await runtime.getCache(tokenKey);
        console.log('Cached token data:', cachedTokenData);

        if (!cachedTokenData) {
            return { success: false, error: 'No verification token found for this email' };
        }

        const { token: storedToken, expiry, accountEntityId } = cachedTokenData as any;

        // Check if token is expired
        if (Date.now() > expiry) {
            await runtime.deleteCache(tokenKey);
            return { success: false, error: 'Verification token has expired' };
        }

        // Check if token matches
        if (token !== storedToken) {
            return { success: false, error: 'Invalid verification token' };
        }

        // Generate auth token for successful verification
        const authToken = uuidv4();
        const authTokenExpiry = Date.now() + (24 * 60 * 60 * 1000); // 24 hours

        // Store auth token
        const authTokenKey = `auth_token_${email}`;
        await runtime.setCache(authTokenKey, {
            authToken,
            email,
            accountEntityId,
            expiry: authTokenExpiry,
            createdAt: Date.now()
        });

        // Clean up verification token
        await runtime.deleteCache(tokenKey);

        return { success: true, authToken };
    } catch (error) {
        logger.error('Error verifying email token:', error as any);
        return { success: false, error: 'Failed to verify token' };
    }
} 