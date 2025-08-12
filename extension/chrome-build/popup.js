// Spartan DeFi Chrome Extension
class SpartanDeFi {
  constructor() {
    this.currentUser = null;
    this.currentTab = 'portfolio';
    this.isBalanceVisible = true;
    this.sessionId = null;
    this.apiBaseUrl = 'http://206.81.100.168:2096/api/agents/Spartan/plugins/spartan-intel'; // Spartan DeFi API port
    this.currentAuthStep = 'email'; // 'email', 'token', 'wallet', or 'registration'
    this.userEmail = null;
    this.authToken = null;

    // Multi-account support
    this.userWallets = []; // Array of user's wallets
    this.currentWalletIndex = 0; // Index of currently selected wallet

    this.init();
  }

  init() {
    try {
      console.log('Initializing Spartan DeFi extension...');
      this.updateDebugStatus('extensionStatus', 'Initializing...');
      this.bindEvents();
      this.initializeUIState();
      this.checkLoginStatus();
      this.updateDebugStatus('extensionStatus', 'Ready');
      console.log('Extension initialized successfully');

      // Show debug section if there are issues
      setTimeout(() => {
        this.showDebugSection();
      }, 2000);
    } catch (error) {
      console.error('Error initializing extension:', error);
      this.updateDebugStatus('extensionStatus', 'Error: ' + error.message);
      this.showDebugSection();
    }
  }

  updateDebugStatus(elementId, status) {
    const element = document.getElementById(elementId);
    if (element) {
      element.textContent = status;
    }
  }

  showDebugSection() {
    const debugSection = document.getElementById('debugSection');
    if (debugSection) {
      debugSection.style.display = 'block';
    }
  }

  hideDebugSection() {
    const debugSection = document.getElementById('debugSection');
    if (debugSection) {
      debugSection.style.display = 'none';
    }
  }

  initializeUIState() {
    // Initialize chat input state
    const chatInput = document.getElementById('chatInput');
    if (chatInput) {
      chatInput.disabled = true;
      chatInput.placeholder = 'Authenticate to chat with Spartan...';
    }

    // Initialize send button state
    const sendChatBtn = document.getElementById('sendChatBtn');
    if (sendChatBtn) {
      sendChatBtn.disabled = true;
    }

    // Initialize authentication flow
    this.showAuthStep('email');

    // Hide portfolio section by default
    const portfolioSection = document.getElementById('portfolioSection');
    if (portfolioSection) {
      portfolioSection.style.display = 'none';
    }

    // Hide chat section by default
    const chatSection = document.getElementById('chatSection');
    if (chatSection) {
      chatSection.style.display = 'none';
    }
  }

  bindEvents() {
    try {
      // Email authentication events
      const continueEmailBtn = document.getElementById('continueEmailBtn');
      if (continueEmailBtn) {
        continueEmailBtn.addEventListener('click', () => {
          this.handleEmailContinue();
        });
      }

      const emailInput = document.getElementById('emailInput');
      if (emailInput) {
        emailInput.addEventListener('keypress', (e) => {
          if (e.key === 'Enter') {
            this.handleEmailContinue();
          }
        });

        emailInput.addEventListener('input', (e) => {
          this.validateEmail(e.target.value);
        });
      }

      // Back to email button
      const backToEmailBtn = document.getElementById('backToEmailBtn');
      if (backToEmailBtn) {
        backToEmailBtn.addEventListener('click', () => {
          this.showAuthStep('email');
        });
      }

      // Token verification events
      const verifyTokenBtn = document.getElementById('verifyTokenBtn');
      if (verifyTokenBtn) {
        verifyTokenBtn.addEventListener('click', () => {
          this.handleTokenVerification();
        });
      }

      const tokenInput = document.getElementById('tokenInput');
      if (tokenInput) {
        tokenInput.addEventListener('keypress', (e) => {
          if (e.key === 'Enter') {
            this.handleTokenVerification();
          }
        });

        tokenInput.addEventListener('input', (e) => {
          // Filter to only allow alphanumeric characters, preserve case
          const filteredValue = e.target.value.replace(/[^A-Za-z0-9]/g, '');
          if (filteredValue !== e.target.value) {
            e.target.value = filteredValue;
          }
          this.validateToken(filteredValue);
        });
      }

      const resendTokenBtn = document.getElementById('resendTokenBtn');
      if (resendTokenBtn) {
        resendTokenBtn.addEventListener('click', () => {
          this.handleResendToken();
        });
      }

      const changeEmailBtn = document.getElementById('changeEmailBtn');
      if (changeEmailBtn) {
        changeEmailBtn.addEventListener('click', () => {
          this.showAuthStep('email');
        });
      }

      // Back to token button
      const backToTokenBtn = document.getElementById('backToTokenBtn');
      if (backToTokenBtn) {
        backToTokenBtn.addEventListener('click', () => {
          this.showAuthStep('token');
        });
      }

      // Back to email from registration
      const backToEmailFromRegBtn = document.getElementById('backToEmailFromRegBtn');
      if (backToEmailFromRegBtn) {
        backToEmailFromRegBtn.addEventListener('click', () => {
          this.showAuthStep('email');
        });
      }

      // Wallet connection events
      const connectWalletBtn = document.getElementById('connectWalletBtn');
      if (connectWalletBtn) {
        connectWalletBtn.addEventListener('click', () => {
          this.handleWalletConnect();
        });
      }

      const walletAddressInput = document.getElementById('walletAddressInput');
      if (walletAddressInput) {
        walletAddressInput.addEventListener('keypress', (e) => {
          if (e.key === 'Enter') {
            this.handleWalletConnect();
          }
        });

        walletAddressInput.addEventListener('input', (e) => {
          this.validateWalletAddress(e.target.value);
        });
      }

      const disconnectBtn = document.getElementById('disconnectBtn');
      if (disconnectBtn) {
        disconnectBtn.addEventListener('click', () => {
          this.handleLogout();
        });
      }

      // Chat events
      const sendChatBtn = document.getElementById('sendChatBtn');
      if (sendChatBtn) {
        sendChatBtn.addEventListener('click', () => {
          this.sendChatMessage();
        });
      }

      const chatInput = document.getElementById('chatInput');
      if (chatInput) {
        chatInput.addEventListener('keypress', (e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            this.sendChatMessage();
          }
        });

        chatInput.addEventListener('input', (e) => {
          this.updateSendButton();
        });
      }

      // Error modal
      const closeErrorModal = document.getElementById('closeErrorModal');
      if (closeErrorModal) {
        closeErrorModal.addEventListener('click', () => {
          this.hideErrorModal();
        });
      }

      const dismissError = document.getElementById('dismissError');
      if (dismissError) {
        dismissError.addEventListener('click', () => {
          this.hideErrorModal();
        });
      }

      // Debug section events
      const hideDebugBtn = document.getElementById('hideDebugBtn');
      if (hideDebugBtn) {
        hideDebugBtn.addEventListener('click', () => {
          this.hideDebugSection();
        });
      }

      const showDebugBtn = document.getElementById('showDebugBtn');
      if (showDebugBtn) {
        showDebugBtn.addEventListener('click', () => {
          this.showDebugSection();
        });
      }

      // Portfolio actions
      const toggleBalanceBtn = document.getElementById('toggleBalanceBtn');
      if (toggleBalanceBtn) {
        toggleBalanceBtn.addEventListener('click', () => {
          this.toggleBalanceVisibility();
        });
      }

      // Quick actions
      const receiveBtn = document.getElementById('receiveBtn');
      if (receiveBtn) {
        receiveBtn.addEventListener('click', () => {
          this.handleReceive();
        });
      }

      const sendBtn = document.getElementById('sendBtn');
      if (sendBtn) {
        sendBtn.addEventListener('click', () => {
          this.handleSend();
        });
      }

      const swapBtn = document.getElementById('swapBtn');
      if (swapBtn) {
        swapBtn.addEventListener('click', () => {
          this.handleSwap();
        });
      }

      // Navigation tabs
      const navTabs = document.querySelectorAll('.nav-tab');
      navTabs.forEach(tab => {
        tab.addEventListener('click', () => {
          const tabName = tab.getAttribute('data-tab');
          this.switchTab(tabName);
        });
      });

      // Header actions
      const refreshBtn = document.getElementById('refreshBtn');
      if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
          this.refreshData();
        });
      }

      const logoutBtn = document.getElementById('logoutBtn');
      if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
          this.handleLogout();
        });
      }

      console.log('Events bound successfully');
    } catch (error) {
      console.error('Error binding events:', error);
    }
  }

  async checkLoginStatus() {
    try {
      console.log('Checking login status...');
      const savedEmail = localStorage.getItem('spartan_email');
      const savedAuthToken = localStorage.getItem('spartan_auth_token');
      const savedWallet = localStorage.getItem('spartan_wallet');
      const savedWallets = localStorage.getItem('spartan_wallets'); // New: saved wallets array
      const savedCurrentWalletIndex = localStorage.getItem('spartan_current_wallet_index'); // New: saved current wallet index

      console.log('Saved email:', savedEmail ? 'Found' : 'Not found');
      console.log('Saved auth token:', savedAuthToken ? 'Found' : 'Not found');
      console.log('Saved wallet:', savedWallet ? 'Found' : 'Not found');
      console.log('Saved wallets:', savedWallets ? 'Found' : 'Not found');

      if (savedEmail && savedAuthToken && savedWallet) {
        try {
          this.userEmail = savedEmail;
          this.authToken = savedAuthToken;

          // Load saved wallets if available
          if (savedWallets) {
            this.userWallets = JSON.parse(savedWallets);
            this.currentWalletIndex = parseInt(savedCurrentWalletIndex) || 0;

            // Ensure current wallet is valid
            if (this.currentWalletIndex >= this.userWallets.length) {
              this.currentWalletIndex = 0;
            }

            this.currentUser = { walletAddress: this.userWallets[this.currentWalletIndex].address };
          } else {
            // Fallback to single wallet
            this.currentUser = { walletAddress: savedWallet };
            this.userWallets = [{ address: savedWallet, name: 'Wallet 1' }];
            this.currentWalletIndex = 0;
          }

          this.updateDebugStatus('emailStatus', 'Authenticated: ' + savedEmail);
          this.updateDebugStatus('walletStatus', 'Connected: ' + this.currentUser.walletAddress.slice(0, 8) + '...');

          // Update UI to show connected state
          this.showConnectedState();
          await this.loadUserData();
        } catch (error) {
          console.error('Error loading saved credentials:', error);
          this.updateDebugStatus('walletStatus', 'Error loading saved credentials');
          this.showDisconnectedState();
        }
      } else if (savedEmail && savedAuthToken && !savedWallet) {
        // Email authenticated but no wallet
        this.userEmail = savedEmail;
        this.authToken = savedAuthToken;
        this.updateDebugStatus('emailStatus', 'Authenticated: ' + savedEmail);
        this.updateDebugStatus('walletStatus', 'Not connected');
        this.showAuthStep('wallet');
      } else if (savedEmail && !savedAuthToken) {
        // Email entered but not verified
        this.userEmail = savedEmail;
        this.updateDebugStatus('emailStatus', 'Token verification required: ' + savedEmail);
        this.updateDebugStatus('walletStatus', 'Not connected');
        this.showAuthStep('token');
      } else {
        // No authentication
        this.updateDebugStatus('emailStatus', 'Not authenticated');
        this.updateDebugStatus('walletStatus', 'Not connected');
        this.showAuthStep('email');
      }
    } catch (error) {
      console.error('Error in checkLoginStatus:', error);
      this.updateDebugStatus('walletStatus', 'Error: ' + error.message);
      this.showDisconnectedState();
    }
  }

  showWelcome() {
    document.getElementById('welcomeScreen').classList.add('active');
    document.getElementById('dashboardScreen').classList.remove('active');
  }

  showConnectedState() {
    try {
      // Hide authentication flow
      const authFlow = document.querySelector('.auth-flow');
      if (authFlow) {
        authFlow.style.display = 'none';
        console.log('Auth flow hidden');
      }

      // Show portfolio section
      const portfolioSection = document.getElementById('portfolioSection');
      if (portfolioSection) {
        portfolioSection.style.display = 'block';
        console.log('Portfolio section displayed');
      }

      // Show chat section after successful authentication
      const chatSection = document.getElementById('chatSection');
      if (chatSection) {
        chatSection.style.display = 'block';
        console.log('Chat section displayed');
      }

      // Update wallet selector if multiple wallets
      this.updateWalletSelector();

      // Clear any error messages
      const walletError = document.getElementById('walletError');
      if (walletError) {
        walletError.style.display = 'none';
      }

      const emailError = document.getElementById('emailError');
      if (emailError) {
        emailError.style.display = 'none';
      }

      // Enable chat input if available
      const chatInput = document.getElementById('chatInput');
      if (chatInput) {
        chatInput.disabled = false;
        chatInput.placeholder = 'Ask Spartan about DeFi...';
      }

      // Update send button state
      this.updateSendButton();

      // Update debug status
      if (this.currentUser && this.currentUser.walletAddress) {
        this.updateDebugStatus('walletStatus', 'Connected: ' + this.currentUser.walletAddress.slice(0, 8) + '...');
      }
    } catch (error) {
      console.error('Error in showConnectedState:', error);
    }
  }

  showDisconnectedState() {
    // Show authentication flow
    const authFlow = document.querySelector('.auth-flow');
    if (authFlow) {
      authFlow.style.display = 'block';
      console.log('Auth flow shown');
    }

    // Hide portfolio section
    const portfolioSection = document.getElementById('portfolioSection');
    if (portfolioSection) {
      portfolioSection.style.display = 'none';
      console.log('Portfolio section hidden');
    }

    // Hide chat section when not authenticated
    const chatSection = document.getElementById('chatSection');
    if (chatSection) {
      chatSection.style.display = 'none';
      console.log('Chat section hidden');
    }

    // Clear inputs and errors
    const walletAddressInput = document.getElementById('walletAddressInput');
    if (walletAddressInput) {
      walletAddressInput.value = '';
    }

    const emailInput = document.getElementById('emailInput');
    if (emailInput) {
      emailInput.value = '';
    }

    const tokenInput = document.getElementById('tokenInput');
    if (tokenInput) {
      tokenInput.value = '';
    }

    const walletError = document.getElementById('walletError');
    if (walletError) {
      walletError.style.display = 'none';
    }

    const emailError = document.getElementById('emailError');
    if (emailError) {
      emailError.style.display = 'none';
    }

    const tokenError = document.getElementById('tokenError');
    if (tokenError) {
      tokenError.style.display = 'none';
    }

    // Clear portfolio data
    const tokenList = document.getElementById('tokenList');
    if (tokenList) {
      tokenList.innerHTML = '';
    }

    const totalBalance = document.getElementById('totalBalance');
    if (totalBalance) {
      totalBalance.textContent = '$0.00';
    }

    const balanceChange = document.getElementById('balanceChange');
    if (balanceChange) {
      balanceChange.innerHTML = '<span class="change-amount">+$0.00</span><span class="change-percent">(0.00%)</span>';
    }

    // Disable chat input if available
    const chatInput = document.getElementById('chatInput');
    if (chatInput) {
      chatInput.disabled = true;
      chatInput.placeholder = 'Authenticate to chat with Spartan...';
    }

    // Update debug status
    this.updateDebugStatus('walletStatus', 'Not connected');
  }

  validateWalletAddress(address, errorElementId = 'walletError') {
    const errorElement = document.getElementById(errorElementId);
    const connectBtn = document.getElementById('connectWalletBtn');
    const confirmBtn = document.getElementById('confirmAddWallet');

    // Basic Solana address validation
    const isValid = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);

    if (address.length > 0 && !isValid) {
      if (errorElement) {
        errorElement.textContent = 'Please enter a valid Solana wallet address';
        errorElement.style.display = 'block';
      }
      if (connectBtn) connectBtn.disabled = true;
      if (confirmBtn) confirmBtn.disabled = true;
    } else {
      if (errorElement) {
        errorElement.style.display = 'none';
      }
      if (connectBtn) connectBtn.disabled = address.length === 0;
      if (confirmBtn) confirmBtn.disabled = address.length === 0;
    }
  }

  validateEmail(email) {
    const errorElement = document.getElementById('emailError');
    const continueBtn = document.getElementById('continueEmailBtn');

    const isValid = this.isValidEmail(email);

    if (email.length > 0 && !isValid) {
      errorElement.textContent = 'Please enter a valid email address';
      errorElement.style.display = 'block';
      continueBtn.disabled = true;
    } else {
      errorElement.style.display = 'none';
      continueBtn.disabled = email.length === 0;
    }
  }

  showAuthStep(step) {
    this.currentAuthStep = step;

    // Hide all auth steps
    const emailStep = document.getElementById('emailAuthStep');
    const tokenStep = document.getElementById('tokenAuthStep');
    const walletStep = document.getElementById('walletAuthStep');
    const registrationStep = document.getElementById('registrationRequiredStep');

    if (emailStep) emailStep.classList.remove('active');
    if (tokenStep) tokenStep.classList.remove('active');
    if (walletStep) walletStep.classList.remove('active');
    if (registrationStep) registrationStep.classList.remove('active');

    // Update step indicators
    const step1Number = document.querySelector('#emailAuthStep .step-number');
    const step1_5Number = document.querySelector('#tokenAuthStep .step-number');
    const step2Number = document.querySelector('#walletAuthStep .step-number');
    const step1Connector = document.querySelector('#tokenAuthStep .step-connector');
    const step1_5Connector = document.querySelector('#walletAuthStep .step-connector');

    if (step === 'email') {
      if (emailStep) emailStep.classList.add('active');
      if (step1Number) step1Number.classList.add('active');
      if (step1Number) step1Number.classList.remove('completed');
      if (step1_5Number) step1_5Number.classList.remove('active');
      if (step1_5Number) step1_5Number.classList.remove('completed');
      if (step2Number) step2Number.classList.remove('active');
      if (step2Number) step2Number.classList.remove('completed');
      if (step1Connector) step1Connector.classList.remove('completed');
      if (step1_5Connector) step1_5Connector.classList.remove('completed');
      this.updateDebugStatus('emailStatus', 'Not authenticated');
    } else if (step === 'token') {
      if (tokenStep) tokenStep.classList.add('active');
      if (step1Number) step1Number.classList.remove('active');
      if (step1Number) step1Number.classList.add('completed');
      if (step1_5Number) step1_5Number.classList.add('active');
      if (step1_5Number) step1_5Number.classList.remove('completed');
      if (step2Number) step2Number.classList.remove('active');
      if (step2Number) step2Number.classList.remove('completed');
      if (step1Connector) step1Connector.classList.add('completed');
      if (step1_5Connector) step1_5Connector.classList.remove('completed');
      this.updateDebugStatus('emailStatus', 'Token sent to: ' + (this.userEmail || 'Unknown'));
    } else if (step === 'wallet') {
      if (walletStep) walletStep.classList.add('active');
      if (step1Number) step1Number.classList.remove('active');
      if (step1Number) step1Number.classList.add('completed');
      if (step1_5Number) step1_5Number.classList.remove('active');
      if (step1_5Number) step1_5Number.classList.add('completed');
      if (step2Number) step2Number.classList.add('active');
      if (step2Number) step2Number.classList.remove('completed');
      if (step1Connector) step1Connector.classList.add('completed');
      if (step1_5Connector) step1_5Connector.classList.add('completed');
      this.updateDebugStatus('emailStatus', 'Authenticated: ' + (this.userEmail || 'Unknown'));
    } else if (step === 'registration') {
      if (registrationStep) registrationStep.classList.add('active');
      this.updateDebugStatus('emailStatus', 'Registration required: ' + (this.userEmail || 'Unknown'));
    }
  }

  validateToken(token) {
    const errorElement = document.getElementById('tokenError');
    const verifyBtn = document.getElementById('verifyTokenBtn');

    // Token validation (6 alphanumeric characters, case insensitive)
    const isValid = /^[A-Za-z0-9]{6}$/.test(token);

    if (token.length > 0 && !isValid) {
      errorElement.textContent = 'Please enter a valid 6-character token';
      errorElement.style.display = 'block';
      verifyBtn.disabled = true;
    } else {
      errorElement.style.display = 'none';
      verifyBtn.disabled = token.length === 0;
    }
  }

  async handleTokenVerification() {
    const token = document.getElementById('tokenInput').value.trim();

    if (!token) {
      this.showError('Please enter the verification token');
      return;
    }

    if (!/^[A-Za-z0-9]{6}$/.test(token)) {
      this.showError('Please enter a valid 6-character token');
      return;
    }

    this.showLoading('Verifying token...');

    try {
      // Log what we're sending
      const requestBody = {
        email: this.userEmail,
        token: token
      };
      console.log('Sending request to:', `${this.apiBaseUrl}/spartan-defi/verify-email-token`);
      console.log('Request body:', requestBody);
      console.log('Stringified body:', JSON.stringify(requestBody));

      // Send token to backend for verification
      const response = await fetch(`${this.apiBaseUrl}/spartan-defi/verify-email-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      const data = await response.json();

      if (data.success) {
        // Store auth token for future requests
        this.authToken = data.data.authToken;
        localStorage.setItem('spartan_auth_token', this.authToken);

        // Update debug status
        this.updateDebugStatus('emailStatus', 'Authenticated: ' + this.userEmail);

        // Check for existing wallets
        await this.checkExistingWallets();

        // Clear any previous errors
        const tokenError = document.getElementById('tokenError');
        if (tokenError) {
          tokenError.style.display = 'none';
        }

      } else {
        throw new Error(data.message || 'Invalid verification token');
      }

    } catch (error) {
      console.error('Error during token verification:', error);
      this.showError('Invalid verification token. Please try again.');
    } finally {
      this.hideLoading();
    }
  }

  async handleResendToken() {
    if (!this.userEmail) {
      this.showError('No email address found. Please start over.');
      return;
    }

    this.showLoading('Resending token...');

    try {
      // Resend token to the same email
      const response = await fetch(`${this.apiBaseUrl}/spartan-defi/request-email-verification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: this.userEmail
        })
      });

      const data = await response.json();

      if (data.success) {
        this.showError('Verification token has been resent to your email.');
      } else {
        throw new Error(data.message || 'Failed to resend token');
      }

    } catch (error) {
      console.error('Error resending token:', error);
      this.showError('Failed to resend token. Please try again.');
    } finally {
      this.hideLoading();
    }
  }

  async handleEmailContinue() {
    const email = document.getElementById('emailInput').value.trim();

    if (!email) {
      this.showError('Please enter your email address');
      return;
    }

    if (!this.isValidEmail(email)) {
      this.showError('Please enter a valid email address');
      return;
    }

    this.showLoading('Sending verification token...');

    try {
      // Send email to backend for verification
      const response = await fetch(`${this.apiBaseUrl}/spartan-defi/request-email-verification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email
        })
      });

      const data = await response.json();

      if (data.success) {
        // Store email for later use
        this.userEmail = email;
        localStorage.setItem('spartan_email', email);

        // Update token email display
        const tokenEmailDisplay = document.getElementById('tokenEmailDisplay');
        if (tokenEmailDisplay) {
          tokenEmailDisplay.textContent = email;
        }

        // Move to token verification step
        this.showAuthStep('token');

        // Clear any previous errors
        const emailError = document.getElementById('emailError');
        if (emailError) {
          emailError.style.display = 'none';
        }

      } else {
        // Handle different error cases
        if (data.error === 'EMAIL_NOT_REGISTERED') {
          // Show registration required step
          this.userEmail = email;
          const regEmailDisplay = document.getElementById('regEmailDisplay');
          if (regEmailDisplay) {
            regEmailDisplay.textContent = email;
          }
          this.showAuthStep('registration');
        } else {
          throw new Error(data.message || 'Failed to send verification token');
        }
      }

    } catch (error) {
      console.error('Error during email authentication:', error);
      this.showError('Failed to send verification token. Please try again.');
    } finally {
      this.hideLoading();
    }
  }

  async checkExistingWallets() {
    try {
      console.log('Checking for existing wallets...');

      // Call the validate-account endpoint to check for existing wallets
      const response = await fetch(`${this.apiBaseUrl}/spartan-defi/validate-account`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.authToken}`
        },
        body: JSON.stringify({
          email: this.userEmail
        })
      });

      const data = await response.json();
      console.log('Existing wallets response:', data);

      if (data.success && data.data.account && data.data.account.wallets && data.data.account.wallets.length > 0) {
        // User has existing wallets, show wallet selection
        this.showWalletSelection(data.data.account.wallets);
      } else {
        // No existing wallets, show social links
        this.showSocialLinks();
      }
    } catch (error) {
      console.error('Error checking existing wallets:', error);
      // Fallback to wallet input
      this.showAuthStep('wallet');
    }
  }

  showWalletSelection(wallets) {
    // Store all wallets for multi-account support
    this.userWallets = wallets.map((wallet, index) => ({
      address: wallet.address,
      name: wallet.name || `Wallet ${index + 1}`
    }));

    // Create wallet selection UI
    const walletStep = document.getElementById('walletAuthStep');
    if (!walletStep) return;

    // Update the wallet step content
    walletStep.innerHTML = `
      <div class="auth-step-header">
        <div class="step-indicator">
          <span class="step-number completed">1</span>
          <span class="step-connector completed"></span>
          <span class="step-number completed">1.5</span>
          <span class="step-connector"></span>
          <span class="step-number active">2</span>
          <span class="step-label">Select Wallet</span>
        </div>
        <button id="backToTokenBtn" class="back-btn" title="Back to token verification">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 12V7H5a2 2 0 0 1 0-4h14v4"></path>
            <path d="M3 5v14a2 2 0 0 0 2 2h16v-5"></path>
            <path d="M18 12a2 2 0 0 0-2 2v4h4v-4a2 2 0 0 0-2-2z"></path>
          </svg>
        </button>
      </div>

      <div class="wallet-selection">
        <h3>Choose your wallet</h3>
        <p>Select one of your existing wallets to connect:</p>
        
        <div class="wallet-list">
          ${wallets.map((wallet, index) => `
            <div class="wallet-option" data-wallet="${wallet.address}">
              <div class="wallet-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"></path>
                  <path d="M3 5v14a2 2 0 0 0 2 2h16v-5"></path>
                  <path d="M18 12a2 2 0 0 0-2 2v4h4v-4a2 2 0 0 0-2-2z"></path>
                </svg>
              </div>
              <div class="wallet-info">
                <div class="wallet-name">${wallet.name || 'Wallet ' + (index + 1)}</div>
                <div class="wallet-address">${wallet.address.slice(0, 8)}...${wallet.address.slice(-8)}</div>
              </div>
              <button class="select-wallet-btn" data-wallet-address="${wallet.address}">
                Select
              </button>
            </div>
          `).join('')}
        </div>

        <div class="add-wallet-section">
          <button id="addNewWalletBtn" class="secondary-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            Add New Wallet
          </button>
        </div>
      </div>
    `;

    // Re-bind events
    this.bindWalletSelectionEvents();
    this.showAuthStep('wallet');
  }

  showSocialLinks() {
    // Show social links instead of wallet input
    const walletStep = document.getElementById('walletAuthStep');
    if (!walletStep) return;

    walletStep.innerHTML = `
      <div class="auth-step-header">
        <div class="step-indicator">
          <span class="step-number completed">1</span>
          <span class="step-connector completed"></span>
          <span class="step-number completed">1.5</span>
          <span class="step-connector"></span>
          <span class="step-number active">2</span>
          <span class="step-label">Join Community</span>
        </div>
        <button id="backToTokenBtn" class="back-btn" title="Back to token verification">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
      </div>

      <div class="social-links">
        <div class="social-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
            <circle cx="9" cy="7" r="4"></circle>
            <path d="M22 21v-2a4 4 0 0 0-3-3.87"></path>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
          </svg>
        </div>
        <h3>No Wallets Found</h3>
        <p>We couldn't find any wallets associated with your account.</p>
        <p>Please join our community to get started:</p>

        <div class="social-links-buttons">
          <a href="https://discord.gg/ai16z" target="_blank" class="social-link discord">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 1-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z" />
            </svg>
            Join Discord
          </a>
          <a href="https://t.me/spartan_staging_bot" target="_blank" class="social-link telegram">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12a12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
            </svg>
            Join Telegram
          </a>
        </div>

        <p class="social-note">After joining, please contact an admin to add your wallet address.</p>
      </div>
    `;

    // Re-bind events
    this.bindWalletSelectionEvents();
    this.showAuthStep('wallet');
  }

  bindWalletSelectionEvents() {
    // Bind back button
    const backToTokenBtn = document.getElementById('backToTokenBtn');
    if (backToTokenBtn) {
      backToTokenBtn.addEventListener('click', () => {
        this.showAuthStep('token');
      });
    }

    // Bind wallet selection buttons using event delegation
    const walletStep = document.getElementById('walletAuthStep');
    if (walletStep) {
      walletStep.addEventListener('click', (e) => {
        if (e.target.classList.contains('select-wallet-btn')) {
          const walletAddress = e.target.getAttribute('data-wallet-address');
          if (walletAddress) {
            this.selectWallet(walletAddress);
          }
        }
      });
    }

    // Bind add new wallet button
    const addNewWalletBtn = document.getElementById('addNewWalletBtn');
    if (addNewWalletBtn) {
      addNewWalletBtn.addEventListener('click', () => {
        this.showWalletInput();
      });
    }
  }

  showWalletInput() {
    // Show the original wallet input form
    const walletStep = document.getElementById('walletAuthStep');
    if (!walletStep) return;

    walletStep.innerHTML = `
      <div class="auth-step-header">
        <div class="step-indicator">
          <span class="step-number completed">1</span>
          <span class="step-connector completed"></span>
          <span class="step-number completed">1.5</span>
          <span class="step-connector"></span>
          <span class="step-number active">2</span>
          <span class="step-label">Connect Wallet</span>
        </div>
        <button id="backToTokenBtn" class="back-btn" title="Back to token verification">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
      </div>

      <div class="auth-input-group">
        <label for="walletAddressInput">Connect your Solana wallet</label>
        <input type="text" id="walletAddressInput" placeholder="Enter your Solana wallet address" required>
        <div class="input-error" id="walletError" style="display: none;"></div>
        <button id="connectWalletBtn" class="primary-btn gradient-btn">
          <span class="btn-text">Connect Wallet</span>
          <span class="btn-loading" style="display: none;">
            <svg class="spinner" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" fill="none"
                stroke-dasharray="31.416" stroke-dashoffset="31.416">
                <animate attributeName="stroke-dasharray" dur="2s" values="0 31.416;15.708 15.708;0 31.416"
                  repeatCount="indefinite" />
                <animate attributeName="stroke-dashoffset" dur="2s" values="0;-15.708;-31.416"
                  repeatCount="indefinite" />
            </svg>
          </span>
        </button>
      </div>
    `;

    // Re-bind wallet input events
    this.bindWalletInputEvents();
  }

  bindWalletInputEvents() {
    // Bind back button
    const backToTokenBtn = document.getElementById('backToTokenBtn');
    if (backToTokenBtn) {
      backToTokenBtn.addEventListener('click', () => {
        this.showAuthStep('token');
      });
    }

    // Bind wallet input events
    const walletAddressInput = document.getElementById('walletAddressInput');
    if (walletAddressInput) {
      walletAddressInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          this.handleWalletConnect();
        }
      });

      walletAddressInput.addEventListener('input', (e) => {
        this.validateWalletAddress(e.target.value);
      });
    }

    // Bind connect button
    const connectWalletBtn = document.getElementById('connectWalletBtn');
    if (connectWalletBtn) {
      connectWalletBtn.addEventListener('click', () => {
        this.handleWalletConnect();
      });
    }
  }

  async handleWalletConnect() {
    const walletAddress = document.getElementById('walletAddressInput').value.trim();

    if (!walletAddress) {
      this.showError('Please enter a wallet address');
      return;
    }

    if (!this.isValidWalletAddress(walletAddress)) {
      this.showError('Please enter a valid Solana wallet address');
      return;
    }

    // Call selectWallet to handle the connection
    await this.selectWallet(walletAddress);
  }

  async selectWallet(walletAddress) {
    try {
      this.showLoading('Connecting wallet...');

      // Validate wallet with backend
      const validateResponse = await fetch(`${this.apiBaseUrl}/spartan-defi/validate-account`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.authToken}`
        },
        body: JSON.stringify({
          email: this.userEmail,
          walletAddress: walletAddress
        })
      });

      const validateData = await validateResponse.json();

      if (!validateData.success || !validateData.data.isValid) {
        throw new Error('Invalid wallet address or wallet not found');
      }

      // Find wallet index in userWallets array
      const walletIndex = this.userWallets.findIndex(w => w.address === walletAddress);
      if (walletIndex !== -1) {
        this.currentWalletIndex = walletIndex;
      } else {
        // Add new wallet to the list
        this.userWallets.push({ address: walletAddress, name: `Wallet ${this.userWallets.length + 1}` });
        this.currentWalletIndex = this.userWallets.length - 1;
      }

      // Set current user first, then save to storage
      this.currentUser = { walletAddress };
      this.saveWalletsToStorage();

      // Update UI to show connected state
      this.showConnectedState();
      await this.loadUserData();

    } catch (error) {
      console.error('Error connecting wallet:', error);
      this.showError('Failed to connect wallet. Please try again.');
    } finally {
      this.hideLoading();
    }
  }

  // New methods for multi-account support
  updateWalletSelector() {
    const walletSelector = document.getElementById('walletSelector');
    if (!walletSelector) return;

    if (this.userWallets.length <= 1) {
      // Hide selector if only one wallet
      walletSelector.style.display = 'none';
      return;
    }

    // Show selector and populate options
    walletSelector.style.display = 'block';
    walletSelector.innerHTML = `
      <div class="wallet-selector-header">
        <span class="current-wallet">
          ${this.userWallets[this.currentWalletIndex].name || 'Wallet ' + (this.currentWalletIndex + 1)}
        </span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="6,9 12,15 18,9"></polyline>
        </svg>
      </div>
      <div class="wallet-dropdown" style="display: none;">
        ${this.userWallets.map((wallet, index) => `
          <div class="wallet-option ${index === this.currentWalletIndex ? 'active' : ''}" 
               data-wallet-index="${index}">
            <div class="wallet-info">
              <div class="wallet-name">${wallet.name || 'Wallet ' + (index + 1)}</div>
              <div class="wallet-address">${wallet.address.slice(0, 8)}...${wallet.address.slice(-8)}</div>
            </div>
            ${index === this.currentWalletIndex ? '<span class="current-indicator">✓</span>' : ''}
          </div>
        `).join('')}
        <div class="wallet-option add-wallet" data-action="add-wallet">
          <div class="wallet-info">
            <div class="wallet-name">Add New Wallet</div>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
        </div>
      </div>
    `;

    // Bind dropdown events
    this.bindWalletSelectorEvents();
  }

  bindWalletSelectorEvents() {
    const walletSelector = document.getElementById('walletSelector');
    if (!walletSelector) return;

    const header = walletSelector.querySelector('.wallet-selector-header');
    const dropdown = walletSelector.querySelector('.wallet-dropdown');

    // Toggle dropdown
    header.addEventListener('click', () => {
      const isVisible = dropdown.style.display !== 'none';
      dropdown.style.display = isVisible ? 'none' : 'block';
    });

    // Handle wallet selection
    dropdown.addEventListener('click', (e) => {
      const option = e.target.closest('.wallet-option');
      if (!option) return;

      const walletIndex = option.getAttribute('data-wallet-index');
      const action = option.getAttribute('data-action');

      if (action === 'add-wallet') {
        this.showAddWalletModal();
      } else if (walletIndex !== null) {
        this.switchWallet(parseInt(walletIndex));
      }

      // Close dropdown
      dropdown.style.display = 'none';
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (!walletSelector.contains(e.target)) {
        dropdown.style.display = 'none';
      }
    });
  }

  async switchWallet(walletIndex) {
    if (walletIndex === this.currentWalletIndex) return;

    try {
      this.showLoading('Switching wallet...');

      const newWallet = this.userWallets[walletIndex];
      this.currentWalletIndex = walletIndex;
      this.currentUser = { walletAddress: newWallet.address };

      // Save to storage
      this.saveWalletsToStorage();

      // Update UI
      this.updateWalletSelector();
      await this.loadUserData();

    } catch (error) {
      console.error('Error switching wallet:', error);
      this.showError('Failed to switch wallet. Please try again.');
    } finally {
      this.hideLoading();
    }
  }

  showAddWalletModal() {
    // Create modal for adding new wallet
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'addWalletModal';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3>Add New Wallet</h3>
          <button class="close-btn" id="closeAddWalletModal">&times;</button>
        </div>
        <div class="modal-body">
          <div class="auth-input-group">
            <label for="newWalletAddressInput">Enter wallet address</label>
            <input type="text" id="newWalletAddressInput" placeholder="Enter your Solana wallet address" required>
            <div class="input-error" id="newWalletError" style="display: none;"></div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn secondary-btn" id="cancelAddWallet">Cancel</button>
          <button class="btn primary-btn" id="confirmAddWallet">Add Wallet</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    modal.style.display = 'flex';

    // Bind events
    const closeBtn = document.getElementById('closeAddWalletModal');
    const cancelBtn = document.getElementById('cancelAddWallet');
    const confirmBtn = document.getElementById('confirmAddWallet');
    const input = document.getElementById('newWalletAddressInput');

    const closeModal = () => {
      document.body.removeChild(modal);
    };

    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);

    input.addEventListener('input', (e) => {
      this.validateWalletAddress(e.target.value, 'newWalletError');
    });

    confirmBtn.addEventListener('click', () => {
      const address = input.value.trim();
      if (address && this.isValidWalletAddress(address)) {
        this.addNewWallet(address);
        closeModal();
      } else {
        this.showError('Please enter a valid wallet address');
      }
    });
  }

  async addNewWallet(walletAddress) {
    try {
      this.showLoading('Adding wallet...');

      // Validate wallet with backend
      const validateResponse = await fetch(`${this.apiBaseUrl}/spartan-defi/validate-account`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.authToken}`
        },
        body: JSON.stringify({
          email: this.userEmail,
          walletAddress: walletAddress
        })
      });

      const validateData = await validateResponse.json();

      if (!validateData.success || !validateData.data.isValid) {
        throw new Error('Invalid wallet address or wallet not found');
      }

      // Check if wallet already exists
      const existingIndex = this.userWallets.findIndex(w => w.address === walletAddress);
      if (existingIndex !== -1) {
        this.showError('This wallet is already added');
        return;
      }

      // Add new wallet
      this.userWallets.push({
        address: walletAddress,
        name: `Wallet ${this.userWallets.length + 1}`
      });

      // Save to storage
      this.saveWalletsToStorage();

      // Update UI
      this.updateWalletSelector();

    } catch (error) {
      console.error('Error adding wallet:', error);
      this.showError('Failed to add wallet. Please check the address and try again.');
    } finally {
      this.hideLoading();
    }
  }

  saveWalletsToStorage() {
    localStorage.setItem('spartan_wallets', JSON.stringify(this.userWallets));
    localStorage.setItem('spartan_current_wallet_index', this.currentWalletIndex.toString());

    // Only save current wallet if currentUser exists
    if (this.currentUser && this.currentUser.walletAddress) {
      localStorage.setItem('spartan_wallet', this.currentUser.walletAddress);
    }
  }

  isValidWalletAddress(address) {
    return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
  }

  handleLogout() {
    localStorage.removeItem('spartan_wallet');
    localStorage.removeItem('spartan_wallets');
    localStorage.removeItem('spartan_current_wallet_index');
    localStorage.removeItem('spartan_email');
    localStorage.removeItem('spartan_auth_token');
    localStorage.removeItem('spartan_session');
    this.currentUser = null;
    this.userEmail = null;
    this.authToken = null;
    this.sessionId = null;
    this.userWallets = [];
    this.currentWalletIndex = 0;

    // Update UI to show disconnected state
    this.showDisconnectedState();
    this.showAuthStep('email');
  }

  showDashboard() {
    document.getElementById('welcomeScreen').classList.remove('active');
    document.getElementById('walletInputScreen').classList.remove('active');
    document.getElementById('dashboardScreen').classList.add('active');

    if (this.currentUser) {
      const walletAddress = this.currentUser.walletAddress;
      const shortAddress = walletAddress ? `${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}` : '';
      document.getElementById('userEmail').textContent = shortAddress;
      document.getElementById('userAvatar').textContent = 'S';
    }
  }

  async loadUserData() {
    if (!this.currentUser) return;

    try {
      console.log('Loading user data for wallet:', this.currentUser.walletAddress);

      // Check API status first, but don't fail if it's not available
      const apiAvailable = await this.checkApiStatus();

      if (apiAvailable) {
        await Promise.all([
          this.loadPortfolio(),
          this.initializeChat()
        ]);
      } else {
        // Show empty portfolio if API is not available
        console.log('API not available, showing empty portfolio');
        this.renderPortfolio({
          totalValueUsd: 0,
          tokens: []
        });
      }
    } catch (error) {
      console.error('Error loading user data:', error);
      // Don't show error modal, just log it
      console.warn('Continuing with limited functionality...');
    }
  }

  async checkApiStatus() {
    try {
      console.log('Checking API status at:', this.apiBaseUrl);
      this.updateDebugStatus('apiStatus', 'Checking...');

      const response = await fetch(`${this.apiBaseUrl}/spartan-defi/status`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        mode: 'cors'
      });

      if (!response.ok) {
        throw new Error(`API responded with status: ${response.status}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error('API service unavailable');
      }

      console.log('API Status:', data.data);
      this.updateDebugStatus('apiStatus', 'Connected');
      return true;
    } catch (error) {
      console.error('API status check failed:', error);
      this.updateDebugStatus('apiStatus', 'Failed: ' + error.message);
      // Don't throw error, just log it and continue
      console.warn('Continuing without API connection...');
      return false;
    }
  }

  async loadPortfolio() {
    try {
      const response = await fetch(`${this.apiBaseUrl}/spartan-defi/balances/${this.currentUser.walletAddress}`);
      const data = await response.json();

      if (data.success) {
        // The API returns data at the root level, not nested under data property
        this.renderPortfolio(data);
      } else {
        throw new Error(data.error || 'Failed to load portfolio');
      }
    } catch (error) {
      console.error('Portfolio loading error:', error);
      // Show empty portfolio on error
      this.renderPortfolio({
        totalValueUsd: 0,
        tokens: []
      });
    }
  }

  renderPortfolio(portfolioData) {
    const tokenList = document.getElementById('tokenList');
    const totalBalance = document.getElementById('totalBalance');
    const balanceChange = document.getElementById('balanceChange');

    if (!portfolioData) {
      tokenList.innerHTML = '<div class="empty-state">No portfolio data available</div>';
      totalBalance.textContent = '$0.00';
      balanceChange.innerHTML = '<span class="change-amount">+$0.00</span><span class="change-percent">(0.00%)</span>';
      return;
    }

    // Use totalValueUsd from API if available, otherwise calculate from tokens
    let totalValue = portfolioData.totalValueUsd || 0;

    // If no totalValueUsd provided, calculate from tokens
    if (!portfolioData.totalValueUsd) {
      const tokens = portfolioData.tokens || [];
      totalValue = tokens.reduce((sum, token) => sum + (token.valueUsd || 0), 0);
    }

    totalBalance.textContent = this.formatCurrency(totalValue);

    // Update balance change
    balanceChange.innerHTML = `
      <span class="change-amount">$0.00</span>
      <span class="change-percent">(0.00%)</span>
    `;

    // Add SOL token to the list if there's a SOL balance
    const tokens = portfolioData.tokens || [];
    const allTokens = [...tokens];

    // Add SOL token if there's any balance
    if (portfolioData.solBalance && portfolioData.solBalance > 0) {
      allTokens.unshift({
        mint: 'So11111111111111111111111111111111111111112',
        symbol: 'SOL',
        name: 'Solana',
        balance: portfolioData.solBalance,
        valueUsd: 0 // Will show as N/A until real price data is available
      });
    }

    if (allTokens.length === 0) {
      tokenList.innerHTML = '<div class="empty-state">No tokens found in wallet</div>';
      return;
    }

    tokenList.innerHTML = allTokens.map(token => `
      <div class="token-item" onclick="spartan.showTokenDetails('${token.mint}')">
        <div class="token-icon">${token.symbol ? token.symbol.charAt(0).toUpperCase() : 'T'}</div>
        <div class="token-info">
          <div class="token-name">${token.name || 'Unknown Token'}</div>
          <div class="token-symbol">${token.symbol || token.mint.slice(0, 8)}</div>
        </div>
        <div class="token-balance">
          <div class="token-amount">${this.formatNumber(token.balance || 0)}</div>
          <div class="token-value">${token.valueUsd ? this.formatCurrency(token.valueUsd) : 'N/A'}</div>
        </div>
      </div>
    `).join('');
  }

  async loadMarketData() {
    try {
      const response = await fetch(`${this.apiBaseUrl}/spartan-defi/market-data`);
      const data = await response.json();

      if (data.success) {
        this.renderMarketData(data.data);
      }
    } catch (error) {
      console.error('Market data loading error:', error);
    }
  }

  renderMarketData(marketData) {
    const tokenCount = document.getElementById('tokenCount');
    const lastUpdate = document.getElementById('lastUpdate');
    const trendingTokens = document.getElementById('trendingTokens');

    tokenCount.textContent = marketData.cachedTokens || 0;
    lastUpdate.textContent = new Date().toLocaleTimeString();

    const tokens = marketData.marketData || [];
    if (tokens.length === 0) {
      trendingTokens.innerHTML = '<div class="empty-state">No market data available</div>';
      return;
    }

    trendingTokens.innerHTML = tokens.slice(0, 10).map(token => `
      <div class="trending-token">
        <div class="trending-token-info">
          <div class="trending-token-name">${token.symbol || 'Unknown'}</div>
          <div class="trending-token-price">$${token.price ? token.price.toFixed(4) : 'N/A'}</div>
        </div>
        <div class="trending-token-change ${token.priceChange24h >= 0 ? 'positive' : 'negative'}">
          ${token.priceChange24h >= 0 ? '+' : ''}${token.priceChange24h ? token.priceChange24h.toFixed(2) : '0.00'}%
        </div>
      </div>
    `).join('');
  }

  async loadTransactions() {
    try {
      const response = await fetch(`${this.apiBaseUrl}/spartan-defi/transactions`);
      const data = await response.json();

      if (data.success) {
        this.renderTransactions(data.data.transactions || []);
      }
    } catch (error) {
      console.error('Transactions loading error:', error);
      this.renderTransactions([]);
    }
  }

  renderTransactions(transactions) {
    const transactionsList = document.getElementById('transactionsList');

    if (transactions.length === 0) {
      transactionsList.innerHTML = '<div class="empty-state">No transactions found</div>';
      return;
    }

    transactionsList.innerHTML = transactions.slice(0, 20).map(tx => `
      <div class="transaction-item">
        <div class="transaction-icon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
          </svg>
        </div>
        <div class="transaction-info">
          <div class="transaction-type">${tx.type || 'Transfer'}</div>
          <div class="transaction-date">${new Date(tx.timestamp || Date.now()).toLocaleDateString()}</div>
        </div>
        <div class="transaction-amount ${tx.amount >= 0 ? 'positive' : 'negative'}">
          ${tx.amount >= 0 ? '+' : ''}${this.formatCurrency(tx.amount || 0)}
        </div>
      </div>
    `).join('');
  }

  async initializeChat() {
    if (!this.currentUser) return;

    try {
      // Create a new session for chat
      const response = await fetch(`${this.apiBaseUrl}/spartan-defi/sessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: this.currentUser.walletAddress,
          metadata: {
            platform: 'chrome-extension',
            walletAddress: this.currentUser.walletAddress,
          }
        })
      });

      const data = await response.json();
      if (data.success) {
        this.sessionId = data.data.sessionId;
      }
    } catch (error) {
      console.error('Chat initialization error:', error);
    }
  }

  async sendChatMessage() {
    const chatInput = document.getElementById('chatInput');
    const message = chatInput.value.trim();

    if (!message) return;

    // Add user message to chat
    this.addChatMessage('user', message);
    chatInput.value = '';
    this.updateSendButton();

    try {
      const response = await fetch(`${this.apiBaseUrl}/spartan-defi/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: message,
          userId: this.currentUser.walletAddress,
          context: {
            userId: this.currentUser.walletAddress,
            walletAddress: this.currentUser.walletAddress
          }
        })
      });

      const data = await response.json();

      if (data.success) {
        this.addChatMessage('assistant', data.data.message || data.data.content || 'Response received');
      } else {
        this.addChatMessage('assistant', 'Sorry, I encountered an error. Please try again.');
      }
    } catch (error) {
      console.error('Chat error:', error);
      this.addChatMessage('assistant', 'Sorry, I\'m having trouble connecting. Please try again.');
    }
  }

  addChatMessage(type, content) {
    const chatMessages = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    messageDiv.innerHTML = `
      <div class="message-content">
        <p>${this.escapeHtml(content)}</p>
      </div>
    `;
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  updateSendButton() {
    const chatInput = document.getElementById('chatInput');
    const sendBtn = document.getElementById('sendChatBtn');

    // Only enable if chat input is not disabled and has content
    const hasContent = chatInput.value.trim().length > 0;
    const isEnabled = !chatInput.disabled && hasContent;
    sendBtn.disabled = !isEnabled;
  }

  switchTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.nav-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.tab === tabName);
    });

    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.toggle('active', content.id === `${tabName}Tab`);
    });

    this.currentTab = tabName;

    // Load data for specific tabs
    if (tabName === 'market') {
      this.loadMarketData();
    } else if (tabName === 'transactions') {
      this.loadTransactions();
    }
  }

  toggleBalanceVisibility() {
    this.isBalanceVisible = !this.isBalanceVisible;
    const totalBalance = document.getElementById('totalBalance');

    if (this.isBalanceVisible) {
      totalBalance.textContent = totalBalance.dataset.actualValue || '$0.00';
    } else {
      totalBalance.dataset.actualValue = totalBalance.textContent;
      totalBalance.textContent = '••••••';
    }
  }

  async refreshData() {
    await this.loadUserData();
  }

  handleReceive() {
    this.showError('Receive functionality coming soon!');
  }

  handleSend() {
    this.showError('Send functionality coming soon!');
  }

  async handleSwap() {
    try {
      // Get current portfolio to show available tokens
      const response = await fetch(`${this.apiBaseUrl}/spartan-defi/balances/${this.currentUser.walletAddress}`);
      const data = await response.json();

      if (data.success && data.tokens && data.tokens.length > 0) {
        const firstToken = data.tokens[0];
        this.showError(`Swap functionality coming soon! You can swap ${firstToken.symbol} tokens.`);
      } else {
        this.showError('Swap functionality coming soon! Connect a wallet with tokens to get started.');
      }
    } catch (error) {
      console.error('Error checking portfolio for swap:', error);
      this.showError('Swap functionality coming soon!');
    }
  }

  async showTokenDetails(tokenMint) {
    try {
      const response = await fetch(`${this.apiBaseUrl}/spartan-defi/token/${this.currentUser.walletAddress}/${tokenMint}`);
      const data = await response.json();

      if (data.success) {
        const token = data.data;
        this.showError(`Token: ${token.symbol || tokenMint.slice(0, 8)} - Balance: ${this.formatNumber(token.balance || 0)} - Value: ${this.formatCurrency(token.valueUsd || 0)}`);
      } else {
        this.showError(`Token details for ${tokenMint.slice(0, 8)}... not found`);
      }
    } catch (error) {
      console.error('Error getting token details:', error);
      this.showError(`Token details for ${tokenMint.slice(0, 8)}... coming soon!`);
    }
  }

  // Utility functions
  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  }

  formatNumber(number) {
    // Handle very small numbers (scientific notation)
    if (Math.abs(number) < 0.000001 && number !== 0) {
      return number.toExponential(6);
    }

    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 6
    }).format(number);
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  showLoading(message = 'Loading...') {
    document.getElementById('loadingText').textContent = message;
    document.getElementById('loadingOverlay').style.display = 'flex';
  }

  hideLoading() {
    document.getElementById('loadingOverlay').style.display = 'none';
  }

  showError(message) {
    document.getElementById('errorMessage').textContent = message;
    document.getElementById('errorModal').style.display = 'flex';
  }

  hideErrorModal() {
    document.getElementById('errorModal').style.display = 'none';
  }
}

// Initialize the extension
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM loaded, initializing Spartan DeFi extension...');
  try {
    const spartan = new SpartanDeFi();
    window.spartan = spartan; // Make it globally accessible for debugging
    console.log('Spartan DeFi extension initialized successfully');
  } catch (error) {
    console.error('Failed to initialize Spartan DeFi extension:', error);
  }
}); 