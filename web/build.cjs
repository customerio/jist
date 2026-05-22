const fs = require("fs");
const { execSync } = require("child_process");

function generateCssModule() {
  const css = fs.readFileSync("src/jist.css", "utf8");
  const escaped = css.replace(/`/g, "\\`").replace(/\$/g, "\\$");
  fs.writeFileSync("src/jist-css.ts", `export default \`${escaped}\`;\n`);
}

generateCssModule();
execSync("tsc", { stdio: "inherit" });

fs.copyFileSync("src/jist.css", "dist/jist.css");
fs.copyFileSync("../LICENSE", "dist/LICENSE");

module.exports = { generateCssModule };
