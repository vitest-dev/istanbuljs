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
