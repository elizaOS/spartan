// Spartan Wallet Content Script
class SpartanWalletContent {
  constructor() {
    this.isInjected = false;
    this.init();
  }

  init() {
    this.checkForExistingProvider();
    this.setupMessageListeners();
    this.injectWalletProvider();
  }

  checkForExistingProvider() {
    // Check if Spartan provider is already injected
    if (window.spartan || window.solana) {
      console.log('Spartan provider already exists');
      this.isInjected = true;
      return;
    }
  }

  setupMessageListeners() {
    // Listen for messages from the background script
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      switch (request.type) {
        case 'CONNECT_WALLET':
          this.handleConnectRequest(sendResponse);
          return true;

        case 'SIGN_TRANSACTION':
          this.handleSignTransaction(request.transaction, sendResponse);
          return true;

        case 'GET_PUBLIC_KEY':
          this.handleGetPublicKey(sendResponse);
          return true;

        default:
          sendResponse({ success: false, error: 'Unknown message type' });
      }
    });
  }

  injectWalletProvider() {
    if (this.isInjected) return;

    // Create the Phantom provider object
    const phantomProvider = {
      isPhantom: true,
      isConnected: false,
      publicKey: null,
      connection: null,

      // Connection methods
      connect: async () => {
        return new Promise((resolve, reject) => {
          chrome.runtime.sendMessage({ type: 'CONNECT_WALLET' }, (response) => {
            if (response.success) {
              phantomProvider.isConnected = true;
              phantomProvider.publicKey = response.data.publicKey;
              resolve(response.data);
            } else {
              reject(new Error(response.error));
            }
          });
        });
      },

      disconnect: async () => {
        phantomProvider.isConnected = false;
        phantomProvider.publicKey = null;
        return Promise.resolve();
      },

      // Transaction signing
      signTransaction: async (transaction) => {
        return new Promise((resolve, reject) => {
          chrome.runtime.sendMessage({
            type: 'SIGN_TRANSACTION',
            transaction: transaction
          }, (response) => {
            if (response.success) {
              resolve(response.data.signedTransaction);
            } else {
              reject(new Error(response.error));
            }
          });
        });
      },

      signAllTransactions: async (transactions) => {
        const signedTransactions = [];
        for (const transaction of transactions) {
          try {
            const signed = await phantomProvider.signTransaction(transaction);
            signedTransactions.push(signed);
          } catch (error) {
            throw error;
          }
        }
        return signedTransactions;
      },

      // Account info
      getPublicKey: async () => {
        return new Promise((resolve, reject) => {
          chrome.runtime.sendMessage({ type: 'GET_PUBLIC_KEY' }, (response) => {
            if (response.success) {
              resolve(response.data.publicKey);
            } else {
              reject(new Error(response.error));
            }
          });
        });
      },

      // Network switching
      switchNetwork: async (network) => {
        // In a real implementation, this would switch between mainnet, testnet, etc.
        console.log('Switching to network:', network);
        return Promise.resolve();
      },

      // Event listeners
      on: (event, callback) => {
        // Store event listeners
        if (!phantomProvider._listeners) {
          phantomProvider._listeners = {};
        }
        if (!phantomProvider._listeners[event]) {
          phantomProvider._listeners[event] = [];
        }
        phantomProvider._listeners[event].push(callback);
      },

      off: (event, callback) => {
        if (phantomProvider._listeners && phantomProvider._listeners[event]) {
          const index = phantomProvider._listeners[event].indexOf(callback);
          if (index > -1) {
            phantomProvider._listeners[event].splice(index, 1);
          }
        }
      },

      // Trigger events
      _triggerEvent: (event, data) => {
        if (phantomProvider._listeners && phantomProvider._listeners[event]) {
          phantomProvider._listeners[event].forEach(callback => {
            try {
              callback(data);
            } catch (error) {
              console.error('Error in event listener:', error);
            }
          });
        }
      }
    };

    // Inject the provider into the window object
    window.phantom = {
      solana: phantomProvider
    };

    // Also inject as window.solana for compatibility
    window.solana = phantomProvider;

    this.isInjected = true;
    console.log('Phantom Wallet provider injected');
  }

  handleConnectRequest(sendResponse) {
    // Connection request not implemented yet
    sendResponse({
      success: false,
      error: 'Connection request not implemented'
    });
  }

  handleSignTransaction(transaction, sendResponse) {
    // Transaction signing not implemented yet
    sendResponse({
      success: false,
      error: 'Transaction signing not implemented'
    });
  }

  handleGetPublicKey(sendResponse) {
    // Public key retrieval not implemented yet
    sendResponse({
      success: false,
      error: 'Public key retrieval not implemented'
    });
  }
}

// Initialize the content script
new SpartanWalletContent(); 