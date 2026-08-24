import fs from "node:fs";
import path from "node:path";

import { describe, it, assert, beforeEach, afterEach, afterAll, vi } from "vitest";

import FileWriter, { supportsColor } from "../src/file-writer";

const dataDir = path.resolve(import.meta.dirname, ".data");

describe("file-writer", () => {
  let writer: FileWriter;

  beforeEach(() => {
    fs.mkdirSync(dataDir, { recursive: true });
    writer = new FileWriter(dataDir);
  });

  afterEach(() => {
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  it("returns a content writer for file", () => {
    const cw = writer.writeFile("foo/bar.txt");
    cw.println("hello");
    assert.equal("foo", cw.colorize("foo", "unknown"));
    cw.close();
    assert.equal(fs.readFileSync(path.resolve(dataDir, "foo/bar.txt"), "utf8"), "hello\n");
  });

  it("returns a console writer for terminal", () => {
    const cw = writer.writeFile("-");
    cw.println("hello");
    assert.equal("foo", cw.colorize("foo"));
    cw.close();
  });

  it("copies files", () => {
    writer.copyFile(import.meta.filename, "out.txt");
    assert.equal(
      fs.readFileSync(path.resolve(dataDir, "out.txt"), "utf8"),
      fs.readFileSync(import.meta.filename, "utf8"),
    );
  });

  it("copies binary files", () => {
    const testBuffer = Buffer.from([195, 40]);
    fs.writeFileSync(path.resolve(dataDir, "in.bin"), testBuffer);
    writer.copyFile(path.resolve(dataDir, "in.bin"), "out.bin");
    assert.equal(Buffer.compare(fs.readFileSync(path.resolve(dataDir, "out.bin")), testBuffer), 0);
  });

  it("copies files while adding headers", () => {
    const header = "/* This is some header text, like a copyright or directive. */\n";
    writer.copyFile(import.meta.filename, "out.txt", header);
    assert.equal(
      fs.readFileSync(path.resolve(dataDir, "out.txt"), "utf8"),
      header + fs.readFileSync(import.meta.filename, "utf8"),
    );
  });

  it("provides writers for subdirs", () => {
    const w = writer.writerForDir("foo");
    const cw = w.writeFile("bar.txt");
    cw.println("hello");
    cw.close();
    assert.equal(fs.readFileSync(path.resolve(dataDir, "foo/bar.txt"), "utf8"), "hello\n");
  });

  it("requires an initial path", () => {
    assert.throws(() => new (FileWriter as unknown as new () => FileWriter)());
  });

  it("barfs on absolute paths", () => {
    assert.throws(() => {
      writer.writeFile(import.meta.filename);
    });
    assert.throws(() => {
      writer.copyFile(import.meta.filename, import.meta.filename);
    });
    assert.throws(() => {
      writer.writerForDir(import.meta.dirname);
    });
  });
});

describe("supportsColor", () => {
  afterAll(() => {
    vi.unstubAllEnvs();
  });

  const tty = { isTTY: true, hasColors: () => true } as unknown as NodeJS.WriteStream;
  const pipe = { isTTY: false } as unknown as NodeJS.WriteStream;

  it("uses colors for a tty that supports them", () => {
    assert.isTrue(supportsColor(tty, {}));
    assert.isFalse(supportsColor({ ...tty, hasColors: () => false } as NodeJS.WriteStream, {}));
  });

  it("does not use colors when the stream is not a tty", () => {
    assert.isFalse(supportsColor(pipe, {}));
  });

  it("honors FORCE_COLOR even when the stream is not a tty", () => {
    assert.isTrue(supportsColor(pipe, { FORCE_COLOR: "1" }));
    assert.isTrue(supportsColor(pipe, { FORCE_COLOR: "" }));
    assert.isTrue(supportsColor(pipe, { FORCE_COLOR: "true" }));
    assert.isFalse(supportsColor(tty, { FORCE_COLOR: "0" }));
    assert.isFalse(supportsColor(tty, { FORCE_COLOR: "false" }));
  });

  it("honors NO_COLOR and NODE_DISABLE_COLORS", () => {
    assert.isFalse(supportsColor(tty, { NO_COLOR: "1" }));
    assert.isFalse(supportsColor(tty, { NO_COLOR: "" }));
    assert.isFalse(supportsColor(tty, { NODE_DISABLE_COLORS: "1" }));
    // FORCE_COLOR takes precedence
    assert.isTrue(supportsColor(pipe, { NO_COLOR: "1", FORCE_COLOR: "1" }));
  });

  it("colorizes console output according to FORCE_COLOR", () => {
    const cw = new FileWriter("/").writeFile("-");
    vi.stubEnv("FORCE_COLOR", "1");
    assert.equal(cw.colorize("foo", "low"), "\u001b[31;1mfoo\u001b[0m");
    assert.equal(cw.colorize("foo", "unknown"), "foo");
    vi.stubEnv("FORCE_COLOR", "0");
    assert.equal(cw.colorize("foo", "low"), "foo");
  });
});
