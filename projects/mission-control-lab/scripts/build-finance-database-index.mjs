#!/usr/bin/env node
import { promises as fs } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { Readable } from 'node:stream';
import { createInterface } from 'node:readline';

const SOURCE_URL = 'https://raw.githubusercontent.com/JerBouma/FinanceDatabase/main/database/equities.csv';
const OUT_PATH = join(process.cwd(), 'data', 'trading', 'finance-database-symbol-index.json');
const MAX_ROWS = Number(process.env.FINANCE_DATABASE_MAX_ROWS || 175000);

function parseCsvLine(line) {
  const fields = [];
  let current = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (quoted) {
      if (char === '"' && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        current += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      fields.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  fields.push(current);
  return fields;
}

async function main() {
  await mkdir(dirname(OUT_PATH), { recursive: true });
  const response = await fetch(SOURCE_URL, { headers: { 'user-agent': 'MissionControlLab/1.0 finance-database-index' } });
  if (!response.ok || !response.body) throw new Error(`FinanceDatabase download failed: ${response.status}`);

  const stream = Readable.fromWeb(response.body);
  const rl = createInterface({ input: stream, crlfDelay: Infinity });
  const rows = [];
  let headers = null;
  for await (const line of rl) {
    if (!line.trim()) continue;
    const fields = parseCsvLine(line);
    if (!headers) {
      headers = fields;
      continue;
    }
    const row = Object.fromEntries(headers.map((header, index) => [header, fields[index] ?? '']));
    if (!row.symbol || !row.name) continue;
    rows.push({
      symbol: row.symbol,
      name: row.name,
      currency: row.currency || null,
      sector: row.sector || null,
      industryGroup: row.industry_group || null,
      industry: row.industry || null,
      exchange: row.exchange || null,
      market: row.market || null,
      country: row.country || null,
      website: row.website || null,
      marketCapCategory: row.market_cap || null,
      isin: row.isin || null,
    });
    if (rows.length >= MAX_ROWS) break;
  }

  const payload = {
    source: 'JerBouma/FinanceDatabase database/equities.csv',
    sourceUrl: SOURCE_URL,
    generatedAt: new Date().toISOString(),
    rowCount: rows.length,
    rows,
  };
  const tmp = `${OUT_PATH}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(payload));
  await fs.rename(tmp, OUT_PATH);
  console.log(`Wrote ${rows.length} FinanceDatabase rows to ${OUT_PATH}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
