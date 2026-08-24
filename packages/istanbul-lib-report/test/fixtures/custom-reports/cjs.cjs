"use strict";
// A classic CommonJS custom report, as written for istanbuljs for years.
module.exports = class CjsReport {
  constructor(opts) {
    this.opts = opts;
    this.lines = [];
  }
  onStart() {
    this.lines.push("start cjs");
  }
  onEnd() {
    this.lines.push("end cjs");
  }
};
