import { includeIgnoreFile } from "@eslint/compat";
import prettier from "eslint-config-prettier";
import path from "node:path";
import { fileURLToPath } from "node:url";

const gitignorePath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".gitignore"
);

export default [includeIgnoreFile(gitignorePath), prettier];
