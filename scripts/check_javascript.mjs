import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

function check(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) check(file);
    else if (entry.name.endsWith(".js")) new vm.Script(fs.readFileSync(file, "utf8"), { filename: file });
  }
}
check("docs");
console.log("All public JavaScript files passed syntax validation.");
