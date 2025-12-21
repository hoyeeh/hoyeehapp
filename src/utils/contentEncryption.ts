/**
 * Content Encryption Utilities
 * AES-128-CBC encryption compatible with Clear Key CDM
 */

// Generate a random 128-bit (16 byte) AES key
export const generateAESKey = async (): Promise<CryptoKey> => {
  return crypto.subtle.generateKey(
    {
      name: 'AES-CBC',
      length: 128,
    },
    true, // extractable
    ['encrypt', 'decrypt']
  );
};

// Generate a random 16-byte initialization vector
export const generateIV = (): Uint8Array => {
  return crypto.getRandomValues(new Uint8Array(16));
};

// Generate a 16-byte key ID
export const generateKeyId = (): Uint8Array => {
  return crypto.getRandomValues(new Uint8Array(16));
};

// Export a CryptoKey to raw bytes
export const exportKey = async (key: CryptoKey): Promise<Uint8Array> => {
  const rawKey = await crypto.subtle.exportKey('raw', key);
  return new Uint8Array(rawKey);
};

// Import raw bytes as a CryptoKey
export const importKey = async (keyBytes: Uint8Array): Promise<CryptoKey> => {
  return crypto.subtle.importKey(
    'raw',
    keyBytes.buffer as ArrayBuffer,
    { name: 'AES-CBC' },
    false,
    ['decrypt']
  );
};

// Encrypt data using AES-128-CBC
export const encryptData = async (
  data: ArrayBuffer,
  key: CryptoKey,
  iv: Uint8Array
): Promise<ArrayBuffer> => {
  return crypto.subtle.encrypt(
    {
      name: 'AES-CBC',
      iv: iv.buffer as ArrayBuffer,
    },
    key,
    data
  );
};

// Decrypt data using AES-128-CBC
export const decryptData = async (
  encryptedData: ArrayBuffer,
  key: CryptoKey,
  iv: Uint8Array
): Promise<ArrayBuffer> => {
  return crypto.subtle.decrypt(
    {
      name: 'AES-CBC',
      iv: iv.buffer as ArrayBuffer,
    },
    key,
    encryptedData
  );
};

// Convert Uint8Array to hex string
export const bytesToHex = (bytes: Uint8Array): string => {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
};

// Convert hex string to Uint8Array
export const hexToBytes = (hex: string): Uint8Array => {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
};

// Convert Uint8Array to base64url
export const bytesToBase64url = (bytes: Uint8Array): string => {
  const binary = String.fromCharCode(...bytes);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

// Convert base64url to Uint8Array
export const base64urlToBytes = (base64url: string): Uint8Array => {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - base64.length % 4) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

// Derive a content key from user ID, content ID, and master secret
export const deriveContentKey = async (
  userId: string,
  contentId: string,
  masterSecret: string
): Promise<Uint8Array> => {
  // Create input data for key derivation
  const encoder = new TextEncoder();
  const inputData = encoder.encode(`${userId}:${contentId}:${masterSecret}`);
  
  // Hash the input using SHA-256
  const hashBuffer = await crypto.subtle.digest('SHA-256', inputData);
  
  // Take the first 16 bytes for AES-128
  return new Uint8Array(hashBuffer.slice(0, 16));
};

// Generate PSSH (Protection System Specific Header) box for CENC
export const generatePSSHBox = (keyId: Uint8Array, systemId: Uint8Array): Uint8Array => {
  // PSSH box structure:
  // 4 bytes: box size
  // 4 bytes: 'pssh'
  // 1 byte: version (1 for multiple key IDs)
  // 3 bytes: flags
  // 16 bytes: system ID
  // 4 bytes: key ID count
  // 16 bytes * count: key IDs
  // 4 bytes: data size
  // data bytes: optional data
  
  const boxSize = 32 + 16; // Header + 1 key ID
  const pssh = new Uint8Array(boxSize);
  const view = new DataView(pssh.buffer);
  
  // Box size
  view.setUint32(0, boxSize, false);
  
  // Box type 'pssh'
  pssh.set([0x70, 0x73, 0x73, 0x68], 4);
  
  // Version and flags
  view.setUint32(8, 0x01000000, false); // version 1
  
  // System ID
  pssh.set(systemId, 12);
  
  // Key ID count
  view.setUint32(28, 1, false);
  
  // Key ID
  pssh.set(keyId, 32);
  
  return pssh;
};

// Clear Key system ID
export const CLEAR_KEY_SYSTEM_ID = new Uint8Array([
  0x10, 0x77, 0xef, 0xec, 0xc0, 0xb2, 0x4d, 0x02,
  0xac, 0xe3, 0x3c, 0x1e, 0x52, 0xe2, 0xfb, 0x4b
]);

// Widevine system ID
export const WIDEVINE_SYSTEM_ID = new Uint8Array([
  0xed, 0xef, 0x8b, 0xa9, 0x79, 0xd6, 0x4a, 0xce,
  0xa3, 0xc8, 0x27, 0xdc, 0xd5, 0x1d, 0x21, 0xed
]);

// Create Clear Key init data for EME
export const createClearKeyInitData = (keyId: Uint8Array): Uint8Array => {
  // For Clear Key, init data is a JSON object with the key ID in base64url
  const initData = {
    kids: [bytesToBase64url(keyId)],
    type: 'temporary',
  };
  
  return new TextEncoder().encode(JSON.stringify(initData));
};

// Create encrypted content wrapper
export interface EncryptedContent {
  keyId: string;
  iv: string;
  data: string;
}

export const createEncryptedContentWrapper = (
  keyId: Uint8Array,
  iv: Uint8Array,
  encryptedData: ArrayBuffer
): EncryptedContent => {
  return {
    keyId: bytesToBase64url(keyId),
    iv: bytesToBase64url(iv),
    data: bytesToBase64url(new Uint8Array(encryptedData)),
  };
};

// Parse encrypted content wrapper
export const parseEncryptedContentWrapper = (wrapper: EncryptedContent): {
  keyId: Uint8Array;
  iv: Uint8Array;
  data: Uint8Array;
} => {
  return {
    keyId: base64urlToBytes(wrapper.keyId),
    iv: base64urlToBytes(wrapper.iv),
    data: base64urlToBytes(wrapper.data),
  };
};
