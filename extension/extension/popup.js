// Spartan Wallet Popup JavaScript
class SpartanWallet {
  constructor() {
    this.isBalanceVisible = false;
    this.currentTab = 'tokens';
    this.currentNav = 'home';
    this.assets = [
      {
        id: 'ai16z',
        name: 'ai16z',
        symbol: 'AI16Z',
        balance: '1,234.56',
        value: '$2,469.12',
        icon: 'ai16z',
        change: '+12.5%'
      },
      {
        id: 'usdc',
        name: 'USDC',
        symbol: 'USDC',
        balance: '2,500.00',
        value: '$2,500.00',
        icon: 'usdc',
        change: '0.0%'
      },
      {
        id: 'usd-coin',
        name: 'USD Coin',
        symbol: 'USDC',
        balance: '1,000.00',
        value: '$1,000.00',
        icon: 'usdc',
        change: '0.0%'
      }
    ];

    this.init();
  }

  init() {
    this.bindEvents();
    this.renderAssets();
    this.loadSettings();
  }

  bindEvents() {
    // Balance toggle
    document.getElementById('showBalanceBtn').addEventListener('click', () => {
      this.toggleBalance();
    });

    // Copy address
    document.getElementById('copyAddress').addEventListener('click', () => {
      this.copyAddress();
    });

    // Action buttons
    document.getElementById('receiveBtn').addEventListener('click', () => {
      this.handleReceive();
    });

    document.getElementById('sendBtn').addEventListener('click', () => {
      this.handleSend();
    });

    document.getElementById('swapBtn').addEventListener('click', () => {
      this.handleSwap();
    });

    document.getElementById('buyBtn').addEventListener('click', () => {
      this.handleBuy();
    });

    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.switchTab(e.target.dataset.tab);
      });
    });

    // Navigation
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.switchNav(e.target.dataset.nav);
      });
    });

    // Top actions
    document.getElementById('searchBtn').addEventListener('click', () => {
      this.handleSearch();
    });

    document.getElementById('settingsBtn').addEventListener('click', () => {
      this.handleSettings();
    });

    document.getElementById('moreBtn').addEventListener('click', () => {
      this.handleMore();
    });
  }

  toggleBalance() {
    this.isBalanceVisible = !this.isBalanceVisible;
    const balanceDots = document.getElementById('balanceDots');
    const hiddenBalance = document.getElementById('hiddenBalance');
    const showBalanceBtn = document.getElementById('showBalanceBtn');

    if (this.isBalanceVisible) {
      balanceDots.style.display = 'none';
      hiddenBalance.style.display = 'block';
      showBalanceBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
          <line x1="1" y1="1" x2="23" y2="23"></line>
        </svg>
        <span>Hide Balance</span>
      `;
    } else {
      balanceDots.style.display = 'flex';
      hiddenBalance.style.display = 'none';
      showBalanceBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
          <circle cx="12" cy="12" r="3"></circle>
        </svg>
        <span>Show Balance</span>
      `;
    }

    // Update asset balances
    this.renderAssets();
  }

  copyAddress() {
    const address = 'A1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6';
    navigator.clipboard.writeText(address).then(() => {
      this.showNotification('Address copied to clipboard');
    }).catch(() => {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = address;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      this.showNotification('Address copied to clipboard');
    });
  }

  handleReceive() {
    this.showNotification('Receive functionality coming soon');
    // In a real implementation, this would open a QR code or address display
  }

  handleSend() {
    this.showNotification('Send functionality coming soon');
    // In a real implementation, this would open a send form
  }

  handleSwap() {
    this.showNotification('Swap functionality coming soon');
    // In a real implementation, this would open a swap interface
  }

  handleBuy() {
    this.showNotification('Buy functionality coming soon');
    // In a real implementation, this would open a buy interface
  }

  switchTab(tab) {
    this.currentTab = tab;

    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tab}"]`).classList.add('active');

    // Update content based on tab
    if (tab === 'tokens') {
      this.renderAssets();
    } else if (tab === 'collectibles') {
      this.renderCollectibles();
    }
  }

  switchNav(nav) {
    this.currentNav = nav;

    // Update nav buttons
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    document.querySelector(`[data-nav="${nav}"]`).classList.add('active');

    // Handle navigation
    switch (nav) {
      case 'home':
        this.showNotification('Home view');
        break;
      case 'swap':
        this.showNotification('Swap view');
        break;
      case 'history':
        this.showNotification('Transaction history');
        break;
      case 'search':
        this.showNotification('Search functionality');
        break;
    }
  }

  handleSearch() {
    this.showNotification('Search functionality coming soon');
  }

  handleSettings() {
    this.showNotification('Settings panel coming soon');
  }

  handleMore() {
    this.showNotification('More options coming soon');
  }

  renderAssets() {
    const assetList = document.getElementById('assetList');
    assetList.innerHTML = '';

    this.assets.forEach(asset => {
      const assetElement = this.createAssetElement(asset);
      assetList.appendChild(assetElement);
    });
  }

  renderCollectibles() {
    const assetList = document.getElementById('assetList');
    assetList.innerHTML = '<div class="empty-state">No collectibles found</div>';
  }

  createAssetElement(asset) {
    const assetDiv = document.createElement('div');
    assetDiv.className = 'asset-item';
    assetDiv.innerHTML = `
      <div class="asset-icon ${asset.icon}">
        ${asset.symbol.charAt(0)}
      </div>
      <div class="asset-details">
        <div class="asset-name">${asset.name}</div>
        <button class="asset-menu">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="8" y1="6" x2="21" y2="6"></line>
            <line x1="8" y1="12" x2="21" y2="12"></line>
            <line x1="8" y1="18" x2="21" y2="18"></line>
            <line x1="3" y1="6" x2="3.01" y2="6"></line>
            <line x1="3" y1="12" x2="3.01" y2="12"></line>
            <line x1="3" y1="18" x2="3.01" y2="18"></line>
          </svg>
        </button>
      </div>
      <div class="asset-balance">
        ${this.isBalanceVisible ?
        `<div class="balance-amount">${asset.balance}</div>
           <div class="balance-value">${asset.value}</div>` :
        `<div class="balance-dots-row">
            <span class="dot"></span>
            <span class="dot"></span>
            <span class="dot"></span>
            <span class="dot"></span>
            <span class="dot"></span>
            <span class="dot"></span>
          </div>
          <div class="balance-dots-row">
            <span class="dot"></span>
            <span class="dot"></span>
            <span class="dot"></span>
            <span class="dot"></span>
            <span class="dot"></span>
            <span class="dot"></span>
          </div>`
      }
      </div>
    `;

    // Add click handler for asset menu
    const menuBtn = assetDiv.querySelector('.asset-menu');
    menuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.showAssetMenu(asset);
    });

    // Add click handler for asset item
    assetDiv.addEventListener('click', () => {
      this.selectAsset(asset);
    });

    return assetDiv;
  }

  showAssetMenu(asset) {
    this.showNotification(`Menu for ${asset.name}`);
    // In a real implementation, this would show a context menu
  }

  selectAsset(asset) {
    this.showNotification(`Selected ${asset.name}`);
    // In a real implementation, this would navigate to asset details
  }

  showNotification(message) {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.textContent = message;
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: var(--card-bg);
      color: var(--text-primary);
      padding: 12px 16px;
      border-radius: var(--radius-md);
      border: 1px solid var(--border-color);
      z-index: 1000;
      font-size: 14px;
      box-shadow: var(--shadow-md);
      animation: slideIn 0.3s ease;
    `;

    document.body.appendChild(notification);

    // Remove after 3 seconds
    setTimeout(() => {
      notification.style.animation = 'slideOut 0.3s ease';
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }, 3000);
  }

  loadSettings() {
    // Load user preferences from storage
    chrome.storage.local.get(['balanceVisible', 'currentTab'], (result) => {
      if (result.balanceVisible !== undefined) {
        this.isBalanceVisible = result.balanceVisible;
        if (this.isBalanceVisible) {
          this.toggleBalance();
        }
      }
      if (result.currentTab) {
        this.switchTab(result.currentTab);
      }
    });
  }

  saveSettings() {
    // Save user preferences to storage
    chrome.storage.local.set({
      balanceVisible: this.isBalanceVisible,
      currentTab: this.currentTab
    });
  }
}

// Add CSS animations for notifications
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateX(-50%) translateY(-20px);
    }
    to {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }
  }

  @keyframes slideOut {
    from {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }
    to {
      opacity: 0;
      transform: translateX(-50%) translateY(-20px);
    }
  }

  .empty-state {
    text-align: center;
    color: var(--text-secondary);
    padding: var(--spacing-xl);
    font-size: 14px;
  }
`;
document.head.appendChild(style);

// Initialize the wallet when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new SpartanWallet();
}); 