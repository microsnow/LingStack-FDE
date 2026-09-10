/** Tools whose use should not be recorded in browser history. */
export const sensitiveToolIds = new Set([
  "jwt",
  "password",
  "aes-encrypt",
  "aes-decrypt",
  "des-encrypt",
  "des-decrypt",
  "tripledes-encrypt",
  "tripledes-decrypt",
  "rabbit-encrypt",
  "rabbit-decrypt",
  "rc4-encrypt",
  "rc4-decrypt",
]);

export function nextRecentTools(current: string[], selected: string, limit = 8) {
  if (sensitiveToolIds.has(selected)) return current;
  return [selected, ...current.filter(id => id !== selected)].slice(0, limit);
}
