import { type IAgentRuntime, type UUID, logger } from '@elizaos/core';

import Birdeye from './tasks/birdeye';
import BuySignal from './tasks/buySignal';
import SellSignal from './tasks/sellSignal';
import Twitter from './tasks/twitter';
import TwitterParser from './tasks/twitterParser';
import CoinmarketCap from './tasks/coinmarketcap';
import type { Sentiment, IToken } from './types';

// let's not make it a dependency
//import type { ITradeService } from '../../degenTrader/types';

/**
 * Registers tasks for the agent to perform various Intel-related actions.
 * * @param { IAgentRuntime } runtime - The agent runtime object.
 * @param { UUID } [worldId] - The optional world ID to associate with the tasks.
 * @returns {Promise<void>} - A promise that resolves once tasks are registered.
 */
export const registerTasks = async (runtime: IAgentRuntime, worldId?: UUID) => {
  worldId = runtime.agentId; // this is global data for the agent

  // -------------------------------------------------------------------
  //  Detect simulation mode (DEGEN_INTEL_SIMULATE_DATA flag)
  // -------------------------------------------------------------------
  const simFlag = String(
    runtime.getSetting('DEGEN_INTEL_SIMULATE_DATA') ||
      (process.env as Record<string, any>).DEGEN_INTEL_SIMULATE_DATA ||
      ''
  ).toLowerCase();
  const simulationEnabled = ['true', '1', 'yes'].includes(simFlag);
  if (simulationEnabled) {
    logger.warn('[degen-intel] Simulation mode ENABLED – mock intel data will be generated.');
  }

  // first, get all tasks with tags "queue", "repeat", "degen_intel" and delete them
  const tasks = await runtime.getTasks({
    tags: ['queue', 'repeat', 'degen_intel'],
  });

  for (const task of tasks) {
    await runtime.deleteTask(task.id);
  }

  /*
  if (runtime.getSetting('BIRDEYE_API_KEY')) {
    runtime.registerTaskWorker({
      name: 'INTEL_BIRDEYE_SYNC_TRENDING',
      validate: async (_runtime, _message, _state) => {
        return true; // TODO: validate after certain time
      },
      execute: async (runtime, _options, task) => {
        const birdeye = new Birdeye(runtime);
        try {
          await birdeye.syncTrendingTokens('solana');
          //await birdeye.syncTrendingTokens('base');
        } catch (error) {
          logger.error('Failed to sync trending tokens', error);
          // kill this task
          runtime.deleteTask(task.id);
        }
      },
    });

    runtime.createTask({
      name: 'INTEL_BIRDEYE_SYNC_TRENDING',
      description: 'Sync trending tokens from Birdeye',
      worldId,
      metadata: {
        createdAt: Date.now(),
        updatedAt: Date.now(),
        updateInterval: 1000 * 60 * 60, // 1 hour
      },
      tags: ['queue', 'repeat', 'degen_intel', 'immediate'],
    });
  } else {
    logger.debug(
      'WARNING: BIRDEYE_API_KEY not found, skipping creation of INTEL_BIRDEYE_SYNC_TRENDING task'
    );
  }

  if (runtime.getSetting('COINMARKETCAP_API_KEY')) {
    runtime.registerTaskWorker({
      name: 'INTEL_COINMARKETCAP_SYNC',
      validate: async (_runtime, _message, _state) => {
        return true; // TODO: validate after certain time
      },
      execute: async (runtime, _options, task) => {
        const cmc = new CoinmarketCap(runtime);
        try {
          await cmc.syncTokens();
        } catch (error) {
          logger.debug('Failed to sync tokens', error);
          // kill this task
          //await runtime.deleteTask(task.id);
        }
      },
    });

    runtime.createTask({
      name: 'INTEL_COINMARKETCAP_SYNC',
      description: 'Sync tokens from Coinmarketcap',
      worldId,
      metadata: {
        createdAt: Date.now(),
        updatedAt: Date.now(),
        updateInterval: 1000 * 60 * 5, // 5 minutes
      },
      tags: ['queue', 'repeat', 'degen_intel', 'immediate'],
    });
  } else {
    logger.debug(
      'WARNING: COINMARKETCAP_API_KEY not found, skipping creation of INTEL_COINMARKETCAP_SYNC task'
    );
  }
  */

  // --------------------------------------------------------------
  //  Wallet sync requires Birdeye API
  // --------------------------------------------------------------
  if (runtime.getSetting('BIRDEYE_API_KEY')) {
    runtime.registerTaskWorker({
      name: 'INTEL_SYNC_WALLET',
      validate: async () => true,
      execute: async (rt, _options, task) => {
        const birdeye = new Birdeye(rt);
        try {
          await birdeye.syncWallet();
        } catch (error) {
          logger.error('Failed to sync wallet', error);
        }
      },
    });

    runtime.createTask({
      name: 'INTEL_SYNC_WALLET',
      description: 'Sync wallet from Birdeye',
      worldId,
      metadata: {
        createdAt: Date.now(),
        updatedAt: Date.now(),
        updateInterval: 1000 * 60 * 5, // 5 minutes
      },
      tags: ['queue', 'repeat', 'degen_intel', 'immediate'],
    });
  } else {
    logger.debug('WARNING: BIRDEYE_API_KEY not found, skipping wallet sync task');
  }

  // Only create the Twitter sync task if the Twitter service exists
  const plugins = runtime.plugins.map((p) => p.name);
  //const twitterService = runtime.getService('twitter');
  if (plugins.indexOf('twitter') !== -1) {
    runtime.registerTaskWorker({
      name: 'INTEL_SYNC_RAW_TWEETS',
      validate: async (runtime, _message, _state) => {
        // Check if Twitter service exists and return false if it doesn't
        const twitterService = runtime.getService('twitter');
        if (!twitterService) {
          // Log only once when we'll be removing the task
          logger.debug('Twitter service not available, removing INTEL_SYNC_RAW_TWEETS task');

          // Get all tasks of this type
          const tasks = await runtime.getTasksByName('INTEL_SYNC_RAW_TWEETS');

          // Delete all these tasks
          for (const task of tasks) {
            await runtime.deleteTask(task.id);
          }

          return false;
        }
        return true;
      },
      execute: async (runtime, _options, task) => {
        try {
          const twitter = new Twitter(runtime);
          await twitter.syncRawTweets();
        } catch (error) {
          logger.error('Failed to sync raw tweets', error);
        }
      },
    });

    runtime.createTask({
      name: 'INTEL_SYNC_RAW_TWEETS',
      description: 'Sync raw tweets from Twitter',
      worldId,
      metadata: {
        createdAt: Date.now(),
        updatedAt: Date.now(),
        updateInterval: 1000 * 60 * 15, // 15 minutes
      },
      tags: ['queue', 'repeat', 'degen_intel', 'immediate'],
    });

    runtime.registerTaskWorker({
      name: 'INTEL_PARSE_TWEETS',
      validate: async (runtime, _message, _state) => {
        // Check if Twitter service exists and return false if it doesn't
        const twitterService = runtime.getService('twitter');
        if (!twitterService) {
          // The main task handler above will take care of removing all Twitter tasks
          return false; // This will prevent execution
        }
        return true;
      },
      execute: async (runtime, _options, task) => {
        const twitterParser = new TwitterParser(runtime);
        try {
          await twitterParser.parseTweets();
        } catch (error) {
          logger.error('Failed to parse tweets', error);
        }
      },
    });

    runtime.createTask({
      name: 'INTEL_PARSE_TWEETS',
      description: 'Parse tweets',
      worldId,
      metadata: {
        createdAt: Date.now(),
        updatedAt: Date.now(),
        updateInterval: 1000 * 60 * 60 * 24, // 24 hours
      },
      tags: ['queue', 'repeat', 'degen_intel', 'immediate'],
    });
  } else {
    console.log(
      'intel:tasks - plugins',
      runtime.plugins.map((p) => p.name)
    );
    logger.debug(
      'WARNING: Twitter plugin not found, skipping creation of INTEL_SYNC_RAW_TWEETS task'
    );
  }

  // enable trading stuff only if we need to
  //const tradeService = runtime.getService(ServiceTypes.DEGEN_TRADING) as unknown; //  as ITradeService
  // has to be included after degenTrader
  const tradeService = runtime.getService('degen_trader') as unknown; //  as ITradeService
  //if (plugins.indexOf('degenTrader') !== -1) {
  if (tradeService) {
    runtime.registerTaskWorker({
      name: 'INTEL_GENERATE_BUY_SIGNAL',
      validate: async (runtime, _message, _state) => {
        // Check if we have some sentiment data before proceeding
        const sentimentsData = (await runtime.getCache<Sentiment[]>('sentiments')) || [];
        if (sentimentsData.length === 0) {
          return false;
        }
        return true;
      },
      execute: async (runtime, _options, task) => {
        const signal = new BuySignal(runtime);
        try {
          await signal.generateSignal();
        } catch (error) {
          logger.error('Failed to generate buy signal', error);
          // Log the error but don't delete the task
        }
      },
    });

    runtime.createTask({
      name: 'INTEL_GENERATE_BUY_SIGNAL',
      description: 'Generate a buy signal',
      worldId,
      metadata: {
        createdAt: Date.now(),
        updatedAt: Date.now(),
        updateInterval: 1000 * 60 * 5, // 5 minutes
      },
      tags: ['queue', 'repeat', 'degen_intel', 'immediate'],
    });

    runtime.registerTaskWorker({
      name: 'INTEL_GENERATE_SELL_SIGNAL',
      validate: async (runtime, _message, _state) => {
        // Check if we have some sentiment data before proceeding
        const sentimentsData = (await runtime.getCache<Sentiment[]>('sentiments')) || [];
        if (sentimentsData.length === 0) {
          return false;
        }
        return true;
      },
      execute: async (runtime, _options, task) => {
        const signal = new SellSignal(runtime);
        try {
          await signal.generateSignal();
        } catch (error) {
          logger.error('Failed to generate buy signal', error);
          // Log the error but don't delete the task
        }
      },
    });

    runtime.createTask({
      name: 'INTEL_GENERATE_SELL_SIGNAL',
      description: 'Generate a sell signal',
      worldId,
      metadata: {
        createdAt: Date.now(),
        updatedAt: Date.now(),
        updateInterval: 1000 * 60 * 5, // 5 minutes
      },
      tags: ['queue', 'repeat', 'degen_intel', 'immediate'],
    });
  } else {
    logger.debug(
      'WARNING: Trader service not found, skipping creation of INTEL_GENERATE_*_SIGNAL task'
    );
  }

  // -------------------------------------------------------------------
  //  Helper to generate & cache simulated intel data
  // -------------------------------------------------------------------

  const generateSimulatedData = async () => {
    // Simulate trending tokens for three chains
    const genToken = (idx: number, chain: string): IToken => {
      return {
        provider: 'birdeye',
        rank: idx + 1,
        chain,
        address: `sim_${chain}_${idx}`,
        name: `SIM_${chain.toUpperCase()}_${idx}`,
        symbol: `SIM${idx}`,
        price: Number((Math.random() * 10 + 0.1).toFixed(4)),
        price24hChangePercent: Number((Math.random() * 20 - 10).toFixed(2)),
        volume24hUSD: Math.floor(Math.random() * 1_000_000),
        liquidity: Math.floor(Math.random() * 5_000_000),
        decimals: 9,
        logoURI: 'https://via.placeholder.com/32',
        marketcap: Math.floor(Math.random() * 100_000_000),
        last_updated: new Date(),
      } as unknown as IToken;
    };

    const tokens_solana: IToken[] = Array.from({ length: 10 }).map((_, i) => genToken(i, 'solana'));
    const tokens_base: IToken[] = Array.from({ length: 8 }).map((_, i) => genToken(i, 'base'));
    const tokens_ethereum: IToken[] = Array.from({ length: 6 }).map((_, i) => genToken(i, 'ethereum'));

    await runtime.setCache('tokens_solana', tokens_solana);
    await runtime.setCache('tokens_base', tokens_base);
    await runtime.setCache('tokens_ethereum', tokens_ethereum);

    // Simulate tweets
    const tweets = Array.from({ length: 15 }).map((_, i) => ({
      id: `sim_tweet_${i}`,
      _id: `sim_tweet_${i}`,
      text: `Simulation tweet #${i} about ${tokens_solana[i % tokens_solana.length].symbol}`,
      username: 'simuser',
      timestamp: new Date(Date.now() - i * 60_000).toISOString(),
      likes: Math.floor(Math.random() * 200),
      retweets: Math.floor(Math.random() * 100),
      __v: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));
    await runtime.setCache('tweets', tweets);

    // Simulate sentiments
    const sentiments: Sentiment[] = [
      {
        timeslot: new Date().toISOString(),
        processed: true,
        text: 'Simulated bullish sentiment on SOL',
        occuringTokens: [
          { token: tokens_solana[0].symbol, sentiment: 70, reason: 'Rising volume' },
          { token: tokens_solana[1].symbol, sentiment: -10, reason: 'Profit taking' },
        ],
      } as unknown as Sentiment,
    ];
    await runtime.setCache('sentiments', sentiments);

    // Simulate signals
    await runtime.setCache('buy_signals', {
      recommended_buy: tokens_solana[0].symbol,
      recommend_buy_address: tokens_solana[0].address,
      reason: 'Strong positive sentiment and increasing liquidity',
      marketcap: tokens_solana[0].marketcap || 0,
      buy_amount: '5',
    });

    await runtime.setCache('sell_signals', {
      recommended_sell: tokens_solana[1].symbol,
      recommend_sell_address: tokens_solana[1].address,
      reason: 'Negative sentiment and decreasing volume',
      marketcap: tokens_solana[1].marketcap || 0,
      sell_amount: '3',
    });

    // Simulate portfolio data
    await runtime.setCache('portfolio', {
      key: 'PORTFOLIO',
      data: {
        wallet: 'sim_wallet_address',
        totalUsd: 2500,
        items: [
          {
            address: tokens_solana[0].address,
            decimals: 9,
            balance: 5000,
            uiAmount: 5,
            chainId: 'solana',
            name: tokens_solana[0].name,
            symbol: tokens_solana[0].symbol,
            icon: tokens_solana[0].logoURI,
            logoURI: tokens_solana[0].logoURI,
            priceUsd: tokens_solana[0].price,
            valueUsd: 2500,
          },
        ],
      },
    });

    // Simulate market overview (reuse solana tokens)
    const cmcTokens = tokens_solana.slice(0, 10).map((t, i) => ({ ...t, provider: 'coinmarketcap', chain: 'L1', rank: i + 1 }));
    await runtime.setCache('cmc_market_data', cmcTokens);
    await runtime.setCache('coinmarketcap_sync', cmcTokens);
  };

  // If simulation mode is enabled, run the generator immediately & schedule periodic updates
  if (simulationEnabled) {
    await generateSimulatedData();

    runtime.registerTaskWorker({
      name: 'INTEL_SIMULATE_DATA',
      validate: async () => true,
      execute: async (rt) => {
        await generateSimulatedData();
      },
    });

    runtime.createTask({
      name: 'INTEL_SIMULATE_DATA',
      description: 'Generate mock intel data in simulation mode',
      worldId,
      metadata: {
        createdAt: Date.now(),
        updatedAt: Date.now(),
        updateInterval: 1000 * 60, // every minute
      },
      tags: ['queue', 'repeat', 'degen_intel', 'immediate'],
    });

    // Skip registering the external-API sync tasks when in simulation mode
    logger.debug('[degen-intel] Simulation mode active – skipping real API task registrations');
    return; // Do not continue with real sync workers below
  }

  // -------------------------------------------------------------------
  //  Existing (real) task setup continues below

};
