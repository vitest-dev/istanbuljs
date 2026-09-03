/** POSIX-ify slashes; keep a leading `/` so absolute Unix paths stay absolute. */
export function posixify(filePath: string): string {
  return filePath.replaceAll("\\", "/");
}

/** Trim trailing slashes but keep filesystem root as `/`. */
function normalizeRoot(projectRoot: string): string {
  const posix = posixify(projectRoot);
  if (posix === "/" || /^[/\\]+$/.test(posix)) {
    return "/";
  }
  return posix.replace(/\/+$/, "");
}

/** Strip `projectRoot/` prefix so UI paths are project-relative. */
export function toRelativePath(filePath: string, projectRoot: string): string {
  const abs = posixify(filePath);
  const root = normalizeRoot(projectRoot);
  if (!root) {
    return abs;
  }
  if (abs === root) {
    return "";
  }
  if (root === "/") {
    return abs.startsWith("/") ? abs.slice(1) : abs;
  }
  const prefix = `${root}/`;
  return abs.startsWith(prefix) ? abs.slice(prefix.length) : abs;
}

export function toAbsolutePath(relPath: string, projectRoot: string): string {
  const rel = posixify(relPath).replace(/^\//, "");
  const root = normalizeRoot(projectRoot);
  if (!root) {
    return rel;
  }
  if (!rel) {
    return root;
  }
  if (root === "/") {
    return `/${rel}`;
  }
  return `${root}/${rel}`;
}

/** Last path segment of `projectRoot`, used as the report display name. */
export function projectRootBaseName(projectRoot: string): string {
  const root = normalizeRoot(projectRoot);
  if (!root || root === "/") {
    return "Coverage";
  }
  const parts = root.split("/").filter(Boolean);
  return parts[parts.length - 1] ?? "Coverage";
}

export function resolveSource(
  sources: Record<string, string>,
  relPath: string,
  projectRoot: string,
): string {
  const abs = toAbsolutePath(relPath, projectRoot);
  const direct = sources[abs] ?? sources[relPath];
  if (direct !== undefined) {
    return direct;
  }

  const needle = posixify(relPath);
  if (!needle) {
    return "";
  }

  for (const [key, src] of Object.entries(sources)) {
    const normalized = posixify(key);
    if (normalized === posixify(abs) || normalized.endsWith(`/${needle}`)) {
      return src;
    }
  }

  return "";
}
