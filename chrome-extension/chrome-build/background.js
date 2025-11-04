// Spartan Wallet Background Service Worker
class SpartanWalletBackground {
  constructor() {
    this.init();
  }

  init() {
    this.setupEventListeners();
    this.setupMessageHandlers();
  }

  setupEventListeners() {
    // Extension installation
    chrome.runtime.onInstalled.addListener((details) => {
      if (details.reason === 'install') {
        this.onFirstInstall();
      } else if (details.reason === 'update') {
        this.onUpdate(details.previousVersion);
      }
    });

    // Extension startup
    chrome.runtime.onStartup.addListener(() => {
      this.onStartup();
    });

    // Tab updates
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (changeInfo.status === 'complete' && tab.url) {
        this.onTabUpdated(tabId, tab);
      }
    });

    // Extension icon click
    chrome.action.onClicked.addListener((tab) => {
      this.onIconClick(tab);
    });
  }

  setupMessageHandlers() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      switch (request.type) {
        case 'GET_WALLET_INFO':
          this.handleGetWalletInfo(sendResponse);
          return true; // Keep message channel open for async response

        case 'CREATE_TRANSACTION':
          this.handleCreateTransaction(request.data, sendResponse);
          return true;

        case 'GET_BALANCE':
          this.handleGetBalance(request.address, sendResponse);
          return true;

        case 'SAVE_SETTINGS':
          this.handleSaveSettings(request.settings, sendResponse);
          return true;

        case 'GET_SETTINGS':
          this.handleGetSettings(sendResponse);
          return true;

        default:
          sendResponse({ success: false, error: 'Unknown message type' });
      }
    });
  }

  onFirstInstall() {
    console.log('Phantom Wallet installed for the first time');

    // Initialize default settings
    const defaultSettings = {
      theme: 'dark',
      currency: 'USD',
      network: 'mainnet',
      autoLock: true,
      lockTimeout: 300, // 5 minutes
      notifications: true
    };

    chrome.storage.local.set({ settings: defaultSettings }, () => {
      console.log('Default settings initialized');
    });

    // Show welcome page
    chrome.tabs.create({
      url: chrome.runtime.getURL('welcome.html')
    });
  }

  onUpdate(previousVersion) {
    console.log(`Phantom Wallet updated from ${previousVersion} to ${chrome.runtime.getManifest().version}`);

    // Handle any migration logic here
    this.migrateSettings(previousVersion);
  }

  onStartup() {
    console.log('Phantom Wallet started');

    // Check if wallet is locked
    chrome.storage.local.get(['walletLocked', 'lastActivity'], (result) => {
      if (result.walletLocked) {
        console.log('Wallet is locked');
      }
    });
  }

  onTabUpdated(tabId, tab) {
    // Check if the tab is a DApp that might want to connect
    if (this.isDAppSite(tab.url)) {
      this.injectWalletProvider(tabId);
    }
  }

  onIconClick(tab) {
    // This will open the popup, but we can also handle additional logic here
    console.log('Phantom Wallet icon clicked');
  }

  isDAppSite(url) {
    const dappDomains = [
      'opensea.io',
      'uniswap.org',
      'sushi.com',
      'raydium.io',
      'serum.markets',
      'solana.com'
    ];

    try {
      const urlObj = new URL(url);
      return dappDomains.some(domain => urlObj.hostname.includes(domain));
    } catch {
      return false;
    }
  }

  injectWalletProvider(tabId) {
    // Inject the wallet provider script into DApp sites
    chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['inject.js']
    }).catch(err => {
      console.log('Failed to inject wallet provider:', err);
    });
  }

  handleGetWalletInfo(sendResponse) {
    // Return wallet information
    const walletInfo = {
      name: 'Phantom Wallet',
      version: chrome.runtime.getManifest().version,
      network: 'mainnet',
      connected: false
    };

    sendResponse({ success: true, data: walletInfo });
  }

  handleCreateTransaction(transactionData, sendResponse) {
    // Handle transaction creation
    console.log('Creating transaction:', transactionData);

    // Transaction creation not implemented yet
    sendResponse({
      success: false,
      error: 'Transaction creation not implemented'
    });
  }

  handleGetBalance(address, sendResponse) {
    // Get balance for an address
    console.log('Getting balance for address:', address);

    // Balance querying not implemented yet
    sendResponse({
      success: false,
      error: 'Balance querying not implemented'
    });
  }

  handleSaveSettings(settings, sendResponse) {
    chrome.storage.local.set({ settings: settings }, () => {
      sendResponse({ success: true });
    });
  }

  handleGetSettings(sendResponse) {
    chrome.storage.local.get(['settings'], (result) => {
      sendResponse({ success: true, data: result.settings || {} });
    });
  }

  migrateSettings(previousVersion) {
    // Handle settings migration between versions
    chrome.storage.local.get(['settings'], (result) => {
      const currentSettings = result.settings || {};

      // Add any new settings that might be missing
      const updatedSettings = {
        ...currentSettings,
        // Add new settings here as needed
      };

      chrome.storage.local.set({ settings: updatedSettings });
    });
  }
}

// Initialize the background service worker
new SpartanWalletBackground(); 