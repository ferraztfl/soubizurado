/**
 * Where to go after signing in (`?next=`). Only paths inside this site are
 * accepted — never another host ("//evil.com", "https://…", "/\\evil.com").
 */
export function safeNextPath(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 200) return null;
  if (!/^\/(?![/\\])[A-Za-z0-9\-._~/?=&%]*$/.test(value)) return null;
  return value;
}
