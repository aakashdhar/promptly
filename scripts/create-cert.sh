#!/bin/bash
set -e

CERT_NAME="Promptly Signing"

# Check if cert already exists
if security find-identity -v -p codesigning 2>/dev/null | grep -q "$CERT_NAME"; then
  echo "✓ Certificate '$CERT_NAME' already exists — skipping creation"
  exit 0
fi

echo "Creating self-signed code signing certificate..."

PASS="promptlysigning"
# A private work folder (not $TMPDIR, which other tools read), removed however the script ends,
# so the private key never stays on disk.
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT
KEY="$WORK/promptly.key"
CRT="$WORK/promptly.crt"
P12="$WORK/promptly.p12"

# Generate key and certificate
openssl genrsa -out "$KEY" 2048 2>/dev/null

openssl req -new -x509 -key "$KEY" -out "$CRT" -days 3650 \
  -subj "/CN=Promptly Signing" \
  -addext "keyUsage=critical,digitalSignature" \
  -addext "extendedKeyUsage=critical,codeSigning" 2>/dev/null

# Export to PKCS12 using legacy format (required for macOS security command)
# Falls back to non-legacy if openssl version doesn't support -legacy flag
if openssl pkcs12 -export -legacy \
  -out "$P12" \
  -inkey "$KEY" \
  -in "$CRT" \
  -passout "pass:$PASS" 2>/dev/null; then
  : # legacy succeeded
else
  openssl pkcs12 -export \
    -out "$P12" \
    -inkey "$KEY" \
    -in "$CRT" \
    -passout "pass:$PASS"
fi

# Import into login keychain
security import "$P12" \
  -k ~/Library/Keychains/login.keychain-db \
  -P "$PASS" \
  -T /usr/bin/codesign \
  -T /usr/bin/security

# Allow codesign to access without password prompt. This needs the login keychain's password;
# with a non-empty one it fails, and macOS asks once on the first signing instead.
security set-key-partition-list \
  -S apple-tool:,apple:,codesign: \
  -s -k "" \
  ~/Library/Keychains/login.keychain-db >/dev/null 2>&1 \
  || echo "  (codesign will ask for keychain access once on the first release — choose Always Allow)"

echo "✓ Certificate '$CERT_NAME' created and imported"
echo ""
echo "Verify with: security find-identity -v -p codesigning"
