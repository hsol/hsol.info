import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { del, list, put } from "@vercel/blob";

const execFileAsync = promisify(execFile);
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

function shouldIgnoreRelativePath(relativePath) {
  const normalized = relativePath.replace(/\\/g, "/");
  const filename = normalized.split("/").pop() ?? "";
  return IGNORED_FILENAMES.has(filename);
}

async function resolveDiffTargets(rootDir) {
  const baseSha = process.env.GIT_DIFF_BASE_SHA;
  const headSha = process.env.GIT_DIFF_HEAD_SHA;
  if (!baseSha || !headSha || /^0+$/.test(baseSha)) {
    return { useDiff: false, uploadRelativePaths: [], deleteRelativePaths: [] };
  }

  const submoduleRel = toPosixPath(path.relative(process.cwd(), rootDir));
  if (!submoduleRel || submoduleRel.startsWith("..")) {
    return { useDiff: false, uploadRelativePaths: [], deleteRelativePaths: [] };
  }

  const { stdout } = await execFileAsync(
    "git",
    ["diff", "--name-status", baseSha, headSha, "--", submoduleRel],
    { cwd: process.cwd() },
  );

  const uploadSet = new Set();
  const deleteSet = new Set();
  const lines = stdout.split("\n").map((line) => line.trim()).filter(Boolean);
  for (const line of lines) {
    const cols = line.split("\t");
    const status = cols[0] ?? "";
    if (status.startsWith("R")) {
      const oldPath = cols[1];
      const newPath = cols[2];
      if (oldPath?.startsWith(`${submoduleRel}/`)) {
        const rel = oldPath.slice(submoduleRel.length + 1);
        if (!shouldIgnoreRelativePath(rel)) deleteSet.add(rel);
      }
      if (newPath?.startsWith(`${submoduleRel}/`)) {
        const rel = newPath.slice(submoduleRel.length + 1);
        if (!shouldIgnoreRelativePath(rel)) uploadSet.add(rel);
      }
      continue;
    }

    const targetPath = cols[1];
    if (!targetPath || !targetPath.startsWith(`${submoduleRel}/`)) continue;
    const rel = targetPath.slice(submoduleRel.length + 1);
    if (shouldIgnoreRelativePath(rel)) continue;
    if (status.startsWith("D")) deleteSet.add(rel);
    else uploadSet.add(rel);
  }

  return {
    useDiff: true,
    uploadRelativePaths: [...uploadSet],
    deleteRelativePaths: [...deleteSet],
  };
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

  const diffTargets = await resolveDiffTargets(rootDir).catch(() => ({
    useDiff: false,
    uploadRelativePaths: [],
    deleteRelativePaths: [],
  }));
  const files = diffTargets.useDiff
    ? diffTargets.uploadRelativePaths.map((relativePath) => path.join(rootDir, relativePath))
    : await collectFiles(rootDir);

  if (diffTargets.useDiff) {
    console.log(
      `변경분 동기화 모드: 업로드 ${files.length}건, 삭제 ${diffTargets.deleteRelativePaths.length}건`,
    );
  }
  if (files.length === 0 && (!diffTargets.useDiff || diffTargets.deleteRelativePaths.length === 0)) {
    console.log("업로드/삭제할 파일이 없습니다.");
    return;
  }

  console.log(`대상 파일 수: ${files.length}`);
  const localBlobPaths = new Set();
  for (const absolutePath of files) {
    const relativePath = path.relative(rootDir, absolutePath);
    if (shouldIgnoreRelativePath(relativePath)) continue;
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
      allowOverwrite: true,
      token,
    });

    console.log(`업로드 완료: ${blobPath} -> ${result.url}`);
  }

  if (diffTargets.useDiff && diffTargets.deleteRelativePaths.length > 0) {
    for (const relativePath of diffTargets.deleteRelativePaths) {
      const blobPath = toPosixPath(path.posix.join(normalizedPrefix, toPosixPath(relativePath)));
      if (dryRun) {
        console.log(`[dry-run] delete ${blobPath}`);
        continue;
      }
      await del(blobPath, { token });
      console.log(`삭제 반영 완료: ${blobPath}`);
    }
  }

  if (diffTargets.useDiff) return;
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
