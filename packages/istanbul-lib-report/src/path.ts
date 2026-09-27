/*
 Copyright 2012-2015, Yahoo Inc.
 Copyrights licensed under the New BSD License. See the accompanying LICENSE file for terms.
 */
import path from "node:path";

type PathParser = (path: string) => path.ParsedPath;

let parsePath: PathParser = path.parse;
let SEP: string = path.sep;
const origParser = parsePath;
const origSep = SEP;

function makeRelativeNormalizedPath(str: string, sep: string): string[] {
  const parsed = parsePath(str);
  let root = parsed.root;
  let dir: string | string[];
  let file = parsed.base;
  let quoted: RegExp;
  let pos: number;

  // handle a weird windows case separately
  if (sep === "\\") {
    pos = root.indexOf(":\\");
    if (pos >= 0) {
      root = root.substring(0, pos + 2);
    }
  }
  dir = parsed.dir.substring(root.length);

  if (str === "") {
    return [];
  }

  if (sep !== "/") {
    quoted = new RegExp(sep.replace(/\W/g, "\\$&"), "g");
    dir = dir.replace(quoted, "/");
    file = file.replace(quoted, "/"); // excessively paranoid?
  }

  if (dir !== "") {
    dir = `${dir}/${file}`;
  } else {
    dir = file;
  }
  if (dir.substring(0, 1) === "/") {
    dir = dir.substring(1);
  }
  dir = dir.split(/\/+/);
  return dir;
}

class Path {
  declare v: string[];

  declare readonly length: number;
  declare push: (...items: string[]) => number;
  declare pop: () => string | undefined;
  declare shift: () => string | undefined;
  declare unshift: (...items: string[]) => number;
  declare splice: (start: number, deleteCount?: number, ...items: string[]) => string[];

  constructor(strOrArray: string | string[]) {
    if (Array.isArray(strOrArray)) {
      this.v = strOrArray;
    } else if (typeof strOrArray === "string") {
      this.v = makeRelativeNormalizedPath(strOrArray, SEP);
    } else {
      throw new Error(`Invalid Path argument must be string or array:${strOrArray}`);
    }
  }

  toString(): string {
    return this.v.join("/");
  }

  hasParent(): boolean {
    return this.v.length > 0;
  }

  parent(): Path {
    if (!this.hasParent()) {
      throw new Error("Unable to get parent for 0 elem path");
    }
    const p = this.v.slice();
    p.pop();
    return new Path(p);
  }

  elements(): string[] {
    return this.v.slice();
  }

  name(): string {
    return this.v.slice(-1)[0];
  }

  contains(other: Path): boolean {
    let i;
    if (other.length > this.length) {
      return false;
    }
    for (i = 0; i < other.length; i += 1) {
      if (this.v[i] !== other.v[i]) {
        return false;
      }
    }
    return true;
  }

  ancestorOf(other: Path): boolean {
    return other.contains(this) && other.length !== this.length;
  }

  descendantOf(other: Path): boolean {
    return this.contains(other) && other.length !== this.length;
  }

  commonPrefixPath(other: Path): Path {
    const len = this.length > other.length ? other.length : this.length;
    let i;
    const ret = [];

    for (i = 0; i < len; i += 1) {
      if (this.v[i] === other.v[i]) {
        ret.push(this.v[i]);
      } else {
        break;
      }
    }
    return new Path(ret);
  }

  static findCommonParent(paths: Path[]): Path {
    return paths.reduce((common, path) => common.commonPrefixPath(path), paths[0] ?? new Path([]));
  }

  static compare(a: Path, b: Path): number {
    const al = a.length;
    const bl = b.length;

    if (al < bl) {
      return -1;
    }

    if (al > bl) {
      return 1;
    }

    const astr = a.toString();
    const bstr = b.toString();
    return astr < bstr ? -1 : astr > bstr ? 1 : 0;
  }

  static tester = {
    setParserAndSep(p: PathParser, sep: string) {
      parsePath = p;
      SEP = sep;
    },
    reset() {
      parsePath = origParser;
      SEP = origSep;
    },
  };
}

(["push", "pop", "shift", "unshift", "splice"] as const).forEach((fn) => {
  Object.defineProperty(Path.prototype, fn, {
    value(this: Path, ...args: unknown[]) {
      return (this.v[fn] as (...args: unknown[]) => unknown).apply(this.v, args);
    },
  });
});

Object.defineProperty(Path.prototype, "length", {
  enumerable: true,
  get(this: Path) {
    return this.v.length;
  },
});

export default Path;
