#!/bin/bash

# Spartan DeFi Chrome Extension Build Script
# This script compiles the extension for use in Google Chrome

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
EXTENSION_DIR="extension"
BUILD_DIR="chrome-build"
DIST_DIR="dist"

echo -e "${BLUE}🚀 Spartan DeFi Chrome Extension Build Script${NC}"
echo "=================================================="

# Function to print colored output
print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    print_error "package.json not found. Please run this script from the extension root directory."
    exit 1
fi

# Check if extension directory exists
if [ ! -d "$EXTENSION_DIR" ]; then
    print_error "Extension directory '$EXTENSION_DIR' not found."
    exit 1
fi

print_status "Starting build process..."

# Clean previous builds
print_status "Cleaning previous builds..."
rm -rf "$BUILD_DIR"
rm -rf "$DIST_DIR"

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    print_status "Installing dependencies..."
    npm install --legacy-peer-deps
else
    print_status "Dependencies already installed"
fi

# Build the TypeScript/JavaScript source
print_status "Building TypeScript source..."
npm run build

if [ $? -ne 0 ]; then
    print_error "TypeScript build failed"
    exit 1
fi

# Create build directory
print_status "Creating Chrome extension build directory..."
mkdir -p "$BUILD_DIR"

# Copy extension files
print_status "Copying extension files..."
cp -r "$EXTENSION_DIR"/* "$BUILD_DIR/"

# Copy built JavaScript files to extension
print_status "Copying built JavaScript files..."
if [ -d "$DIST_DIR" ]; then
    cp "$DIST_DIR"/*.js "$BUILD_DIR/" 2>/dev/null || true
    cp "$DIST_DIR"/*.d.ts "$BUILD_DIR/" 2>/dev/null || true
fi

# Update manifest.json with correct version
print_status "Updating manifest.json..."
MANIFEST_VERSION=$(node -p "require('./package.json').version")
sed -i "s/\"version\": \"[^\"]*\"/\"version\": \"$MANIFEST_VERSION\"/" "$BUILD_DIR/manifest.json"

# Create a zip file for Chrome Web Store (optional)
print_status "Creating Chrome extension package..."
cd "$BUILD_DIR"
zip -r "../spartan-defi-extension-v$MANIFEST_VERSION.zip" . -x "*.DS_Store" "*.git*" "node_modules/*" "*.log"
cd ..

# Verify the build
print_status "Verifying build..."
if [ -f "$BUILD_DIR/manifest.json" ]; then
    print_status "✓ manifest.json found"
else
    print_error "manifest.json not found in build directory"
    exit 1
fi

if [ -f "$BUILD_DIR/popup.html" ]; then
    print_status "✓ popup.html found"
else
    print_warning "popup.html not found"
fi

if [ -f "$BUILD_DIR/background.js" ]; then
    print_status "✓ background.js found"
else
    print_warning "background.js not found"
fi

if [ -f "$BUILD_DIR/content.js" ]; then
    print_status "✓ content.js found"
else
    print_warning "content.js not found"
fi

# Check for required icons
ICON_FILES=("icon-16.png" "icon-48.png" "icon-128.png")
for icon in "${ICON_FILES[@]}"; do
    if [ -f "$BUILD_DIR/$icon" ]; then
        print_status "✓ $icon found"
    else
        print_warning "$icon not found"
    fi
done

echo ""
echo -e "${GREEN}🎉 Build completed successfully!${NC}"
echo "=================================================="
echo -e "${BLUE}Build directory:${NC} $BUILD_DIR"
echo -e "${BLUE}Extension package:${NC} spartan-defi-extension-v$MANIFEST_VERSION.zip"
echo ""
echo -e "${YELLOW}To install in Chrome:${NC}"
echo "1. Open Chrome and go to chrome://extensions/"
echo "2. Enable 'Developer mode' (toggle in top right)"
echo "3. Click 'Load unpacked' and select the '$BUILD_DIR' folder"
echo ""
echo -e "${YELLOW}To update the extension:${NC}"
echo "1. Make your changes"
echo "2. Run this script again"
echo "3. Go to chrome://extensions/ and click the refresh icon on the extension"
echo ""
echo -e "${BLUE}Extension Details:${NC}"
echo -e "Name: $(node -p "require('./$BUILD_DIR/manifest.json').name")"
echo -e "Version: $(node -p "require('./$BUILD_DIR/manifest.json').version")"
echo -e "Description: $(node -p "require('./$BUILD_DIR/manifest.json').description")"

# Optional: Open the build directory
if command -v xdg-open >/dev/null 2>&1; then
    echo ""
    read -p "Open build directory in file manager? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        xdg-open "$BUILD_DIR"
    fi
elif command -v open >/dev/null 2>&1; then
    echo ""
    read -p "Open build directory in file manager? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        open "$BUILD_DIR"
    fi
fi

print_status "Build script completed!" 