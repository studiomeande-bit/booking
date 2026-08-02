#!/usr/bin/env node
// 포트폴리오 라이트 팔레트 대비 검사.
// 팔레트 플립(다크→크림) 때 --text/--ink 처럼 "다크에선 대비였던 쌍"이 라이트에서
// near-black on near-black 이 되는 사고가 실제로 라이브에 나갔다(주 CTA 1.07:1).
// 같은 규칙 블록에서 color/background 를 둘 다 var(--x) 로 지정한 쌍을 전부 뽑아
// 대비를 검사한다. portfolio.css + 각 HTML 인라인 <style> 모두 대상.
//
// 실행: node scripts/check-portfolio-contrast.mjs

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'frontend', 'portfolio');
const MIN_RATIO = 4.5; // WCAG AA 본문

const css = readFileSync(join(ROOT, 'portfolio.css'), 'utf8');

// :root 토큰 (마지막 정의가 이김 — CSS 캐스케이드와 동일)
const tokens = {};
for (const [, name, value] of css.matchAll(/--([\w-]+)\s*:\s*([^;}]+)[;}]/g)) {
  tokens[name] = value.trim();
}

function toRgb(v, depth = 0) {
  if (depth > 5) return null;
  v = v.trim();
  const varMatch = v.match(/^var\(\s*--([\w-]+)\s*(?:,([^)]*))?\)$/);
  if (varMatch) {
    const resolved = tokens[varMatch[1]] ?? varMatch[2];
    return resolved == null ? null : toRgb(resolved, depth + 1);
  }
  let m = v.match(/^#([0-9a-f]{6})$/i);
  if (m) return [0, 2, 4].map((i) => parseInt(m[1].substr(i, 2), 16));
  m = v.match(/^#([0-9a-f]{3})$/i);
  if (m) return [...m[1]].map((c) => parseInt(c + c, 16));
  m = v.match(/^rgba?\(([^)]+)\)$/i);
  if (m) {
    const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
    if (p.length >= 3 && p.every(Number.isFinite)) {
      return p.length > 3 ? p.slice(0, 4) : [...p.slice(0, 3), 1];
    }
  }
  return null;
}

// 반투명 면은 페이지 배경 위에 얹힌다 — 합성해야 실제 보이는 색이 나온다
const PAGE_BG = toRgb(tokens.bg) ?? [255, 255, 255];
const flatten = (c) => {
  const a = c[3] ?? 1;
  return a >= 1 ? c.slice(0, 3) : c.slice(0, 3).map((n, i) => Math.round(n * a + PAGE_BG[i] * (1 - a)));
};

const lum = (rgb) => {
  const [r, g, b] = rgb.map((n) => {
    const x = n / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

// 사진/라이트박스 위에 얹히는 흰 글자는 정상 — 페이지 배경 대비로 판정하면 안 된다
const OVER_MEDIA = /\.stage-kicker|\.portfolio-card::after|\.lightbox|\.hero-photo/;

const findings = [];

function scanBlocks(source, label) {
  for (const [, selector, body] of source.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const sel = selector.trim().replace(/\s+/g, ' ');
    if (OVER_MEDIA.test(sel)) continue;
    const fg = body.match(/(?:^|[;{\s])color\s*:\s*([^;]+)/);
    const bg = body.match(/(?:^|[;{\s])background(?:-color)?\s*:\s*([^;]+)/);
    if (!fg || !bg) continue;
    if (/transparent|none|gradient|url\(/i.test(bg[1])) continue;
    const rawFg = toRgb(fg[1]);
    const rawBg = toRgb(bg[1]);
    if (!rawFg || !rawBg) continue;
    const b = flatten(rawBg);
    // 글자색도 반투명이면 자기 배경 위에 합성
    const a = (rawFg[3] ?? 1) >= 1
      ? rawFg.slice(0, 3)
      : rawFg.slice(0, 3).map((n, i) => Math.round(n * rawFg[3] + b[i] * (1 - rawFg[3])));
    const ratio = contrast(a, b);
    if (ratio < MIN_RATIO) {
      findings.push({ label, sel, fg: fg[1].trim(), bg: bg[1].trim(), ratio: ratio.toFixed(2) });
    }
  }
}

scanBlocks(css, 'portfolio.css');

const htmlFiles = [];
(function walk(dir) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.netlify') continue;
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p);
    else if (entry.endsWith('.html')) htmlFiles.push(p);
  }
})(ROOT);

for (const file of htmlFiles) {
  const html = readFileSync(file, 'utf8');
  for (const [, style] of html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)) {
    scanBlocks(style, relative(ROOT, file));
  }
}

// 다크테마 잔재: 라이트 배경 위 흰색 테두리/면은 보이지 않는다
const leftovers = [];
for (const [, selector, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
  const sel = selector.trim().replace(/\s+/g, ' ');
  if (OVER_MEDIA.test(sel)) continue;
  for (const [, prop] of body.matchAll(/([\w-]*(?:border-color|background(?:-color)?))\s*:\s*rgba\(\s*255\s*,\s*255\s*,\s*255/g)) {
    if (/gradient/.test(body)) continue; // 미세 텍스처 그라디언트는 기능 아님
    leftovers.push(`${sel} { ${prop} }`);
  }
}

// theme-color 메타가 크림인지 (모바일 브라우저 크롬 색)
const themeBad = [];
for (const file of htmlFiles) {
  const m = readFileSync(file, 'utf8').match(/name="theme-color"\s+content="([^"]+)"/);
  if (!m || m[1].toLowerCase() !== '#faf6f0') {
    themeBad.push(`${relative(ROOT, file)} → ${m ? m[1] : '<없음>'}`);
  }
}

let failed = false;
if (findings.length) {
  failed = true;
  console.error(`\n✗ 대비 미달 ${findings.length}건 (기준 ${MIN_RATIO}:1)`);
  for (const f of findings) {
    console.error(`  ${f.label}  ${f.sel}\n      color:${f.fg} on background:${f.bg} = ${f.ratio}:1`);
  }
}
if (leftovers.length) {
  failed = true;
  console.error(`\n✗ 다크테마 잔재(라이트 배경 위 흰색) ${leftovers.length}건`);
  for (const l of leftovers) console.error(`  ${l}`);
}
if (themeBad.length) {
  failed = true;
  console.error(`\n✗ theme-color 메타 불일치 ${themeBad.length}건`);
  for (const t of themeBad) console.error(`  ${t}`);
}

if (failed) process.exit(1);
console.log(`✓ 포트폴리오 대비 OK — CSS 규칙 + 인라인 ${htmlFiles.length}페이지, theme-color 전부 #faf6f0`);
