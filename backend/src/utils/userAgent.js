import { UAParser } from "ua-parser-js";

// Extracts device type, OS and browser from a User-Agent string so each scan
// event can be analyzed by these dimensions. Hand-rolling a parser is
// error-prone, so we use the tiny, widely-used ua-parser-js library.
// Unknown values stay null instead of being guessed.
export function parseUserAgent(userAgent) {
  if (!userAgent) {
    return { deviceType: null, os: null, browser: null };
  }

  const result = new UAParser(userAgent).getResult();

  return {
    deviceType: result.device.type || "desktop", // desktops often lack a type
    os: result.os.name || null,
    browser: result.browser.name || null,
  };
}