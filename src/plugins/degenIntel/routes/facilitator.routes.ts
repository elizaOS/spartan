/**
 * x402 Payment Facilitator Routes
 * Invoice generation, payment verification, transaction sponsorship, and session management
 */

import type { Route, IAgentRuntime } from '@elizaos/core';
import { PAYMENT_ADDRESSES, type Network } from '../payment-config';

export const facilitatorRoutes: Route[] = [
  // Generate Payment Invoice
  {
    type: 'POST',
    path: '/api/facilitator/invoice',
    public: true,
    name: 'Generate Payment Invoice',
    handler: async (req: any, res: any, runtime: IAgentRuntime) => {
      try {
        const { endpoint, price, network = 'BASE' } = req.body;

        if (!endpoint || !price) {
          return res.status(400).json({
            success: false,
            error: 'endpoint and price are required'
          });
        }

        // Generate L402 invoice
        const invoiceId = `invoice_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const invoice = {
          success: true,
          invoice: {
            id: invoiceId,
            endpoint: endpoint,
            price: price,
            network: network,
            paymentAddress: PAYMENT_ADDRESSES[network as Network] || PAYMENT_ADDRESSES['BASE'],
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(), // 15 minutes
            // L402 specific fields
            rateLimit: {
              requests: 1,
              window: '15m'
            },
            metadata: {
              description: `Payment required for ${endpoint}`,
              memo: `Invoice for ${endpoint}`
            }
          }
        };

        // Store invoice in runtime cache for verification
        await runtime.setCache(`invoice:${invoiceId}`, {
          ...invoice.invoice,
          verified: false,
          paid: false
        });

        res.json(invoice);
      } catch (error) {
        console.error('Error generating invoice:', error);
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  },

  // Verify Payment Transaction
  {
    type: 'POST',
    path: '/api/facilitator/verify',
    public: true,
    name: 'Verify Payment',
    handler: async (req: any, res: any, runtime: IAgentRuntime) => {
      try {
        const { invoiceId, transactionHash, network = 'BASE' } = req.body;

        if (!invoiceId || !transactionHash) {
          return res.status(400).json({
            success: false,
            error: 'invoiceId and transactionHash are required'
          });
        }

        // Get invoice from cache
        const invoice = await runtime.getCache<any>(`invoice:${invoiceId}`);
        if (!invoice || !invoice.expiresAt) {
          return res.status(404).json({
            success: false,
            error: 'Invoice not found'
          });
        }

        // Check if invoice is expired
        if (new Date() > new Date(invoice.expiresAt)) {
          return res.status(400).json({
            success: false,
            error: 'Invoice expired'
          });
        }

        // Verify transaction on blockchain
        // In production, you would:
        // 1. Check transaction on blockchain
        // 2. Verify payment amount matches
        // 3. Verify it's sent to correct address
        // 4. Verify network matches

        const verification = {
          success: true,
          verified: true,
          transaction: {
            hash: transactionHash,
            network: network,
            invoiceId: invoiceId,
            verifiedAt: new Date().toISOString()
          },
          // Payment proof for client to use
          paymentProof: Buffer.from(`invoice:${invoiceId}:${transactionHash}`).toString('base64')
        };

        // Update invoice as verified
        await runtime.setCache(`invoice:${invoiceId}`, {
          ...invoice,
          verified: true,
          paid: true,
          transactionHash,
          verifiedAt: verification.transaction.verifiedAt
        });

        res.json(verification);
      } catch (error) {
        console.error('Error verifying payment:', error);
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  },

  // Sponsor Transaction (Pay Gas)
  {
    type: 'POST',
    path: '/api/facilitator/sponsor',
    public: true,
    name: 'Sponsor Transaction (Pay Gas)',
    handler: async (req: any, res: any, runtime: IAgentRuntime) => {
      try {
        const { transactionHash, network = 'BASE' } = req.body;

        if (!transactionHash) {
          return res.status(400).json({
            success: false,
            error: 'transactionHash is required'
          });
        }

        // In production, this would:
        // 1. Check if transaction needs gas sponsorship
        // 2. Sign and send sponsorship transaction
        // 3. Return updated transaction hash

        // For now, return success (client handles gas)
        res.json({
          success: true,
          sponsored: false,
          message: 'Transaction sponsorship not yet implemented',
          transactionHash,
          note: 'Client must include sufficient gas for transaction'
        });
      } catch (error) {
        console.error('Error sponsoring transaction:', error);
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  },

  // Verify Payment ID (for x402 protocol)
  {
    type: 'GET',
    path: '/api/facilitator/verify/:paymentId',
    public: true,
    name: 'Verify Payment ID',
    handler: async (req: any, res: any, runtime: IAgentRuntime) => {
      try {
        const { paymentId } = req.params;

        console.log('');
        console.log('╔═══════════════════════════════════════════════════════════╗');
        console.log('║   FACILITATOR VERIFY ENDPOINT CALLED                     ║');
        console.log('╚═══════════════════════════════════════════════════════════╝');
        console.log('Payment ID:', paymentId);
        console.log('Timestamp:', new Date().toISOString());
        console.log('');

        // Check if this is an invoice ID or payment ID
        const invoice = await runtime.getCache<any>(`invoice:${paymentId}`);

        if (!invoice) {
          console.log('✗ Payment not found in cache');
          return res.status(404).json({
            error: 'Payment not found',
            valid: false,
            message: 'The payment ID does not exist or has expired'
          });
        }

        console.log('✓ Invoice found in cache');
        console.log('  - Endpoint:', invoice.endpoint);
        console.log('  - Price:', invoice.price);
        console.log('  - Network:', invoice.network);
        console.log('  - Verified:', invoice.verified);
        console.log('  - Paid:', invoice.paid);
        console.log('');

        // Check if already used (replay protection)
        const used = await runtime.getCache<boolean>(`payment-used:${paymentId}`);
        if (used) {
          console.log('✗ Payment already used (replay attack prevented)');
          return res.status(410).json({
            error: 'Payment already consumed',
            valid: false,
            message: 'This payment has already been used'
          });
        }

        console.log('✓ Payment not yet used (replay check passed)');

        // Check if verified and paid
        if (!invoice.verified || !invoice.paid) {
          console.log('✗ Payment not verified or not paid');
          console.log('  - Verified:', invoice.verified);
          console.log('  - Paid:', invoice.paid);
          return res.status(400).json({
            error: 'Payment not verified',
            valid: false,
            message: 'The payment has not been verified on the blockchain'
          });
        }

        console.log('✓ Payment is verified and paid');

        // Check expiration
        if (new Date() > new Date(invoice.expiresAt)) {
          console.log('✗ Payment expired');
          console.log('  - Expires at:', invoice.expiresAt);
          console.log('  - Current time:', new Date().toISOString());
          return res.status(400).json({
            error: 'Payment expired',
            valid: false,
            message: 'The payment has expired'
          });
        }

        console.log('✓ Payment not expired');
        console.log('  - Expires at:', invoice.expiresAt);

        // Mark as used (replay protection)
        await runtime.setCache(`payment-used:${paymentId}`, true);
        console.log('✓ Payment marked as used');

        console.log('');
        console.log('╔═══════════════════════════════════════════════════════════╗');
        console.log('║   ✓ PAYMENT VERIFICATION SUCCESSFUL                      ║');
        console.log('╚═══════════════════════════════════════════════════════════╝');
        console.log('');

        res.json({
          valid: true,
          verified: true,
          amount: invoice.price,
          currency: 'USD',
          network: invoice.network,
          endpoint: invoice.endpoint,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('');
        console.error('✗ Error verifying payment ID:', error);
        console.error('');
        res.status(500).json({
          error: error instanceof Error ? error.message : 'Unknown error',
          valid: false
        });
      }
    }
  },

  // Get Invoice Status
  {
    type: 'GET',
    path: '/api/facilitator/invoice/:invoiceId',
    public: true,
    name: 'Get Invoice Status',
    handler: async (req: any, res: any, runtime: IAgentRuntime) => {
      try {
        const { invoiceId } = req.params;

        const invoice = await runtime.getCache<any>(`invoice:${invoiceId}`);
        if (!invoice) {
          return res.status(404).json({
            success: false,
            error: 'Invoice not found'
          });
        }

        res.json({
          success: true,
          invoice: {
            id: invoice.id || invoiceId,
            endpoint: invoice.endpoint || '',
            price: invoice.price || '',
            network: invoice.network || 'BASE',
            paymentAddress: invoice.paymentAddress || '',
            createdAt: invoice.createdAt || '',
            expiresAt: invoice.expiresAt || '',
            verified: invoice.verified || false,
            paid: invoice.paid || false,
            transactionHash: invoice.transactionHash || null
          }
        });
      } catch (error) {
        console.error('Error getting invoice:', error);
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  },

  // Create Session Token (Coinbase Onramp)
  {
    type: 'POST',
    path: '/api/facilitator/session',
    public: true,
    name: 'Create Session Token (Coinbase Onramp)',
    handler: async (req: any, res: any, runtime: IAgentRuntime) => {
      try {
        // This endpoint is used by Coinbase Onramp for "Buy More USDC" feature
        const sessionToken = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        const session = {
          success: true,
          sessionToken,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hour
          onrampEnabled: true
        };

        // Store session
        await runtime.setCache(`session:${sessionToken}`, session);

        res.json(session);
      } catch (error) {
        console.error('Error creating session:', error);
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  }
];

