#!/usr/bin/env node
// Exports a language pack: a tree that mirrors the installed GameHelper layout so it
// can be copied over an official installation.
//   <install>/Localization/zh-CN.json                     <- GameHelper/Localization
//   <install>/Plugins/<Plugin>/Localization/zh-CN.json    <- Plugins/<Plugin>/Localization
// Usage: node tools/zh-sync/export-langpack.mjs [--root DIR] [--out DIR]
import fs from 'node:fs';
import path from 'node:path';

const CODES = ['zh-CN', 'zh-Hant'];
// Renamed plugin folder kept in the repo but removed from published builds.
const EXCLUDE = new Set(['RuneforgeHelper']);

const argv = process.argv.slice(2);
const opt = { root: process.cwd(), out: null };
for (let i = 0; i < argv.length; i += 1) {
  const a = argv[i];
  if (a === '--root') opt.root = path.resolve(argv[++i] ?? '.');
  else if (a === '--out') opt.out = path.resolve(argv[++i] ?? 'dist/langpack');
  else if (a === '--help' || a === '-h') {
    console.log('usage: node tools/zh-sync/export-langpack.mjs [--root DIR] [--out DIR]');
    process.exit(0);
  } else {
    console.error('unknown argument: ' + a);
    process.exit(2);
  }
}
opt.out ??= path.join(opt.root, 'dist', 'langpack');

function copyDir(srcDir, dstDir, label, report) {
  if (!fs.existsSync(srcDir)) return;
  for (const code of CODES) {
    const from = path.join(srcDir, code + '.json');
    if (!fs.existsSync(from)) continue;
    fs.mkdirSync(dstDir, { recursive: true });
    fs.copyFileSync(from, path.join(dstDir, code + '.json'));
    report.push({ file: path.relative(opt.out, path.join(dstDir, code + '.json')).split(path.sep).join('/'), bytes: fs.statSync(from).size });
  }
}

fs.rmSync(opt.out, { recursive: true, force: true });
const report = [];
copyDir(path.join(opt.root, 'GameHelper', 'Localization'), path.join(opt.out, 'Localization'), 'main', report);

const pluginsRoot = path.join(opt.root, 'Plugins');
const plugins = fs.existsSync(pluginsRoot)
  ? fs.readdirSync(pluginsRoot, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort()
  : [];
for (const plugin of plugins) {
  if (EXCLUDE.has(plugin)) continue;
  copyDir(path.join(pluginsRoot, plugin, 'Localization'), path.join(opt.out, 'Plugins', plugin, 'Localization'), plugin, report);
}

const readme = [
  'GameHelper 汉化语言包（简体 zh-CN / 繁体 zh-Hant）',
  '',
  '这个包只包含翻译文本，不包含程序本体。适用于官方原版安装目录。',
  '',
  '安装方法：',
  '1. 完全退出 GameHelper（包括托盘图标和 Launcher）。',
  '2. 把本压缩包里的 Localization 文件夹和 Plugins 文件夹，',
  '   直接复制粘贴到 GameHelper 安装目录（就是有 GameHelper.exe 的那个文件夹），',
  '   提示是否合并/替换时选择“是”。',
  '3. 打开 GameHelper → 设置 → Language（语言）→ 选 Simplified Chinese 或 Chinese Traditional。',
  '4. 重启 GameHelper。',
  '',
  '注意：',
  '- 插件面板里少数新增的说明文字（例如调试信息）仍是英文，因为那部分文字在程序代码里，',
  '  语言包无法修改。想要 100% 中文请用完整汉化版（GameHelper-zh-*.zip）。',
  '- 官方启动器如果自动更新，会把文件换回官方版本，汉化随之失效；',
  '  重新复制一次本语言包即可。',
  '',
  'Files: ' + report.length,
].join('\r\n');
fs.writeFileSync(path.join(opt.out, '安装说明.txt'), '\uFEFF' + readme + '\r\n', 'utf8');

console.log('language pack -> ' + opt.out);
for (const f of report) console.log('  ' + f.file + '  (' + f.bytes + ' B)');
console.log('total files: ' + report.length);
if (!report.length) {
  console.error('no localization files found under ' + opt.root);
  process.exit(1);
}
