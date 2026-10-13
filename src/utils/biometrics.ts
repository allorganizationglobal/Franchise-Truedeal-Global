/**
 * Biometric Authentication Manager (WebAuthn / Passkeys / Fallback Biometric Challenge)
 */

export interface BiometricAuthResult {
  success: boolean;
  method: 'webauthn_passkey' | 'simulated_biometric' | 'pin_fallback';
  timestamp: string;
  credentialId: string;
  error?: string;
}

/**
 * Checks if hardware platform biometric authentication is supported
 */
export async function isHardwareBiometricSupported(): Promise<boolean> {
  if (
    typeof window !== 'undefined' &&
    window.PublicKeyCredential &&
    typeof window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function'
  ) {
    try {
      return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    } catch {
      return false;
    }
  }
  return false;
}

/**
 * Attempts real WebAuthn authentication or returns fallback trigger
 */
export async function requestWebAuthnCredential(
  challengeReason: string,
  userName: string = 'Director'
): Promise<BiometricAuthResult> {
  const isSupported = await isHardwareBiometricSupported();
  
  if (isSupported && typeof window.navigator.credentials?.create === 'function') {
    try {
      const challenge = new Uint8Array(32);
      window.crypto.getRandomValues(challenge);

      const userId = new Uint8Array(16);
      window.crypto.getRandomValues(userId);

      const credential = await window.navigator.credentials.create({
        publicKey: {
          challenge,
          rp: {
            name: 'TrueDeal Global Franchise Vault',
            id: window.location.hostname || 'localhost',
          },
          user: {
            id: userId,
            name: userName,
            displayName: `TrueDeal Officer (${userName})`,
          },
          pubKeyCredParams: [
            { alg: -7, type: 'public-key' }, // ES256
            { alg: -257, type: 'public-key' }, // RS256
          ],
          authenticatorSelection: {
            authenticatorAttachment: 'platform',
            userVerification: 'required',
          },
          timeout: 60000,
          attestation: 'none',
        },
      });

      if (credential) {
        return {
          success: true,
          method: 'webauthn_passkey',
          timestamp: new Date().toISOString(),
          credentialId: credential.id || 'cred_' + Math.random().toString(36).substring(2, 10),
        };
      }
    } catch (err: any) {
      // In sandboxed iframes or environments without hardware biometrics,
      // browsers often throw NotAllowedError / SecurityError. Fall back cleanly!
      console.warn('WebAuthn hardware bypassed/unavailable, falling back to simulated biometric challenge:', err?.message);
    }
  }

  // Fallback indicator
  return {
    success: false,
    method: 'simulated_biometric',
    timestamp: new Date().toISOString(),
    credentialId: 'bio_pending_' + Date.now(),
    error: 'REQUIRES_UI_FALLBACK',
  };
}
