/**
 * extract-getty-vocabularies.ts
 *
 * Queries the Getty AAT SPARQL endpoint to extract controlled-vocabulary
 * terms for four facets (Object Types, Materials, Techniques,
 * Styles/Periods) in English and German, then writes merged JSON files
 * to src/data/getty/.
 *
 * Usage:  npx tsx scripts/extract-getty-vocabularies.ts
 *
 * Requires Node 18+ (native fetch).  NOT shipped with the app.
 */

import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GettyTerm {
  uri: string;
  label_en: string;
  label_de?: string;
  parent_en?: string;
  scopeNote_en?: string;
}

interface SparqlBinding {
  subject: { value: string };
  prefLabel: { value: string };
  scopeNote?: { value: string };
  parentLabel?: { value: string };
}

interface SparqlResponse {
  results: {
    bindings: SparqlBinding[];
  };
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const SPARQL_ENDPOINT = "https://vocab.getty.edu/sparql";
const USER_AGENT = "aha-register-vocabulary-extractor/1.0";
const REQUEST_TIMEOUT_MS = 30_000;
const MAX_RETRIES = 3;

const OUTPUT_DIR = join(__dirname, "..", "src", "data", "getty");

interface FacetConfig {
  name: string;
  filename: string;
  /** One or more AAT root IDs to UNION together */
  roots: string[];
}

const FACETS: FacetConfig[] = [
  {
    name: "Object Types",
    filename: "object-types.json",
    roots: ["300264092", "300191086", "300026059"],
  },
  {
    name: "Materials",
    filename: "materials.json",
    roots: ["300010358"],
  },
  {
    name: "Techniques",
    filename: "techniques.json",
    roots: ["300053001"],
  },
  {
    name: "Styles/Periods",
    filename: "styles-periods.json",
    roots: ["300264088"],
  },
];

// ---------------------------------------------------------------------------
// SPARQL query builder
// ---------------------------------------------------------------------------

function buildQuery(roots: string[], lang: string, limit: number): string {
  const rootClauses = roots
    .map((r) => `  { ?subject gvp:broaderExtended aat:${r} }`)
    .join(" UNION\n");

  return `\
PREFIX aat: <http://vocab.getty.edu/aat/>
PREFIX gvp: <http://vocab.getty.edu/ontology#>
PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
PREFIX xl: <http://www.w3.org/2008/05/skos-xl#>
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>

SELECT ?subject ?prefLabel ?scopeNote ?parentLabel WHERE {
${rootClauses}
  ?subject xl:prefLabel [xl:literalForm ?prefLabel] .
  FILTER(lang(?prefLabel) = "${lang}")
  OPTIONAL { ?subject skos:scopeNote [rdf:value ?scopeNote] . FILTER(lang(?scopeNote) = "${lang}") }
  OPTIONAL { ?subject gvp:broader ?parent . ?parent xl:prefLabel [xl:literalForm ?parentLabel] . FILTER(lang(?parentLabel) = "${lang}") }
}
ORDER BY ?prefLabel
LIMIT ${limit}`;
}

// ---------------------------------------------------------------------------
// HTTP helpers with retry + exponential backoff
// ---------------------------------------------------------------------------

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchSparql(query: string): Promise<SparqlResponse> {
  const url = `${SPARQL_ENDPOINT}?query=${encodeURIComponent(query)}&format=json`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/sparql-results+json",
        "User-Agent": USER_AGENT,
      },
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText}`);
    }
    return (await res.json()) as SparqlResponse;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchWithRetry(
  roots: string[],
  lang: string,
): Promise<SparqlBinding[]> {
  // First attempt series: LIMIT 1000
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const query = buildQuery(roots, lang, 1000);
      const data = await fetchSparql(query);
      return data.results.bindings;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(
        `  [attempt ${attempt}/${MAX_RETRIES}] failed (limit 1000): ${msg}`,
      );
      if (attempt < MAX_RETRIES) {
        const delayMs = 1000 * 2 ** (attempt - 1); // 1s, 2s, 4s
        console.warn(`  retrying in ${delayMs}ms ...`);
        await sleep(delayMs);
      }
    }
  }

  // Fallback: try with LIMIT 500
  console.warn("  all retries with LIMIT 1000 failed — falling back to LIMIT 500");
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const query = buildQuery(roots, lang, 500);
      const data = await fetchSparql(query);
      return data.results.bindings;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(
        `  [fallback attempt ${attempt}/${MAX_RETRIES}] failed (limit 500): ${msg}`,
      );
      if (attempt < MAX_RETRIES) {
        const delayMs = 1000 * 2 ** (attempt - 1);
        console.warn(`  retrying in ${delayMs}ms ...`);
        await sleep(delayMs);
      }
    }
  }

  throw new Error("All retry attempts exhausted (both LIMIT 1000 and LIMIT 500)");
}

// ---------------------------------------------------------------------------
// Merge EN + DE bindings into GettyTerm[]
// ---------------------------------------------------------------------------

function mergeBindings(
  enBindings: SparqlBinding[],
  deBindings: SparqlBinding[],
): GettyTerm[] {
  const map = new Map<string, GettyTerm>();

  for (const b of enBindings) {
    const uri = b.subject.value;
    map.set(uri, {
      uri,
      label_en: b.prefLabel.value,
      parent_en: b.parentLabel?.value,
      scopeNote_en: b.scopeNote?.value,
    });
  }

  for (const b of deBindings) {
    const uri = b.subject.value;
    const existing = map.get(uri);
    if (existing) {
      existing.label_de = b.prefLabel.value;
    } else {
      // Term only found in German — still record it with label_en fallback
      map.set(uri, {
        uri,
        label_en: b.prefLabel.value, // fallback
        label_de: b.prefLabel.value,
        parent_en: b.parentLabel?.value,
        scopeNote_en: b.scopeNote?.value,
      });
    }
  }

  // Sort alphabetically by English label
  return Array.from(map.values()).sort((a, b) =>
    a.label_en.localeCompare(b.label_en, "en"),
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const totalStart = performance.now();

  console.log("Getty AAT Vocabulary Extractor");
  console.log("=".repeat(50));

  // Ensure output directory exists
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
    console.log(`Created output directory: ${OUTPUT_DIR}`);
  }

  const summary: { facet: string; terms: number; timeMs: number }[] = [];

  for (const facet of FACETS) {
    const facetStart = performance.now();
    console.log(`\nQuerying: ${facet.name}`);

    console.log(`  Fetching EN labels ...`);
    const enBindings = await fetchWithRetry(facet.roots, "en");
    console.log(`  -> ${enBindings.length} EN bindings`);

    console.log(`  Fetching DE labels ...`);
    const deBindings = await fetchWithRetry(facet.roots, "de");
    console.log(`  -> ${deBindings.length} DE bindings`);

    const terms = mergeBindings(enBindings, deBindings);
    console.log(`  Merged: ${terms.length} unique terms`);

    const outPath = join(OUTPUT_DIR, facet.filename);
    writeFileSync(outPath, JSON.stringify(terms, null, 2), "utf-8");
    console.log(`  Saved: ${outPath}`);

    const facetMs = Math.round(performance.now() - facetStart);
    summary.push({ facet: facet.name, terms: terms.length, timeMs: facetMs });
  }

  // Summary table
  const totalMs = Math.round(performance.now() - totalStart);

  console.log("\n" + "=".repeat(50));
  console.log("Summary");
  console.log("=".repeat(50));
  console.log(
    "Facet".padEnd(20) + "Terms".padStart(8) + "Time (s)".padStart(12),
  );
  console.log("-".repeat(40));
  for (const row of summary) {
    console.log(
      row.facet.padEnd(20) +
        String(row.terms).padStart(8) +
        (row.timeMs / 1000).toFixed(1).padStart(12),
    );
  }
  console.log("-".repeat(40));
  console.log(
    "Total".padEnd(20) +
      String(summary.reduce((s, r) => s + r.terms, 0)).padStart(8) +
      (totalMs / 1000).toFixed(1).padStart(12),
  );
  console.log("\nDone.");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
