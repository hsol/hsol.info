import { access, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { list } from "@vercel/blob";

const DEFAULT_SUBMODULE_DIR = "hsol-info-blob";
const DEFAULT_PREFIX = "info";
const SYNC_STATE_FILE = ".blob-sync-state.json";

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    submoduleDir: process.env.BLOB_SUBMODULE_DIR || DEFAULT_SUBMODULE_DIR,
    prefix: process.env.BLOB_PATH_PREFIX || DEFAULT_PREFIX,
    clean: false,
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--submodule-dir") options.submoduleDir = args[++i];
    else if (arg === "--prefix") options.prefix = args[++i];
    else if (arg === "--clean") options.clean = true;
  }

  return options;
}

function toPosixPath(filePath) {
  return filePath.split(path.sep).join("/");
}

async function pathExists(targetPath) {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function loadSyncState(statePath) {
  try {
    const raw = await readFile(statePath, "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    return parsed;
  } catch {
    return {};
  }
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
  const { submoduleDir, prefix, clean } = parseArgs();
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    throw new Error("BLOB_READ_WRITE_TOKEN 환경변수가 필요합니다.");
  }

  const normalizedPrefix = `${prefix.replace(/^\/+|\/+$/g, "")}/`;
  const submoduleRoot = path.resolve(process.cwd(), submoduleDir);
  const statePath = path.join(submoduleRoot, SYNC_STATE_FILE);
  await mkdir(submoduleRoot, { recursive: true });
  const previousState = await loadSyncState(statePath);
  const nextState = {};

  const blobs = await listAllBlobs(normalizedPrefix, token);
  if (blobs.length === 0) {
    console.log(`prefix(${normalizedPrefix}) 하위에 Blob 파일이 없습니다.`);
    return;
  }

  const expectedLocalPaths = new Set();
  let downloadedCount = 0;
  let skippedCount = 0;
  for (const blob of blobs) {
    const relativePath = blob.pathname.slice(normalizedPrefix.length);
    if (!relativePath) continue;

    const destinationPath = path.join(submoduleRoot, relativePath);
    const destinationResolved = path.resolve(destinationPath);
    expectedLocalPaths.add(path.resolve(destinationPath));
    const blobTimestamp = blob.uploadedAt
      ? new Date(blob.uploadedAt).toISOString()
      : "";
    const previousTimestamp = previousState[relativePath];
    const alreadyExists = await pathExists(destinationResolved);
    if (blobTimestamp && previousTimestamp === blobTimestamp && alreadyExists) {
      nextState[relativePath] = blobTimestamp;
      skippedCount += 1;
      continue;
    }

    await mkdir(path.dirname(destinationPath), { recursive: true });
    const response = await fetch(blob.url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) {
      throw new Error(`Blob 다운로드 실패: ${blob.url} (${response.status})`);
    }

    const content = Buffer.from(await response.arrayBuffer());
    await writeFile(destinationPath, content);
    nextState[relativePath] = blobTimestamp || previousTimestamp || "";
    downloadedCount += 1;
    console.log(`다운로드 완료: ${toPosixPath(relativePath)}`);
  }

  if (clean) {
    const localFiles = await collectFiles(submoduleRoot);
    for (const localFile of localFiles) {
      const resolved = path.resolve(localFile);
      if (!expectedLocalPaths.has(resolved)) {
        await rm(localFile, { force: true });
        const rel = path.relative(submoduleRoot, localFile);
        console.log(`로컬 정리: ${toPosixPath(rel)}`);
      }
    }
  }

  await writeFile(statePath, `${JSON.stringify(nextState, null, 2)}\n`);
  console.log(`증분 동기화 완료: 다운로드 ${downloadedCount}건, 스킵 ${skippedCount}건`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
