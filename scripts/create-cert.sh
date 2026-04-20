#!/bin/bash
set -e

CERT_NAME="Promptly Signing"

# Check if cert already exists
if security find-identity -v -p codesigning | grep -q "$CERT_NAME"; then
  echo "✓ Certificate '$CERT_NAME' already exists — skipping creation"
  exit 0
fi

echo "Creating self-signed code signing certificate..."

# Create a temporary config file for the certificate
cat > /tmp/promptly-cert.cfg << EOF
[ req ]
default_bits       = 2048
distinguished_name = req_distinguished_name
x509_extensions    = v3_req
prompt             = no

[ req_distinguished_name ]
CN = Promptly Signing

[ v3_req ]
keyUsage         = critical, digitalSignature
extendedKeyUsage = critical, codeSigning
EOF

# Generate private key and self-signed cert
openssl req -x509 -newkey rsa:2048 -keyout /tmp/promptly.key \
  -out /tmp/promptly.crt -days 3650 -nodes \
  -config /tmp/promptly-cert.cfg

# Convert to p12
openssl pkcs12 -export -out /tmp/promptly.p12 \
  -inkey /tmp/promptly.key -in /tmp/promptly.crt \
  -passout pass:promptly123

# Import into keychain
security import /tmp/promptly.p12 -k ~/Library/Keychains/login.keychain-db \
  -P promptly123 -T /usr/bin/codesign

# Set partition list to allow codesign access without password prompt
security set-key-partition-list -S apple-tool:,apple: \
  -s -k "$(security find-generic-password -wa 'login' 2>/dev/null || echo '')" \
  ~/Library/Keychains/login.keychain-db 2>/dev/null || true

# Clean up temp files
rm -f /tmp/promptly.key /tmp/promptly.crt /tmp/promptly.p12 /tmp/promptly-cert.cfg

echo "✓ Certificate '$CERT_NAME' created and imported into Keychain"
echo "  Note: You may see a Keychain access dialog — click Allow"
