/**
 * vault 객체 노트를 context-protocol 방식(폴더 중첩 = 개념 계층)으로 찾고, 비공개 노트를 거른다.
 *
 * 개념 노트: `objects/<타입>/` 바로 아래의 `*.md`, 또는 어느 깊이든 자기 폴더와 이름이 같은 `<X>/<X>.md`.
 * 실체 폴더(개념 노트 type 이 Organization, Project 등) 안의 다른 파일은 그 실체에 속한 문서이지 객체가 아니다
 * (조직/무하유/특허-연구/*.md, 원본 자료 등).
 * 분류 폴더(개념 노트 type 이 concept)는 인스턴스를 묶는 폴더다. 그 바로 아래 `*.md` 는 각각 객체다
 * (인물/가족-구성원/김연수.md, 사건/커리어-사건/2016-11-ridi-join.md 등).
 *
 * 비공개: frontmatter `visibility: private`. 비공개 개념 노트의 폴더 아래는 통째로 비공개로 본다.
 * 원페이저, site-data 같은 공개 콘텐츠의 근거에서 뺀다. 정본 규칙은 개인 OneDrive 워크스페이스 CONTEXT.md.
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---/;

/** frontmatter 에 `visibility: private` 가 있으면 true. 따옴표와 대소문자는 무시한다. */
export function isPrivateText(text: string): boolean {
  const fm = text.match(FRONTMATTER);
  if (!fm) return false;
  const line = fm[1].split(/\r?\n/).find((l) => /^visibility\s*:/i.test(l));
  if (!line) return false;
  return line.replace(/^visibility\s*:/i, "").trim().replace(/^["']|["']$/g, "").toLowerCase() === "private";
}

/** frontmatter `type` 값(소문자). 없으면 "". */
export function noteTypeText(text: string): string {
  const fm = text.match(FRONTMATTER);
  if (!fm) return "";
  const line = fm[1].split(/\r?\n/).find((l) => /^type\s*:/i.test(l));
  if (!line) return "";
  return line.replace(/^type\s*:/i, "").trim().replace(/^["']|["']$/g, "").toLowerCase();
}

async function isGroupConcept(filePath: string): Promise<boolean> {
  try {
    return noteTypeText(await readFile(filePath, "utf8")) === "concept";
  } catch {
    return false;
  }
}

async function isPrivateFile(filePath: string): Promise<boolean> {
  try {
    return isPrivateText(await readFile(filePath, "utf8"));
  } catch {
    return false;
  }
}

const nfc = (s: string) => s.normalize("NFC");
const isMd = (name: string) => name.toLowerCase().endsWith(".md");

/**
 * `objects/<타입>` 디렉터리들 아래의 공개 개념 노트 경로(입력 경로 기준). 깊이 제한 없이 내려가되,
 * 비공개 개념 노트를 만나면 그 폴더 아래는 보지 않는다.
 */
export async function listPublicObjectNotes(typeDirs: string[]): Promise<string[]> {
  const out: string[] = [];
  async function walk(dir: string, isTypeRoot: boolean): Promise<void> {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return; // 디렉터리 없음 -> 건너뜀
    }
    const dirName = nfc(path.basename(dir));
    let members = isTypeRoot;
    let conceptName: string | null = null;
    if (!isTypeRoot) {
      const concept = entries.find((e) => e.isFile() && nfc(e.name) === `${dirName}.md`);
      if (concept) {
        const conceptPath = path.join(dir, concept.name);
        if (await isPrivateFile(conceptPath)) return;
        out.push(conceptPath);
        conceptName = concept.name;
        members = await isGroupConcept(conceptPath);
      }
    }
    for (const e of entries) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) await walk(p, false);
      else if (members && e.name !== conceptName && e.isFile() && isMd(e.name) && !(await isPrivateFile(p))) out.push(p);
    }
  }
  for (const d of typeDirs) await walk(d, true);
  return out.sort();
}

/**
 * 파일 경로 목록에서 비공개를 뺀다. 파일 자신이 비공개이거나, 조상 폴더 중 하나의 개념 노트(`<폴더>/<폴더>.md`)가
 * 비공개면 뺀다. `stopAt` 위로는 올라가지 않는다(vault 루트).
 */
export async function filterPublicPaths(files: string[], stopAt: string): Promise<string[]> {
  const root = path.resolve(stopAt);
  const cache = new Map<string, boolean>();
  async function folderPrivate(dir: string): Promise<boolean> {
    if (!cache.has(dir)) {
      let names: string[] = [];
      try {
        names = await readdir(dir);
      } catch {
        // 없음
      }
      const base = nfc(path.basename(dir));
      const hit = names.find((n) => nfc(n) === `${base}.md`);
      cache.set(dir, hit ? await isPrivateFile(path.join(dir, hit)) : false);
    }
    return cache.get(dir)!;
  }
  const out: string[] = [];
  for (const f of files) {
    if (isMd(f) && (await isPrivateFile(f))) continue;
    let dir = path.resolve(path.dirname(f));
    let hidden = false;
    while (dir.startsWith(root) && dir !== root) {
      if (await folderPrivate(dir)) {
        hidden = true;
        break;
      }
      dir = path.dirname(dir);
    }
    if (!hidden) out.push(f);
  }
  return out;
}
