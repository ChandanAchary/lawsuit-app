// Friendly labels + error-message mapping for the eKYC provider in use.
// Mirror of lawsuit-frontend/src/utils/ekycProvider.ts so the two FEs stay
// in lockstep when the provider rotates.
//
// The server returns `provider: 'sandbox' | 'email' | 'stub' | …` on every
// EkycSubmission; UI surfaces should use `ekycProviderLabel(provider)` so
// renaming the provider only touches this file. Same for `ekycVerifiedVia`
// on the Client row (AADHAAR | EMAIL_OTP) — both forms map to a friendly
// short string here.

export type EkycProviderRaw = string | null | undefined;
export type EkycVerifiedViaRaw = 'AADHAAR' | 'EMAIL_OTP' | null | undefined;

const PROVIDER_LABELS: Record<string, string> = {
  sandbox: 'Sandbox.co.in',
  email: 'NyayaX Email OTP',
  stub: 'Dev Stub',
  // Legacy — kept so historical EkycSubmission rows still render a name.
  surepass: 'Surepass',
};

const PROVIDER_LONG_LABELS: Record<string, string> = {
  sandbox: 'Aadhaar OKYC via Sandbox.co.in',
  email: 'Temporary email-OTP fallback',
  stub: 'Local-dev stub provider',
  surepass: 'Aadhaar OKYC via Surepass',
};

export function ekycProviderLabel(provider: EkycProviderRaw): string {
  if (!provider) return 'NyayaX';
  return PROVIDER_LABELS[provider] ?? provider;
}

export function ekycProviderLongLabel(provider: EkycProviderRaw): string {
  if (!provider) return 'NyayaX identity verification';
  return PROVIDER_LONG_LABELS[provider] ?? `Provider: ${provider}`;
}

export function verifiedViaLabel(via: EkycVerifiedViaRaw): string {
  if (via === 'EMAIL_OTP') return 'Verified via NyayaX Email OTP (temporary)';
  if (via === 'AADHAAR') return 'Verified via Sandbox.co.in';
  return 'Verified';
}

// ---------------------------------------------------------------------------
// Sandbox-specific error message mapping
// ---------------------------------------------------------------------------
// Sandbox surfaces a small set of recurring error strings. The generic
// formatErrorMessage helper passes these through verbatim, which is fine
// but a bit terse. This mapping rewrites the most common ones into copy
// that tells the user what to *do*, not just what went wrong.
//
// Anything not matched falls through unchanged.

const SANDBOX_REWRITES: Array<{ match: RegExp; rewrite: string }> = [
  {
    match: /invalid\s*otp|otp\s*(is\s*)?(invalid|incorrect|wrong|did\s*not\s*match|mismatch)/i,
    rewrite: "That OTP didn't match. Double-check the digits and try again.",
  },
  {
    match: /reference[_\s-]*id.*(expired|invalid|not\s*found)/i,
    rewrite: 'That OTP request expired. Please request a new OTP.',
  },
  {
    match: /(aadhaar|aadhar).*(not\s*linked|no\s*mobile|mobile\s*not\s*linked|no\s*registered\s*mobile)/i,
    rewrite:
      "Your Aadhaar isn't linked to a mobile number. Update your linkage at an Aadhaar Seva Kendra to verify here.",
  },
  {
    match: /(too\s*many|rate\s*limit|throttle|exceeded)/i,
    rewrite: 'Too many OTP requests for this Aadhaar. Please wait a few minutes and try again.',
  },
  {
    match: /(invalid|incorrect|malformed).*(aadhaar|aadhar)/i,
    rewrite: 'That Aadhaar number looks invalid. Please re-enter and try again.',
  },
  {
    match: /(unauthorized|forbidden|invalid\s*api\s*(key|secret)|access\s*token)/i,
    rewrite: 'Identity verification is temporarily unavailable. Please try again in a few minutes.',
  },
];

// Only fire the sandbox rewrites when the failing request actually came
// from the eKYC API. The previous unscoped version turned every error
// containing words like "unauthorized" / "forbidden" / "access token" /
// "rate limit" into the generic eKYC sandbox-down message — even on
// totally unrelated screens (document AI extract, JWT refresh, Cloudinary
// permission errors). That left users staring at "Identity verification
// is temporarily unavailable" when their real problem was something else
// entirely.
const EKYC_URL_RE = /\/ekyc(\/|$|\?)/i;

export function rewriteSandboxError(raw: string, opts?: { url?: string }): string {
  if (!raw) return raw;
  const url = opts?.url ?? '';
  // Aadhaar-specific patterns mention 'aadhaar' explicitly in their regex,
  // so they self-scope and are safe to keep enabled regardless of URL.
  // The broad patterns (rate limit, unauthorized, forbidden, etc.) only
  // run when we know the error came from an eKYC endpoint.
  const fromEkyc = !!url && EKYC_URL_RE.test(url);
  for (const { match, rewrite } of SANDBOX_REWRITES) {
    if (!fromEkyc && !/(aadhaar|aadhar)/i.test(match.source)) continue;
    if (match.test(raw)) return rewrite;
  }
  return raw;
}
