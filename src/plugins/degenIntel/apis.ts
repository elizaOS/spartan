// TODO: Replace with cache adapter

import { type IAgentRuntime, type Memory, type Route, createUniqueUuid } from '@elizaos/core';

import { SentimentArraySchema, TweetArraySchema } from './schemas';

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Portfolio, SentimentContent, TransactionHistory } from './providers/birdeye';
import type { IToken } from './types';
import ejs from 'ejs';

import { Connection, PublicKey } from '@solana/web3.js';
import {
  getWalletBalancesFromServices,
  getTokenBalanceFromServices,
  getSwapQuoteFromServices,
  getTokenInfo,
  chatWithSpartanAI,
  verifyUserRegistration,
  createOrUpdateVerificationToken,
  verifyEmailToken,
  validateAuthToken
} from './utils';

const connection = new Connection('https://api.mainnet-beta.solana.com');

// Define the equivalent of __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// from the package.json, find frontend/dist and host it statically
const frontendDist = path.resolve(__dirname, './');

const INDEX_PATH = path.resolve(frontendDist, 'index.html');
console.log('INDEX_PATH', INDEX_PATH)
const INDEX_TEMPLATE = await fsp.readFile(INDEX_PATH, 'utf8');

function injectBase(html: string, href: string) {
  // Put the tag right after <head …> so the browser sees it first
  html = html.replace(
    /<head([^>]*)>/i,
    (_match, attrs) => `<head${attrs}>\n  <base href="${href}">`
  );

  html = html.replace(
    /href="\/degen-intel\/([^"]*)"/i,
    (_match, attrs) => `href="degen-intel/${attrs}"`
  );
  html = html.replace(
    /src="\/degen-intel\/([^"]*)"/i,
    (_match, attrs) => `src="degen-intel/${attrs}"`
  );

  return html
}

async function getAccountType(address) {
  const pubkey = new PublicKey(address);
  const accountInfo = await connection.getAccountInfo(pubkey);

  if (!accountInfo) {
    return 'Account does not exist';
  }

  //console.log('accountInfo', accountInfo)

  const dataLength = accountInfo.data.length;

  if (dataLength === 0) {
    return 'Wallet';
  }

  // SPL Token accounts are always 165 bytes
  // User's balance of a specified token
  if (dataLength === 165) {
    return 'Token Account';
  }

  // Token mint account
  if (dataLength === 82) {
    return 'Token';
  }

  return `Unknown (Data length: ${dataLength})`;
}

/**
 * Definition of routes with type, path, and handler for each route.
 * Routes include fetching trending tokens, wallet information, tweets, sentiment analysis, and signals.
 */

//__dirname /root/spartan-05-26-odi/packages/spartan/dist
//console.log('__dirname', __dirname)

//const frontendNewDist = path.resolve(__dirname, '../src/investmentManager/plugins/degen-intel/frontend_new');
const frontendNewDist = path.resolve(__dirname, '../src/plugins/degenIntel/frontend_new');
console.log('frontendDist', frontendNewDist)

export const routes: Route[] = [
  {
    type: 'GET',
    path: '/degen-intel',
    public: true,
    name: 'Spartan Intel',
    handler: async (_req: any, res: any) => {
      const route = _req.url;
      res.sendFile(path.resolve(frontendDist, 'index.html'));
    },
  },
  {
    type: 'GET',
    path: '/spartan',
    public: true,
    name: 'Spartan Wallet',
    handler: async (req: any, res: any) => {
      const base = req.path;
      console.log('spartan base', base);
      try {
        const filePath = frontendNewDist + '/templates/page.ejs';
        console.log('spartan path', filePath);
        const data = {
          title: 'Spartan Wallet',
          page: 'spartan'
        };
        const html = await ejs.renderFile(filePath, data);
        const basedHtml = injectBase(html, base);
        res.type('html').send(basedHtml);
      } catch (e) {
        console.error('spartan error', e);
        res.status(500).send('File not found');
      }
    },
  },
  {
    type: 'GET',
    path: '/emailToUUID',
    public: true,
    name: 'Email to UUID',
    handler: async (req: any, res: any, runtime: IAgentRuntime) => {
      console.log('email', req.query.email)
      const entityId = createUniqueUuid(runtime, req.query.email);
      res.send(entityId)
    },
  },
  {
    type: 'GET',
    path: '/fix',
    //public: true,
    handler: async (req: any, res: any, runtime) => {
      const base = '/api/agents/Spartan/plugins/spartan-intel' + req.path;
      console.log('base', base)
      //res.redirect(base + '/')

      try {
        //console.log('frontendDist', frontendDist)
        /*
        const filePath = frontendNewDist + '/templates/page.ejs'
        console.log('path', filePath)
        const data = {
          title: 'Spartan Interface',
          page: 'empty'
        }
        // want a wrapcontent style maybe...
        const html = await ejs.renderFile(filePath, data);
        const basedHtml = injectBase(html, base);
        res.type('html').send(basedHtml);
        */

        // ok we need to access spartan
        const agentEntityId = createUniqueUuid(runtime, runtime.agentId);
        const agentEntity = await runtime.getEntityById(agentEntityId);
        const spartanData = agentEntity.components.find(c => c.type === 'spartan_services')
        console.log('spartanData', spartanData)

        const users = await runtime.getEntityByIds(spartanData.data.users)
        const accounts = await runtime.getEntityByIds(spartanData.data.accounts)

        // users
        // how do we audit this...
        // use list of accounts to find users?
        for (const a of accounts) {
          const acctComp = a.components.find(c => c.type === 'component_account_v0')
          if (!acctComp) {
            console.log('no component_account_v0 for', u)
            continue
          }
          const acctData = acctComp.data
          const userId = acctComp.sourceEntityId
          if (spartanData.data.users.indexOf(userId) === -1) {
            console.log('unlinked account', acctComp, 'was made by', userId)
          }
        }

        // accounts
        // how do we audit this...
        // use list of users to find accounts <- this works
        for (const u of users) {
          const userComp = u.components.find(c => c.type === 'component_user_v0')
          if (!userComp) {
            console.log('no component_user_v0 for', u)
            continue
          }
          const userData = userComp.data
          // code, tries, addrss, verified
          if (userData.verified) {
            const emailAddress = userData.address
            const emailEntityId = createUniqueUuid(runtime, emailAddress);
            if (spartanData.data.accounts.indexOf(emailEntityId) === -1) {
              console.log('emailEntityId', emailEntityId, 'is missing for', emailAddress)
              spartanData.data.accounts.push(emailEntityId)
            }
          }
        }

        // save spartan data
        if (0) {
          await runtime.updateComponent({
            id: spartanData.id,
            // do we need all these fields?
            //agentId: runtime.agentId,
            //worldId: roomDetails.worldId,
            //roomId: message.roomId,
            //sourceEntityId: entityId,
            //entityId: entityId,
            //type: CONSTANTS.SPARTAN_SERVICE_TYPE,
            data: spartanData.data,
          });
        }

        // this will leak privateKeys
        res.json({
          spartanData,
          users,
          accounts,
        })
      } catch (e) {
        console.error('e', e)
        res.status(500).send('File not found');
      }

    },
  },
  {
    type: 'GET',
    path: '/new/',
    public: true,
    handler: async (req: any, res: any) => {
      //console.log('path', req.path, 'url', req.url)
      // path /new/ url /new/
      // .replace(/\/spartan-intel$/, '')
      //const base = '/api/agents/Spartan/plugins/spartan-intel' + req.path;
      const base = req.path
      console.log('base', base)
      try {
        //console.log('frontendDist', frontendDist)
        /*
        const INDEX_PATH       = path.resolve(frontendDist, 'index.html');
        console.log('INDEX_PATH', INDEX_PATH)
        const INDEX_TEMPLATE   = await fsp.readFile(INDEX_PATH, 'utf8');
        console.log('INDEX_TEMPLATE', INDEX_TEMPLATE)
        const html = injectBase(INDEX_TEMPLATE, base);
        */
        const filePath = frontendNewDist + '/templates/page.ejs'
        console.log('path', filePath)
        const data = {
          title: 'Spartan Interface',
          page: 'empty'
        }
        const html = await ejs.renderFile(filePath, data);
        const basedHtml = injectBase(html, base);
        res.type('html').send(basedHtml);
      } catch (e) {
        console.error('e', e)
        res.status(500).send('File not found');
      }
      //res.sendFile(path.resolve(frontendDist, 'index.html'));
    },
  },
  {
    type: 'GET',
    path: '/new',
    //public: true,
    handler: async (req: any, res: any) => {
      //const base = '/api/agents' + req.path.replace(/\/spartan-intel$/, '');
      const base = req.path
      console.log('base', base)
      res.redirect(base + '/')
    },
  },
  // redirector
  {
    type: 'GET',
    path: '/new/addresses/*',
    handler: async (req: any, res: any) => {
      //const base = '/api/agents' + req.path.split(/\/new\//, 2)[0]
      //  + req.path;
      //console.log('req.path', req.path) // has addresses in it
      //const base = '/api/agents/Spartan/plugins/spartan-intel'
      //
      const base = req.path.split(/\/new\//, 2)[0]
      console.log('addresses base', base)
      const address = req.path.split(/\/addresses\//, 2)[1];
      console.log('address', address)
      const result = await getAccountType(address)
      console.log('result', result)
      try {
        if (result === 'Wallet') {
          res.redirect(base + '/new/wallets/' + address)
          return
        }
        if (result === 'Token') {
          res.redirect(base + '/new/tokens/' + address)
          return
        }
        res.type('html').send('Not sure where to send you');
      } catch (e) {
        console.error('e', e)
        res.status(500).send('File not found');
      }
      //res.sendFile(path.resolve(frontendDist, 'index.html'));
    },
  },
  {
    type: 'GET',
    path: '/new/wallets/*',
    handler: async (req: any, res: any, runtime) => {
      //const base = '/api/agents' + req.path.split(/\/new\//, 2)[0]
      //const base = '/api/agents/Spartan/plugins/spartan-intel' + req.path.split(/\/new\//, 2)[0];
      const base = req.path.split(/\/new\//, 2)[0]
      //console.log('wallets base', base)
      const address = req.path.split(/\/wallets\//, 2)[1];
      //console.log('address', address)
      const solanaService = runtime.getService('chain_solana') as any;
      const result = await solanaService.getAddressType(address)
      //const result = await getAccountType(address)
      //console.log('result', result)
      try {
        // be smartish
        if (result === 'Token') {
          res.redirect(base + '/new/tokens/' + address)
          return
        }
        // handle unhandled
        if (result !== 'Wallet') {
          res.status(500).send('CA unknown type');
          return
        }
        // default flow
        console.log('frontendNewDist', frontendNewDist)
        const filePath = frontendNewDist + '/templates/page.ejs'
        console.log('path', filePath)
        const data = {
          title: 'Spartan Interface - Wallet',
          page: 'wallet',
          walletAddress: address,
        }
        const html = await ejs.renderFile(filePath, data);
        const basedHtml = injectBase(html, base + '/new/');
        res.type('html').send(basedHtml);

      } catch (e) {
        console.error('e', e)
        res.status(500).send('File not found');
      }
      //res.sendFile(path.resolve(frontendDist, 'index.html'));
    },
  },
  {
    type: 'GET',
    path: '/new/json/wallets/*',
    handler: async (req: any, res: any, runtime) => {
      //const base = '/api/agents' + req.path.split(/\/new\//, 2)[0]
      const base = req.path.split(/\/new\//, 2)[0]
      //console.log('base', base)
      const address = req.path.split(/\/wallets\//, 2)[1];
      //console.log('address', address)
      const solanaService = runtime.getService('chain_solana') as any;
      const result = await solanaService.getAddressType(address)
      //console.log('result', result)
      try {
        // be smartish
        if (result === 'Token') {
          res.redirect(base + '/new/json/tokens/' + address)
          return
        }
        // handle unhandled
        if (result !== 'Wallet') {
          res.status(500).send('CA unknown type');
          return
        }
        // default flow
        const pubKeyObj = new PublicKey(address)
        // get account by pk
        const data = await solanaService.getTokenAccountsByKeypair(pubKeyObj)
        res.json({
          history: [],
          portfolio: {
            wallet: address,
            totalUsd: 0,
            items: data.map(s => {
              return {
                address: s.account.data.parsed.info.mint,
                chainId: 'solana',
                name: '',
                symbol: '',
                uiAmount: s.account.data.parsed.info.tokenAmount.uiAmount,
                valueUsd: 0,
              }
            }),
          }
        })
      } catch (e) {
        console.error('e', e)
        res.status(500).send('File not found');
      }
      //res.sendFile(path.resolve(frontendDist, 'index.html'));
    },
  },
  {
    type: 'GET',
    path: '/new/tokens/*',
    handler: async (req: any, res: any) => {
      const base = '/api/agents' + req.path.split(/\/new\//, 2)[0]
      //console.log('base', base)
      const address = req.path.split(/\/tokens\//, 2)[1];
      //console.log('address', address)
      const result = await getAccountType(address)
      //console.log('result', result)
      try {
        // be smartish
        if (result === 'Wallet') {
          res.redirect(base + '/new/wallets/' + address)
          return
        }
        // handle unhandled
        if (result !== 'Token') {
          res.status(500).send('CA unknown type');
          return
        }
        // default flow
        console.log('frontendNewDist', frontendNewDist)
        const filePath = frontendNewDist + '/templates/page.ejs'
        console.log('path', filePath)
        const data = {
          title: 'Spartan Interface - Tokens',
          page: 'token',
          address,
        }
        const html = await ejs.renderFile(filePath, data);
        const basedHtml = injectBase(html, base + '/new/');
        res.type('html').send(basedHtml);

      } catch (e) {
        console.error('e', e)
        res.status(500).send('File not found');
      }
      //res.sendFile(path.resolve(frontendDist, 'index.html'));
    },
  },
  {
    type: 'GET',
    path: '/new/json/tokens/*',
    handler: async (req: any, res: any, runtime) => {
      //const base = '/api/agents' + req.path.split(/\/new\//, 2)[0]
      const base = req.path.split(/\/new\//, 2)[0]
      //console.log('base', base)
      const address = req.path.split(/\/tokens\//, 2)[1];
      //console.log('address', address)
      const result = await getAccountType(address)
      //console.log('result', result)
      try {
        // be smartish
        if (result === 'Wallet') {
          res.redirect(base + '/new/wallets/' + address)
          return
        }
        // handle unhandled
        if (result !== 'Token') {
          res.status(500).send('CA unknown type');
          return
        }
        // default flow
        const birdeyeService = runtime.getService('birdeye');
        if (!birdeyeService) {
          res.status(500).send('Birdeye is not available');
          return
        }
        //console.log('birdeyeService', birdeyeService.lookupToken)
        const tokenData = await birdeyeService.lookupToken('solana', address)
        console.log('tokenData', tokenData)
        // what do we need from birdeye?
        res.json({})
        /*
        console.log('frontendNewDist', frontendNewDist)
        const filePath = frontendNewDist + '/templates/page.ejs'
        console.log('path', filePath)
        const data = {
          title: 'Spartan Interface - Tokens',
          page: 'token',
          address,
        }
        const html = await ejs.renderFile(filePath, data);
        const basedHtml = injectBase(html, base + '/new/');
        res.type('html').send(basedHtml);
        */
      } catch (e) {
        console.error('e', e)
        res.status(500).send('File not found');
      }
      //res.sendFile(path.resolve(frontendDist, 'index.html'));
    },
  },
  {
    type: 'GET',
    path: '/new/css/*',
    handler: async (req: any, res: any) => {
      //const frontendDist = path.resolve(__dirname, '../src/investmentManager/plugins/degen-intel/frontend_new');
      const frontendDist = frontendNewDist
      //console.log('css frontendDist', frontendDist)
      //console.log('css uri', req.path.split('/new/')[1])
      const assetPath = frontendDist + '/' + req.path.split('/new/')[1]
      console.log('css assetPath', assetPath)
      if (fs.existsSync(path.resolve(assetPath))) {
        res.sendFile(assetPath);
      } else {
        res.status(404).send('File not found');
      }
    },
  },
  {
    type: 'GET',
    path: '/new/images/*',
    handler: async (req: any, res: any) => {
      const frontendDist = path.resolve(__dirname, '../src/plugins/degenIntel/frontend_new');
      //console.log('js frontendDist', frontendDist)
      //console.log('js uri', req.path.split('/new/')[1])
      const assetPath = frontendDist + '/' + req.path.split('/new/')[1]
      //console.log('js assetPath', assetPath)
      if (fs.existsSync(path.resolve(assetPath))) {
        res.sendFile(assetPath);
      } else {
        res.status(404).send('File not found');
      }
    },
  },
  {
    type: 'GET',
    path: '/new/js/*',
    handler: async (req: any, res: any) => {
      const frontendDist = path.resolve(__dirname, '../src/plugins/degenIntel/frontend_new');
      //console.log('js frontendDist', frontendDist)
      //console.log('js uri', req.path.split('/new/')[1])
      const assetPath = frontendDist + '/' + req.path.split('/new/')[1]
      //console.log('js assetPath', assetPath)
      if (fs.existsSync(path.resolve(assetPath))) {
        res.sendFile(assetPath);
      } else {
        res.status(404).send('File not found');
      }
    },
  },
  // generic page handler
  {
    type: 'GET',
    path: '/new/*',
    handler: async (req: any, res: any) => {
      // degen-intel/new/about
      // we want it to be /new/
      const base = '/api/agents' + req.path.replace(/\/degen-intel$/, '') + '/..';
      console.log('base', base)
      const frontendDist = path.resolve(__dirname, '../src/plugins/degenIntel/frontend_new');
      console.log('page frontendDist', frontendDist)
      console.log('page uri', req.path.split('/new/')[1])
      const assetPath = frontendDist + '/templates/' + req.path.split('/new/')[1]
      console.log('page assetPath', assetPath)

      // if not ext add .ejs?

      //const filePath = frontendDist + '/templates/index.ejs'
      //console.log('path', filePath)
      const data = {
        title: 'Spartan Interface',
        page: 'home'
      }
      try {
        const html = await ejs.renderFile(assetPath + '.ejs', data);
        const basedHtml = injectBase(html, base + '/');
        res.type('html').send(basedHtml);
      } catch (e) {
        res.status(404).send('File not found');
      }
    },
  },
  {
    type: 'GET',
    path: '/',
    handler: async (req: any, res: any) => {
      console.log('path', req.path, 'url', req.url)
      //  '/api/agents' +
      // .replace(/\/degen-intel$/, '');
      const base = req.path
      try {
        const html = injectBase(INDEX_TEMPLATE, base);
        res.type('html').send(html);
      } catch (e) {
        console.error('e', e)
      }
      //res.sendFile(path.resolve(frontendDist, 'index.html'));
    },
  },
  {
    type: 'GET',
    path: '/assets/*',
    handler: async (req: any, res: any) => {
      const assetPath = `/dist/assets/${req.path.split('/assets/')[1]}`;
      const cwd = process.cwd();
      const filePath = cwd + path.resolve(cwd, assetPath);
      console.log('filePath', filePath)
      if (fs.existsSync(path.resolve(filePath))) {
        res.sendFile(filePath);
      } else {
        res.status(404).send('File not found');
      }
    },
  },
  {
    type: 'GET',
    path: '/logos/*',
    handler: async (req: any, res: any) => {
      const assetPart = req.path.split('/logos/')[1];

      if (!assetPart) {
        return res.status(404).send('Asset not specified');
      }

      const filePath = path.join(
        __dirname,
        '..', // dist
        //'..', // the-org (we're now at packages/the-org)
        'src',
        'investmentManager',
        'plugins',
        'degen-intel',
        'frontend',
        'logos',
        assetPart
      );
      console.log('filePath', filePath);

      if (fs.existsSync(filePath)) {
        res.sendFile(filePath);
      } else {
        res.status(404).send('File not found');
      }
    },
  },
  {
    type: 'POST',
    path: '/trending',
    handler: async (_req: any, res: any, runtime) => {
      try {
        const cachedTokens = await runtime.getCache<IToken[]>('tokens_solana');
        const tokens: IToken[] = cachedTokens ? cachedTokens : [];
        const sortedTokens = tokens.sort((a, b) => (a.rank || 0) - (b.rank || 0));
        res.json(sortedTokens);
      } catch (_error) {
        console.log('error', _error)
        res.status(500).json({ error: 'Internal server error' });
      }
    },
  },
  {
    type: 'POST',
    path: '/wallet',
    handler: async (_req: any, res: any, runtime: IAgentRuntime) => {
      try {
        // Get transaction history
        const cachedTxs = await runtime.getCache<TransactionHistory[]>('transaction_history');
        const transactions: TransactionHistory[] = cachedTxs ? cachedTxs : [];
        const history = transactions
          .filter((tx) => tx.data.mainAction === 'received')
          .sort((a, b) => new Date(b.blockTime).getTime() - new Date(a.blockTime).getTime())
          .slice(0, 100);

        // Get portfolio
        const cachedPortfolio = await runtime.getCache<Portfolio>('portfolio');
        const portfolio: Portfolio = cachedPortfolio
          ? cachedPortfolio
          : { key: 'PORTFOLIO', data: null };

        res.json({ history, portfolio: portfolio.data });
      } catch (_error) {
        console.log('error', _error)
        res.status(500).json({ error: 'Internal server error' });
      }
    },
  },
  {
    type: 'GET',
    path: '/tweets',
    handler: async (_req: any, res: any, runtime: IAgentRuntime) => {
      try {
        const memories = await runtime.getMemories({
          tableName: 'messages',
          roomId: createUniqueUuid(runtime, 'twitter-feed'),
          end: Date.now(),
          count: 50,
        });

        //console.log('memory', memories[0])

        const tweets = memories
          .filter((m) => m.content.source === 'twitter')
          .sort((a, b) => b.createdAt - a.createdAt)
          .map((m) => ({
            text: m.content.text,
            username: m.content?.metadata.username,
            retweets: m.content?.metadata.retweets,
            likes: m.content?.metadata.likes,
            timestamp: m.content?.metadata.timestamp || m.createdAt,
            metadata: m.content.tweet || {},
          }));

        const validatedData = TweetArraySchema.parse(tweets);
        res.json(validatedData);
      } catch (_error) {
        console.log('error', _error)
        res.status(500).json({ error: 'Internal server error' });
      }
    },
  },
  {
    type: 'POST',
    path: '/statistics',
    handler: async (_req: any, res: any, runtime: IAgentRuntime) => {
      try {
        const tweetMemories = await runtime.getMemories({
          tableName: 'messages',
          roomId: createUniqueUuid(runtime, 'twitter-feed'),
          end: Date.now(),
          count: 50,
        });

        const tweets = tweetMemories
          // we do really need to filter?
          .filter((m) => m.content.source === 'twitter')
          .sort((a, b) => b.createdAt - a.createdAt)
          .map((m) => ({
            text: m.content.text,
            timestamp: m.createdAt,
            metadata: m.content.tweet || {},
          }));

        const sentimentMemories = await runtime.getMemories({
          tableName: 'messages',
          roomId: createUniqueUuid(runtime, 'sentiment-analysis'),
          end: Date.now(),
          count: 30,
        });

        const sentiments = sentimentMemories
          .filter(
            (m): m is Memory & { content: SentimentContent } =>
              m.content.source === 'sentiment-analysis' &&
              !!m.content.metadata &&
              typeof m.content.metadata === 'object' &&
              m.content.metadata !== null &&
              'processed' in m.content.metadata &&
              'occuringTokens' in m.content.metadata &&
              Array.isArray(m.content.metadata.occuringTokens) &&
              m.content.metadata.occuringTokens.length > 1
          )
          .sort((a, b) => {
            const aTime = new Date(a.content.metadata.timeslot).getTime();
            const bTime = new Date(b.content.metadata.timeslot).getTime();
            return bTime - aTime;
          })
          .map((m) => ({
            timeslot: m.content.metadata.timeslot,
            text: m.content.text,
            processed: m.content.metadata.processed,
            occuringTokens: m.content.metadata.occuringTokens || [],
          }));

        const cachedTokens = await runtime.getCache<IToken[]>('tokens_solana');
        const tokens: IToken[] = cachedTokens ? cachedTokens : [];

        const data = {
          tweets: tweets.length,
          sentiment: sentiments.length,
          tokens: tokens.length,
        }
        res.json(data);
      } catch (_error) {
        console.log('error', _error)
        res.status(500).json({ error: 'Internal server error' });
      }
    },
  },
  {
    type: 'GET',
    path: '/sentiment',
    handler: async (_req: any, res: any, runtime: IAgentRuntime) => {
      try {
        const memories = await runtime.getMemories({
          tableName: 'messages',
          roomId: createUniqueUuid(runtime, 'sentiment-analysis'),
          end: Date.now(),
          count: 30,
        });

        const sentiments = memories
          .filter(
            (m): m is Memory & { content: SentimentContent } =>
              m.content.source === 'sentiment-analysis' &&
              !!m.content.metadata &&
              typeof m.content.metadata === 'object' &&
              m.content.metadata !== null &&
              'processed' in m.content.metadata &&
              'occuringTokens' in m.content.metadata &&
              Array.isArray(m.content.metadata.occuringTokens) &&
              m.content.metadata.occuringTokens.length > 1
          )
          .sort((a, b) => {
            const aTime = new Date(a.content.metadata.timeslot).getTime();
            const bTime = new Date(b.content.metadata.timeslot).getTime();
            return bTime - aTime;
          })
          .map((m) => ({
            timeslot: m.content.metadata.timeslot,
            text: m.content.text,
            processed: m.content.metadata.processed,
            occuringTokens: m.content.metadata.occuringTokens || [],
          }));

        const validatedData = SentimentArraySchema.parse(sentiments);
        res.json(validatedData);
      } catch (_error) {
        console.log('error', _error)
        res.status(500).json({ error: 'Internal server error' });
      }
    },
  },
  {
    type: 'POST',
    path: '/signal',
    handler: async (_req: any, res: any, runtime: IAgentRuntime) => {
      try {
        const cachedSignal = await runtime.getCache<any>('BUY_SIGNAL');
        const signal = cachedSignal ? cachedSignal : {};
        res.json(signal?.data || {});
      } catch (_error) {
        console.log('error', _error)
        res.status(500).json({ error: 'Internal server error' });
      }
    },
  },
  // Spartan DeFi Routes
  {
    type: 'GET',
    path: '/spartan-defi',
    public: true,
    name: 'Spartan DeFi',
    handler: async (_req: any, res: any) => {
      res.json({
        name: 'Spartan DeFi API',
        version: '1.0.0',
        description: 'DeFi token management, swaps, and AI-powered trading insights using degenIntel services',
        endpoints: [
          'GET /spartan-defi/balances/:walletAddress',
          'GET /spartan-defi/token/:walletAddress/:tokenMint',
          'POST /spartan-defi/swap/quote',
          'POST /spartan-defi/swap/execute',
          'POST /spartan-defi/chat',
          'POST /spartan-defi/sessions',
          'POST /spartan-defi/sessions/:sessionId/messages',
          'GET /spartan-defi/sessions/:sessionId/messages',
          'DELETE /spartan-defi/sessions/:sessionId',
          'GET /spartan-defi/market-data',
          'GET /spartan-defi/portfolio',
          'GET /spartan-defi/transactions',
          'GET /spartan-defi/status',
          'POST /spartan-defi/validate-account',
          'POST /spartan-defi/request-email-verification',
          'GET /spartan-defi/verify-email-token',
          'POST /spartan-defi/verify-email-token',
        ]
      });
    },
  },
  {
    type: 'GET',
    path: '/spartan-defi/balances/:walletAddress',
    handler: async (req: any, res: any, runtime: IAgentRuntime) => {
      try {
        const { walletAddress } = req.params;
        const includePrices = req.query.prices !== 'false';

        const solanaService = runtime.getService('chain_solana');
        if (!solanaService) {
          return res.status(500).json({ error: 'Solana service not available' });
        }

        const balances = await getWalletBalancesFromServices(runtime, walletAddress, includePrices);

        res.json({
          success: true,
          data: balances,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        console.error('Error getting wallet balances:', error);
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    },
  },
  {
    type: 'GET',
    path: '/spartan-defi/token/:walletAddress/:tokenMint',
    handler: async (req: any, res: any, runtime: IAgentRuntime) => {
      try {
        const { walletAddress, tokenMint } = req.params;

        const solanaService = runtime.getService('chain_solana');
        if (!solanaService) {
          return res.status(500).json({ error: 'Solana service not available' });
        }

        const balance = await getTokenBalanceFromServices(runtime, walletAddress, tokenMint);

        if (!balance) {
          return res.status(404).json({
            success: false,
            error: 'Token not found in wallet'
          });
        }

        res.json({
          success: true,
          data: balance,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        console.error('Error getting token balance:', error);
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    },
  },
  {
    type: 'POST',
    path: '/spartan-defi/swap/quote',
    handler: async (req: any, res: any, runtime: IAgentRuntime) => {
      try {
        const { inputMint, outputMint, amount, slippageBps = 100 } = req.body;

        if (!inputMint || !outputMint || !amount) {
          return res.status(400).json({
            success: false,
            error: 'Missing required parameters: inputMint, outputMint, amount'
          });
        }

        const quote = await getSwapQuoteFromServices(runtime, {
          inputMint,
          outputMint,
          amount: parseFloat(amount),
          slippageBps: parseInt(slippageBps),
          walletAddress: req.body.walletAddress || "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM",
        });

        if (!quote) {
          return res.status(400).json({
            success: false,
            error: 'Failed to get swap quote'
          });
        }

        res.json({
          success: true,
          data: quote,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        console.error('Error getting swap quote:', error);
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    },
  },
  {
    type: 'POST',
    path: '/spartan-defi/swap/execute',
    handler: async (req: any, res: any, runtime: IAgentRuntime) => {
      try {
        const { quote, walletAddress } = req.body;

        if (!quote || !walletAddress) {
          return res.status(400).json({
            success: false,
            error: 'Missing required parameters: quote, walletAddress'
          });
        }

        // For now, just return the quote as executed (simulation)
        const result = {
          signature: "simulated_signature_" + Date.now(),
          success: true,
          inputAmount: parseFloat(quote.amount),
          outputAmount: parseFloat(quote.otherAmountThreshold),
          priceImpact: quote.priceImpactPct,
        };

        res.json({
          success: result.success,
          data: result,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        console.error('Error executing swap:', error);
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    },
  },
  {
    type: 'POST',
    path: '/spartan-defi/chat',
    handler: async (req: any, res: any, runtime: IAgentRuntime) => {
      try {
        const { message, context, userId } = req.body;

        if (!message) {
          return res.status(400).json({
            success: false,
            error: 'Missing required parameter: message'
          });
        }

        // Add user ID to context if provided
        const chatContext = context || {};
        if (userId) {
          chatContext.userId = userId;
        }

        const response = await chatWithSpartanAI(runtime, message, chatContext);

        res.json({
          success: true,
          data: response,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        console.error('Error chatting with Spartan:', error);
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    },
  },
  {
    type: 'POST',
    path: '/spartan-defi/sessions',
    handler: async (req: any, res: any, runtime: IAgentRuntime) => {
      try {
        const { userId, metadata } = req.body;

        if (!userId) {
          return res.status(400).json({
            success: false,
            error: 'Missing required parameter: userId'
          });
        }

        // Create session using Sessions API
        const response = await fetch(`${runtime.getSetting('API_BASE_URL') || 'http://localhost:3000'}/api/messaging/sessions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            agentId: runtime.agentId,
            userId,
            metadata: {
              platform: 'spartan',
              username: userId,
              ...metadata,
            }
          })
        });

        if (!response.ok) {
          throw new Error(`Failed to create session: ${response.statusText}`);
        }

        const { sessionId } = await response.json();

        res.json({
          success: true,
          data: { sessionId },
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        console.error('Error creating session:', error);
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    },
  },
  {
    type: 'POST',
    path: '/spartan-defi/sessions/:sessionId/messages',
    handler: async (req: any, res: any, runtime: IAgentRuntime) => {
      try {
        const { sessionId } = req.params;
        const { content, metadata } = req.body;

        if (!content) {
          return res.status(400).json({
            success: false,
            error: 'Missing required parameter: content'
          });
        }

        // Send message to session using Sessions API
        const response = await fetch(
          `${runtime.getSetting('API_BASE_URL') || 'http://localhost:3000'}/api/messaging/sessions/${sessionId}/messages`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              content,
              metadata: {
                userTimezone: 'UTC',
                context: 'defi',
                ...metadata,
              }
            })
          }
        );

        if (!response.ok) {
          throw new Error(`Failed to send message: ${response.statusText}`);
        }

        const messageResponse = await response.json();

        res.json({
          success: true,
          data: messageResponse,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        console.error('Error sending session message:', error);
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    },
  },
  {
    type: 'GET',
    path: '/spartan-defi/sessions/:sessionId/messages',
    handler: async (req: any, res: any, runtime: IAgentRuntime) => {
      try {
        const { sessionId } = req.params;
        const { limit = 20, before, after } = req.query;

        // Build query parameters
        const queryParams = new URLSearchParams();
        if (limit) queryParams.append('limit', limit.toString());
        if (before) queryParams.append('before', before);
        if (after) queryParams.append('after', after);

        // Get message history using Sessions API
        const response = await fetch(
          `${runtime.getSetting('API_BASE_URL') || 'http://localhost:3000'}/api/messaging/sessions/${sessionId}/messages?${queryParams}`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            }
          }
        );

        if (!response.ok) {
          throw new Error(`Failed to get messages: ${response.statusText}`);
        }

        const messagesResponse = await response.json();

        res.json({
          success: true,
          data: messagesResponse,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        console.error('Error getting session messages:', error);
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    },
  },
  {
    type: 'DELETE',
    path: '/spartan-defi/sessions/:sessionId',
    handler: async (req: any, res: any, runtime: IAgentRuntime) => {
      try {
        const { sessionId } = req.params;

        // End session using Sessions API
        const response = await fetch(
          `${runtime.getSetting('API_BASE_URL') || 'http://localhost:3000'}/api/messaging/sessions/${sessionId}`,
          {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
            }
          }
        );

        if (!response.ok) {
          throw new Error(`Failed to end session: ${response.statusText}`);
        }

        res.json({
          success: true,
          data: { message: 'Session ended successfully' },
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        console.error('Error ending session:', error);
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    },
  },
  {
    type: 'GET',
    path: '/spartan-defi/market-data',
    handler: async (req: any, res: any, runtime: IAgentRuntime) => {
      try {
        const cachedTokens = await runtime.getCache('tokens_solana') || [];

        res.json({
          success: true,
          data: {
            cachedTokens: cachedTokens.length,
            marketData: cachedTokens.slice(0, 20), // Return top 20 tokens
            timestamp: new Date().toISOString(),
          },
        });
      } catch (error) {
        console.error('Error getting market data:', error);
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    },
  },
  {
    type: 'GET',
    path: '/spartan-defi/portfolio',
    handler: async (req: any, res: any, runtime: IAgentRuntime) => {
      try {
        const portfolioData = await runtime.getCache('portfolio');

        res.json({
          success: true,
          data: portfolioData || { data: null },
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        console.error('Error getting portfolio:', error);
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    },
  },
  {
    type: 'GET',
    path: '/spartan-defi/transactions',
    handler: async (req: any, res: any, runtime: IAgentRuntime) => {
      try {
        const transactionHistory = await runtime.getCache('transaction_history') || [];

        res.json({
          success: true,
          data: {
            transactions: transactionHistory.slice(0, 50), // Return last 50 transactions
            count: transactionHistory.length,
            timestamp: new Date().toISOString(),
          },
        });
      } catch (error) {
        console.error('Error getting transactions:', error);
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    },
  },
  {
    type: 'GET',
    path: '/spartan-defi/status',
    handler: async (req: any, res: any, runtime: IAgentRuntime) => {
      try {
        const dataProviderService = runtime.getService('TRADER_DATAPROVIDER');
        const chainService = runtime.getService('TRADER_CHAIN');
        const solanaService = runtime.getService('chain_solana');

        // Get cache status
        const cachedTokens = await runtime.getCache('tokens_solana') || [];
        const portfolioData = await runtime.getCache('portfolio');
        const transactionHistory = await runtime.getCache('transaction_history') || [];

        res.json({
          success: true,
          data: {
            service: 'Spartan DeFi',
            status: 'running',
            dependencies: {
              dataProvider: !!dataProviderService,
              chainService: !!chainService,
              solanaService: !!solanaService,
            },
            cache: {
              tokens: cachedTokens.length,
              portfolio: !!portfolioData,
              transactions: transactionHistory.length,
            },
            timestamp: new Date().toISOString(),
          },
        });
      } catch (error) {
        console.error('Error getting service status:', error);
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    },
  },
  {
    type: 'POST',
    path: '/spartan-defi/validate-account',
    handler: async (req: any, res: any, runtime: IAgentRuntime) => {
      try {
        const { walletAddress, email } = req.body;

        if (!walletAddress && !email) {
          return res.status(400).json({
            success: false,
            error: 'Missing required parameter: walletAddress or email'
          });
        }

        let isValid = false;
        let accountData = null;

        if (email) {
          // Check if auth token is provided for email validation
          const authHeader = req.headers.authorization;
          if (authHeader && authHeader.startsWith('Bearer ')) {
            const authToken = authHeader.substring(7);
            const authValidation = await validateAuthToken(runtime, email, authToken);

            if (authValidation.valid) {
              isValid = true;

              // Get user's associated wallets
              const emailEntityId = createUniqueUuid(runtime, email);
              const intAccountService = runtime.getService('AUTONOMOUS_TRADER_INTERFACE_ACCOUNTS') as any;
              let wallets = [];

              if (intAccountService) {
                try {
                  const components = await intAccountService.interface_accounts_ByIds([emailEntityId]);
                  const component = components[emailEntityId];

                  if (component && component.metawallets) {
                    console.log('component.metawallets', component.metawallets)
                    /*
                    wallets = component.metawallets?.keypairs.map((wallet: any) => ({
                      address: wallet.publicKey,
                      name: wallet.name || `Wallet ${wallet.publicKey?.slice(0, 8)}...`,
                      type: wallet.type || 'solana',
                      verified: wallet.verified || true
                    }));
                    */
                    // for each metawallets
                    for(const mw of component.metawallets) {
                      // get a wallet for each chain
                      for(const chain in mw.keypairs) {
                        const kp = mw.keypairs[chain]
                        console.log(chain, kp)
                        wallets.push({
                          address: kp.publicKey,
                          name: kp.publicKey.slice(0, 8) + '...',
                          type: chain,
                          verified: true, // this really isn't a thing
                        })
                      }
                    }
                    console.log('wallets', wallets)
                  }
                } catch (error) {
                  console.error('Error fetching user wallets:', error);
                }
              }

              accountData = {
                type: 'email',
                address: email,
                verified: true,
                registrationDate: new Date().toISOString(),
                wallets: wallets
              };
            } else {
              return res.status(401).json({
                success: false,
                error: 'INVALID_AUTH_TOKEN',
                message: authValidation.error || 'Invalid authentication token'
              });
            }
          } else {
            // Fallback to existing user registration check
            const emailEntityId = createUniqueUuid(runtime, email);
            const intUserService = runtime.getService('AUTONOMOUS_TRADER_INTERFACE_USERS') as any;

            if (intUserService) {
              const components = await intUserService.interface_users_ByIds([emailEntityId]);
              const component = components[emailEntityId];

              if (component && component.verified) {
                isValid = true;
                accountData = {
                  type: 'email',
                  address: email,
                  verified: component.verified,
                  registrationDate: component.createdAt,
                };
              }
            }
          }
        } else if (walletAddress) {
          // Validate by wallet address (check if wallet exists on Solana)
          const solanaService = runtime.getService('chain_solana');
          if (solanaService) {
            try {
              const accountType = await solanaService.getAddressType(walletAddress);
              if (accountType === 'Wallet') {
                isValid = true;
                accountData = {
                  type: 'wallet',
                  address: walletAddress,
                  verified: true,
                  registrationDate: new Date().toISOString(),
                };
              }
            } catch (error) {
              console.error('Error validating wallet address:', error);
            }
          }
        }

        res.json({
          success: true,
          data: {
            isValid,
            account: accountData,
            timestamp: new Date().toISOString(),
          },
        });
      } catch (error) {
        console.error('Error validating account:', error);
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    },
  },
  {
    type: 'POST',
    path: '/spartan-defi/request-email-verification',
    handler: async (req: any, res: any, runtime: IAgentRuntime) => {
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
          registrationStatus.userEntityId!
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
    },
  },
  /*
  {
    type: 'GET',
    path: '/spartan-defi/verify-email-token',
    handler: async (req: any, res: any, runtime: IAgentRuntime) => {
      try {
        const { email, token } = req.query;

        if (!email || !token) {
          return res.status(400).json({
            success: false,
            error: 'Missing required parameters: email and token',
            method: req.method,
            hasQuery: !!req.query,
            queryKeys: req.query ? Object.keys(req.query) : []
          });
        }

        // Verify the email token
        const verificationResult = await verifyEmailToken(runtime, email, token);

        if (!verificationResult.success) {
          return res.status(400).json({
            success: false,
            error: 'INVALID_TOKEN',
            message: verificationResult.error || 'Invalid verification token'
          });
        }

        res.json({
          success: true,
          data: {
            message: 'Email verified successfully',
            email,
            authToken: verificationResult.authToken,
            timestamp: new Date().toISOString(),
          },
        });
      } catch (error) {
        console.error('Error verifying email token:', error);
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    },
  },
  */
  {
    type: 'POST',
    path: '/spartan-defi/verify-email-token',
    handler: async (req: any, res: any, runtime: IAgentRuntime) => {
      try {
        // Set CORS headers for cross-origin requests
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

        // Log the request details for debugging
        console.log('POST /spartan-defi/verify-email-token - Request details:');
        console.log('Method:', req.method);
        console.log('Body:', req.body);
        console.log('Query:', req.query);
        console.log('Headers:', req.headers);
        console.log('Content-Type:', req.headers['content-type']);

        // Handle OPTIONS preflight request
        if (req.method === 'OPTIONS') {
          res.status(200).end();
          return;
        }

        // Try to get parameters from both body and query
        let email = req.body?.email || req.query?.email;
        let token = req.body?.token || req.query?.token;

        console.log('Extracted email:', email);
        console.log('Extracted token:', token);

        if (!email || !token) {
          return res.status(400).json({
            success: false,
            error: 'Missing required parameters: email and token',
            method: req.method,
            hasBody: !!req.body,
            hasQuery: !!req.query,
            bodyKeys: req.body ? Object.keys(req.body) : [],
            queryKeys: req.query ? Object.keys(req.query) : [],
            body: req.body,
            query: req.query,
            contentType: req.headers['content-type']
          });
        }

        // Verify the email token
        const verificationResult = await verifyEmailToken(runtime, email, token);

        if (!verificationResult.success) {
          return res.status(400).json({
            success: false,
            error: 'INVALID_TOKEN',
            message: verificationResult.error || 'Invalid verification token'
          });
        }

        res.json({
          success: true,
          data: {
            message: 'Email verified successfully',
            email,
            authToken: verificationResult.authToken,
            timestamp: new Date().toISOString(),
          },
        });
      } catch (error) {
        console.error('Error verifying email token:', error);
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    },
  },
];

export default routes;
