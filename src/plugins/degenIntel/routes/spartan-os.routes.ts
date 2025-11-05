/**
 * Spartan OS Routes
 * New interface for Spartan OS unit - wallet/token pages, JSON data, and assets
 */

import type { Route, IAgentRuntime } from '@elizaos/core';
import { PublicKey } from '@solana/web3.js';
import { fs, path, ejs, frontendNewDist, injectBase } from './shared';

/**
 * Get account type using chain_solana service
 * Determines if an address is a Wallet, Token, or Token Account
 */
async function getAccountType(runtime: IAgentRuntime, address: string): Promise<string> {
  try {
    const solanaService = runtime.getService('chain_solana') as any;
    
    if (!solanaService) {
      console.warn('chain_solana service not available');
      return 'Unknown (service unavailable)';
    }

    // Use service's getAddressType if available
    if (typeof solanaService.getAddressType === 'function') {
      return await solanaService.getAddressType(address);
    }

    // Fallback: use service's connection
    if (solanaService.connection) {
      const pubkey = new PublicKey(address);
      const accountInfo = await solanaService.connection.getAccountInfo(pubkey);

      if (!accountInfo) {
        return 'Account does not exist';
      }

      const dataLength = accountInfo.data.length;

      if (dataLength === 0) return 'Wallet';
      if (dataLength === 165) return 'Token Account'; // SPL Token account
      if (dataLength === 82) return 'Token'; // Token mint

      return `Unknown (Data length: ${dataLength})`;
    }

    return 'Unknown (no connection available)';
  } catch (error) {
    console.error('Error getting account type:', error);
    return 'Error determining account type';
  }
}

export const spartanOsRoutes: Route[] = [
  // Home page
  {
    type: 'GET',
    path: '/new/',
    public: true,
    handler: async (req: any, res: any) => {
      const base = req.path;
      console.log('base', base);
      try {
        const filePath = frontendNewDist + '/templates/page.ejs';
        console.log('path', filePath);
        const data = {
          title: 'Spartan Interface',
          page: 'empty'
        };
        const html = await ejs.renderFile(filePath, data);
        const basedHtml = injectBase(html, base);
        res.type('html').send(basedHtml);
      } catch (e) {
        console.error('e', e);
        res.status(500).send('File not found');
      }
    },
  },

  // Redirect to home
  {
    type: 'GET',
    path: '/new',
    handler: async (req: any, res: any) => {
      const base = req.path;
      console.log('base', base);
      res.redirect(base + '/');
    },
  },

  // Address redirector (determines if wallet or token)
  {
    type: 'GET',
    path: '/new/addresses/*',
    handler: async (req: any, res: any, runtime: IAgentRuntime) => {
      const base = req.path.split(/\/new\//, 2)[0];
      console.log('addresses base', base);
      const address = req.path.split(/\/addresses\//, 2)[1];
      console.log('address', address);
      const result = await getAccountType(runtime, address);
      console.log('result', result);
      try {
        if (result === 'Wallet') {
          res.redirect(base + '/new/wallets/' + address);
          return;
        }
        if (result === 'Token') {
          res.redirect(base + '/new/tokens/' + address);
          return;
        }
        res.type('html').send('Not sure where to send you');
      } catch (e) {
        console.error('e', e);
        res.status(500).send('File not found');
      }
    },
  },

  // Wallet page (HTML)
  {
    type: 'GET',
    path: '/new/wallets/*',
    handler: async (req: any, res: any, runtime: IAgentRuntime) => {
      const base = req.path.split(/\/new\//, 2)[0];
      const address = req.path.split(/\/wallets\//, 2)[1];
      const solanaService = runtime.getService('chain_solana') as any;
      const result = await solanaService.getAddressType(address);
      
      try {
        if (result === 'Token') {
          res.redirect(base + '/new/tokens/' + address);
          return;
        }
        if (result !== 'Wallet') {
          res.status(500).send('CA unknown type');
          return;
        }
        
        console.log('frontendNewDist', frontendNewDist);
        const filePath = frontendNewDist + '/templates/page.ejs';
        console.log('path', filePath);
        const data = {
          title: 'Spartan Interface - Wallet',
          page: 'wallet',
          walletAddress: address,
        };
        const html = await ejs.renderFile(filePath, data);
        const basedHtml = injectBase(html, base + '/new/');
        res.type('html').send(basedHtml);
      } catch (e) {
        console.error('e', e);
        res.status(500).send('File not found');
      }
    },
  },

  // Wallet data (JSON)
  {
    type: 'GET',
    path: '/new/json/wallets/*',
    handler: async (req: any, res: any, runtime: IAgentRuntime) => {
      const base = req.path.split(/\/new\//, 2)[0];
      const address = req.path.split(/\/wallets\//, 2)[1];
      const solanaService = runtime.getService('chain_solana') as any;
      const result = await solanaService.getAddressType(address);
      
      try {
        if (result === 'Token') {
          res.redirect(base + '/new/json/tokens/' + address);
          return;
        }
        if (result !== 'Wallet') {
          res.status(500).send('CA unknown type');
          return;
        }
        
        const pubKeyObj = new PublicKey(address);
        const data = await solanaService.getTokenAccountsByKeypair(pubKeyObj);
        res.json({
          history: [],
          portfolio: {
            wallet: address,
            totalUsd: 0,
            items: data.map(s => ({
              address: s.account.data.parsed.info.mint,
              chainId: 'solana',
              name: '',
              symbol: '',
              uiAmount: s.account.data.parsed.info.tokenAmount.uiAmount,
              valueUsd: 0,
            })),
          }
        });
      } catch (e) {
        console.error('e', e);
        res.status(500).send('File not found');
      }
    },
  },

  // Token page (HTML)
  {
    type: 'GET',
    path: '/new/tokens/*',
    handler: async (req: any, res: any, runtime: IAgentRuntime) => {
      const base = '/api/agents' + req.path.split(/\/new\//, 2)[0];
      const address = req.path.split(/\/tokens\//, 2)[1];
      const result = await getAccountType(runtime, address);
      
      try {
        if (result === 'Wallet') {
          res.redirect(base + '/new/wallets/' + address);
          return;
        }
        if (result !== 'Token') {
          res.status(500).send('CA unknown type');
          return;
        }
        
        console.log('frontendNewDist', frontendNewDist);
        const filePath = frontendNewDist + '/templates/page.ejs';
        console.log('path', filePath);
        const data = {
          title: 'Spartan Interface - Tokens',
          page: 'token',
          address,
        };
        const html = await ejs.renderFile(filePath, data);
        const basedHtml = injectBase(html, base + '/new/');
        res.type('html').send(basedHtml);
      } catch (e) {
        console.error('e', e);
        res.status(500).send('File not found');
      }
    },
  },

  // Token data (JSON)
  {
    type: 'GET',
    path: '/new/json/tokens/*',
    handler: async (req: any, res: any, runtime: IAgentRuntime) => {
      const base = req.path.split(/\/new\//, 2)[0];
      const address = req.path.split(/\/tokens\//, 2)[1];
      const result = await getAccountType(runtime, address);
      
      try {
        if (result === 'Wallet') {
          res.redirect(base + '/new/wallets/' + address);
          return;
        }
        if (result !== 'Token') {
          res.status(500).send('CA unknown type');
          return;
        }
        
        const birdeyeService = runtime.getService('birdeye') as any;
        if (!birdeyeService || typeof birdeyeService.lookupToken !== 'function') {
          res.status(500).send('Birdeye is not available');
          return;
        }
        
        const tokenData = await birdeyeService.lookupToken('solana', address);
        console.log('tokenData', tokenData);
        res.json({});
      } catch (e) {
        console.error('e', e);
        res.status(500).send('File not found');
      }
    },
  },

  // CSS assets
  {
    type: 'GET',
    path: '/new/css/*',
    handler: async (req: any, res: any) => {
      const assetPath = frontendNewDist + '/' + req.path.split('/new/')[1];
      console.log('css assetPath', assetPath);
      if (fs.existsSync(path.resolve(assetPath))) {
        res.sendFile(assetPath);
      } else {
        res.status(404).send('File not found');
      }
    },
  },

  // Image assets
  {
    type: 'GET',
    path: '/new/images/*',
    handler: async (req: any, res: any) => {
      const assetPath = frontendNewDist + '/' + req.path.split('/new/')[1];
      if (fs.existsSync(path.resolve(assetPath))) {
        res.sendFile(assetPath);
      } else {
        res.status(404).send('File not found');
      }
    },
  },

  // JavaScript assets
  {
    type: 'GET',
    path: '/new/js/*',
    handler: async (req: any, res: any) => {
      const assetPath = frontendNewDist + '/' + req.path.split('/new/')[1];
      if (fs.existsSync(path.resolve(assetPath))) {
        res.sendFile(assetPath);
      } else {
        res.status(404).send('File not found');
      }
    },
  },

  // Generic page handler
  {
    type: 'GET',
    path: '/new/*',
    handler: async (req: any, res: any) => {
      const base = '/api/agents' + req.path.replace(/\/degen-intel$/, '') + '/..';
      console.log('base', base);
      const assetPath = frontendNewDist + '/templates/' + req.path.split('/new/')[1];
      console.log('page assetPath', assetPath);

      const data = {
        title: 'Spartan Interface',
        page: 'home'
      };
      try {
        const html = await ejs.renderFile(assetPath + '.ejs', data);
        const basedHtml = injectBase(html, base + '/');
        res.type('html').send(basedHtml);
      } catch (e) {
        res.status(404).send('File not found');
      }
    },
  },
];

