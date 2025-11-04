# Spartan Wallet Chrome Extension

A modern, secure cryptocurrency wallet Chrome extension that provides a complete wallet experience for managing Solana-based assets. Part of the Spartan DeFi trading ecosystem - your resident Solana-based DeFi trading warlord.

## Features

### 🎨 **Modern UI/UX**
- Dark theme design with modern aesthetics
- Responsive layout optimized for Chrome extension popup
- Smooth animations and transitions
- Intuitive navigation with bottom tab bar

### 💰 **Wallet Management**
- Account overview with balance display
- Show/hide balance functionality for privacy
- Multiple token support (SOL, USDC, custom tokens)
- Asset list with real-time balance updates

### 🔧 **Core Functionality**
- **Receive**: Generate QR codes and addresses for receiving funds
- **Send**: Transfer tokens to other addresses
- **Swap**: Exchange tokens within the wallet
- **Buy**: Purchase crypto directly from the wallet
- **DeFi Trading**: Execute trades across Solana DEXs (Orca, Raydium, Meteora)
- **Copy Trading**: Follow elite wallet strategies
- **LP Management**: Manage liquidity positions with optimal strategies

### 🔒 **Security Features**
- Secure key management
- Transaction signing
- DApp integration with proper permissions
- Lock/unlock wallet functionality

### 🌐 **DApp Integration**
- Web3 provider injection for DApp compatibility
- Transaction approval interface
- Network switching support
- Connection management
- Integration with Spartan's DeFi ecosystem
- Access to market intelligence and trading signals

## Installation

### Development Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/elizaOS/spartan
   cd packages/spartan/extension
   ```

2. **Load the extension in Chrome**
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top right)
   - Click "Load unpacked"
   - Select the `extension/` folder from this directory

3. **Verify installation**
   - The Spartan Wallet icon should appear in your Chrome toolbar
   - Click the icon to open the wallet interface

### Production Build

1. **Build the extension**
   ```bash
   npm run build
   ```

2. **Load the built extension**
   - Follow the same steps as development setup
   - Select the `dist/` folder instead of `extension/`

## Usage

### First Time Setup

1. **Welcome Screen**: New users will see a welcome page with setup instructions
2. **Create Wallet**: Generate a new wallet or import existing one
3. **Backup**: Securely backup your recovery phrase
4. **Set Password**: Create a strong password for wallet access

### Daily Usage

1. **View Balance**: Click the wallet icon to see your account overview
2. **Send Tokens**: Click "Send" and enter recipient address and amount
3. **Receive Tokens**: Click "Receive" to get your wallet address or QR code
4. **Swap Tokens**: Use the "Swap" feature to exchange tokens
5. **Buy Crypto**: Use "Buy" to purchase crypto with fiat

### DApp Integration

1. **Connect to DApp**: Visit a Solana DApp and click "Connect Wallet"
2. **Approve Connection**: Review and approve the connection request
3. **Sign Transactions**: Review and sign transactions when prompted
4. **Manage Connections**: View and disconnect from DApps in settings

## Development

### Project Structure

```
extension/
├── manifest.json          # Extension manifest
├── popup.html            # Main wallet interface
├── popup.css             # Wallet styles
├── popup.js              # Wallet functionality
├── background.js         # Background service worker
├── content.js            # Content script for DApp integration
├── inject.js             # Web3 provider injection
├── welcome.html          # Welcome page for new users
└── README.md             # This file
```

### Key Components

- **Popup Interface**: Main wallet UI with account management
- **Background Script**: Handles extension lifecycle and messaging
- **Content Script**: Manages DApp integration and provider injection
- **Inject Script**: Provides Web3 provider for DApp compatibility

### Customization

#### Styling
- Modify `popup.css` to change the visual appearance
- Update color variables in `:root` for theme customization
- Adjust spacing and layout in the CSS classes

#### Functionality
- Add new features in `popup.js`
- Extend DApp integration in `content.js` and `inject.js`
- Modify background behavior in `background.js`

#### Assets
- Replace icon files for custom branding
- Update welcome page content in `welcome.html`
- Modify manifest.json for extension metadata

## Security Considerations

### Key Management
- Private keys are stored securely in Chrome's storage
- Keys are encrypted with user-provided password
- Recovery phrases are handled with proper security measures

### DApp Permissions
- Users must explicitly approve DApp connections
- Transaction signing requires user confirmation
- Connection permissions can be revoked at any time

### Data Privacy
- Wallet data is stored locally in the browser
- No data is sent to external servers without user consent
- Balance visibility can be toggled for privacy

## Troubleshooting

### Common Issues

1. **Extension not loading**
   - Check that Developer mode is enabled
   - Verify the correct folder is selected
   - Reload the extension from chrome://extensions/

2. **DApp connection issues**
   - Ensure the DApp supports Solana wallets
   - Check that the extension is properly injected
   - Try refreshing the DApp page

3. **Transaction failures**
   - Verify sufficient balance for transaction and fees
   - Check network connection
   - Ensure correct recipient address

### Debug Mode

Enable debug logging by:
1. Opening the extension popup
2. Right-click and select "Inspect"
3. Check the console for error messages
4. Review the background script logs in chrome://extensions/

## About Spartan

Spartan is your resident Solana-based DeFi trading warlord—a no-BS tactician who blends alpha with attitude. He's part shitposter, part protocol whisperer, and all about winning (even if it means dying on-chain for the memes).

### Spartan Features
- **Multi-Plugin Architecture**: Leverages various plugins for functionalities like SQL database interaction, AI model access, Discord/Telegram/Twitter integrations, and Solana blockchain interactions
- **Trading Capabilities**: Managing shared trading pools, executing trades across Solana DEXs, tracking token data and market trends
- **Copy Trading**: Optional copy trading from specified elite wallets
- **LP Management**: Managing LP positions with optimal strategies
- **Autonomous Trading**: Deploying autonomous trading tactics

For more information, visit: [https://github.com/elizaOS/spartan](https://github.com/elizaOS/spartan)

## Contributing

1. Fork the [Spartan repository](https://github.com/elizaOS/spartan)
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support and questions:
- Create an issue in the [Spartan repository](https://github.com/elizaOS/spartan)
- Check the troubleshooting guide
- Review the documentation

---

**Spartan Wallet** - Your resident Solana-based DeFi trading warlord 