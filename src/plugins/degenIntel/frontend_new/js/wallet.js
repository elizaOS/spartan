// Web3 wallet connection functionality
document.addEventListener('DOMContentLoaded', function() {
  const connectWalletBtn = document.getElementById('connect-wallet');
  if (!connectWalletBtn) return;
  let isConnected = false;

  connectWalletBtn.addEventListener('click', async function() {
    if (isConnected) {
      // Disconnect wallet logic
      disconnectWallet();
      return;
    }

    // Check if Web3 is available
    if (typeof window.ethereum !== 'undefined') {
      try {
        // Request account access
        connectWalletBtn.textContent = 'Connecting...';
        connectWalletBtn.disabled = true;

        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        const account = accounts[0];

        // Update UI
        isConnected = true;
        connectWalletBtn.textContent = formatAddress(account);
        connectWalletBtn.classList.remove('bg-gradient-to-r', 'from-primary-600', 'to-secondary-600', 'hover:from-primary-700', 'hover:to-secondary-700');
        connectWalletBtn.classList.add('bg-green-600', 'hover:bg-green-700');
        connectWalletBtn.disabled = false;

        // Listen for account changes
        window.ethereum.on('accountsChanged', handleAccountsChanged);

        console.log('Connected to wallet:', account);
      } catch (error) {
        // Check if error is due to user rejection
        if (error.code === 4001 || error.message.includes('User rejected')) {
          console.log('User declined to connect wallet');
        } else {
          console.error('Error connecting to wallet:', error);
        }

        // Reset button state regardless of error type
        connectWalletBtn.textContent = 'Connect Wallet';
        connectWalletBtn.disabled = false;
      }
    } else {
      // MetaMask not installed
      window.alert('Web3 wallet not detected! Please install MetaMask or another Web3 wallet.');
    }
  });

  function disconnectWallet() {
    isConnected = false;
    connectWalletBtn.textContent = 'Connect Wallet';
    connectWalletBtn.classList.remove('bg-green-600', 'hover:bg-green-700');
    connectWalletBtn.classList.add('bg-gradient-to-r', 'from-primary-600', 'to-secondary-600', 'hover:from-primary-700', 'hover:to-secondary-700');

    // Remove listeners
    if (window.ethereum) {
      window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
    }

    console.log('Disconnected from wallet');
  }

  function handleAccountsChanged(accounts) {
    if (accounts.length === 0) {
      // User disconnected their wallet
      disconnectWallet();
    } else {
      // User switched accounts
      connectWalletBtn.textContent = formatAddress(accounts[0]);
    }
  }

  function formatAddress(address) {
    return address.slice(0, 6) + '...' + address.slice(-4);
  }
});