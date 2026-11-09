#!/usr/bin/env node
// Localization self-check for the zh (Simplified/Traditional Chinese) fork.
// Usage: node tools/zh-sync/check.mjs [--root DIR] [--json] [--strict] [--fill]
// Exit code: 0 clean, 1 errors (or warnings when --strict).
import fs from 'node:fs';
import path from 'node:path';

const BASE = 'en-US';
const TARGETS = ['zh-CN', 'zh-Hant'];

const argv = process.argv.slice(2);
const opt = { root: process.cwd(), json: false, strict: false, fill: false };
for (let i = 0; i < argv.length; i += 1) {
  const a = argv[i];
  if (a === '--root') opt.root = path.resolve(argv[++i] ?? '.');
  else if (a === '--json') opt.json = true;
  else if (a === '--strict') opt.strict = true;
  else if (a === '--fill') opt.fill = true;
  else if (a === '--help' || a === '-h') {
    console.log('usage: node tools/zh-sync/check.mjs [--root DIR] [--json] [--strict] [--fill]');
    process.exit(0);
  } else {
    console.error('unknown argument: ' + a);
    process.exit(2);
  }
}

const PLACEHOLDER = /\{(\d+|[A-Za-z_][A-Za-z0-9_.]*)\}|%[sdf]|%%/g;
const CJK = /[\u3400-\u9FFF]/;

function tok(s) {
  return [...String(s).matchAll(PLACEHOLDER)].map((m) => m[0]).sort();
}

function readRaw(file) {
  const text = fs.readFileSync(file, 'utf8');
  return text.replace(/^\uFEFF/, '');
}

function load(file) {
  const raw = readRaw(file);
  let data;
  try {
    data = JSON.parse(raw);
  } catch (err) {
    return { error: 'invalid JSON: ' + err.message };
  }
  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    return { error: 'root is not a JSON object' };
  }
  const seen = new Set();
  const dupes = [];
  for (const m of raw.matchAll(/"((?:[^"\\]|\\.)*)"\s*:/g)) {
    const k = m[1];
    if (seen.has(k)) dupes.push(k);
    seen.add(k);
  }
  for (const [k, v] of Object.entries(data)) {
    if (typeof v !== 'string') return { error: 'value of "' + k + '" is not a string' };
  }
  return { data, dupes };
}

function discover(root) {
  const dirs = [];
  const add = (rel) => {
    const abs = path.join(root, rel);
    if (fs.existsSync(path.join(abs, BASE + '.json'))) dirs.push(rel.split(path.sep).join('/'));
  };
  add(path.join('GameHelper', 'Localization'));
  const plugins = path.join(root, 'Plugins');
  if (fs.existsSync(plugins)) {
    for (const e of fs.readdirSync(plugins, { withFileTypes: true })) {
      if (e.isDirectory()) add(path.join('Plugins', e.name, 'Localization'));
    }
  }
  return dirs.sort();
}

const result = { root: opt.root, dirs: [], errors: 0, warnings: 0, keyset: 0, untranslated: 0 };

for (const rel of discover(opt.root)) {
  const dirAbs = path.join(opt.root, rel);
  const entry = { dir: rel, errors: [], warnings: [], keys: 0 };
  const base = load(path.join(dirAbs, BASE + '.json'));
  if (base.error) {
    entry.errors.push(BASE + '.json: ' + base.error);
  } else {
    if (base.dupes.length) entry.errors.push(BASE + '.json: duplicate keys ' + base.dupes.slice(0, 5).join(', '));
    entry.keys = Object.keys(base.data).length;
    result.keyset += entry.keys;
    const baseKeys = Object.keys(base.data);
    for (const code of TARGETS) {
      const file = path.join(dirAbs, code + '.json');
      if (!fs.existsSync(file)) {
        entry.errors.push(code + '.json: missing');
        continue;
      }
      const zh = load(file);
      if (zh.error) {
        entry.errors.push(code + '.json: ' + zh.error);
        continue;
      }
      if (zh.dupes.length) entry.errors.push(code + '.json: duplicate keys ' + zh.dupes.slice(0, 5).join(', '));
      const missing = baseKeys.filter((k) => !(k in zh.data));
      const extra = Object.keys(zh.data).filter((k) => !(k in base.data));
      if (opt.fill && missing.length) {
        const out = {};
        for (const k of baseKeys) out[k] = k in zh.data ? zh.data[k] : base.data[k];
        for (const k of Object.keys(zh.data)) if (!(k in out)) out[k] = zh.data[k];
        fs.writeFileSync(file, JSON.stringify(out, null, 2) + '\n', 'utf8');
        zh.data = out;
        entry.warnings.push(code + ': filled ' + missing.length + ' missing key(s) with English text - translate them');
      } else if (missing.length) {
        entry.errors.push(code + ': ' + missing.length + ' key(s) missing vs ' + BASE + ' (e.g. ' + missing.slice(0, 5).join(', ') + ')');
      }
      if (extra.length) entry.warnings.push(code + ': ' + extra.length + ' key(s) not in ' + BASE + ' (e.g. ' + extra.slice(0, 5).join(', ') + ')');
      for (const k of baseKeys) {
        const en = base.data[k];
        const val = zh.data[k];
        if (val === undefined) continue;
        if (!en.trim()) { entry.errors.push(code + ' "' + k + '": base text is empty'); continue; }
        if (!val.trim()) { entry.errors.push(code + ' "' + k + '": empty translation'); continue; }
        const a = tok(en).join('|');
        const b = tok(val).join('|');
        if (a !== b) entry.errors.push(code + ' "' + k + '": placeholder mismatch [' + tok(en).join(' ') + '] vs [' + tok(val).join(' ') + ']');
        if (en !== en.trim() || val !== val.trim()) entry.warnings.push(code + ' "' + k + '": leading/trailing whitespace');
        const asciiShort = /^[\x20-\x7E]+$/.test(en) && en.length <= 6;
        if (en === val && !asciiShort) {
          entry.warnings.push(code + ' "' + k + '": untranslated (identical to ' + BASE + ')');
          result.untranslated += 1;
        }
      }
    }
    const cn = fs.existsSync(path.join(dirAbs, 'zh-CN.json')) ? load(path.join(dirAbs, 'zh-CN.json')) : null;
    const hant = fs.existsSync(path.join(dirAbs, 'zh-Hant.json')) ? load(path.join(dirAbs, 'zh-Hant.json')) : null;
    if (cn && hant && !cn.error && !hant.error) {
      const same = Object.keys(cn.data).filter((k) => cn.data[k] === hant.data[k] && CJK.test(cn.data[k]) && cn.data[k].length > 2);
      if (same.length) entry.warnings.push('zh-Hant identical to zh-CN in ' + same.length + ' entry(ies) (e.g. ' + same.slice(0, 3).join(', ') + ') - check glyphs');
    }
  }
  result.errors += entry.errors.length;
  result.warnings += entry.warnings.length;
  result.dirs.push(entry);
}

const failed = result.errors > 0 || (opt.strict && result.warnings > 0);

if (opt.json) {
  console.log(JSON.stringify({ ...result, ok: !failed }, null, 2));
} else {
  for (const d of result.dirs) {
    const tag = d.errors.length ? 'FAIL' : d.warnings.length ? 'WARN' : ' OK ';
    console.log('[' + tag + '] ' + d.dir + '  (' + d.keys + ' keys)');
    for (const e of d.errors) console.log('        error   ' + e);
    for (const w of d.warnings.slice(0, 6)) console.log('        warning ' + w);
    if (d.warnings.length > 6) console.log('        ... ' + (d.warnings.length - 6) + ' more warning(s)');
  }
  console.log('');
  console.log('dirs: ' + result.dirs.length + '   base keys: ' + result.keyset + '   errors: ' + result.errors + '   warnings: ' + result.warnings);
  console.log(failed ? 'RESULT: FAILED' : 'RESULT: OK');
}
process.exit(failed ? 1 : 0);
