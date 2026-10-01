'use strict';

// The user's own API keys (D-AI-PROVIDERS), encrypted with Electron's safeStorage: the macOS
// Keychain or Windows DPAPI holds the encryption key, so config.json only ever has ciphertext.
// Where safeStorage can't encrypt, keys aren't saved at all rather than saved in plain text.

const REFUSED = "This computer can't store keys securely, so Promptly won't save it.";

function createSecrets({ safeStorage }) {
  const available = () => {
    try { return !!safeStorage && safeStorage.isEncryptionAvailable(); } catch { return false; }
  };
  return {
    available,
    // → base64 ciphertext; throws with a user-facing message when it can't encrypt.
    encrypt(plain) {
      if (!available()) throw new Error(REFUSED);
      return safeStorage.encryptString(String(plain)).toString('base64');
    },
    // → the key, or null when the ciphertext can't be read (another Mac, a reset Keychain).
    decrypt(b64) {
      if (!b64 || !available()) return null;
      try { return safeStorage.decryptString(Buffer.from(b64, 'base64')); } catch { return null; }
    },
  };
}

module.exports = { createSecrets, REFUSED };
