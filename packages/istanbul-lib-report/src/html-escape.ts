const ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  "'": "&#39;",
  '"': "&quot;",
};

/**
 * escapes a string for safe use in HTML text and attribute values
 * @param {String} value the string to escape
 * @returns {String} the escaped string
 */
export function escape(value: string): string {
  return String(value).replace(/[&<>'"]/g, (char) => ESCAPES[char]);
}
