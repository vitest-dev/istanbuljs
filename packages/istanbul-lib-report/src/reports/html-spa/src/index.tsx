// The entry point for the spa running on the summary page
import { render } from "preact";

import App from "./app";

render(<App />, document.getElementById("app")!);
