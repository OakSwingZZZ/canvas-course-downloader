/**
 * Canvas Course Downloader — Pure Utility Helpers
 *
 * Stateless utility functions used across the extension.
 * These have no DOM or Chrome API dependencies (except getCanvasBrandColor/darkenColor
 * which read computed styles).
 */

// ---------------------------------------------------------------------------
// Canvas Theme Detection
// ---------------------------------------------------------------------------

const FALLBACK_COLOR = "#e82429";

/** Reads the institution's Canvas brand color from CSS custom properties. */
function getCanvasBrandColor() {
  const root = document.documentElement;
  const style = getComputedStyle(root);
  return (
    style.getPropertyValue("--ic-brand-primary").trim() ||
    style.getPropertyValue("--ic-brand-button--primary-bgd").trim() ||
    style.getPropertyValue("--ic-brand-global-nav-bgd").trim() ||
    FALLBACK_COLOR
  );
}

/** Returns a darker shade of a hex color for hover states. */
function darkenColor(hex, amount = 0.15) {
  const num = parseInt(hex.replace("#", ""), 16);
  const r = Math.max(0, Math.min(255, ((num >> 16) & 0xFF) - Math.round(255 * amount)));
  const g = Math.max(0, Math.min(255, ((num >> 8) & 0xFF) - Math.round(255 * amount)));
  const b = Math.max(0, Math.min(255, (num & 0xFF) - Math.round(255 * amount)));
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

// ---------------------------------------------------------------------------
// String & Path Sanitization
// ---------------------------------------------------------------------------

/** Replaces characters that are invalid or problematic in file paths. */
function sanitizeFilename(name) {
  if (!name) return "untitled";
  const cleaned = name
    .replace(/[\u0000-\u001F\u007F]/g, "")                          // control chars
    .replace(/[\u200B-\u200D\uFEFF]/g, "")                          // zero-width chars
    .replace(/\u00A0/g, " ")                                          // non-breaking space
    .replace(/[/\\?%*:|"<>]/g, "-")                                   // OS-reserved chars
    .replace(/^\.+/, "")                                              // leading dots
    .replace(/[. ]+$/, "")                                            // trailing dots/spaces
    .replace(/^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(\.|$)/i, "_$1$2") // Windows reserved names
    .trim();
  return cleaned || "untitled";
}

/** Strips script tags from HTML to prevent XSS when opening exported files. */
function sanitizeHtml(html) {
  return html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
}

/** Wraps content in a minimal HTML page and returns a data-URI. */
function toHtmlDataUri(title, body) {
  const safeBody = sanitizeHtml(body);
  const html = `<html><head><title>${title}</title></head><body><h1>${title}</h1>${safeBody}</body></html>`;
  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
}

// ---------------------------------------------------------------------------
// Pagination Parsing
// ---------------------------------------------------------------------------

/**
 * Parses a Link header and returns the URL for the "next" page, or null.
 * Canvas API uses RFC 5988 Link headers for pagination.
 *
 * @param {string|null} linkHeader - The raw Link header value
 * @returns {string|null} The next page URL, or null if there is none
 */
function parsePaginationLink(linkHeader) {
  if (!linkHeader) return null;
  const nextLink = linkHeader.split(",").find((s) => s.includes('rel="next"'));
  return nextLink ? nextLink.match(/<([^>]+)>/)?.[1] ?? null : null;
}

// ---------------------------------------------------------------------------
// Path Length Safety
// ---------------------------------------------------------------------------

/**
 * Truncates a filename to fit within maxPath characters when combined with
 * the course name and file path. Preserves the file extension.
 *
 * @param {string} filename - The original filename
 * @param {string} courseName - Sanitized course name
 * @param {string} filePath - The file's subdirectory path
 * @param {number} maxPath - Maximum total path length (default 250)
 * @returns {string} The possibly-truncated filename
 */
function truncateFilename(filename, courseName, filePath, maxPath = 250) {
  const fullLen = courseName.length + 1 + filePath.length + filename.length;
  if (fullLen <= maxPath) return filename;

  const ext = filename.includes(".") ? filename.slice(filename.lastIndexOf(".")) : "";
  const maxName = maxPath - courseName.length - 1 - filePath.length - ext.length;
  if (maxName > 10) {
    return filename.slice(0, maxName) + ext;
  }
  return filename;
}
