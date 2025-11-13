import { getSalt, encryptStringValue, Service, logger } from '@elizaos/core';
import type { Memory, TargetInfo, IAgentRuntime } from '@elizaos/core';
import { acquireService } from '../utils';
import type {
  IChainService,
  IntelTokenBalance,
  IntelPortfolio,
  IntelTransferParams,
  IntelTransferResult,
  IntelTokenMetadata,
  IntelDetectedKey,
  IntelExchange
} from '../types';

type SwapWalletSet = {
  signal: {
    inToken: string; // <chain-namespace>:<chain-ref>/<asset-namespace>:<asset-ref> (signal.sourceTokenCA)
    outToken: string; // (signal.targetTokenCA)
  };
  // inKeypair has to be unique
  wallets: Array<{
    inKeypair: string; // giver (private key string in base58)
    outKeypair: string; // taker (private key string in base58)
    inAmount: number; // atomic units
    slippage: number;
  }>;
};

export const ELIZAOS_SUPPORTED_CHAINS = [
  "solana",
  "ethereum",
  "arbitrum",
  "avalanche",
  "bsc",
  "optimism",
  "polygon",
  "base",
  "zksync",
  "sui",
  "solana",
  "evm", // EVM-compatible chains but we don't know the chain
] as const;
export type ElizaosSupportedChain = (typeof ELIZAOS_SUPPORTED_CHAINS)[number];

// Export Intel types for external use
export type {
  IChainService,
  IntelTokenBalance,
  IntelPortfolio,
  IntelTransferParams,
  IntelTransferResult,
  IntelTokenMetadata,
  IntelDetectedKey,
  IntelExchange
};

type RegistryEntry = {
  name: string;
  chain: string;
  chainType?: string;
  chainNet?: string;
  service?: string;
  [key: string]: any;
};

// Type for service with registry
type ServiceWithRegistry = {
  registry: RegistryEntry;
  service: Service;
};

export type ChainAddressExtractionToken = {
  address: string;
  type?: string;
};

interface AddressExtractionOptions {
  includeChains?: string[];
  checkCurve?: boolean;
  includeTypes?: boolean;
  filterTokenOnly?: boolean;
}

interface AddressExtractionOptionsNormalized {
  includeChains: Set<string>;
  checkCurve: boolean;
  includeTypes: boolean;
  filterTokenOnly: boolean;
}

export type ChainAddressExtractionResult = {
  chain: string;
  addresses: string[];
  addressesByType: Record<string, string[]>;
  tokens: ChainAddressExtractionToken[];
};

export class TradeChainService extends Service {
  private isRunning = false;
  private registry: Record<number, RegistryEntry> = {};
  private readonly tokenTypeMatch = ['token', 'mint', 'coin'];

  static serviceType = 'INTEL_CHAIN';
  capabilityDescription = 'The agent is able to trade with blockchains';

  // config (key/string)

  constructor(public runtime: IAgentRuntime) {
    super(runtime); // sets this.runtime
    this.registry = {};
  }

  private normalizeChain(chain?: string): string {
    return (chain || 'unknown').toLowerCase();
  }

  private normalizeExtractionOptions(
    raw: AddressExtractionOptions = {}
  ): AddressExtractionOptionsNormalized {
    const includeChains = Array.isArray(raw.includeChains)
      ? new Set(raw.includeChains.map((chain) => chain.toLowerCase()))
      : null;

    const filterTokenOnly = raw.filterTokenOnly ?? false;
    const includeTypes = raw.includeTypes ?? filterTokenOnly;

    return {
      includeChains: includeChains ?? new Set(Object.values(ELIZAOS_SUPPORTED_CHAINS)),
      checkCurve: Boolean(raw.checkCurve),
      includeTypes,
      filterTokenOnly,
    };
  }

  private isTokenType(type?: string): boolean {
    if (typeof type !== 'string') {
      return false;
    }
    const normalized = type.toLowerCase();
    return this.tokenTypeMatch.some((candidate) => normalized.includes(candidate));
  }

  private getTypeKey(type?: string): string {
    if (!type || !type.trim()) {
      return '__unknown';
    }
    return type.trim().toLowerCase();
  }

  private async resolveAddressTypes(
    chainService: IChainService,
    addresses: string[],
    chainName: string
  ): Promise<Record<string, string>> {
    let addressTypes: Record<string, string> = {};

    if (typeof chainService.getAddressesTypes === 'function') {
      try {
        const result = await chainService.getAddressesTypes(addresses);
        if (result && typeof result === 'object') {
          addressTypes = result;
        }
      } catch (error) {
        logger.debug(
          `TradeChainService: getAddressesTypes failed for ${chainName}: ${String(error)}`
        );
      }
    }

    if (
      (!addressTypes || Object.keys(addressTypes).length === 0) &&
      typeof (chainService as any).getAddressType === 'function'
    ) {
      const fallbackTypes: Record<string, string> = {};
      await Promise.all(
        addresses.map(async (address) => {
          try {
            const type = await (chainService as any).getAddressType(address);
            if (type) {
              fallbackTypes[address] = type;
            }
          } catch (error) {
            logger.debug(
              `TradeChainService: getAddressType failed for ${address} on ${chainName}: ${String(error)}`
            );
          }
        })
      );

      if (Object.keys(fallbackTypes).length > 0) {
        addressTypes = fallbackTypes;
      }
    }

    return addressTypes;
  }

  private async detectAddressesForChain(
    entry: ServiceWithRegistry,
    text: string,
    options: AddressExtractionOptionsNormalized
  ): Promise<ChainAddressExtractionResult> {
    const chain = this.normalizeChain(entry.registry?.chain);
    const chainService = entry.service as IChainService;
    const detectFn = (chainService as any).detectPubkeysFromString;

    if (!options.includeChains.has(chain)) {
      return { chain, addresses: [], addressesByType: {}, tokens: [] };
    }

    if (typeof detectFn !== 'function') {
      logger.debug(`TradeChainService: ${chain} does not support detectPubkeysFromString`);
      return { chain, addresses: [], addressesByType: {}, tokens: [] };
    }

    let addresses: unknown;
    try {
      addresses = await detectFn.call(chainService, text, options.checkCurve);
    } catch (error) {
      logger.debug(
        `TradeChainService: detectPubkeysFromString failed for ${chain}: ${String(error)}`
      );
      return { chain, addresses: [], addressesByType: {}, tokens: [] };
    }

    const addressList = Array.isArray(addresses)
      ? addresses.filter((addr): addr is string => typeof addr === 'string' && addr.length > 0)
      : [];

    if (addressList.length === 0) {
      return { chain, addresses: [], addressesByType: {}, tokens: [] };
    }

    let addressTypes: Record<string, string> = {};
    if (options.includeTypes) {
      addressTypes = await this.resolveAddressTypes(chainService, addressList, chain);
    }

    const addressesByType: Record<string, string[]> = {};
    const appendToType = (typeKey: string, address: string) => {
      if (!addressesByType[typeKey]) {
        addressesByType[typeKey] = [];
      }
      if (!addressesByType[typeKey].includes(address)) {
        addressesByType[typeKey].push(address);
      }
    };

    if (options.includeTypes) {
      addressList.forEach((address) => {
        const typeKey = this.getTypeKey(addressTypes[address]);
        appendToType(typeKey, address);
      });
      if (!addressesByType['__all']) {
        addressesByType['__all'] = [...addressList];
      }
    } else {
      addressList.forEach((address) => appendToType('__all', address));
    }

    const tokens = options.filterTokenOnly
      ? addressList
        .filter((address) => this.isTokenType(addressTypes?.[address]))
        .map((address) => ({ address, type: addressTypes[address] }))
      : [];

    return {
      chain,
      addresses: addressList,
      addressesByType,
      tokens,
    };
  }

  async extractAddresses(
    text: string,
    rawOptions: AddressExtractionOptions = {}
  ): Promise<ChainAddressExtractionResult[]> {
    const options = this.normalizeExtractionOptions(rawOptions);
    const services = this.forEachRegWithReg('service');

    const results = await Promise.all(
      services.map((entry) => this.detectAddressesForChain(entry, text, options))
    );

    return this.mergeExtractionResults(results, options);
  }

  private mergeExtractionResults(
    results: ChainAddressExtractionResult[],
    options: AddressExtractionOptionsNormalized
  ): ChainAddressExtractionResult[] {
    const aggregated = new Map<
      string,
      {
        addresses: Set<string>;
        types: Map<string, Set<string>>;
        tokens: Map<string, ChainAddressExtractionToken>;
      }
    >();

    for (const result of results) {
      if (!options.includeChains.has(result.chain)) continue;

      if (!aggregated.has(result.chain)) {
        aggregated.set(result.chain, {
          addresses: new Set(),
          types: new Map(),
          tokens: new Map(),
        });
      }

      const entry = aggregated.get(result.chain)!;
      result.addresses.forEach((address) => entry.addresses.add(address));

      Object.entries(result.addressesByType).forEach(([typeKey, addresses]) => {
        const normalizedType =
          options.includeTypes && typeKey !== '__all' ? typeKey : '__all';
        if (!entry.types.has(normalizedType)) {
          entry.types.set(normalizedType, new Set());
        }
        const typeSet = entry.types.get(normalizedType)!;
        addresses.forEach((address) => typeSet.add(address));
      });

      if (options.filterTokenOnly) {
        result.tokens.forEach((token) => entry.tokens.set(token.address, token));
      }
    }

    return Array.from(aggregated.entries()).map(([chain, data]) => {
      const addressesByType: Record<string, string[]> = {};
      data.types.forEach((set, typeKey) => {
        addressesByType[typeKey] = Array.from(set);
      });

      if (!addressesByType['__all']) {
        addressesByType['__all'] = Array.from(data.addresses);
      }

      return {
        chain,
        addresses: Array.from(data.addresses),
        addressesByType,
        tokens: options.filterTokenOnly ? Array.from(data.tokens.values()) : [],
      };
    });
  }

  /**
   * Registers a trading provider with the service.
   * @param {any} provider - The provider to register
   * @returns {Promise<number>} The ID assigned to the registered provider
   */
  async registerChain(provider: any): Promise<number> {
    const id = Object.values(this.registry).length + 1;
    logger.log('Registered', provider.name, 'as Blockchain provider #' + id);
    this.registry[id] = provider;
    return id;
  }

  async listActiveChains() {
    return Object.values(this.registry).map(s => s.name)
  }

  forEachReg(key: string): Service[] {
    const results: Service[] = [];
    // foreach provider
    for (const dp of Object.values(this.registry)) {
      // do they have this type of service
      if (dp[key]) {
        // if so get service handle
        const infoService = this.runtime.getService(dp[key]);
        if (infoService) {
          //console.log('updateTrending - result', result)
          results.push(infoService);
        } else {
          console.warn('Registered data provider service not found', key, dp[key]);
        }
      } else {
        console.warn('registered service does not support', key, ':', dp)
      }
    }
    return results
  }

  forEachRegWithReg(key: string): ServiceWithRegistry[] {
    const results: ServiceWithRegistry[] = [];
    // foreach provider
    for (const dp of Object.values(this.registry)) {
      // do they have this type of service
      if (dp[key]) {
        // if so get service handle
        const infoService = this.runtime.getService(dp[key]);
        if (infoService) {
          //console.log('updateTrending - result', result)
          results.push({
            registry: dp,
            service: infoService,
          });
        } else {
          console.warn('Registered data provider service not found', key, dp[key]);
        }
      } else {
        console.warn('registered service does not support', key, ':', dp)
      }
    }
    return results
  }

  async makeKeypairs() {
    const services = this.forEachRegWithReg('service')
    const salt = await getSalt()
    const wallets = await Promise.all(services.map(async i => {
      // maybe we should encrypt
      // so service isn't the registration but the plugin service itself...
      console.log('makeKeypairs has service', i.registry.name, i.registry.chain)
      // get key from sparty
      return { chain: i.registry.chain, keypair: await (i.service as any).createWallet() }
    }))
    // should be keyed by chain
    const walletsByChain = {}
    for (const w of wallets) {
      walletsByChain[w.chain] = w.keypair
    }
    console.log('made', walletsByChain)
    return walletsByChain
  }

  async makeKeypair(regName: string) {
    const reg = Object.values(this.registry).find(r => r.name === regName)
    console.log('reg', reg)
    // maybe we should do this in registerChain
    if (!reg || !reg.service) {
      console.log('cannot make keypair, chain', regName, 'not registered right')
      return false
    }
    const chainService = await acquireService(this.runtime, reg.service, 'TRADER_CHAIN')
    const ky = await (chainService as any).createWallet()
    //console.log('ky', ky)
    return ky
  }

  // which chains have this symbol (return with CAs)
  // options.chains an array to limit which chains to check
  // shouldn't this be a data provider thing?
  async hasSymbols(symbols: string[], options: any = {}): Promise<{ chain: string }[]> {
    const services = this.forEachRegWithReg('service')
    return await Promise.all(services.map(async i => {
      // i.registry.name i.registry.chain
      // birdeye?
      //i.service.lookupSymbol()
      return {
        chain: i.registry.chain,
      }
    }))
  }

  // address to chain guesser
  extractChain(text: string): ElizaosSupportedChain {
    // Check for SUI address (0x followed by 64 hex chars)
    if (text.match(/0x[a-fA-F0-9]{64}/)) {
      return "sui";
    }
    // Check for EVM address (0x followed by 40 hex chars)
    if (text.match(/0x[a-fA-F0-9]{40}/)) {
      return "ethereum";
    }
    // Default to solana
    return "solana";
  };

  // probably don't want checkcurve here, it's a solana thing
  // options for caching?
  async detectAddressesFromString(string: string, checkCurve = false) {
    const results = await this.extractAddresses(string, {
      checkCurve,
      includeTypes: false,
      filterTokenOnly: false,
    });

    return results.map((result) => ({
      chain: result.chain,
      addresses: result.addresses,
    }));
  }

  async detectTokenContractsFromString(
    text: string,
    options: { checkCurve?: boolean } = {}
  ): Promise<
    Array<{
      chain: string;
      addresses: string[];
      addressesByType: Record<string, string[]>;
      tokens: Array<{ address: string; type?: string }>;
    }>
  > {
    const results = await this.extractAddresses(text, {
      checkCurve: options.checkCurve,
      includeTypes: true,
      filterTokenOnly: true,
    });

    return results.map((result) => ({
      chain: result.chain,
      addresses: result.addresses,
      addressesByType: result.addressesByType,
      tokens: result.tokens,
    }));
  }

  async detectPubkeysFromString(string: string) {
  }

  // chainAndAddresses
  // options for caching?
  async verifySignature(publicKey: string, message: string, signature: string): Promise<{ chain: string; verified: boolean }[]> {
    // include which chain
    const services = this.forEachRegWithReg('service')
    return await Promise.all(services.map(async i => {
      // i.registry.name i.registry.chain
      const chainService = i.service as IChainService;
      if (!chainService.verifySignature) {
        console.log(i.registry.chain, 'doesnt support verifySignature')
        return {
          chain: i.registry.chain,
          verified: false,
        }
      }
      const result = chainService.verifySignature(publicKey, message, signature)
      return {
        chain: i.registry.chain,
        verified: result,
      }
    }))
  }

  // chainAndAddresses
  // options for caching?
  async AreValidAddresses(publicKeys: string[]): Promise<{ chain: string; valid: boolean[] }[]> {
    // include which chain
    const services = this.forEachRegWithReg('service')
    return await Promise.all(services.map(async i => {
      // i.registry.name i.registry.chain
      const chainService = i.service as IChainService;
      if (!chainService.AreValidAddresses) {
        console.log(i.registry.chain, 'doesnt support AreValidAddresses')
        return {
          chain: i.registry.chain,
          valid: [],
        }
      }
      const result = chainService.AreValidAddresses(publicKeys)
      return {
        chain: i.registry.chain,
        valid: result,
      }
    }))
  }

  // chainAndAddresses
  async getAddressesTypes(publicKeys: string[]): Promise<{ chain: string; types: Record<string, string> }[]> {
    // include which chain
    const services = this.forEachRegWithReg('service')
    return await Promise.all(services.map(async i => {
      // i.registry.name i.registry.chain
      const chainService = i.service as IChainService;
      if (!chainService.getAddressesTypes) {
        console.log(i.registry.chain, 'doesnt support getAddressesTypes')
        return {
          chain: i.registry.chain,
          types: {},
        }
      }
      const result = chainService.getAddressesTypes(publicKeys)
      return {
        chain: i.registry.chain,
        types: result,
      }
    }))
  }

  // get supply / getCirculatingSupplies / getDecimal / getTokensSymbols
  // get token details (include supply) list of token address
  async getTokenDetails(addresses: string[]): Promise<{ chain: string; tokenDetails: Record<string, IntelTokenMetadata> }[]> {
    // include which chain
    const services = this.forEachRegWithReg('service')
    return await Promise.all(services.map(async i => {
      // i.registry.name i.registry.chain
      const chainService = i.service as IChainService;
      if (!chainService.getTokenDetails) {
        console.log(i.registry.chain, 'doesnt support getTokenDetails')
        return {
          chain: i.registry.chain,
          tokenDetails: {},
        }
      }
      const result = await chainService.getTokenDetails(addresses)
      return {
        chain: i.registry.chain,
        tokenDetails: result,
      }
    }))
  }

  // getTokenAccountsByKeypair / getBalancesByAddrs
  // get wallet
  // get all balances in wallet
  // @deprecated Use the new getBalances(publicKeys, caipAssetIds) method instead
  async getBalancesLegacy(publicKeys: string[]): Promise<{ chain: string; balances: IntelTokenBalance[] }[]> {
    // base chain token + list of token accounts
    // include which chain
    const services = this.forEachRegWithReg('service')
    return await Promise.all(services.map(async i => {
      // i.registry.name i.registry.chain
      const chainService = i.service as IChainService;
      if (!chainService.getBalances) {
        console.log(i.registry.chain, 'doesnt support getBalances')
        return {
          chain: i.registry.chain,
          balances: [],
        }
      }
      // For legacy support, we'll need to query all tokens - this is not ideal
      // New code should use getBalances(publicKeys, caipAssetIds) instead
      const result = await chainService.getBalances(publicKeys, [])
      return {
        chain: i.registry.chain,
        balances: result,
      }
    }))
  }

  // solana:mainnet/spl-token:So1111…
  /**
   * Parse IDs shaped like:
   *   "chainNs[:chainRef]/[assetNs:]assetRef"
   *
   * Defaults:
   *   - chainRef → "mainnet" if omitted
   *   - assetNs  → "default" if omitted
   *
   * Examples:
   *   solana:devnet/spl-token:So111...        → solana, devnet, spl-token, So111...
   *   solana/spl-token:So111...               → solana, mainnet, spl-token, So111...
   *   solana:devnet/So111...              → solana, devnet, default, So111...
   *   solana/So111...                     → solana, mainnet, default, So111...
   */
  parseChainAssetId(id: string) {
    if (typeof id !== 'string') throw new Error('id must be a string');

    const slashIdx = id.indexOf('/');
    if (slashIdx === -1) {
      throw new Error('Missing "/" between chain and asset parts');
    }

    const chainPart = id.slice(0, slashIdx).trim();
    const assetPart = id.slice(slashIdx + 1).trim();

    if (!chainPart || !assetPart) {
      throw new Error('Invalid format — both chain and asset parts required');
    }

    // --- chain part: "ns[:ref]" ---
    const chainSep = chainPart.indexOf(':');
    let chainNamespace, chainRef;
    if (chainSep === -1) {
      chainNamespace = chainPart;
      chainRef = 'mainnet';
    } else {
      chainNamespace = chainPart.slice(0, chainSep).trim();
      const maybeRef = chainPart.slice(chainSep + 1).trim();
      chainRef = maybeRef || 'mainnet';
    }

    // --- asset part: "[ns:]ref" ---
    const assetSep = assetPart.indexOf(':');
    let assetNamespace, assetRef;
    if (assetSep === -1) {
      assetNamespace = 'default';
      assetRef = assetPart;
    } else {
      assetNamespace = assetPart.slice(0, assetSep).trim() || 'default';
      assetRef = assetPart.slice(assetSep + 1).trim();
    }

    if (!chainNamespace || !assetRef) {
      throw new Error('chainNs and assetRef must be non-empty');
    }

    return { chainNamespace, chainRef, assetNamespace, assetRef };
  }

  getChainServiceByElizaTokenAddress(address: string) {
    const chainToken = this.parseChainAssetId(address)

    // foreach provider
    for (const r of Object.values(this.registry)) {
      // do they have this type of service
      if (r && r.chainType === chainToken.chainNamespace && r.chainNet === chainToken.chainRef) {
        // if so get service handle
        const infoService = this.runtime.getService(r.service!);
        if (infoService) {
          //console.log('getChainServiceByElizaTokenAddress - found service', address, '=>', r)
          return infoService
          /*
          results.push({
            registry: dp,
            service: infoService,
          });
          */
        } else {
          console.warn('Registered data provider service not found', 'service', r);
        }
      } else {
        console.warn('registered service does not support', 'service', ':', r)
      }
    }
    return false
  }

  // <chain-namespace>:<chain-ref>/<asset-namespace>:<asset-ref>
  /*
  executeSwaps(
    [
      signal: {
        inToken: <chain-namespace>:<chain-ref>/<asset-namespace>:<asset-ref> (signal.sourceTokenCA)
        outToken: <chain-namespace>:<chain-ref>/<asset-namespace>:<asset-ref> (signal.targetTokenCA)
      },
      wallets: [
        //
        {
          inSourceWallet / keypair (taker)
          outSourceWallet / keypair (taker)
          inAmount: (wallet.amount)
          slippage limits
        }
      ]
    ]
  )
  */

  // subscribeToAccount / executeSwap
  async executeSwaps(swaps: SwapWalletSet[]) {
    const out = {}
    for (const i in swaps) {
      const s = swaps[i]
      out[i] = null
      // extract chain
      const src = this.parseChainAssetId(s.signal.inToken)
      const trg = this.parseChainAssetId(s.signal.outToken)

      // if we detect a bridge
      if (src.chainNamespace === trg.chainNamespace && src.chainRef === trg.chainRef) {
        // swap
        console.log('swap')
        // get the unified service for both
        const service = this.getChainServiceByElizaTokenAddress(s.signal.inToken)
        if (service && typeof service === 'object' && 'selectExchange' in service) {
          const exch = await (service as any).selectExchange()
          const res = await (service as any).doSwapOnExchange(exch, s)
          console.log('res', res)

          out[i] = {}
          for (const w of s.wallets) {
            const pubKey = (service as any).getPubkeyFromSecret(w.inKeypair)
            out[i][pubKey] = null
            if (res[pubKey]) {
              out[i][pubKey] = res[pubKey]
            }
          }
        } else {
          console.warn('Service not found or does not support required methods for', s.signal.inToken)
          out[i] = {}
        }
      } else {
        // bridge service? relay, squid router, chainflip
        console.log('bridge')
      }
    }
    console.log('executeSwaps out', out)
    return out
  }

  // combine with dataProvider pricing today so we can evaluate it in USD

  // ============================================================================
  // Intel Chain Service Methods - Generic blockchain operations
  // ============================================================================

  /**
   * Get portfolios for multiple wallet public keys
   * Plain publicKeys query all chains; CAIP format queries specific chain
   */
  async getPortfolio(publicKeys: string[]): Promise<IntelPortfolio[]> {
    const results: IntelPortfolio[] = [];
    const services = this.forEachRegWithReg('service');

    for (const { service, registry } of services) {
      const chainService = service as IChainService;
      if (!chainService.getPortfolio) {
        console.log(registry.chain, 'does not support getPortfolio');
        continue;
      }

      try {
        const portfolios = await chainService.getPortfolio(publicKeys);
        results.push(...portfolios);
      } catch (error) {
        console.error(`Error getting portfolio from ${registry.chain}:`, error);
      }
    }

    return results;
  }

  /**
   * Get balances for wallet/token combinations
   * publicKeys: list of wallet addresses
   * caipAssetIds: list of token identifiers in CAIP format
   * Returns balance for each publicKey x caipAssetId combination
   */
  async getBalances(publicKeys: string[], caipAssetIds: string[]): Promise<IntelTokenBalance[]> {
    const results: IntelTokenBalance[] = [];
    const grouped = this.createBalanceRequests(publicKeys, caipAssetIds);

    for (const [chain, { service, publicKeys: pks, assetIds }] of grouped) {
      const chainService = service as IChainService;
      if (!chainService.getBalances) {
        console.log(chain, 'does not support getBalances');
        continue;
      }

      try {
        const balances = await chainService.getBalances(pks, assetIds);
        results.push(...balances);
      } catch (error) {
        console.error(`Error getting balances from ${chain}:`, error);
      }
    }

    return results;
  }

  /**
   * Get symbols for CAIP asset IDs (batch)
   * Returns map: { "solana:mainnet/spl-token:So111...": "USDC", ... }
   */
  async getTokenSymbols(caipAssetIds: string[]): Promise<Record<string, string | null>> {
    const results: Record<string, string | null> = {};
    const grouped = this.groupCAIPByChain(caipAssetIds);

    for (const [chain, { service, assetIds }] of grouped) {
      const chainService = service as IChainService;
      if (!chainService.getTokensSymbols) {
        console.log(chain, 'does not support getTokensSymbols');
        continue;
      }

      try {
        // Extract just the asset addresses from CAIP IDs for the chain service
        const addresses = assetIds.map(caipId => {
          const parsed = this.parseChainAssetId(caipId);
          return parsed.assetRef;
        });

        const symbols = await chainService.getTokensSymbols(addresses);

        // Map back to CAIP IDs
        for (const caipId of assetIds) {
          const parsed = this.parseChainAssetId(caipId);
          results[caipId] = symbols[parsed.assetRef] || null;
        }
      } catch (error) {
        console.error(`Error getting token symbols from ${chain}:`, error);
      }
    }

    return results;
  }

  /**
   * Get decimals for CAIP asset IDs (batch)
   */
  async getTokenDecimals(caipAssetIds: string[]): Promise<Record<string, number>> {
    const results: Record<string, number> = {};
    const grouped = this.groupCAIPByChain(caipAssetIds);

    for (const [chain, { service, assetIds }] of grouped) {
      const chainService = service as IChainService;
      if (!chainService.getDecimals) {
        console.log(chain, 'does not support getDecimals');
        continue;
      }

      try {
        const addresses = assetIds.map(caipId => {
          const parsed = this.parseChainAssetId(caipId);
          return parsed.assetRef;
        });

        const decimals = await chainService.getDecimals(addresses);

        // Map back to CAIP IDs
        assetIds.forEach((caipId, idx) => {
          results[caipId] = decimals[idx];
        });
      } catch (error) {
        console.error(`Error getting token decimals from ${chain}:`, error);
      }
    }

    return results;
  }

  /**
   * Get supply information (batch)
   */
  async getTokenSupply(caipAssetIds: string[]): Promise<Record<string, { total: string; circulating?: string }>> {
    const results: Record<string, { total: string; circulating?: string }> = {};
    const grouped = this.groupCAIPByChain(caipAssetIds);

    for (const [chain, { service, assetIds }] of grouped) {
      const chainService = service as IChainService;
      if (!chainService.getCirculatingSupplies) {
        console.log(chain, 'does not support getCirculatingSupplies');
        continue;
      }

      try {
        const addresses = assetIds.map(caipId => {
          const parsed = this.parseChainAssetId(caipId);
          return parsed.assetRef;
        });

        const supplies = await chainService.getCirculatingSupplies(addresses);

        // Map back to CAIP IDs
        for (const caipId of assetIds) {
          const parsed = this.parseChainAssetId(caipId);
          const supply = supplies[parsed.assetRef];
          if (supply) {
            results[caipId] = {
              total: supply,
              circulating: supply
            };
          }
        }
      } catch (error) {
        console.error(`Error getting token supply from ${chain}:`, error);
      }
    }

    return results;
  }

  /**
   * Get full token metadata (batch)
   */
  async getTokenMetadata(caipAssetIds: string[]): Promise<Record<string, IntelTokenMetadata>> {
    const results: Record<string, IntelTokenMetadata> = {};
    const grouped = this.groupCAIPByChain(caipAssetIds);

    for (const [chain, { service, assetIds }] of grouped) {
      const chainService = service as IChainService;
      if (!chainService.getTokenDetails) {
        console.log(chain, 'does not support getTokenDetails');
        continue;
      }

      try {
        const metadata = await chainService.getTokenDetails(assetIds);
        Object.assign(results, metadata);
      } catch (error) {
        console.error(`Error getting token metadata from ${chain}:`, error);
      }
    }

    return results;
  }

  /**
   * Batch transfer method
   * Chain determined from caipAssetId in each transfer
   */
  async transfer(params: IntelTransferParams[]): Promise<IntelTransferResult[]> {
    const results: IntelTransferResult[] = [];
    const grouped = this.groupTransfersByChain(params);

    for (const [chain, { service, transfers }] of grouped) {
      const chainService = service as IChainService;
      if (!chainService.transfer) {
        console.log(chain, 'does not support transfer');
        // Add failed results for these transfers
        results.push(...transfers.map(t => ({
          success: false,
          error: `${chain} does not support transfer`,
          chain,
          from: t.from,
          to: t.to,
          caipAssetId: t.caipAssetId
        })));
        continue;
      }

      try {
        const txResults = await chainService.transfer(transfers);
        results.push(...txResults);
      } catch (error) {
        console.error(`Error executing transfers on ${chain}:`, error);
        results.push(...transfers.map(t => ({
          success: false,
          error: error instanceof Error ? error.message : String(error),
          chain,
          from: t.from,
          to: t.to,
          caipAssetId: t.caipAssetId
        })));
      }
    }

    return results;
  }

  /**
   * Sign messages with private keys (batch)
   * Each request contains privateKey and message
   * Returns signatures from all chains that can handle each key format
   */
  async signMessages(requests: Array<{ privateKey: string; message: string }>): Promise<Array<{ chain: string; signature: string; publicKey: string }>> {
    const results: Array<{ chain: string; signature: string; publicKey: string }> = [];
    const services = this.forEachRegWithReg('service');

    for (const { service, registry } of services) {
      const chainService = service as IChainService;
      if (!chainService.signMessages) {
        continue;
      }

      try {
        const signatures = await chainService.signMessages(requests);
        results.push(...signatures.map(sig => ({
          chain: registry.chain,
          ...sig
        })));
      } catch (error) {
        console.error(`Error signing messages with ${registry.chain}:`, error);
      }
    }

    return results;
  }

  /**
   * Detect private keys from text
   */
  async detectPrivateKeysFromString(text: string): Promise<{ chain: string; keys: IntelDetectedKey[] }[]> {
    const results: { chain: string; keys: IntelDetectedKey[] }[] = [];
    const services = this.forEachRegWithReg('service');

    for (const { service, registry } of services) {
      const chainService = service as IChainService;
      if (!chainService.detectPrivateKeysFromString) {
        continue;
      }

      try {
        const keys = chainService.detectPrivateKeysFromString(text);
        if (keys.length > 0) {
          results.push({
            chain: registry.chain,
            keys
          });
        }
      } catch (error) {
        console.error(`Error detecting private keys with ${registry.chain}:`, error);
      }
    }

    return results;
  }

  /**
   * Get public keys from private keys (batch)
   * Enhanced version of existing getPubkeyFromSecret used in executeSwaps
   */
  async getPubkeysFromSecrets(privateKeys: string[]): Promise<{ chain: string; publicKeys: string[] }[]> {
    const results: { chain: string; publicKeys: string[] }[] = [];
    const services = this.forEachRegWithReg('service');

    for (const { service, registry } of services) {
      const chainService = service as IChainService;
      if (!chainService.getPubkeysFromSecrets) {
        continue;
      }

      try {
        const publicKeys = chainService.getPubkeysFromSecrets(privateKeys);
        if (publicKeys.length > 0) {
          results.push({
            chain: registry.chain,
            publicKeys
          });
        }
      } catch (error) {
        console.error(`Error getting public keys from ${registry.chain}:`, error);
      }
    }

    return results;
  }

  /**
   * List available exchanges across all registered chains
   */
  async listExchanges(): Promise<IntelExchange[]> {
    const results: IntelExchange[] = [];
    const services = this.forEachRegWithReg('service');

    for (const { service, registry } of services) {
      const chainService = service as IChainService;
      if (!chainService.listExchanges) {
        continue;
      }

      try {
        const exchanges = await chainService.listExchanges();
        results.push(...exchanges);
      } catch (error) {
        console.error(`Error listing exchanges from ${registry.chain}:`, error);
      }
    }

    return results;
  }

  // ============================================================================
  // Internal Helper Methods
  // ============================================================================

  /**
   * Get chain service from CAIP address
   * Enhanced version of existing getChainServiceByElizaTokenAddress
   */
  private getChainServiceFromCAIP(caipAssetId: string): IChainService | null {
    try {
      const chainToken = this.parseChainAssetId(caipAssetId);

      for (const r of Object.values(this.registry)) {
        if (r && r.chainType === chainToken.chainNamespace && r.chainNet === chainToken.chainRef) {
          const infoService = this.runtime.getService(r.service!);
          if (infoService) {
            return infoService as IChainService;
          }
        }
      }
    } catch (error) {
      console.error(`Error parsing CAIP address ${caipAssetId}:`, error);
    }
    return null;
  }

  /**
   * Group CAIP addresses by chain for batch operations
   */
  private groupCAIPByChain(caipAssetIds: string[]): Map<string, { service: IChainService; assetIds: string[] }> {
    const grouped = new Map<string, { service: IChainService; assetIds: string[] }>();

    for (const caipId of caipAssetIds) {
      try {
        const parsed = this.parseChainAssetId(caipId);
        const chainKey = `${parsed.chainNamespace}:${parsed.chainRef}`;

        if (!grouped.has(chainKey)) {
          const service = this.getChainServiceFromCAIP(caipId);
          if (service) {
            grouped.set(chainKey, { service, assetIds: [] });
          }
        }

        const entry = grouped.get(chainKey);
        if (entry) {
          entry.assetIds.push(caipId);
        }
      } catch (error) {
        console.error(`Error grouping CAIP address ${caipId}:`, error);
      }
    }

    return grouped;
  }

  /**
   * Group transfer params by chain
   */
  private groupTransfersByChain(params: IntelTransferParams[]): Map<string, { service: IChainService; transfers: IntelTransferParams[] }> {
    const grouped = new Map<string, { service: IChainService; transfers: IntelTransferParams[] }>();

    for (const transfer of params) {
      try {
        const parsed = this.parseChainAssetId(transfer.caipAssetId);
        const chainKey = `${parsed.chainNamespace}:${parsed.chainRef}`;

        if (!grouped.has(chainKey)) {
          const service = this.getChainServiceFromCAIP(transfer.caipAssetId);
          if (service) {
            grouped.set(chainKey, { service, transfers: [] });
          }
        }

        const entry = grouped.get(chainKey);
        if (entry) {
          entry.transfers.push(transfer);
        }
      } catch (error) {
        console.error(`Error grouping transfer by chain:`, error);
      }
    }

    return grouped;
  }

  /**
   * Create cross-product of publicKeys x caipAssetIds for balance queries
   */
  private createBalanceRequests(publicKeys: string[], caipAssetIds: string[]): Map<string, { service: IChainService; publicKeys: string[]; assetIds: string[] }> {
    const grouped = new Map<string, { service: IChainService; publicKeys: string[]; assetIds: string[] }>();

    // Group CAIP asset IDs by chain
    for (const caipId of caipAssetIds) {
      try {
        const parsed = this.parseChainAssetId(caipId);
        const chainKey = `${parsed.chainNamespace}:${parsed.chainRef}`;

        if (!grouped.has(chainKey)) {
          const service = this.getChainServiceFromCAIP(caipId);
          if (service) {
            grouped.set(chainKey, { service, publicKeys: [...publicKeys], assetIds: [] });
          }
        }

        const entry = grouped.get(chainKey);
        if (entry) {
          entry.assetIds.push(caipId);
        }
      } catch (error) {
        console.error(`Error creating balance requests for ${caipId}:`, error);
      }
    }

    return grouped;
  }

  /**
   * Start the scenario service with the given runtime.
   * @param {IAgentRuntime} runtime - The agent runtime
   * @returns {Promise<ScenarioService>} - The started scenario service
   */
  static async start(runtime: IAgentRuntime) {
    const service = new TradeChainService(runtime);
    service.start();
    return service;
  }
  /**
   * Stops the Scenario service associated with the given runtime.
   *
   * @param {IAgentRuntime} runtime The runtime to stop the service for.
   * @throws {Error} When the Scenario service is not found.
   */
  static async stop(runtime: IAgentRuntime) {
    const service = runtime.getService(this.serviceType);
    if (!service) {
      throw new Error(this.serviceType + ' service not found');
    }
    service.stop();
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Trading chain service is already running');
      return;
    }

    try {
      logger.info('Starting chain trading service...');

      this.isRunning = true;
      logger.info('Trading chain service started successfully');
    } catch (error) {
      logger.error('Error starting trading chain service:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      logger.warn('Trading service is not running');
      return;
    }

    try {
      logger.info('Stopping chain trading service...');

      this.isRunning = false;
      logger.info('Trading service stopped successfully');
    } catch (error) {
      logger.error('Error stopping trading service:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  isServiceRunning(): boolean {
    return this.isRunning;
  }
}
