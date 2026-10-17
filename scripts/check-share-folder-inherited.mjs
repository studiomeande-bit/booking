#!/usr/bin/env node
/* check-share-folder-inherited.mjs — 보정본 발송이 상속 권한 때문에 멈추지 않게(2026-10-17 연예진 'Access denied: DriveApp')
 * 상위 세션 폴더가 '누구나 편집'이면 하위 보정본 폴더를 VIEW 로 못 낮춘다 → 이미 링크 공개면 계속, 비공개면 던진다. 두 발송 경로가 헬퍼를 쓴다. */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const gs = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'appscript', 'Code.gs'), 'utf8');
const src = gs.match(/function shareFolderViewByLink_\(folder\)\{[\s\S]*?\n\}\n/)[0];
const DriveApp = { Access: { ANYONE_WITH_LINK: 'AWL', PRIVATE: 'P' }, Permission: { VIEW: 'V' } };
const fn = new Function('DriveApp', 'Logger', `${src}; return shareFolderViewByLink_;`)(DriveApp, { log() {} });
let fail = 0; const ok = (c, l) => { if (!c) { fail++; console.error('  ✗ ' + l); } };
ok(fn({ setSharing() {} }) === 'view', '정상: VIEW 로 공유');
ok(fn({ setSharing() { throw new Error('Access denied: DriveApp.'); }, getSharingAccess: () => 'AWL' }) === 'inherited', '상속 편집 권한 + 링크 공개: 발송 계속');
let threw = false; try { fn({ setSharing() { throw new Error('Access denied: DriveApp.'); }, getSharingAccess: () => 'P' }); } catch (e) { threw = true; }
ok(threw, '링크 비공개인데 공유 실패: 던진다(고객이 못 여는 링크를 보내지 않게)');
ok(/shareFolderViewByLink_\(ret\.folder\);\n      retouchFolderLink=ret\.url;/.test(gs) && /if\(payload\.dryRun!==true\)shareFolderViewByLink_\(ret\.folder\);/.test(gs), '어드민·에이전트 보정본 발송 두 경로가 헬퍼 사용');
ok(!/ret\.folder\.setSharing\(DriveApp\.Access\.ANYONE_WITH_LINK/.test(gs), '보정본 폴더 직접 setSharing 잔존 없음');
if (fail) { console.error(`\n✗ 납품 폴더 공유 검사 실패 ${fail}건`); process.exit(1); }
console.log('✓ 납품 폴더 공유 — 상속 편집 권한이어도 보정본 발송 계속, 비공개면 중단');
