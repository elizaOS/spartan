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
const connection = new Connection('https://api.mainnet-beta.solana.com');

// Define the equivalent of __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// from the package.json, find frontend/dist and host it statically
const frontendDist = path.resolve(__dirname, './');

const INDEX_PATH       = path.resolve(frontendDist, 'index.html');
console.log('INDEX_PATH', INDEX_PATH)
const INDEX_TEMPLATE   = await fsp.readFile(INDEX_PATH, 'utf8');

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
    path: '/emailToUUID',
    public: true,
    name: 'Email to UUID',
    handler: async (req: any, res: any) => {
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
        for(const a of accounts) {
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
        for(const u of users) {
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
      } catch(e) {
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
];

export default routes;
