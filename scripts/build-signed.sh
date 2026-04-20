#!/bin/bash
set -e

echo "=== Promptly Build + Sign ==="
echo ""

# Step 1: Build renderer
echo "Building renderer..."
npm run build:renderer

# Step 2: Package with electron-builder (unsigned)
echo "Packaging app..."
npx electron-builder --mac --universal --config.mac.identity=null

# Step 3: Sign the app
echo "Signing app..."
bash scripts/sign-app.sh

# Step 4: Create DMG from signed app
echo "Creating DMG..."
npx electron-builder --mac dmg --config.mac.identity=null \
  --config.dmg.contents[0].path="dist/mac-universal/Promptly.app"

echo ""
echo "=== Build complete ==="
echo "Output: dist/Promptly-1.0.0-universal.dmg"
