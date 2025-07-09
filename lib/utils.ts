/**
 * Decodes HTML entities in a string
 * Handles common entities like &#39; &quot; &amp; etc.
 */
export function decodeHtmlEntities(str: string): string {
  if (!str) return str;

  // Create a temporary DOM element to leverage browser's built-in decoding
  if (typeof document !== "undefined") {
    const element = document.createElement("div");
    element.innerHTML = str;
    return element.textContent || element.innerText || str;
  }

  // Fallback for server-side rendering - handle common entities manually
  const entities: { [key: string]: string } = {
    "&#39;": "'",
    "&quot;": '"',
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&nbsp;": " ",
    "&#x27;": "'",
    "&#x2F;": "/",
    "&#x60;": "`",
    "&#x3D;": "=",
  };

  return str.replace(/&#?\w+;/g, (match) => entities[match] || match);
}
