// QR health/validation checks. Runs at creation and on demand (GET /api/qr/:id/health)
// so every QR is verified before being considered ready.
//
// Localhost is a legitimate redirect target during local development, so the
// "no localhost" rule is only enforced in production. The reachability and
// target-matching checks run everywhere.

const LOCAL_HOSTS = ["localhost", "127.0.0.1", "::1", "0.0.0.0"];

const REDIRECT_TIMEOUT_MS = 5000;

// User-Agent used by health probes. The redirect engine ignores these so
// verification never inflates a real QR's scan counts.
export const HEALTH_CHECK_UA = "dynamic-qr-health-check";

function isLocalhostUrl(url) {
  try {
    const parsed = new URL(url);
    return LOCAL_HOSTS.includes(parsed.hostname) || parsed.hostname.startsWith("127.");
  } catch {
    return true; // unparseable URLs are treated as unsafe
  }
}

async function fetchLocation(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REDIRECT_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      redirect: "manual",
      signal: controller.signal,
      headers: { "user-agent": HEALTH_CHECK_UA },
    });
    return { status: res.status, location: res.headers.get("location") || null };
  } finally {
    clearTimeout(timer);
  }
}

// Runs every check and returns a stable shape the API can surface to the UI.
export async function checkQrHealth({ redirectUrl, qrImage, destinationUrl }) {
  const checks = {
    noLocalhost: !isLocalhostUrl(redirectUrl) || process.env.NODE_ENV !== "production",
    qrImage:
      typeof qrImage === "string" && qrImage.startsWith("data:image/png;base64,") && qrImage.length > 32,
    reachable: false,
    targetMatch: false,
  };

  // Only probe the network when the URL is syntactically valid; an unparseable
  // URL would already fail noLocalhost in production and would otherwise throw.
  try {
    new URL(redirectUrl);
    const { status, location } = await fetchLocation(redirectUrl);
    checks.reachable = status >= 300 && status < 400;
    checks.targetMatch = checks.reachable && location === destinationUrl;
  } catch {
    checks.reachable = false;
    checks.targetMatch = false;
  }

  return {
    ok: Object.values(checks).every(Boolean),
    redirectUrl,
    checks,
  };
}
