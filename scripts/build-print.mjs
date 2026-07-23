#!/usr/bin/env node
/**
 * build-print.mjs — Studio mean 인화앱 배포본 빌더
 *
 * 원본(단일 self-contained HTML, reservation 레포 밖):
 *   website/photo-print/index.html
 * 배포본(Netlify, print.studio-mean.com):
 *   website/reservation/frontend/print/{index.html, app.js}
 *
 * 하는 일: 그들 프론트 CSP가 script-src 'self'(인라인 스크립트 금지)라, 원본의
 * 단일 인라인 <script>…</script> 블록을 외부 app.js로 분리하고, index.html에는
 * <script src="app.js"></script>만 남긴다. 인라인 CSS는 style-src 'unsafe-inline'로
 * 허용되므로 그대로 둔다. ERP_BASE(주문모드 ④ 기본 /exec)는 원본에 이미 들어있어
 * 그대로 실려 나간다 — 아래에서 존재 여부만 검증한다.
 *
 * netlify.toml / README.md 는 손으로 관리하는 파일이라 건드리지 않는다.
 *
 * 사용법:
 *   node scripts/build-print.mjs           # 빌드(배포본 재생성)
 *   node scripts/build-print.mjs --check    # 재생성 결과가 현재 커밋본과 동일한지 검증만(쓰기 X)
 */
import { readFileSync, writeFileSync, readdirSync, mkdirSync, copyFileSync, existsSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));               // reservation/scripts
const SRC = join(HERE, '..', '..', 'photo-print', 'index.html');    // website/photo-print/index.html
const SRC_FONTS = join(HERE, '..', '..', 'photo-print', 'fonts');   // website/photo-print/fonts
const SRC_SAMPLES = join(HERE, '..', '..', 'photo-print', 'samples'); // website/photo-print/samples
const OUT_DIR = join(HERE, '..', 'frontend', 'print');              // reservation/frontend/print
const OUT_HTML = join(OUT_DIR, 'index.html');
const OUT_JS = join(OUT_DIR, 'app.js');
const OUT_FONTS = join(OUT_DIR, 'fonts');
const OUT_SAMPLES = join(OUT_DIR, 'samples');

const checkOnly = process.argv.includes('--check');

function fail(msg) { console.error('❌ ' + msg); process.exit(1); }

let src;
try { src = readFileSync(SRC, 'utf8'); }
catch { fail(`원본을 읽을 수 없습니다: ${SRC}`); }

// 원본은 인라인 <script>(속성 없는 것) 정확히 1개여야 한다.
const openCount = (src.match(/<script>/g) || []).length;
const srcTagCount = (src.match(/<script\s+src=/g) || []).length;
if (openCount !== 1) fail(`원본에 속성 없는 <script> 가 ${openCount}개 (1개 예상). 구조가 바뀌었으면 이 스크립트를 갱신하세요.`);
if (srcTagCount !== 0) fail(`원본에 이미 <script src=…> 가 ${srcTagCount}개 있습니다. 원본은 self-contained 여야 합니다.`);

// <script>\n …앱코드… \n</script> 를 캡처. app.js 는 태그 사이 내용(앞뒤 줄바꿈 제외)과 동일.
const m = src.match(/<script>\n([\s\S]*?)\n<\/script>/);
if (!m) fail('인라인 <script>…</script> 블록을 찾지 못했습니다.');
// 정규식이 </script> 앞 \n 을 구분자로 소비하므로, 파일 끝 개행(관례)을 복원해 커밋본과 바이트 동일.
const appJs = m[1] + '\n';

// index.html: 블록 전체를 한 줄짜리 외부참조로 치환.
const outHtml = src.replace(/<script>\n[\s\S]*?\n<\/script>/, '<script src="app.js"></script>');

// 안전장치: ERP_BASE 가 공개 GAS /exec 를 가리키는지(비어있지 않은지) 검증.
const erp = appJs.match(/const\s+ERP_BASE\s*=\s*"([^"]*)"/);
if (!erp) fail('app.js 에 const ERP_BASE 선언이 없습니다.');
if (!/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(erp[1])) {
  fail(`ERP_BASE 가 공개 GAS /exec 형식이 아닙니다: "${erp[1]}". 원본에서 확인하세요.`);
}

// 치환이 유효했는지(인라인 스크립트가 남지 않았는지) 확인.
if (/<script>\n/.test(outHtml)) fail('치환 후에도 인라인 <script> 가 남아있습니다.');
if (!outHtml.includes('<script src="app.js"></script>')) fail('외부 스크립트 참조 주입 실패.');

// 번들 폰트(woff2) 목록 — @font-face url("fonts/<key>.woff2") 이 참조. 원본↔배포본 동기화 대상.
const fontFiles = existsSync(SRC_FONTS) ? readdirSync(SRC_FONTS).filter(f => f.endsWith('.woff2')).sort() : [];
// index.html 의 @font-face 가 참조하는 파일이 fonts/ 에 실제로 있는지 교차검증.
const referenced = [...src.matchAll(/url\("fonts\/([^"]+\.woff2)"\)/g)].map(m => m[1]).sort();
for (const ref of referenced) if (!fontFiles.includes(ref)) fail(`@font-face 가 fonts/${ref} 를 참조하지만 원본 fonts/ 에 없습니다.`);

function fontsSynced() {
  if (!existsSync(OUT_FONTS)) return fontFiles.length === 0;
  const out = readdirSync(OUT_FONTS).filter(f => f.endsWith('.woff2')).sort();
  if (out.join(',') !== fontFiles.join(',')) return false;
  return fontFiles.every(f => readFileSync(join(SRC_FONTS, f)).equals(readFileSync(join(OUT_FONTS, f))));
}

// 예시 이미지(samples/*.jpg) — 프리셋 미리보기용, 앱 SAMPLES 가 참조.
const sampleFiles = existsSync(SRC_SAMPLES) ? readdirSync(SRC_SAMPLES).filter(f => f.endsWith('.jpg')).sort() : [];
function samplesSynced() {
  if (!existsSync(OUT_SAMPLES)) return sampleFiles.length === 0;
  const out = readdirSync(OUT_SAMPLES).filter(f => f.endsWith('.jpg')).sort();
  if (out.join(',') !== sampleFiles.join(',')) return false;
  return sampleFiles.every(f => readFileSync(join(SRC_SAMPLES, f)).equals(readFileSync(join(OUT_SAMPLES, f))));
}

if (checkOnly) {
  const curHtml = readFileSync(OUT_HTML, 'utf8');
  const curJs = readFileSync(OUT_JS, 'utf8');
  const htmlSame = curHtml === outHtml;
  const jsSame = curJs === appJs;
  const fontsSame = fontsSynced();
  const samplesSame = samplesSynced();
  console.log(`app.js  : ${jsSame ? '✅ 일치' : '⚠️ 다름(원본이 커밋본보다 최신 — 빌드 필요)'}`);
  console.log(`index   : ${htmlSame ? '✅ 일치' : '⚠️ 다름(빌드 필요)'}`);
  console.log(`fonts   : ${fontsSame ? `✅ 일치(${fontFiles.length}개)` : '⚠️ 다름(빌드 필요)'}`);
  console.log(`samples : ${samplesSame ? `✅ 일치(${sampleFiles.length}개)` : '⚠️ 다름(빌드 필요)'}`);
  process.exit(htmlSame && jsSame && fontsSame && samplesSame ? 0 : 2);
}

// 폰트·예시이미지 동기화(원본 → 배포본). 원본에서 지운 파일은 배포본에서도 제거해야
// 배포에 유령 파일이 남지 않고 --check 가 빌드 직후 통과한다(목록 전체를 비교하므로).
function syncDir(srcDir, outDir, files, ext) {
  mkdirSync(outDir, { recursive: true });
  for (const stale of readdirSync(outDir).filter(f => f.endsWith(ext) && !files.includes(f))) {
    unlinkSync(join(outDir, stale));
  }
  for (const f of files) copyFileSync(join(srcDir, f), join(outDir, f));
}
syncDir(SRC_FONTS, OUT_FONTS, fontFiles, '.woff2');
syncDir(SRC_SAMPLES, OUT_SAMPLES, sampleFiles, '.jpg');

writeFileSync(OUT_JS, appJs);
writeFileSync(OUT_HTML, outHtml);
console.log(`✅ 빌드 완료 → frontend/print/`);
console.log(`   fonts    : ${fontFiles.length}개 woff2 복사`);
console.log(`   samples  : ${sampleFiles.length}개 jpg 복사`);
console.log(`   app.js   : ${appJs.split('\n').length} 줄`);
console.log(`   index.html: ${outHtml.split('\n').length} 줄`);
console.log(`   ERP_BASE : ${erp[1]}`);
console.log(`   (netlify.toml / README.md 는 그대로 — 손관리 파일)`);
