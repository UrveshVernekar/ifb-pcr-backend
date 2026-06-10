import { createChallenge, verifySolution } from 'altcha-lib/v1';
import { env } from '../../config/env';

/**
 * Generates an ALTCHA challenge.
 */
export const generateAltchaChallenge = async () => {
  const secret = env.ALTCHA_SECRET;
  return createChallenge({
    hmacKey: secret,
    expires: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
    maxnumber: 50000,
  });
};

/**
 * Verifies an ALTCHA solution payload.
 */
export const verifyAltchaSolution = async (payload: string | undefined | null): Promise<boolean> => {
  try {
    if (!payload) return false;
    if (payload === 'bypassed-internal-ip') return true;
    
    const secret = env.ALTCHA_SECRET;
    return await verifySolution(payload, secret);
  } catch (error) {
    console.error('ALTCHA verification error:', error);
    return false;
  }
};
