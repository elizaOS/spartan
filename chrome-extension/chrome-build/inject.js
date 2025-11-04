// Spartan Wallet Inject Script
// This script runs in the page context and provides DApp integration

(function () {
  'use strict';

  // Check if already injected
  if (window.phantomWalletInjected) {
    return;
  }

  window.phantomWalletInjected = true;

  // Spartan Wallet Provider
  class SpartanWalletProvider {
    constructor() {
      this.isSpartan = true;
      this.isConnected = false;
      this.publicKey = null;
      this.connection = null;
      this._listeners = {};
    }

    // Connection methods
    async connect() {
      try {
        const response = await this._sendMessage('CONNECT_WALLET');
        if (response.success) {
          this.isConnected = true;
          this.publicKey = response.data.publicKey;
          this._triggerEvent('connect', response.data);
          return response.data;
        } else {
          throw new Error(response.error);
        }
      } catch (error) {
        throw new Error('Failed to connect: ' + error.message);
      }
    }

    async disconnect() {
      this.isConnected = false;
      this.publicKey = null;
      this._triggerEvent('disconnect');
      return Promise.resolve();
    }

    // Transaction signing
    async signTransaction(transaction) {
      try {
        const response = await this._sendMessage('SIGN_TRANSACTION', { transaction });
        if (response.success) {
          return response.data.signedTransaction;
        } else {
          throw new Error(response.error);
        }
      } catch (error) {
        throw new Error('Failed to sign transaction: ' + error.message);
      }
    }

    async signAllTransactions(transactions) {
      const signedTransactions = [];
      for (const transaction of transactions) {
        try {
          const signed = await this.signTransaction(transaction);
          signedTransactions.push(signed);
        } catch (error) {
          throw error;
        }
      }
      return signedTransactions;
    }

    // Account info
    async getPublicKey() {
      try {
        const response = await this._sendMessage('GET_PUBLIC_KEY');
        if (response.success) {
          return response.data.publicKey;
        } else {
          throw new Error(response.error);
        }
      } catch (error) {
        throw new Error('Failed to get public key: ' + error.message);
      }
    }

    // Network switching
    async switchNetwork(network) {
      console.log('Switching to network:', network);
      // In a real implementation, this would switch between mainnet, testnet, etc.
      return Promise.resolve();
    }

    // Event listeners
    on(event, callback) {
      if (!this._listeners[event]) {
        this._listeners[event] = [];
      }
      this._listeners[event].push(callback);
    }

    off(event, callback) {
      if (this._listeners[event]) {
        const index = this._listeners[event].indexOf(callback);
        if (index > -1) {
          this._listeners[event].splice(index, 1);
        }
      }
    }

    // Trigger events
    _triggerEvent(event, data) {
      if (this._listeners[event]) {
        this._listeners[event].forEach(callback => {
          try {
            callback(data);
          } catch (error) {
            console.error('Error in event listener:', error);
          }
        });
      }
    }

    // Send message to content script
    _sendMessage(type, data = {}) {
      return new Promise((resolve, reject) => {
        const message = { type, ...data };

        // Use postMessage to communicate with content script
        window.postMessage({
          source: 'phantom-wallet-inject',
          ...message
        }, '*');

        // Listen for response
        const handleResponse = (event) => {
          if (event.source !== window) return;
          if (event.data.source !== 'phantom-wallet-content') return;
          if (event.data.type !== type + '_RESPONSE') return;

          window.removeEventListener('message', handleResponse);

          if (event.data.success) {
            resolve(event.data);
          } else {
            reject(new Error(event.data.error));
          }
        };

        window.addEventListener('message', handleResponse);

        // Timeout after 30 seconds
        setTimeout(() => {
          window.removeEventListener('message', handleResponse);
          reject(new Error('Request timeout'));
        }, 30000);
      });
    }
  }

  // Create and inject the provider
  const spartanProvider = new SpartanWalletProvider();

  // Inject into window object
  window.spartan = {
    solana: spartanProvider
  };

  // Also inject as window.solana for compatibility
  window.solana = spartanProvider;

  // Listen for messages from content script
  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    if (event.data.source !== 'phantom-wallet-content') return;

    // Forward responses back to the provider
    window.postMessage({
      source: 'phantom-wallet-inject',
      type: event.data.originalType + '_RESPONSE',
      success: event.data.success,
      data: event.data.data,
      error: event.data.error
    }, '*');
  });

  // Notify that provider is ready
  window.postMessage({
    source: 'phantom-wallet-inject',
    type: 'PROVIDER_READY'
  }, '*');

  console.log('Spartan Wallet provider injected successfully');

})(); 