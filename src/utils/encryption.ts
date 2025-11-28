import { createCipheriv, createDecipheriv, randomBytes, scrypt } from 'crypto';

/**
 * Encryption utilities for sensitive data at rest
 */

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16; // 128 bits
const TAG_LENGTH = 16; // 128 bits

/**
 * Derives encryption key from password using scrypt
 */
async function deriveKey(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, KEY_LENGTH, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(derivedKey);
    });
  });
}

/**
 * Encrypts text data
 */
export async function encrypt(text: string, password: string): Promise<string> {
  if (!text || typeof text !== 'string') {
    throw new Error('Text to encrypt must be a non-empty string');
  }
  
  if (!password || typeof password !== 'string') {
    throw new Error('Password must be a non-empty string');
  }

  try {
    // Generate salt and IV
    const salt = randomBytes(16);
    const iv = randomBytes(IV_LENGTH);
    
    // Derive key
    const key = await deriveKey(password, salt);
    
    // Create cipher
    const cipher = createCipheriv(ALGORITHM, key, iv);
    
    // Encrypt data
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // Get authentication tag
    const tag = cipher.getAuthTag();
    
    // Combine all components: salt + iv + tag + encrypted
    const combined = Buffer.concat([
      salt,
      iv,
      tag,
      Buffer.from(encrypted, 'hex')
    ]);
    
    return combined.toString('base64');
  } catch (error) {
    throw new Error(`Encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Decrypts text data
 */
export async function decrypt(encryptedData: string, password: string): Promise<string> {
  if (!encryptedData || typeof encryptedData !== 'string') {
    throw new Error('Encrypted data must be a non-empty string');
  }
  
  if (!password || typeof password !== 'string') {
    throw new Error('Password must be a non-empty string');
  }

  try {
    // Parse combined data
    const combined = Buffer.from(encryptedData, 'base64');
    
    // Extract components
    const salt = combined.subarray(0, 16);
    const iv = combined.subarray(16, 16 + IV_LENGTH);
    const tag = combined.subarray(16 + IV_LENGTH, 16 + IV_LENGTH + TAG_LENGTH);
    const encrypted = combined.subarray(16 + IV_LENGTH + TAG_LENGTH);
    
    // Derive key
    const key = await deriveKey(password, salt);
    
    // Create decipher
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    
    // Decrypt data
    let decrypted = decipher.update(encrypted, undefined, 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    throw new Error(`Decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Checks if data appears to be encrypted (basic heuristic)
 */
export function isEncrypted(data: string): boolean {
  if (!data || typeof data !== 'string') {
    return false;
  }
  
  try {
    // Try to decode as base64 and check minimum length
    const decoded = Buffer.from(data, 'base64');
    // Minimum length: salt(16) + iv(16) + tag(16) + some encrypted data
    return decoded.length >= 48;
  } catch {
    return false;
  }
}

/**
 * Encryption key manager for application
 */
export class EncryptionManager {
  private password: string;
  
  constructor(password: string) {
    if (!password || password.length < 32) {
      throw new Error('Encryption password must be at least 32 characters long');
    }
    this.password = password;
  }
  
  /**
   * Encrypts sensitive field for storage
   */
  async encryptField(text: string): Promise<string> {
    return encrypt(text, this.password);
  }
  
  /**
   * Decrypts sensitive field from storage
   */
  async decryptField(encryptedData: string): Promise<string> {
    return decrypt(encryptedData, this.password);
  }
  
  /**
   * Safely decrypts field - returns original if not encrypted
   */
  async safeDecryptField(data: string): Promise<string> {
    if (!isEncrypted(data)) {
      return data;
    }
    return this.decryptField(data);
  }
}