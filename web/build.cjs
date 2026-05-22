const fs = require("fs");
const { execSync } = require("child_process");

const css = fs.readFileSync("src/jist.css", "utf8");
const escaped = css.replace(/`/g, "\\`").replace(/\$/g, "\\$");
fs.writeFileSync("src/jist-css.ts", `export default \`${escaped}\`;\n`);

execSync("tsc", { stdio: "inherit" });

fs.copyFileSync("src/jist.css", "dist/jist.css");
fs.copyFileSync("../LICENSE", "dist/LICENSE");
