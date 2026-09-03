import Path from "../../path";

/** Map a coverage file path to {@link Path}, including Windows drive paths on any platform. */
function filePathToPath(filePath: string): Path {
  const normalized = filePath.replaceAll("\\", "/");
  if (/^[A-Za-z]:(?:\/|$)/.test(normalized)) {
    const withoutDrive = normalized.replace(/^[A-Za-z]:\/?/, "");
    const segments = withoutDrive ? withoutDrive.split("/").filter(Boolean) : [];
    return new Path(segments);
  }

  return new Path(filePath);
}

/** Restore a filesystem path prefix dropped by {@link Path} (POSIX `/` or Windows drive). */
function formatProjectRoot(common: Path, filePaths: string[]): string {
  const relative = common.toString();
  const sample = filePaths[0]!.replaceAll("\\", "/");

  const driveMatch = sample.match(/^([A-Za-z]:)(?:\/|$)/);
  if (driveMatch) {
    return relative ? `${driveMatch[1]}/${relative}` : driveMatch[1];
  }

  if (sample.startsWith("/")) {
    return relative ? `/${relative}` : "/";
  }

  return relative;
}

/**
 * Infer project root from coverage file paths: the common parent directory
 * of all file paths (same algorithm as SummarizerFactory `_commonParent`).
 * Returns `undefined` when there is no useful shared prefix.
 */
export function inferProjectRoot(filePaths: string[]): string | undefined {
  if (filePaths.length === 0) {
    return undefined;
  }

  const parentPaths = filePaths.map((filePath) => filePathToPath(filePath).parent());
  const common = Path.findCommonParent(parentPaths);
  if (common.length === 0) {
    return undefined;
  }

  return formatProjectRoot(common, filePaths);
}

export function resolveProjectRoot(filePaths: string[], explicit?: string): string {
  if (explicit !== undefined && explicit !== "") {
    return explicit;
  }

  return inferProjectRoot(filePaths) || process.cwd();
}
