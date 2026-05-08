import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { del, list, put } from "@vercel/blob";

const DEFAULT_SUBMODULE_DIR = "hsol-info-blob/vault";
const DEFAULT_PREFIX = "info/vault";
const IGNORED_FILENAMES = new Set([".DS_Store", ".DS-Store", ".blob-sync-state.json"]);

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    submoduleDir: process.env.BLOB_SUBMODULE_DIR || DEFAULT_SUBMODULE_DIR,
    prefix: process.env.BLOB_PATH_PREFIX || DEFAULT_PREFIX,
    access: process.env.BLOB_ACCESS || "private",
    dryRun: false,
    prune: true,
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--submodule-dir") options.submoduleDir = args[++i];
    else if (arg === "--prefix") options.prefix = args[++i];
    else if (arg === "--dry-run") options.dryRun = true;
    else if (arg === "--no-prune") options.prune = false;
  }

  return options;
}

async function collectFiles(rootDir, currentDir = rootDir) {
  const entries = await readdir(currentDir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.name === ".git") continue;
    if (IGNORED_FILENAMES.has(entry.name)) continue;
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

async function listAllBlobs(prefix, token) {
  let cursor;
  const blobs = [];

  do {
    const page = await list({
      prefix,
      cursor,
      token,
      limit: 1000,
    });
    blobs.push(...page.blobs);
    cursor = page.cursor;
  } while (cursor);

  return blobs;
}

async function main() {
  const { submoduleDir, prefix, access, dryRun, prune } = parseArgs();
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  const normalizedPrefix = prefix.replace(/^\/+|\/+$/g, "");
  const normalizedPrefixWithSlash = `${normalizedPrefix}/`;
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
  const localBlobPaths = new Set();
  for (const absolutePath of files) {
    const relativePath = path.relative(rootDir, absolutePath);
    const blobPath = toPosixPath(path.posix.join(normalizedPrefix, toPosixPath(relativePath)));
    localBlobPaths.add(blobPath);
    if (dryRun) {
      console.log(`[dry-run] ${relativePath} -> ${blobPath}`);
      continue;
    }

    const data = await readFile(absolutePath);
    const result = await put(blobPath, data, {
      access,
      addRandomSuffix: false,
      token,
    });

    console.log(`업로드 완료: ${blobPath} -> ${result.url}`);
  }

  if (!prune) return;

  const remoteBlobs = await listAllBlobs(normalizedPrefixWithSlash, token);
  const stalePathnames = remoteBlobs
    .map((blob) => blob.pathname)
    .filter((pathname) => !localBlobPaths.has(pathname));

  if (stalePathnames.length === 0) {
    console.log("삭제 반영: 제거할 Blob 파일이 없습니다.");
    return;
  }

  if (dryRun) {
    for (const pathname of stalePathnames) {
      console.log(`[dry-run] delete ${pathname}`);
    }
    return;
  }

  for (const pathname of stalePathnames) {
    await del(pathname, { token });
    console.log(`삭제 반영 완료: ${pathname}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
