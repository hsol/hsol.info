import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { put } from "@vercel/blob";

const DEFAULT_SUBMODULE_DIR = "hsol-info-blob";
const DEFAULT_PREFIX = "info";

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    submoduleDir: process.env.BLOB_SUBMODULE_DIR || DEFAULT_SUBMODULE_DIR,
    prefix: process.env.BLOB_PATH_PREFIX || DEFAULT_PREFIX,
    dryRun: false,
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--submodule-dir") options.submoduleDir = args[++i];
    else if (arg === "--prefix") options.prefix = args[++i];
    else if (arg === "--dry-run") options.dryRun = true;
  }

  return options;
}

async function collectFiles(rootDir, currentDir = rootDir) {
  const entries = await readdir(currentDir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.name === ".git") continue;
    const fullPath = path.join(currentDir, entry.name);
    if (entry.isDirectory()) {
      const nested = await collectFiles(rootDir, fullPath);
      files.push(...nested);
      continue;
    }

    if (entry.isFile()) {
      files.push(fullPath);
    }
  }

  return files;
}

function toPosixPath(filePath) {
  return filePath.split(path.sep).join("/");
}

async function main() {
  const { submoduleDir, prefix, dryRun } = parseArgs();
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  const normalizedPrefix = prefix.replace(/^\/+|\/+$/g, "");
  const rootDir = path.resolve(process.cwd(), submoduleDir);

  if (!token && !dryRun) {
    throw new Error("BLOB_READ_WRITE_TOKEN 환경변수가 필요합니다.");
  }

  const files = await collectFiles(rootDir);
  if (files.length === 0) {
    console.log("업로드할 파일이 없습니다.");
    return;
  }

  console.log(`대상 파일 수: ${files.length}`);
  for (const absolutePath of files) {
    const relativePath = path.relative(rootDir, absolutePath);
    const blobPath = toPosixPath(path.posix.join(normalizedPrefix, toPosixPath(relativePath)));
    if (dryRun) {
      console.log(`[dry-run] ${relativePath} -> ${blobPath}`);
      continue;
    }

    const data = await readFile(absolutePath);
    const result = await put(blobPath, data, {
      access: "public",
      addRandomSuffix: false,
      token,
    });

    console.log(`업로드 완료: ${blobPath} -> ${result.url}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
