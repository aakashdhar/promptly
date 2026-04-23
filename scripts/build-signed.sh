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

# Step 4: Create DMG from signed app using hdiutil
echo "Creating signed DMG..."
rm -f dist/Promptly-signed.dmg
hdiutil create \
  -volname "Promptly" \
  -srcfolder dist/mac-universal/Promptly.app \
  -ov -format UDZO \
  dist/Promptly-signed.dmg

echo ""
echo "=== Build complete ==="
echo "Output: dist/Promptly-signed.dmg"
