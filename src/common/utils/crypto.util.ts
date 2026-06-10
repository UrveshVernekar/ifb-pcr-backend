import fs from 'fs';
import path from 'path';
import forge from 'node-forge';
import { env } from '../../config/env';

let cachedPrivateKeyPem: string | null = null;

const getPrivateKeyPem = (): string | null => {
  if (cachedPrivateKeyPem) return cachedPrivateKeyPem;

  const privateKeyPath = path.isAbsolute(env.PRIVATE_KEY_PATH)
    ? env.PRIVATE_KEY_PATH
    : path.join(process.cwd(), env.PRIVATE_KEY_PATH);

  if (!fs.existsSync(privateKeyPath)) {
    console.error(`Private key not found at: ${privateKeyPath}`);
    return null;
  }
  cachedPrivateKeyPem = fs.readFileSync(privateKeyPath, 'utf8');
  return cachedPrivateKeyPem;
};

/**
 * Decrypts RSA-OAEP encrypted base64 values sent by client.
 */
export const decryptPassword = (encryptedValue: string | undefined | null): string | null => {
  try {
    if (!encryptedValue) return null;
    const privateKeyPem = getPrivateKeyPem();
    if (!privateKeyPem) return null;

    const privateKey = forge.pki.privateKeyFromPem(privateKeyPem);
    const encryptedBytes = forge.util.decode64(encryptedValue);
    return privateKey.decrypt(encryptedBytes, 'RSA-OAEP', {
      md: forge.md.sha256.create(),
      mgf1: { md: forge.md.sha256.create() },
    });
  } catch (error) {
    console.error('Decryption error:', error);
    return null;
  }
};
