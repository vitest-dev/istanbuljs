const HASH_PREFIX = "#/";

function hashesEqual(left: string, right: string): boolean {
  return normalizeHash(left) === normalizeHash(right);
}

function normalizeHash(hash: string): string {
  if (hash === "" || hash === "#" || hash === "#/") {
    return "#/";
  }
  return hash;
}

/** `src/utils.ts` → `#/src/utils.ts` */
export function pathToHash(path: string): string {
  if (path === "") {
    return HASH_PREFIX;
  }
  return `${HASH_PREFIX}${path.split("/").map(encodeURIComponent).join("/")}`;
}

/** `#/src/utils.ts` → `src/utils.ts` */
export function hashToPath(hash: string): string {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  const withoutQuery = (raw.split("?")[0] ?? "").replace(/^\/+/, "").replace(/\/+$/, "");
  if (withoutQuery === "") {
    return "";
  }
  return withoutQuery.split("/").map(decodeURIComponent).join("/");
}

export function readHashPath(): string {
  if (typeof window === "undefined") {
    return "";
  }
  return hashToPath(window.location.hash);
}

export function writeHashPath(path: string): void {
  if (typeof window === "undefined") {
    return;
  }
  const next = pathToHash(path);
  if (hashesEqual(window.location.hash, next)) {
    return;
  }
  window.location.hash = next;
}
