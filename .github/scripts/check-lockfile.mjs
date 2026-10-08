#!/usr/bin/env node
// Fail when package.json and package-lock.json disagree about the direct
// dependencies. This is the drift that makes `npm ci` fail for everyone once a
// hand-edited package.json reaches main, so the comparison is done on the data
// rather than by re-running an install: `npm install --package-lock-only`
// rewrites lockfiles differently across npm majors and would produce false
// failures.
import { readFileSync } from "node:fs";

const here = new URL(".", import.meta.url);
const pkg = JSON.parse(readFileSync(new URL("../../package.json", here), "utf8"));
const lock = JSON.parse(readFileSync(new URL("../../package-lock.json", here), "utf8"));

const root = lock.packages && lock.packages[""];
if (!root) {
  console.error("::error::package-lock.json has no root package entry; run `npm install` and commit it.");
  process.exit(1);
}

const FIELDS = ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"];
let failed = false;

for (const field of FIELDS) {
  const declared = pkg[field] || {};
  const locked = root[field] || {};

  for (const [name, range] of Object.entries(declared)) {
    if (!(name in locked)) {
      console.error(`::error::${name}@${range} is declared in package.json ${field} but is missing from package-lock.json.`);
      failed = true;
    } else if (locked[name] !== range) {
      console.error(`::error::${name} is ${range} in package.json but ${locked[name]} in package-lock.json.`);
      failed = true;
    }
  }

  for (const name of Object.keys(locked)) {
    if (!(name in declared)) {
      console.error(`::error::${name} is listed in package-lock.json ${field} but not in package.json.`);
      failed = true;
    }
  }
}

if (failed) {
  console.error("Run `npm install` locally and commit the regenerated package-lock.json.");
  process.exit(1);
}

console.log("package-lock.json is in sync with package.json.");
