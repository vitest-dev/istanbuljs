import { gzipSync } from "node:zlib";

export function compress(jsonstring: string): string {
  const gzip = gzipSync(jsonstring, { level: 9 });
  return gzip.toString("base64");
}
