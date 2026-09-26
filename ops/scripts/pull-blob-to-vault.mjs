/**
 * hsol-info-blob 전용: Vercel Blob prefix에서 로컬 vault로 내려받기(증분 + 상태 파일).
 * 로컬 개발 시 이 저장소 루트에서 실행한다.
 */
import { access, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { list } from "@vercel/blob";

const DEFAULT_VAULT_DIR = "vault";
const DEFAULT_PREFIX = "info/vault";
const SYNC_STATE_FILE = ".blob-sync-state.json";
const IGNORED_FILENAMES = new Set([".DS_Store", ".DS-Store"]);

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    vaultDir: process.env.BLOB_VAULT_DIR || DEFAULT_VAULT_DIR,
    prefix: process.env.BLOB_PATH_PREFIX || DEFAULT_PREFIX,
    clean: false,
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--vault-dir") options.vaultDir = args[++i];
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

function shouldIgnoreRelativePath(relativePath) {
  const normalized = relativePath.replace(/\\/g, "/");
  const filename = normalized.split("/").pop() ?? "";
  return IGNORED_FILENAMES.has(filename);
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
  const { vaultDir, prefix, clean } = parseArgs();
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    throw new Error("BLOB_READ_WRITE_TOKEN 환경변수가 필요합니다.");
  }

  const normalizedPrefix = `${prefix.replace(/^\/+|\/+$/g, "")}/`;
  const vaultRoot = path.resolve(process.cwd(), vaultDir);
  const statePath = path.join(vaultRoot, SYNC_STATE_FILE);
  await mkdir(vaultRoot, { recursive: true });
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
    if (shouldIgnoreRelativePath(relativePath)) {
      console.log(`무시됨(시스템 파일): ${toPosixPath(relativePath)}`);
      continue;
    }

    const destinationPath = path.join(vaultRoot, relativePath);
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
    const localFiles = await collectFiles(vaultRoot);
    for (const localFile of localFiles) {
      const resolved = path.resolve(localFile);
      if (!expectedLocalPaths.has(resolved)) {
        await rm(localFile, { force: true });
        const rel = path.relative(vaultRoot, localFile);
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
