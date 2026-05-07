import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { list } from "@vercel/blob";

const DEFAULT_SUBMODULE_DIR = "hsol-info-blob";
const DEFAULT_PREFIX = "info";

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
  await mkdir(submoduleRoot, { recursive: true });

  const blobs = await listAllBlobs(normalizedPrefix, token);
  if (blobs.length === 0) {
    console.log(`prefix(${normalizedPrefix}) 하위에 Blob 파일이 없습니다.`);
    return;
  }

  const expectedLocalPaths = new Set();
  for (const blob of blobs) {
    const relativePath = blob.pathname.slice(normalizedPrefix.length);
    if (!relativePath) continue;

    const destinationPath = path.join(submoduleRoot, relativePath);
    expectedLocalPaths.add(path.resolve(destinationPath));
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
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
