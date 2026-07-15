const fs = require("fs");
const { spawn } = require("child_process");
const { generateCssModule } = require("./build.cjs");

generateCssModule();

fs.watch("src/jist.css", () => {
  generateCssModule();
});

spawn("npx", ["tsc", "--watch", "--preserveWatchOutput"], {
  stdio: "inherit",
  shell: true,
});

spawn("npx", ["serve", ".", "-l", "0", "--no-clipboard"], {
  stdio: "inherit",
  shell: true,
});
