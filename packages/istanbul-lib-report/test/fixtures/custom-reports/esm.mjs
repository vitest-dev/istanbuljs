export default class EsmReport {
  constructor(opts) {
    this.opts = opts;
    this.lines = [];
  }
  onStart() {
    this.lines.push("start esm");
  }
  onEnd() {
    this.lines.push("end esm");
  }
}
