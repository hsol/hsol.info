import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { siteDataSchema } from "../src/content/schema";

const SOURCE_PATH =
  process.env.VAULT_SITE_DATA_PATH ??
  "hsol-info-blob/vault/object-views/site-data.json";
const OUTPUT_PATH = process.env.SITE_TS_OUTPUT_PATH ?? "src/data/site.ts";

async function main() {
  const sourceText = await readFile(SOURCE_PATH, "utf8");
  const sourceJson = JSON.parse(sourceText);
  const parsed = siteDataSchema.parse(sourceJson);

  const outputDir = path.dirname(OUTPUT_PATH);
  await mkdir(outputDir, { recursive: true });
  const output = `import { siteDataSchema } from "@/content/schema";

/** Generated from vault/object-views/site-data.json */
export const HSOL_DATA = siteDataSchema.parse(${JSON.stringify(parsed, null, 2)} as const);

export type SiteData = typeof HSOL_DATA;
`;

  await writeFile(OUTPUT_PATH, output, "utf8");
  console.log(`Generated ${OUTPUT_PATH} from ${SOURCE_PATH}`);
}

main().catch((error) => {
  console.error("Failed to generate site.ts from vault.");
  console.error(error);
  process.exit(1);
});
