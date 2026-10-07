#!/usr/bin/env node
/**
 * check-inquiry-spam.mjs — 문의·상담 스팸 차단 검사기
 *
 * 왜 필요한가(2026-10-01 사장님: "상담페이지로 자꾸 스팸이 들어와, 차단하거나 블랙리스트"):
 *   9/2~10/1 상담 시트 48건이 전부 같은 봇(회사명 'google', tinyurl '에스코트' 피싱, submit.php 직접 POST)이었고
 *   그때마다 고객 접수확인 메일이 봇이 적은 **남의 주소로** 나갔다. 막는 규칙이 실제 문의를 같이 막으면 더 큰 사고다 —
 *   ① 실제 스팸 원문은 막히고 ② 실제 고객 문의 원문은 통과하고 ③ 막힌 건 행·메일 없이 로그만 남고
 *   ④ '스팸' 상태가 블랙리스트로 이어지고 ⑤ 블랙리스트가 공개 응답에 새지 않아야 한다.
 *
 * 어떻게: Code.gs 를 GAS 스텁과 함께 통째로 올려 진짜 inquirySpamReason_·createConsultation_·createPortfolioLead_·
 *   update*Admin 을 돌린다(시트·메일은 가짜). 폼(submit.php·contact-lead.js)은 소스 구조로 대조한다.
 *
 * 사용법:  node scripts/check-inquiry-spam.mjs       (불일치 시 exit 1)
 */
process.env.TZ = 'Europe/Berlin';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import vm from 'node:vm';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const gs = readFileSync(join(ROOT, 'appscript', 'Code.gs'), 'utf8');
const php = readFileSync(join(ROOT, 'frontend', 'portfolio', 'contact', 'submit.php'), 'utf8');
const leadJs = readFileSync(join(ROOT, 'frontend', 'portfolio', 'contact-lead.js'), 'utf8');
const adminHtml = readFileSync(join(ROOT, 'appscript', 'AdminV2.html'), 'utf8');

const fmt = (d, tz, p) => {
  const q = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Berlin', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
    .formatToParts(new Date(d)).map((x) => [x.type, x.value]));
  return p.replace('yyyy', q.year).replace('MM', q.month).replace('dd', q.day).replace('HH', q.hour).replace('mm', q.minute).replace('ss', q.second);
};
const cacheStore = new Map();
Object.assign(globalThis, {
  Utilities: { formatDate: fmt, getUuid: () => 'abcd1234-0000-0000-0000-000000000000' },
  PropertiesService: { getScriptProperties: () => ({ getProperty: () => null, setProperty() {} }) },
  CacheService: { getScriptCache: () => ({ get: (k) => (cacheStore.has(k) ? cacheStore.get(k) : null), put: (k, v) => cacheStore.set(k, v), remove: (k) => cacheStore.delete(k) }) },
  LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock() {} }) },
  Session: { getScriptTimeZone: () => 'Europe/Berlin' }, Logger: { log() {} },
  ScriptApp: { getService: () => ({ getUrl: () => 'stub' }) }, HtmlService: {}, MimeType: {},
  SpreadsheetApp: {}, DriveApp: {}, CalendarApp: {}, MailApp: {}, GmailApp: {}, UrlFetchApp: {},
});
const dir = mkdtempSync(join(tmpdir(), 'inqspam-'));
const modPath = join(dir, 'code.cjs');
writeFileSync(modPath, `${gs}
var __SET__={}, __SHEETS__={}, __MAILS__=[];
function __sheet__(name,headers){
  if(!__SHEETS__[name]) __SHEETS__[name]={name,rows:headers?[headers]:[],   // insertSheet 은 빈 시트
    appendRow(r){this.rows.push(r.slice());}, getLastRow(){return this.rows.length;}, setFrozenRows(){},
    getRange(r,c,nr,nc){ const self=this; return {
      getValue(){ return (self.rows[r-1]||[])[c-1]; },
      setValue(v){ while(self.rows.length<r) self.rows.push([]); self.rows[r-1][c-1]=v; },
      getValues(){ const out=[]; for(let i=0;i<(nr||1);i++){ out.push((self.rows[r-1+i]||[]).slice(c-1,c-1+(nc||1))); } return out; }
    }; } };
  return __SHEETS__[name];
}
function getSettingsMap_(){return __SET__;}
function upsertSetting_(k,v){__SET__[k]=String(v).replace(/^'/,'');}   // 시트는 첫머리 ' (텍스트 표시)를 읽을 때 떼어 낸다
var __RAW_SET__={}; var __upsert0__=upsertSetting_; upsertSetting_=function(k,v){__RAW_SET__[k]=v; __upsert0__(k,v);};
function ensureSheets_(){ return {
  ss:{ getSheetByName:function(n){return __SHEETS__[n]||null;}, insertSheet:function(n){return __sheet__(n);} },
  leadSheet:__sheet__('리드',LEAD_HEADERS), consultationSheet:__sheet__('상담',CONSULTATION_HEADERS) }; }
function _sendConsultationAdminEmail_(c){__MAILS__.push('consult-admin:'+c.email);}
function _sendConsultationCustomerEmail_(c){__MAILS__.push('consult-customer:'+c.email);}
function _sendPortfolioLeadAdminEmail_(l){__MAILS__.push('lead-admin:'+l.email);}
function _sendPortfolioLeadCustomerEmail_(l){__MAILS__.push('lead-customer:'+l.email);}
function _createConsultationCalendarEvent_(){ return 'evt'; }
function assertAdmin_(){ return true; }
module.exports={assertPublicConsultationPayload_,inquirySpamReason_,inquiryBlocklistHit_,createConsultation_,createPortfolioLead_,updateConsultationAdmin,updatePortfolioLeadStatusAdmin,
  addInquiryBlocklistEntry_,listInquirySpamLogForAgent_,getInquiryBlocklistFromText_,mergeInquiryBlocklistEdit_,__raw:function(){return __RAW_SET__;},getCustomerInitSettings_,LEAD_COL,CONSULTATION_COL,
  __set:function(o){__SET__=o;}, __sheets:function(){return __SHEETS__;}, __mails:function(){return __MAILS__;}, __reset:function(){__SHEETS__={};__MAILS__=[];}};`);
const M = (await import(pathToFileURL(modPath).href)).default;
rmSync(dir, { recursive: true, force: true });

let fail = 0;
const ok = (cond, label, got) => {
  if (cond) return;
  fail++;
  console.error(`  ✗ ${label}${got === undefined ? '' : ` — 실제: ${JSON.stringify(got)}`}`);
};
const body = (src, name) => { const i = src.indexOf(`function ${name}(`); return i < 0 ? '' : src.slice(i, src.indexOf('\nfunction ', i + 10)); };
const R = (f) => { cacheStore.clear(); return M.inquirySpamReason_(f); };

// ── 1) 실제 스팸 원문은 막힌다(10/1 상담 시트에서 그대로 옮김 — 전부 submit.php 직접 POST 라 실제로는 PHP 의 no-js 가 먼저 막는다) ──
{
  M.__set({});
  const spam = [
    { name: 'Joxabila', email: 'floris@gmail.com', company: 'google', location: 'Nigeria', message: 'Photos for my escort application are uploaded.   \nLet me know if the quality is good.   \nPreview: https://tinyurl.com/4747d22s#W3bddD' },
    { name: 'Photos for my escort application are uploaded. Let me know if the quality is good. Preview: https://tinyurl.com/d6jf5psc#plqDsh', email: 'rmharris1977@gmail.com', company: 'google', message: 'uUtXkaT O9du vVKMSGS' },
    { name: 'testacle', email: 'merchant67379@belettersmail.com', company: 'google', message: 'Preview: https://tinyurl.com/4N45fxXS JUYEGRT11936THRT' },
    { name: 'Gino Delagarza', email: 'info@freeb2bdata.org', company: 'Gino Delagarza', message: 'We have over 252 countries ... https://Gino.freeb2bdata.org' },
  ];
  spam.forEach((f, i) => ok(R(f) !== '', `실제 스팸 ${i + 1} 차단`, f.email));
  ok(R({ name: 'CarlosScusa', email: 'x@gmail.com', company: 'google', message: 'promo', preReason: 'no-js' }) === 'no-js', 'PHP 가 판정한 no-js 를 그대로 따른다');
}

// ── 2) 실제 고객 문의 원문은 통과한다(리드·상담 시트의 진짜 문의) ──
{
  M.__set({});
  const real = [
    { name: 'Kyung-Suk Shin-Kiefer', email: 'shin.kiefer5@gmail.com', message: '안녕하세요 Saarland에서 사는 신경숙입니다 전에 전화드렸었죠 사진은 연주회 Plakat에 넣을 사진입니다', formCheck: 95000 },
    { name: '김정음', email: 'gjeummm@gmail.com', message: '올해 10월 중 프리웨딩 촬영 문의. 하이델베르크에서 촬영 가능한지와 추가 비용, 실내 촬영 후 실외로 이동', formCheck: 120000 },
    { name: '이홍규', email: 'ghdrb207@gmail.com', message: '졸업공연 및 프로필용 사진을 악기(기타)와 함께 촬영 희망. 금액 문의.' },
    { name: '왕혜연', email: 'wang0721@naver.com', message: '가족사진 문의. 캐나다·영국 거주 가족이 잠시 독일 방문. 어른 4명, 중학생 1명, 어린이 1명 총 6명.', formCheck: null },
    { name: 'Alice', email: 'alice.hyun314@outlook.com', company: '', message: '웨딩 / 암트 결혼식 상담. Instagram: https://www.instagram.com/studio_mean/ 참고했어요', formCheck: '' },
  ];
  real.forEach((f) => ok(R(f) === '', `실제 문의 통과 — ${f.name}`, R(f)));
  ok(R({ name: 'Anna Müller', email: 'anna@web.de', message: 'Hochzeit im Kurhaus Casino Wiesbaden am 12.6. — haben Sie noch frei?', formCheck: 80000 }) === '', '실제 행사장 이름(쿠어하우스 카지노)은 스팸 낱말이 아니다');
  ok(R({ name: 'Lea', email: 'lea@gmx.de', location: 'https://maps.app.goo.gl/AbC123', message: 'Treffpunkt siehe Link, Insta: https://bit.ly/lea-wedding', formCheck: 70000 }) === '', '구글 지도 공유(maps.app.goo.gl)·bit.ly 링크는 통과(실제 고객이 쓴다)');
}

// ── 3) 블랙리스트·속도·횟수 ──
{
  M.__set({ inquiry_blocklist: '@nolettersbox.com\nspam@example.com, 203.0.113.\nfreeb2bdata\n198.51.100.7' });
  ok(/^blocklist/.test(R({ email: 'sadler28189@nolettersbox.com', message: 'hi' })), '@도메인 차단');
  ok(R({ email: 'friend@lettersbox.com', message: 'hi' }) === '', '@도메인은 끝부분만 — 비슷한 도메인은 통과');
  ok(R({ email: 'friend@xnolettersbox.com', message: 'hi' }) === '', '@도메인은 도메인 전체 일치 — 이름이 겹치는 다른 도메인은 통과');
  ok(/^blocklist/.test(R({ email: 'SPAM@example.com', message: 'hi' })), '이메일 차단(대소문자 무시)');
  ok(/^blocklist/.test(R({ email: 'a@b.de', ip: '203.0.113.45', message: 'hi' })), 'IP 앞자리(끝이 .) 차단');
  ok(R({ email: 'a@b.de', ip: '198.51.100.70', message: 'hi' }) === '', 'IP 정확 일치 항목은 앞자리로 번지지 않는다');
  ok(/^blocklist/.test(R({ email: 'a@b.de', ip: '198.51.100.7', message: 'hi' })), 'IP 정확 일치 차단');
  ok(/^blocklist/.test(R({ email: 'a@b.de', name: 'x', message: 'Download at https://gino.FreeB2BData.org now' })) === false, "점 없는 낱말 'freeb2bdata' 는 내용에서 찾지 않는다");
  M.__set({ inquiry_blocklist: 'freeb2bdata.org\ngoogle\nseo' });
  ok(/^blocklist/.test(R({ email: 'a@b.de', name: 'x', message: 'Download at https://gino.FreeB2BData.org now' })), '점이 든 항목(링크 도메인)은 내용에서도 찾는다');
  ok(/^blocklist/.test(R({ email: 'a@b.de', name: 'Joxabila', company: 'google', message: 'hi' })), "낱말 'google' — 회사명 google 차단");
  ok(R({ email: 'a@b.de', name: '김민지', company: '', message: 'Google 지도에서 보고 연락드려요. found you on google' }) === '', "낱말 'google' 은 내용에서 찾지 않는다(실제 문의 보호)");
  ok(R({ email: 'a@b.de', name: 'Seoul Kim', company: 'Seoul Trading', message: 'hi' }) === '', "낱말 'seo' 가 'Seoul' 안에서 걸리지 않는다(낱말 단위)");
  M.__set({ inquiry_blocklist: '@nolettersbox.com\nspam@example.com, 203.0.113.\nfreeb2bdata\n198.51.100.7' });
  M.__set({ inquiry_blocklist: 'ab' });
  ok(R({ email: 'a@b.de', name: 'ab', company: 'AB Foto GmbH', message: 'about a family shoot' }) === '', '2자 이하 낱말은 무시(실제 문의를 마구 막지 않게)');
  M.__set({});
  ok(R({ email: 'a@b.de', message: 'hello', formCheck: 1200 }) === 'too-fast', '3초 안에 채운 폼 = 봇');
  ok(R({ email: 'a@b.de', message: 'hello', formCheck: 3500 }) === '', '3초 넘으면 통과');
  cacheStore.clear();
  const seq = [];
  for (let i = 0; i < 6; i++) seq.push(M.inquirySpamReason_({ email: `u${i}@x.de`, ip: '192.0.2.9', message: 'hello' }));
  ok(seq.slice(0, 5).every((r) => r === '') && seq[5] === 'rate-ip', '같은 IP 한 시간 5건 넘으면 차단', seq);
  cacheStore.clear();
  const seq2 = [];
  for (let i = 0; i < 4; i++) seq2.push(M.inquirySpamReason_({ email: 'same@x.de', message: 'hello' }));
  ok(seq2.slice(0, 3).every((r) => r === '') && seq2[3] === 'rate-email', '같은 이메일 한 시간 3건 넘으면 차단', seq2);
  ok(JSON.stringify(M.getInquiryBlocklistFromText_(' a@b.de \n\nA@B.DE, @x.com;foo ')) === '["a@b.de","@x.com","foo"]', '블랙리스트 저장 정규화(빈 줄·중복 제거)');
  cacheStore.clear();
  const own = [];
  for (let i = 0; i < 5; i++) own.push(M.inquirySpamReason_({ email: 'studio.mean.de@gmail.com', message: 'test' }));
  ok(own.every((r) => r === ''), '사장님 주소는 횟수 제한에 안 걸린다(테스트가 조용히 막히지 않게)', own);
  M.__set({ inquiry_blocklist: 'a@x.de\nb@x.de\nnew@other.de' });
  ok(JSON.stringify(M.mergeInquiryBlocklistEdit_('a@x.de\nc@x.de', 'a@x.de\nb@x.de')) === '["a@x.de","new@other.de","c@x.de"]', '설정 저장은 화면 기준 차이만 — 다른 곳에서 막은 new@other.de 를 지우지 않는다', M.mergeInquiryBlocklistEdit_('a@x.de\nc@x.de', 'a@x.de\nb@x.de'));
  ok(JSON.stringify(M.mergeInquiryBlocklistEdit_('z@x.de', undefined)) === '["z@x.de"]', 'base 가 없으면(구 화면) 통째로 교체');
  M.__set({});
  M.addInquiryBlocklistEntry_('=hyperlink("x")@evil.de');
  ok(/^'/.test(String(M.__raw().inquiry_blocklist || '')), "블랙리스트 셀 쓰기는 수식 무력화(공격자가 고른 이메일이 첫머리)", M.__raw().inquiry_blocklist);
  M.__set({});
}

// ── 4) 막힌 제출은 행·메일 없이 로그만, 통과하면 그대로 ──
{
  M.__set({}); M.__reset(); cacheStore.clear();
  const spamPayload = { name: 'Joxabila', email: 'floris@gmail.com', phone: '89455659384', company: 'google', consultationType: 'Business / Event', location: 'Nigeria',
    message: 'Preview: https://tinyurl.com/4747d22s', privacyConsent: true, ip: '192.0.2.1', spamReason: '' };
  const r1 = M.createConsultation_(spamPayload, {});
  const sh = M.__sheets();
  ok(r1.ok === true && !r1.rowIndex, '스팸 상담: 성공처럼 응답(봇에게 차단을 알리지 않음), 행 번호 없음', r1);
  ok(sh['상담'].rows.length === 1, '스팸 상담: 상담 시트에 행 없음', sh['상담'].rows.length);
  ok(M.__mails().length === 0, '스팸 상담: 사장님 알림·고객 접수확인 메일 없음(남의 주소로 안 나감)', M.__mails());
  ok(sh['스팸차단'] && sh['스팸차단'].rows.length === 2 && sh['스팸차단'].rows[1][1] === 'consult' && sh['스팸차단'].rows[1][2] === 'short-link', "'스팸차단' 시트에 사유와 함께 한 줄", sh['스팸차단'] && sh['스팸차단'].rows[1]);
  const r2 = M.createPortfolioLead_({ name: 'Bot', email: 'b@x.de', projectType: 'Sonstiges', message: 'hi', privacyConsent: true, spamReason: 'no-js', lang: 'en' }, {});
  ok(r2.ok === true && !r2.rowIndex && /\/en\/contact\/success\//.test(r2.successPath || ''), '스팸 리드: 성공 경로로 응답, 행 없음', r2);
  ok(sh['리드'].rows.length === 1 && M.__mails().length === 0, '스팸 리드: 리드 행·메일 없음');
  const r3 = M.createPortfolioLead_({ name: '김정음', email: 'gjeummm@gmail.com', projectType: 'Hochzeit', message: '프리웨딩 촬영 문의', privacyConsent: true, formCheck: 90000, spamReason: '' }, {});
  ok(r3.rowIndex === 2 && M.__mails().join(',') === 'lead-admin:gjeummm@gmail.com,lead-customer:gjeummm@gmail.com', '실제 리드: 행 + 알림 + 접수확인 그대로', [r3, M.__mails()]);
  const log = M.listInquirySpamLogForAgent_('t', { limit: 10 });
  ok(log.count === 2 && log.items[0].reason === 'no-js', '차단 로그 조회 액션(최신순)', log);
}

// ── 5) '스팸' 상태 = 닫고 블랙리스트 ──
{
  M.__set({}); M.__reset();
  const c = M.createConsultation_({ name: 'Vanessa', email: 'Sales@CareDogBest.com', consultationType: 'Sonstiges', message: 'new dog harness 50% OFF', privacyConsent: true, formCheck: 60000 }, {});
  ok(c.rowIndex === 2, '사장님이 판단할 애매한 영업 메일은 일단 접수', c);
  M.updateConsultationAdmin('t', 2, '스팸', '');
  ok(String(M.__sheets()['상담'].rows[1][M.CONSULTATION_COL['상태']]) === '스팸', "상담 상태 '스팸' 저장");
  ok(M.listInquirySpamLogForAgent_('t', {}).blocklist.indexOf('sales@caredogbest.com') > -1, "'스팸' 으로 바꾸면 그 이메일이 블랙리스트에", M.listInquirySpamLogForAgent_('t', {}).blocklist);
  cacheStore.clear();
  ok(/^blocklist/.test(M.inquirySpamReason_({ email: 'sales@caredogbest.com', message: 'again' })), '같은 주소의 다음 상담은 접수 안 됨');
  const l = M.createPortfolioLead_({ name: 'X', email: 'x@spam.test', projectType: 'Sonstiges', message: 'buy', privacyConsent: true, formCheck: 50000 }, {});
  M.updatePortfolioLeadStatusAdmin('t', l.rowIndex, '스팸', '');
  ok(M.listInquirySpamLogForAgent_('t', {}).blocklist.indexOf('x@spam.test') > -1, "리드도 '스팸' 저장 → 블랙리스트");
  ok(M.addInquiryBlocklistEntry_('studio.mean.de@gmail.com') === false && M.addInquiryBlocklistEntry_('sales@studio-mean.com') === false, '우리 주소(사칭 스팸)는 블랙리스트에 안 올린다');
  ok(M.addInquiryBlocklistEntry_('x@spam.test') === false, '이미 있는 주소는 중복 추가 안 함');
}

// ── 6) 공개 응답·화면·폼 배선 ──
{
  ok(!/inquiryBlocklist|inquiry_blocklist/.test(body(gs, 'getCustomerInitSettings_')), '블랙리스트는 공개 init 설정에 절대 싣지 않는다(봇이 읽고 우회)');
  ok(/settings:Object\.assign\(getCustomerInitSettings_\(\),\{inquiryBlocklist:getInquiryBlocklist_\(\)\.join\('\\n'\)\}\)/.test(body(gs, 'getInitDataAdmin')), '어드민 init 에만 블랙리스트');
  ok(/if\(s\.inquiryBlocklist!==undefined\) upsertSetting_\('inquiry_blocklist',neutralizeFormula_\(mergeInquiryBlocklistEdit_\(s\.inquiryBlocklist,s\.inquiryBlocklistBase\)/.test(gs), '설정 저장: 값이 왔을 때만 · 차이만 · 수식 무력화');
  ok(/inquiryBlocklistBase:\(document\.getElementById\('s_inquiry_blocklist'\)&&window\._inquiryBlocklistBase!=null\)\?window\._inquiryBlocklistBase:undefined/.test(adminHtml), '어드민 저장이 처음 받은 목록(base)을 함께 보낸다');
  const cb = body(gs, 'createConsultation_');
  ok(cb.indexOf('_parseConsultationAppointment_(payload,c)') > -1 && cb.indexOf('_parseConsultationAppointment_(payload,c)') < cb.indexOf('inquirySpamReason_('), '상담: 입력 오류 검사가 횟수 세기보다 먼저(고친 재제출이 조용히 막히지 않게)');
  ok(/if \(\$spamReason !== 'junk' && !is_array\(\$erp\)\) \{\s*error_log\(/.test(php), 'submit.php: 막혔는데 ERP 전달도 실패하면 서버 로그');
  ok(/inquiryBlocklist:document\.getElementById\('s_inquiry_blocklist'\)\?document\.getElementById\('s_inquiry_blocklist'\)\.value:undefined/.test(adminHtml), '어드민 설정 저장이 블랙리스트를 싣는다');
  ok((adminHtml.match(/,'종료','스팸'\];/g) || []).length === 2, "어드민 문의·상담 상태 목록에 '스팸'");
  ok(/function syncBlocklistBox\(/.test(adminHtml), '스팸 처리 직후 설정 칸 동기화(같은 화면에서 덮어쓰기 방지)');
  // submit.php — JS 실행 증거
  ok(/function client_check_reason\(string \$raw\): string\s*\{\s*if \(!preg_match\('\/\^js\\\.\(\\d\{1,9\}\)\$\/', \$raw, \$m\)\) \{\s*return 'no-js';\s*\}\s*return \(\(int\)\$m\[1\] < 3000\) \? 'too-fast' : '';/.test(php), 'submit.php: client_check 없으면 no-js, 3초 미만 too-fast');
  const iSpam = php.indexOf("if ($spamReason !== '') {"), iMail = php.indexOf('$sent = mail(');
  ok(iSpam > -1 && iMail > iSpam && /'spamReason' => \$spamReason,/.test(php), 'submit.php: 스팸은 ERP 에 사유를 넘기고(로그) 폴백 메일 전에 성공 페이지로');
  ok(!/if \(is_obvious_spam\(\$email, \$name, \$message\)\) \{\s*redirect_for_language/.test(php), 'submit.php: 알려진 스팸도 로그에 남긴다(조용히 사라지지 않음)');
  // contact-lead.js — 두 경로 모두 증거를 싣는다
  const iStamp = leadJs.indexOf("checkForm.addEventListener('submit', stampClientCheck, true)"), iFetchGuard = leadJs.indexOf('if (!form || !window.fetch) return;');
  ok(iStamp > -1 && iFetchGuard > iStamp, 'contact-lead.js: client_check 는 fetch 확인보다 앞(옛 브라우저의 PHP 제출도 증거를 싣는다)');
  const leadHash = createHash('sha256').update(readFileSync(join(ROOT, 'frontend', 'portfolio', 'contact-lead.js'))).digest('hex').slice(0, 10);
  for (const page of ['contact/index.html', 'en/contact/index.html', 'ko/contact/index.html']) {
    const html = readFileSync(join(ROOT, 'frontend', 'portfolio', page), 'utf8');
    ok(html.includes(`/contact-lead.js?v=${leadHash}`), `${page}: 새 contact-lead.js 해시를 가리킨다(npm run stamp — 옛 스크립트가 1년 캐시되면 폴백 문의가 no-js 로 막힌다)`, (html.match(/contact-lead\.js\?v=[a-f0-9]+/) || [''])[0]);
  }
  ok(/el\.value = 'js\.' \+ Math\.max\(0, Date\.now\(\) - loadedAt\);/.test(leadJs) && /formCheck: Math\.max\(0, Date\.now\(\) - loadedAt\)/.test(leadJs), 'contact-lead.js: PHP 폴백·GAS 직송 둘 다 경과 시간');
}

// ── 7) contact-lead.js(실제 방문자 경로)가 상담 문항을 상담 라우트로 보낸다 — submit.php $isConsultation 과 같은 규칙 ──
// 2026-10-01: JS 경로는 항상 portfolio-lead 로만 보내 웨딩·기업 문의의 회사·예산·범위가 사라졌다. 가짜 DOM 에서 스크립트를 실제로 돌린다.
{
  const runLead = async (lang, fields) => {
    const sent = [];
    let onSubmit, clock = 1e12;
    const form = { addEventListener: (t, fn, capture) => { if (!capture) onSubmit = fn; }, querySelector: () => null, appendChild() {}, submit() { sent.push({ fallback: true }); } };
    const win = { location: { href: `https://studio-mean.com/${lang === 'de' ? '' : lang + '/'}contact/`, search: '' } };
    win.fetch = (url, opt) => { sent.push({ url, body: JSON.parse(opt.body) }); return Promise.resolve({ json: () => ({ ok: true, data: { ok: true, id: 'C1', rowIndex: 5 } }) }); };
    const all = { name: '테스트', email: 'studio.mean.de@gmail.com', project_type: 'Wedding', preferred_date: '2027-05', message: '본식 문의', privacy_consent: 'on', site_language: lang, ...fields };
    vm.runInNewContext(leadJs, { window: win, fetch: win.fetch, document: { querySelector: () => form }, navigator: {}, FormData: function () { return { get: (k) => (k in all ? all[k] : null) }; },
      URLSearchParams, AbortController, setTimeout, clearTimeout, Date: { now: () => clock } });
    clock += 60000;   // 사람이 1분 걸려 폼을 채운다(3초 미만이면 GAS 가 too-fast 로 버린다)
    onSubmit({ preventDefault() {} });
    await new Promise((r) => setTimeout(r, 0));
    return { req: sent[0], href: win.location.href };
  };
  const route = (r) => (r.req && r.req.url.match(/\?api=([\w-]+)/) || [])[1];
  const wed = await runLead('en', { budget: '1,000–2,000€', deliverables: 'Photo + Video', scope: '6h ceremony', company: '' });
  ok(route(wed) === 'consultation', 'contact-lead.js: 상담 문항이 있으면 ?api=consultation', wed.req && wed.req.url);
  ok(wed.href === '/en/contact/success/', 'contact-lead.js: 상담 응답엔 successPath 가 없어도 언어별 성공 페이지로', wed.href);
  ok(route(await runLead('ko', { company: 'KOTRA', budget: '미정', deliverables: '미정', scope: '' })) === 'consultation', 'contact-lead.js: 회사명만 있어도 상담');
  ok(route(await runLead('de', { budget: '2.000€ oder mehr', deliverables: 'Noch offen', scope: '', company: '' })) === 'consultation', 'contact-lead.js: 예산만 골라도 상담');
  for (const [lang, und] of [['ko', '미정'], ['en', 'Not decided'], ['de', 'Noch offen']]) {
    const r = await runLead(lang, { project_type: 'Portrait', budget: und, deliverables: und, scope: '', company: '' });
    ok(route(r) === 'portfolio-lead', `contact-lead.js: 상담 문항이 기본값(${und})뿐이면 리드`, route(r));
  }
  ok(route(await runLead('de', {})) === 'portfolio-lead', 'contact-lead.js: 상담 칸이 없는 폼(옛 페이지)도 리드');
  // 그 payload 를 진짜 GAS 상담 라우트에 넣는다 — 필수항목 검사 통과 + 회사·예산·범위가 시트에 남는다
  M.__set({}); M.__reset(); cacheStore.clear();
  const biz = await runLead('ko', { project_type: '기업 / 행사', budget: '1,000–2,000€', deliverables: '사진 + 영상', scope: '행사 반나절', company: 'KOTRA' });
  let threw = '';
  try { M.assertPublicConsultationPayload_(biz.req.body.data, biz.req.body); } catch (e) { threw = e.message; }
  ok(threw === '', 'GAS assertPublicConsultationPayload_: JS payload 통과(name/email/consultationType/privacyConsent)', threw);
  const cr = M.createConsultation_(biz.req.body.data, {});
  const row = (M.__sheets()['상담'].rows[cr.rowIndex - 1] || []);
  const C = M.CONSULTATION_COL;
  ok(typeof biz.req.body.data.formCheck === 'number' && biz.req.body.data.formCheck >= 3000, 'contact-lead.js: 상담 라우트에도 formCheck(JS 실행 증거)', biz.req.body.data.formCheck);
  ok(cr.rowIndex === 2 && row[C['상담유형']] === '기업 / 행사' && row[C['회사명']] === 'KOTRA' && row[C['예산']] === '1,000–2,000€' && row[C['언어']] === 'ko' && row[C['촬영예정일']] === '2027-05',
    'GAS createConsultation_: 상담유형·회사·예산·언어·촬영예정일 저장', row);
  const survey = JSON.parse(row[C['설문JSON']] || '{}');
  ok(survey.custom && survey.custom.scope === '행사 반나절' && survey.custom.deliverables === '사진 + 영상', 'GAS createConsultation_: 범위·결과물이 설문JSON 에', survey);
}

if (fail) { console.error(`\n✗ 문의 스팸 차단 검사 실패 ${fail}건`); process.exit(1); }
console.log('✓ 문의 스팸 차단 — 실제 스팸 차단·실제 문의 통과·행/메일 없음·로그·스팸→블랙리스트·공개 미노출·폼 배선 전부 일치');
