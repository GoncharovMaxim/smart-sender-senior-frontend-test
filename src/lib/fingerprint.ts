const STORAGE_KEY = 'device_fingerprint';
const FINGERPRINT_RE = /^[0-9a-f]{32}$/;

function generateFingerprint(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** Stable device id (32 hex chars): generated once and kept in localStorage. */
export function getFingerprint(): string {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && FINGERPRINT_RE.test(stored)) return stored;

    const fingerprint = generateFingerprint();
    localStorage.setItem(STORAGE_KEY, fingerprint);
    return fingerprint;
  } catch {
    // Storage is unavailable (e.g. blocked site data): fall back to a per-tab id.
    return generateFingerprint();
  }
}
