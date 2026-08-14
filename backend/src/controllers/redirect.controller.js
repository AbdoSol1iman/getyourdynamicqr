import {
  findForRedirect,
  findForRedirectOnDomain,
  getBaseHost,
  recordScan,
} from "../services/qr.service.js";
import { HEALTH_CHECK_UA } from "../services/qr.health.js";

function cleanIp(rawIp) {
  if (!rawIp) return null;
  return rawIp.replace(/^::ffff:/, "");
}

export async function redirect(req, res) {
  const { shortCode } = req.params;

  // If the request arrives on our default host, use the global lookup.
  // Otherwise treat the host as a custom domain owned by some user.
  const qr =
    req.hostname === getBaseHost()
      ? await findForRedirect(shortCode)
      : await findForRedirectOnDomain(req.hostname, shortCode);

  if (!qr) {
    return res.status(404).json({ success: false, message: "QR code not found" });
  }

  // Scan logging is best-effort: a failure must not block the redirect
  // (spec §15). Health/verification probes are not real scans and must not
  // inflate the QR's analytics counts.
  if (req.get("user-agent") !== HEALTH_CHECK_UA) {
    try {
      await recordScan({
        qrCodeId: qr.id,
        ipAddress: cleanIp(req.ip),
        userAgent: req.get("user-agent") || null,
      });
    } catch (err) {
      console.error("Failed to record scan:", err);
    }
  }

  // 302 (not 301): temporary redirect so destination changes and scan tracking
  // always reach our server again on every scan (spec §14).
  res.redirect(302, qr.destinationUrl);
}
