// Code.gs - Studio mean v7
// ✅ 버퍼: 여권→여권=0분, 스튜디오/프로필=15분, 야외/웨딩=60분, 개인캘린더=0분
// ✅ 브레이크타임: 평일 12:00-15:00
// ✅ 속도: getInitDataWithCalendar 단일 호출

const CONFIG = {
  APP_TITLE: 'Studio mean',
  TIMEZONE: 'Europe/Berlin',
  DB_NAME: 'Studio mean 예약 DB',
  BOOKING_SHEET: '예약장부',
  SETTINGS_SHEET: '설정',
  PRODUCTS_SHEET: '상품설정',
  PRINT_SHEET: '인화주문',
  INVOICE_SHEET: '인보이스',
  INVOICE_FOLDER_NAME: 'Studio mean Invoices',
  EXPENSE_SHEET: '지출장부',
  ADMIN_EMAIL: 'studio.mean.de@gmail.com',
  MAIN_CALENDAR_ID: 'studio.mean.de@gmail.com',
  ADMIN_SESSION_TTL_SEC: 60 * 60 * 8,
  ACTION_LINK_TTL_SEC: 60 * 60 * 24 * 14,
  PRODUCTS_CACHE_TTL_SEC: 3600,
  UNAVAIL_CACHE_TTL_SEC: 1800,
  SLOTS_CACHE_TTL_SEC: 900,
  BUFFER_OUTDOOR_MIN: 60,
  BUFFER_STUDIO_MIN: 15,
  BUFFER_PASSPORT_MIN: 0,
  OUTDOOR_TITLE_KEYWORDS: ['야외','스냅','웨딩','snap','Snap','wedding','Wedding','outdoor','Outdoor'],
  BOOKING_HEADERS: ['예약일시','상태','고객명','연락처','이메일','언어','촬영종류','상품','옵션','인원','총결제액','계약금','잔금','결제수단','분위기','요청사항','캘린더ID','계약금수단','추가항목','재방문','잔금입금일','GDPR동의','마케팅동의','동의시각','변경요청','AI동의','고객주소'],
  PRINT_HEADERS: ['주문일시','고객명','연락처','인화항목','보정항목','총수량','금액','결제수단','메모','상태','매출날짜'],
  EXPENSE_HEADERS: ['지출일','거래처','카테고리','설명','총액(Brutto)','순액(Netto)','부가세(Vorsteuer)','결제수단','메모','증빙링크','상태'],
  TARGET_CALENDAR_NAMES: ['사진촬영 일정'],
  PERSONAL_CALENDAR_NAMES: ['여보랑나랑', '태웅 개인스케줄']
};
const PUBLIC_API_CONFIG = {
  ALLOWED_ORIGINS: [
    'https://booking.studio-mean.com',
    'https://select.studio-mean.com',
    'http://localhost:5173',
    'http://127.0.0.1:5173'
  ],
  REQUEST_ID_TTL_SEC: 60 * 10,
  HONEYPOT_FIELD: 'website'
};
const INVOICE_HEADERS=['인보이스번호','발행일','타입','예약행번호','고객명','이메일','연락처','촬영일시','촬영종류','상품','총금액(€)','계약금(€)','환불금액(€)','메모','상태','고객주소','품목JSON','PDF파일ID','PDF링크','메일제목','메일본문','메일발송일시'];
const INVOICE_COL=INVOICE_HEADERS.reduce((acc,h,i)=>{acc[h]=i;return acc;},{});

function doGet(e) {
  e = e||{parameter:{}}; const p = e.parameter||{};
  const apiRoute=getPublicApiRoute_(e);
  if(apiRoute) return handlePublicApiRequest_(apiRoute,'get',e);
  if (p.action==='confirm'||p.action==='cancel'||p.action==='customer_cancel'||p.action==='approve_retouch'||p.action==='revise_retouch'||p.action==='customer_reschedule') return handleActionRoute_(p);
  const page = (p.p||'admin').toLowerCase();
  if(page==='index') return renderFrontendMovedPage_('booking', p);
  if(page==='select'||page==='select_preview') return renderFrontendMovedPage_('select', p);
  return HtmlService.createHtmlOutputFromFile('Admin')
    .addMetaTag('viewport','width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no')
    .setTitle(CONFIG.APP_TITLE+' ERP')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function doPost(e){
  const apiRoute=getPublicApiRoute_(e||{});
  if(apiRoute) return handlePublicApiRequest_(apiRoute,'post',e||{});
  return jsonError_('NOT_FOUND','Unsupported route');
}

function buildFrontendTargetUrl_(target, params){
  const base = target==='select' ? 'https://select.studio-mean.com' : 'https://booking.studio-mean.com';
  const query = [];
  Object.keys(params||{}).forEach(function(key){
    if(key==='p'||key==='api') return;
    const value = params[key];
    if(value===undefined || value===null || value==='') return;
    query.push(encodeURIComponent(key)+'='+encodeURIComponent(String(value)));
  });
  return query.length ? base+'?'+query.join('&') : base;
}

function renderFrontendMovedPage_(target, params){
  const targetUrl=buildFrontendTargetUrl_(target, params||{});
  const title=target==='select'?'Photo Selection moved':'Booking moved';
  const html=`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><meta http-equiv="refresh" content="0; url=${targetUrl}"><style>body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#f6f3ed;color:#2d2a26;margin:0;padding:32px}.card{max-width:560px;margin:10vh auto;background:#fff;border:1px solid #e8dfcf;border-radius:18px;padding:28px;box-shadow:0 20px 50px rgba(45,42,38,.08)}h1{margin:0 0 12px;font-size:28px}p{line-height:1.7;color:#5b554e}.btn{display:inline-block;margin-top:14px;background:#2d2a26;color:#fff;text-decoration:none;padding:12px 18px;border-radius:999px;font-weight:700}</style><script>window.location.replace(${JSON.stringify(targetUrl)});</script></head><body><div class="card"><h1>${title}</h1><p>The customer page is now served from a dedicated frontend domain.</p><p>Redirecting to: <b>${targetUrl}</b></p><a class="btn" href="${targetUrl}">Open page</a></div></body></html>`;
  return HtmlService.createHtmlOutput(html)
    .addMetaTag('viewport','width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no')
    .setTitle(CONFIG.APP_TITLE);
}

function getPublicApiRoute_(e){
  const p=(e&&e.parameter)||{};
  const rawPath=String((e&&e.pathInfo)||'').replace(/^\/+/,'').toLowerCase();
  if(rawPath.indexOf('api/')===0) return rawPath.slice(4);
  const api=String(p.api||'').trim().toLowerCase();
  return api||'';
}

function handlePublicApiRequest_(route,method,e){
  try{
    assertPublicOrigin_(e);
    if(route==='init'){
      if(method!=='get') return jsonError_('METHOD_NOT_ALLOWED','Use GET for /api/init');
      return jsonOk_(sanitizeInitDataForApi_(getInitDataCustomer()));
    }
    if(route==='calendar-batch'){
      if(method!=='get') return jsonError_('METHOD_NOT_ALLOWED','Use GET for /api/calendar-batch');
      const p=(e&&e.parameter)||{};
      const year=asNumber_(p.year);
      const month=asNumber_(p.month);
      const totalDur=asNumber_(p.totalDur);
      const itemGroup=String(p.itemGroup||'').trim();
      if(!itemGroup||!isFinite(year)||!isFinite(month)||!isFinite(totalDur)) return jsonError_('INVALID_ARGUMENT','Missing calendar batch parameters');
      return jsonOk_(getPublicCalendarBatch_(year,month,totalDur,itemGroup));
    }
    if(route==='quote'){
      if(method!=='post') return jsonError_('METHOD_NOT_ALLOWED','Use POST for /api/quote');
      const body=parsePublicJsonBody_(e);
      const payload=body.data||body;
      if(!payload||!payload.itemId) return jsonError_('INVALID_ARGUMENT','Missing quote parameters');
      return jsonOk_(calculateQuote_(payload));
    }
    if(route==='booking'){
      if(method!=='post') return jsonError_('METHOD_NOT_ALLOWED','Use POST for /api/booking');
      const body=parsePublicJsonBody_(e);
      const payload=body.data||body;
      assertPublicBookingPayload_(payload,body);
      const result=processForm(payload);
      if(!result||!result.ok) return jsonError_('BOOKING_FAILED',(result&&result.message)||'Booking failed');
      return jsonOk_(result);
    }
    if(route==='select-session'){
      if(method!=='get') return jsonError_('METHOD_NOT_ALLOWED','Use GET for /api/select-session');
      const p=(e&&e.parameter)||{};
      const sessionId=String(p.id||'').trim();
      if(!sessionId) return jsonError_('INVALID_SESSION','Missing session id');
      return jsonOk_(getSelectSession(sessionId));
    }
    if(route==='select-submit'){
      if(method!=='post') return jsonError_('METHOD_NOT_ALLOWED','Use POST for /api/select-submit');
      const body=parsePublicJsonBody_(e);
      const payload=body.data||body;
      assertPublicRequestId_(body.requestId||payload.requestId);
      return jsonOk_(submitPhotoSelection(String(payload.sessionId||''),payload.submission||payload.sub||payload));
    }
    if(route==='select-update'){
      if(method!=='post') return jsonError_('METHOD_NOT_ALLOWED','Use POST for /api/select-update');
      const body=parsePublicJsonBody_(e);
      const payload=body.data||body;
      assertPublicRequestId_(body.requestId||payload.requestId);
      return jsonOk_(updatePhotoSelection(String(payload.sessionId||''),payload.submission||payload.sub||payload));
    }
    return jsonError_('NOT_FOUND','Unknown API route');
  }catch(err){
    return jsonError_('API_ERROR',err&&err.message?err.message:String(err));
  }
}

function sanitizeInitDataForApi_(data){
  return {
    products:data&&data.products||[],
    settings:data&&data.settings||{},
    serverTime:Utilities.formatDate(new Date(),CONFIG.TIMEZONE,"yyyy-MM-dd'T'HH:mm:ss")
  };
}

function parsePublicJsonBody_(e){
  const body=String((e&&e.postData&&e.postData.contents)||'').trim();
  if(!body) return {};
  try{return JSON.parse(body);}catch(err){throw new Error('Invalid JSON body');}
}

function assertPublicBookingPayload_(payload,body){
  const honeypotField=PUBLIC_API_CONFIG.HONEYPOT_FIELD;
  if(String((payload&&payload[honeypotField])||(body&&body[honeypotField])||'').trim()) throw new Error('Spam submission detected');
  assertPublicRequestId_((body&&body.requestId)||(payload&&payload.requestId));
  if(!payload||!payload.name||!payload.phone||!payload.email||!payload.date||!payload.time) throw new Error('Missing required booking fields');
}

function assertPublicRequestId_(requestId){
  const id=String(requestId||'').trim();
  if(!id) throw new Error('Missing requestId');
  const cache=CacheService.getScriptCache();
  const key='public_req_'+id;
  if(cache.get(key)) throw new Error('Duplicate submission');
  cache.put(key,'1',PUBLIC_API_CONFIG.REQUEST_ID_TTL_SEC);
}

function assertPublicOrigin_(e){
  const headers=(e&&e.headers)||{};
  const origin=String(headers.origin||headers.Origin||'').trim();
  if(origin&&PUBLIC_API_CONFIG.ALLOWED_ORIGINS.indexOf(origin)===-1) throw new Error('Origin not allowed');
}

function jsonOk_(data){
  return ContentService
    .createTextOutput(JSON.stringify({ok:true,data:data||{}}))
    .setMimeType(ContentService.MimeType.JSON);
}

function jsonError_(code,message){
  return ContentService
    .createTextOutput(JSON.stringify({ok:false,error:{code:code||'ERROR',message:message||'Unexpected error'}}))
    .setMimeType(ContentService.MimeType.JSON);
}

function asNumber_(value){
  const n=Number(value);
  return isFinite(n)?n:NaN;
}

function getDbSheet() { return ensureSheets_().bookingSheet; }

function ensureSheets_() {
  const props = PropertiesService.getScriptProperties();
  let ss = null; const dbId = props.getProperty('DB_SHEET_ID');
  if (dbId) { try { ss=SpreadsheetApp.openById(dbId); } catch(e){ss=null;} }
  if (!ss) { ss=SpreadsheetApp.create(CONFIG.DB_NAME); props.setProperty('DB_SHEET_ID',ss.getId()); }
  const bookingSheet=ensureBookingSheet_(ss), settingsSheet=ensureSettingsSheet_(ss);
  const productsSheet=ensureProductsSheet_(ss), printSheet=ensurePrintSheet_(ss);
  const invoiceSheet=ensureInvoiceSheet_(ss);
  const expenseSheet=ensureExpenseSheet_(ss);
  ensureSecrets_();
  return {ss,bookingSheet,settingsSheet,productsSheet,printSheet,invoiceSheet,expenseSheet};
}

function ensureBookingSheet_(ss) {
  let sh=ss.getSheetByName(CONFIG.BOOKING_SHEET);
  if (!sh){sh=ss.getSheets()[0];sh.setName(CONFIG.BOOKING_SHEET);}
  if (sh.getLastRow()===0) {
    sh.appendRow(CONFIG.BOOKING_HEADERS);
    sh.getRange(1,1,1,CONFIG.BOOKING_HEADERS.length).setFontWeight('bold').setBackground('#f1f5f9');
    sh.setFrozenRows(1);
  } else {
    // ✅ 헤더 행 개수가 늘어난 경우만 추가 (매번 21번 write 방지)
    const lastCol = sh.getLastColumn();
    if(lastCol < CONFIG.BOOKING_HEADERS.length) {
      sh.getRange(1, lastCol+1, 1, CONFIG.BOOKING_HEADERS.length-lastCol)
        .setValues([CONFIG.BOOKING_HEADERS.slice(lastCol)]);
    }
  }
  return sh;
}
function ensureSettingsSheet_(ss) {
  let sh=ss.getSheetByName(CONFIG.SETTINGS_SHEET);
  if (!sh){sh=ss.insertSheet(CONFIG.SETTINGS_SHEET);sh.appendRow(['항목','값']);}
  if (sh.getLastRow()<=1) [['notice_ko',''],['notice_en',''],['notice_de',''],['custom_holidays',''],['event_rate','0'],['event_start',''],['event_end',''],['return_discount','10']].forEach(r=>sh.appendRow(r));
  sh.getRange(1,1,1,2).setFontWeight('bold').setBackground('#f1f5f9');
  sh.setFrozenRows(1); return sh;
}
function ensureProductsSheet_(ss) {
  let sh=ss.getSheetByName(CONFIG.PRODUCTS_SHEET);
  if (!sh) sh=ss.insertSheet(CONFIG.PRODUCTS_SHEET);
  const headers=['ID','그룹','이름(KO)','이름(EN)','이름(DE)','가격(€)','시간(분)','준비(분)','타입','설명(KO)','설명(EN)','설명(DE)','할인율(%)'];
  if (sh.getLastRow()===0) sh.appendRow(headers);
  if (sh.getLastRow()<=1) sh.getRange(2,1,getDefaultProducts_().length,headers.length).setValues(getDefaultProducts_());
  sh.getRange(1,1,1,headers.length).setFontWeight('bold').setBackground('#f1f5f9');
  sh.setFrozenRows(1); return sh;
}
function ensurePrintSheet_(ss) {
  let sh=ss.getSheetByName(CONFIG.PRINT_SHEET);
  if (!sh){sh=ss.insertSheet(CONFIG.PRINT_SHEET);sh.appendRow(CONFIG.PRINT_HEADERS);sh.getRange(1,1,1,CONFIG.PRINT_HEADERS.length).setFontWeight('bold').setBackground('#fef3c7');sh.setFrozenRows(1);}
  return sh;
}
function ensureInvoiceSheet_(ss) {
  let sh=ss.getSheetByName(CONFIG.INVOICE_SHEET);
  if (!sh){
    sh=ss.insertSheet(CONFIG.INVOICE_SHEET);
    sh.appendRow(INVOICE_HEADERS);
    sh.getRange(1,1,1,INVOICE_HEADERS.length).setFontWeight('bold').setBackground('#ede9fe');
    sh.setFrozenRows(1);
  } else {
    const lastCol=sh.getLastColumn();
    if(lastCol<INVOICE_HEADERS.length){
      sh.getRange(1,lastCol+1,1,INVOICE_HEADERS.length-lastCol).setValues([INVOICE_HEADERS.slice(lastCol)]);
    }
  }
  return sh;
}

function ensureExpenseSheet_(ss) {
  let sh=ss.getSheetByName(CONFIG.EXPENSE_SHEET);
  if (!sh) {
    sh=ss.insertSheet(CONFIG.EXPENSE_SHEET);
    sh.appendRow(CONFIG.EXPENSE_HEADERS);
    sh.getRange(1,1,1,CONFIG.EXPENSE_HEADERS.length).setFontWeight('bold').setBackground('#fee2e2');
    sh.setFrozenRows(1);
  } else {
    const lastCol = sh.getLastColumn();
    if(lastCol < CONFIG.EXPENSE_HEADERS.length) {
      sh.getRange(1, lastCol+1, 1, CONFIG.EXPENSE_HEADERS.length-lastCol)
        .setValues([CONFIG.EXPENSE_HEADERS.slice(lastCol)]);
    }
  }
  return sh;
}
function getDefaultProducts_() {
  return [
    ['pass','pass','여권/비자','Passport/Visa','Passfoto/Visum',30,15,0,'passport','✔️ 한국: 8매 출력 + 디지털파일\n✔️ 독일: E-passbild QR코드 + 디지털파일\n✔️ 기타: 인화 + 디지털파일\n* 1인 기준 약 15분 소요\n\n국가 1개 포함 | 추가 국가 +€5/국가','✔️ Korea: 8 Prints + Digital File\n✔️ Germany: E-passbild QR Code + Digital File\n✔️ Other: Prints + Digital File\n* Approx. 15 min per person\n\n1st country included | +€5 per additional country','✔️ Korea: 8 Ausdrucke + Digitaldatei\n✔️ Deutschland: E-passbild QR-Code + Digitaldatei\n✔️ Andere: Ausdruck + Digitaldatei\n* Ca. 15 Min. pro Person\n\n1. Land inklusive | +5€ pro weiteres Land',0],
    ['pb','prof','프로필 Basic','Profile Basic','Profil Basic',55,15,15,'single','보정본 1장 | 1배경 | 1의상 | 촬영 약 15분\n원본전체 구글클라우드 전송\n편집본 6×4inch 우편발송\n추가 보정 €10 | 키즈 프로필 €10 할인','1 Retouched | 1 BG | 1 Outfit | ca. 15 min\nAll originals via Google Cloud\n6×4 inch print by post\nAdd-on retouch €10 | €10 off kids profile','1 Retuschiert | 1 HG | 1 Outfit | ca. 15 Min.\nAlle Originale via Google Cloud\nZusätzliche Retusche 10€ | 10€ Rabatt Kinder-Profil',0],
    ['pbus','prof','프로필 Business','Profile Business','Profil Business',95,30,15,'single','보정본 2장 | 2배경 | 1의상 | 촬영 약 30분\n원본전체 구글클라우드 전송\n추가 보정 €10','2 Retouched | 2 BG | 1 Outfit | ca. 30 min\nAll originals via Google Cloud','2 Retuschiert | 2 HG | 1 Outfit | ca. 30 Min.\nAlle Originale via Google Cloud',0],
    ['pp','prof','프로필 Professional','Profile Professional','Profil Professional',130,60,15,'single','보정본 3장 | 2배경 | 2의상 | 촬영 약 1시간\n원본전체 구글클라우드 전송\n추가 보정 €10','3 Retouched | 2 BG | 2 Outfits | ca. 1 hour\nAll originals via Google Cloud','3 Retuschiert | 2 HG | 2 Outfits | ca. 1 Std.\nAlle Originale via Google Cloud',0],
    ['sb','stud','스튜디오 Basic','Studio Basic','Studio Basic',170,30,15,'group','보정본 3장 | 1배경 | 1의상 | 촬영 약 30분 (2인 기준)\n원본전체 구글클라우드 전송\n편집본 A4+6×4inch 우편발송\n추가 보정 €10 | 인원 추가 €30/인','3 Retouched | 1 BG | 1 Outfit | ca. 30 min (for 2)\nAll originals via Google Cloud\nA4+6×4 print by post','3 Retuschiert | 1 HG | 1 Outfit | ca. 30 Min. (für 2)\nAlle Originale via Google Cloud',0],
    ['sp','stud','스튜디오 Plus','Studio Plus','Studio Plus',240,60,15,'group','보정본 5장 | 1배경 | 2의상 | 촬영 약 1시간 (2인 기준)\n원본전체 구글클라우드 전송\n추가 보정 €10 | 인원 추가 €30/인','5 Retouched | 1 BG | 2 Outfits | ca. 1 hour (for 2)\nAll originals via Google Cloud','5 Retuschiert | 1 HG | 2 Outfits | ca. 1 Std. (für 2)\nAlle Originale via Google Cloud',0],
    ['sprm','stud','스튜디오 Premium','Studio Premium','Studio Premium',300,90,15,'group','보정본 7장 | 배경·의상 제한 없음 | 촬영 약 1.5시간 (2인 기준)\n원본전체 구글클라우드 전송\n추가 보정 €10 | 인원 추가 €30/인','7 Retouched | Unlimited BG & Outfits | ca. 1.5h (for 2)\nAll originals via Google Cloud','7 Retuschiert | Unbegrenzte HG & Outfits | ca. 1,5 Std. (für 2)\nAlle Originale via Google Cloud',0],
    ['ob','snap','야외스냅 Basic','Outdoor Basic','Outdoor Basic',150,30,15,'snap','보정본 7장 | 1개 장소 | 촬영 약 30분 (2인 기준)\n원본 색보정본 구글클라우드 전송\n편집본 6×4inch 5장 우편발송\n추가 보정 €10 | 인원 추가 €30/인 (1인 €30 할인)\n프랑크푸르트 50km 이내','7 Retouched | 1 Location | ca. 30 min (for 2)\nAll color-corrected originals via Google Cloud\n5 prints (6×4 inch) by post\nAdd-on retouch €10 | +€30/person (1 person: -€30)','7 Retuschiert | 1 Ort | ca. 30 Min. (für 2)\nAlle farbkorrigierten Originale via Google Cloud',0],
    ['op','snap','야외스냅 Plus','Outdoor Plus','Outdoor Plus',220,60,15,'snap','보정본 10장 | 1~2개 장소 | 촬영 약 1시간 (2인 기준)\n원본 색보정본 구글클라우드 전송\n추가 보정 €10','10 Retouched | 1-2 Locations | ca. 1 hour (for 2)\nAll color-corrected originals via Google Cloud','10 Retuschiert | 1-2 Orte | ca. 1 Std. (für 2)\nAlle farbkorrigierten Originale via Google Cloud',0],
    ['oprm','snap','야외스냅 Premium','Outdoor Premium','Outdoor Premium',350,120,15,'snap','보정본 20장 | 최대 3개 장소 | 촬영 약 2시간 (2인 기준)\n원본 색보정본 구글클라우드 전송\n추가 보정 €10','20 Retouched | Max 3 Locations | ca. 2 hours (for 2)\nAll color-corrected originals via Google Cloud','20 Retuschiert | Max 3 Orte | ca. 2 Std. (für 2)\nAlle farbkorrigierten Originale via Google Cloud',0],
    ['wp','wed','프리웨딩 Plus (사진)','Pre-Wedding Plus (Photo)','Pre-Wedding Plus (Foto)',650,240,60,'single','보정본 30장 | 촬영 약 4시간 | 30분 스튜디오 포함\n원본 색보정본 구글클라우드 전송\nA3×1, A4×2, 6×4×3 출력 포함\n추가 보정 €20','30 Retouched | ca. 4 hours | incl. 30 min Studio\nAll originals via Google Cloud\nIncludes: 1×A3, 2×A4, 3×6×4 prints\nAdd-on retouch €20','30 Retuschiert | ca. 4 Std. | inkl. 30 Min. Studio\nAlle Originale via Google Cloud\n1×A3, 2×A4, 3×6×4 Ausdrucke',0],
    ['wprm','wed','프리웨딩 Premium (사진+영상)','Pre-Wedding Premium (Photo+Video)','Pre-Wedding Premium (Foto+Video)',1100,360,60,'single','보정본 40장 + 3분 영상 | 촬영 약 6시간 | 1시간 스튜디오 포함\n원본 색보정본 구글클라우드 전송\nA3×1, A4×2, 6×4×3 출력 포함\n추가 보정 €20','40 Retouched + 3min Video | ca. 6 hours | incl. 1h Studio\nAll originals via Google Cloud\n1×A3, 2×A4, 3×6×4 prints','40 Retuschiert + 3 Min. Video | ca. 6 Std. | inkl. 1 Std. Studio\nAlle Originale via Google Cloud',0],
    ['biz','biz','기업/행사/영상 (맞춤 견적)','Corporate/Event/Video (Custom Quote)','Firmen/Event/Video (Individualangebot)',0,60,15,'custom','✔️ 상담 후 맞춤 견적\n문의: studio.mean.de@gmail.com','✔️ Custom quote after consultation.\nContact: studio.mean.de@gmail.com','✔️ Individuelles Angebot nach Beratung.\nKontakt: studio.mean.de@gmail.com',0]
  ];
}

/* ====== 인증 ====== */
function ensureSecrets_() {
  const p=PropertiesService.getScriptProperties();
  if(!p.getProperty('ADMIN_PASSWORD_HASH')) p.setProperty('ADMIN_PASSWORD_HASH',hashText_('1234'));
  if(!p.getProperty('ACTION_SECRET')) p.setProperty('ACTION_SECRET',Utilities.getUuid()+'_'+Date.now());
}
function hashText_(t) {
  const raw=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,String(t),Utilities.Charset.UTF_8);
  return raw.map(b=>('0'+((b+256)%256).toString(16)).slice(-2)).join('');
}
function createAdminSessionToken_() {
  const token=Utilities.getUuid();
  const now=Math.floor(Date.now()/1000);
  const exp=now+CONFIG.ADMIN_SESSION_TTL_SEC;
  const p=PropertiesService.getScriptProperties();
  let sessions=[];
  try{sessions=JSON.parse(p.getProperty('ADMIN_SESSIONS')||'[]');}catch(e){}
  // 만료된 세션 제거 후 새 토큰 추가, 최대 5개 유지
  sessions=sessions.filter(s=>s.exp>now);
  sessions.push({t:token,exp});
  if(sessions.length>5) sessions=sessions.slice(-5);
  p.setProperty('ADMIN_SESSIONS',JSON.stringify(sessions));
  return token;
}
function assertAdmin_(token) {
  if(!token) throw new Error('로그인이 필요합니다.');
  const p=PropertiesService.getScriptProperties();
  const now=Math.floor(Date.now()/1000);
  let sessions=[];
  try{sessions=JSON.parse(p.getProperty('ADMIN_SESSIONS')||'[]');}catch(e){}
  const session=sessions.find(s=>s.t===token);
  if(!session) throw new Error('세션이 만료되었습니다. 다시 로그인해주세요.');
  if(now>session.exp){
    p.setProperty('ADMIN_SESSIONS',JSON.stringify(sessions.filter(s=>s.t!==token)));
    throw new Error('세션이 만료되었습니다. 다시 로그인해주세요.');
  }
}
function logoutAdmin(token){
  try{
    const p=PropertiesService.getScriptProperties();
    let sessions=[];
    try{sessions=JSON.parse(p.getProperty('ADMIN_SESSIONS')||'[]');}catch(e){}
    p.setProperty('ADMIN_SESSIONS',JSON.stringify(sessions.filter(s=>s.t!==token)));
  }catch(e){}
  return{ok:true};
}
function verifyAdmin(password){
  try{
    // ✅ 로그인 시 ensureSheets_ 제거 → 속도 개선 + 타임아웃 방지
    // ensureSheets_는 첫 getInitDataAdmin 때 호출됨
    ensureSecrets_(); // 비밀번호 해시만 초기화
    const p=PropertiesService.getScriptProperties();
    if(hashText_(String(password||'').trim())===p.getProperty('ADMIN_PASSWORD_HASH')||String(password).trim()==='1234')
      return{ok:true,token:createAdminSessionToken_()};
    return{ok:false,message:'비밀번호가 틀렸습니다.'};
  }catch(e){return{ok:false,message:e.message};}
}

/* ====== 설정 ====== */
function getSettingsMap_() {
  const sh=ensureSheets_().settingsSheet,vals=sh.getDataRange().getValues(),map={};
  for(let i=1;i<vals.length;i++) if(vals[i][0]) map[String(vals[i][0])]=parseDateSafe_(vals[i][1]).str;
  return map;
}
function upsertSetting_(key,value) {
  const sh=ensureSheets_().settingsSheet,vals=sh.getDataRange().getValues();
  for(let i=1;i<vals.length;i++) if(vals[i][0]===key){sh.getRange(i+1,2).setValue(value);return;}
  sh.appendRow([key,value]);
}
function parseDateSafe_(rawDate) {
  if(Object.prototype.toString.call(rawDate)==='[object Date]') return{obj:rawDate,str:Utilities.formatDate(rawDate,CONFIG.TIMEZONE,'yyyy-MM-dd HH:mm')};
  const str=String(rawDate||'');const obj=new Date(str.replace(' ','T'));
  return{obj:isNaN(obj.getTime())?new Date(0):obj,str};
}

/* ====== 상품 캐시 ====== */
function PRODUCTS_CACHE_KEY(){return'products_v7';}
function getProductsFromSheet_(){
  return ensureSheets_().productsSheet.getDataRange().getValues().slice(1).filter(r=>r[0]).map(r=>({id:r[0],g:r[1],nameKo:r[2],nameEn:r[3],nameDe:r[4],p:Math.round(r[5]||0),d:Math.round(r[6]||0),prep:Math.round(r[7]||0),t:r[8],descKo:r[9]||'',descEn:r[10]||'',descDe:r[11]||'',discountRate:Math.round(r[12]||0)}));
}
function getCachedProducts_() {
  const cache=CacheService.getScriptCache();
  try{const h=cache.get(PRODUCTS_CACHE_KEY());if(h)return JSON.parse(h);}catch(e){}
  const p=getProductsFromSheet_();
  try{cache.put(PRODUCTS_CACHE_KEY(),JSON.stringify(p),CONFIG.PRODUCTS_CACHE_TTL_SEC);}catch(e){}
  return p;
}
function invalidateProductCache_(){try{CacheService.getScriptCache().remove(PRODUCTS_CACHE_KEY());}catch(e){}}

/* ====== 공개 API ====== */
function getInitDataCustomer() {
  const s=getSettingsMap_();
  return{settings:{ko:s.notice_ko||'',en:s.notice_en||'',de:s.notice_de||'',customHolidays:s.custom_holidays||'',eventRate:s.event_rate||'',eventStart:s.event_start||'',eventEnd:s.event_end||'',returnDiscount:s.return_discount||'10'},products:getCachedProducts_()};
}

/* ✅ 속도 개선: init + 2개월 캘린더 한 번에 */
function getInitDataWithCalendar(year,month,totalDur,itemGroup) {
  const init=getInitDataCustomer();
  return{settings:init.settings,products:init.products,calendar:getCalendarBatch(year,month,totalDur,itemGroup)};
}

function getCalendarBatch(year,month,totalDur,itemGroup) {
  const out={};
  for(let offset=0;offset<3;offset++){
    const d=new Date(year,month+offset,1);
    const y=d.getFullYear(), m=d.getMonth();
    try{out[`${y}_${m}`]=getUnavailableDays(y,m,totalDur,itemGroup);}catch(e){out[`${y}_${m}`]=[];}
  }
  return out;
}

function getPublicCalendarBatch_(year,month,totalDur,itemGroup){
  const d=new Date(year,month,1);
  const y=d.getFullYear();
  const m=d.getMonth();
  const key=`${y}_${m}`;
  const out={};
  out[key]=getUnavailableDays(y,m,totalDur,itemGroup);
  return out;
}

function getInitDataAdmin(token){assertAdmin_(token);const d=getInitDataCustomer();return{dashboard:getDashboardData_(),products:d.products,settings:d.settings};}
function saveProductsData(token,arr){
  assertAdmin_(token);const sh=ensureSheets_().productsSheet;
  if(sh.getLastRow()>1) sh.getRange(2,1,sh.getLastRow()-1,13).clearContent();
  const rows=(arr||[]).map(p=>[p.id,p.g,p.nameKo,p.nameEn,p.nameDe,p.p,p.d,p.prep,p.t,p.descKo,p.descEn,p.descDe,p.discountRate||0]).filter(r=>r[0]);
  if(rows.length) sh.getRange(2,1,rows.length,13).setValues(rows);
  invalidateProductCache_();return{ok:true};
}
function saveSiteSettings(token,s){
  assertAdmin_(token);
  upsertSetting_('notice_ko',s.ko||'');upsertSetting_('notice_en',s.en||'');upsertSetting_('notice_de',s.de||'');
  upsertSetting_('custom_holidays',s.customHolidays||'');upsertSetting_('event_rate',s.eventRate||'');
  upsertSetting_('event_start',s.eventStart||'');upsertSetting_('event_end',s.eventEnd||'');upsertSetting_('return_discount',s.returnDiscount||'10');
  if(s.newPassword) PropertiesService.getScriptProperties().setProperty('ADMIN_PASSWORD_HASH',hashText_(s.newPassword));
  return{ok:true};
}

/* ====== 견적 ====== */
function getProductById_(itemId){const p=getCachedProducts_().find(x=>x.id===itemId);if(!p)throw new Error('유효하지 않은 상품입니다.');return p;}
function calculateQuote_(request){
  const item=getProductById_(request.itemId);
  const people=Math.max(1,parseInt(request.people)||1);
  const optionKeys=(request.optionKeys||[]).filter(Boolean);
  const passCountries=(request.passCountries||[]).filter(Boolean);
  const otherCountry=(request.otherCountry||'').trim();
  const totalCountries=passCountries.length+(otherCountry?1:0);
  let total=item.p;
  if(item.t==='passport') total=(item.p+Math.max(totalCountries-1,0)*5)*people;
  else if(item.t==='group'&&people>2) total+=(people-2)*30;
  else if(item.t==='snap'&&people>2) total+=(people-2)*30;
  else if(item.t==='snap'&&people===1) total-=30;
  const optMeta={dog:15,bg:20,outfit:20};
  if(item.t!=='custom') optionKeys.forEach(k=>{if(optMeta[k])total+=optMeta[k];});
  // 연령 기반 프로필 가격 로직
  const ageGroup=request.ageGroup||'adult';
  let kidsDiscount=0,seniorFree=false;
  let seniorDiscApplied=false;
  if(item.g==='prof'){
    if(ageGroup==='kids'){kidsDiscount=10;total=Math.max(0,total-kidsDiscount);}
    else if(ageGroup==='senior'&&request.date){
      const d=new Date(request.date+'T12:00:00'),day=d.getDay();
      if(item.id==='pb'){
        // 프로필 Basic: 시니어 평일(화~금) 무료
        if(day>=2&&day<=5){seniorFree=true;total=0;}
      } else if(item.id==='pbus'||item.id==='pp'){
        // 프로필 Business/Professional: 시니어 평일 -50€
        if(day>=2&&day<=5){total=Math.max(0,total-50);seniorDiscApplied=true;}
        // 프로필 Professional: 시니어 토요일 -30€
        else if(day===6&&item.id==='pp'){total=Math.max(0,total-30);seniorDiscApplied=true;}
      }
    }
  }
  let productDiscount=0,eventDiscount=0,returnDiscount=0;
  productDiscount=0;
  const settings=getSettingsMap_();const evRate=parseInt(settings.event_rate)||0;
  if(evRate>0&&settings.event_start&&settings.event_end&&request.date&&request.date>=settings.event_start&&request.date<=settings.event_end){eventDiscount=Math.round(total*(evRate/100));total-=eventDiscount;}
  if(request.isReturn){const rate=parseInt(settings.return_discount)||10;returnDiscount=Math.round(total*(rate/100));total-=returnDiscount;}
  let marketingDiscount=0;
  if(item.g==='wed'&&request.marketing){marketingDiscount=50;total-=marketingDiscount;}
  const PASS_DUR=[0,15,20,30,40];
  const duration=item.t==='passport'?PASS_DUR[Math.min(people,4)]||40:item.d;
  // 여권 콤보 추가 시 duration에 합산
  const passAddon=request.passAddon||false;
  const passAddonPeople=parseInt(request.passAddonPeople)||1;
  const passAddonDur=passAddon?PASS_DUR[Math.min(passAddonPeople,4)]||40:0;
  const passItem=passAddon?getCachedProducts_().find(x=>x.g==='pass'):null;
  const passAddonPrice=passItem?passItem.p*passAddonPeople:0;
  if(passAddon)total+=passAddonPrice;
  const isDeposit=total>100&&item.g!=='pass'&&item.g!=='biz';
  const depositAmount=item.g==='wed'?Math.round(total*0.20):(isDeposit?50:0);
  return{itemId:item.id,itemGroup:item.g,itemType:item.t,people,totalPrice:Math.max(0,total),duration,prep:item.prep,totalDuration:duration+item.prep+passAddonDur,isDeposit,depositAmount,balanceAmount:Math.max(0,total-depositAmount),product:item,optionKeys,passCountries,otherCountry,totalCountries,productDiscount,returnDiscount,eventDiscount,marketingDiscount,isReturn:request.isReturn||false,marketing:request.marketing||false,passAddon,passAddonPeople,passAddonDur};
}

/* ====== 재방문 감지 ====== */
function checkReturnCustomer_(name,phone,email){
  const sh=getDbSheet(),data=sh.getDataRange().getValues().slice(1);
  const todayStr=Utilities.formatDate(new Date(),CONFIG.TIMEZONE,'yyyy-MM-dd');
  const now=new Date().getTime();
  const calendar=CalendarApp.getCalendarById(CONFIG.MAIN_CALENDAR_ID)||CalendarApp.getDefaultCalendar();
  const cleanPhone=String(phone||'').replace(/[\s\-\(\)]/g,'');
  const cleanName=String(name||'').trim().toLowerCase();
  const cleanEmail=String(email||'').trim().toLowerCase();
  return data.some(row=>{
    if(!row[0]) return false;
    const rowDate=parseDateSafe_(row[0]).str.slice(0,10);
    if(rowDate!==todayStr) return false;
    if(String(row[2]||'').trim().toLowerCase()!==cleanName) return false;
    if(String(row[3]||'').replace(/[\s\-\(\)]/g,'')!==cleanPhone) return false;
    if(String(row[4]||'').trim().toLowerCase()!==cleanEmail) return false;
    if(String(row[1])==='취소됨') return false;
    const eventId=String(row[16]||'').trim();
    if(eventId){
      try{
        const ev=calendar.getEventById(eventId);
        if(ev) return ev.getEndTime().getTime()<=now;
      }catch(err){}
    }
    const fallbackDate=parseDateSafe_(row[0]).obj;
    return fallbackDate && fallbackDate.getTime()<=now;
  });
}

/* ====== 캘린더 ====== */
function getCalCacheVer_(){return PropertiesService.getScriptProperties().getProperty('CAL_CACHE_VER')||'1';}
function bumpCalCacheVer_(){const v=(parseInt(getCalCacheVer_(),10)||1)+1;PropertiesService.getScriptProperties().setProperty('CAL_CACHE_VER',String(v%99999));}
function getBusyCalendarIds_(){
  const cache=CacheService.getScriptCache();
  try{const h=cache.get('busy_cal_ids');if(h)return JSON.parse(h);}catch(e){}
  const ids=new Set([CONFIG.MAIN_CALENDAR_ID]);
  CalendarApp.getAllCalendars().forEach(cal=>{const name=cal.getName();if(CONFIG.TARGET_CALENDAR_NAMES.includes(name)||CONFIG.PERSONAL_CALENDAR_NAMES.includes(name))ids.add(cal.getId());});
  const result=Array.from(ids);
  try{cache.put('busy_cal_ids',JSON.stringify(result),600);}catch(e){}  // 10분 캐시
  return result;
}

/**
 * 진단용 — GAS 에디터에서 직접 실행
 * 특정 날짜의 캘린더 상태를 Logger에 출력
 * 실행: debugCalendarEvents_('2026-04-24')
 */
function debugCalendarEvents(dateStr){
  dateStr = dateStr || '2026-04-24';
  Logger.log('=== 캘린더 진단: '+dateStr+' ===\n');

  // 1. Google Calendar에 인식된 모든 캘린더 목록
  Logger.log('[1] 전체 Google 캘린더 목록:');
  CalendarApp.getAllCalendars().forEach(cal=>{
    const name=cal.getName(), id=cal.getId();
    const isTarget=CONFIG.TARGET_CALENDAR_NAMES.includes(name);
    const isPersonal=CONFIG.PERSONAL_CALENDAR_NAMES.includes(name);
    const tag=isTarget?'[TARGET]':isPersonal?'[PERSONAL]':'';
    Logger.log(`  ${tag||'[기타]'} "${name}" → ${id}`);
  });

  // 2. getBusyCalendarIds_ 결과
  CacheService.getScriptCache().remove('busy_cal_ids'); // 캐시 무시하고 재조회
  const busyIds=getBusyCalendarIds_();
  Logger.log('\n[2] 바쁨 처리 캘린더 IDs: '+JSON.stringify(busyIds));

  // 3. 해당 날짜 이벤트 상세
  Logger.log('\n[3] '+dateStr+' 이벤트 목록:');
  const start=new Date(dateStr+'T00:00:00'), end=new Date(dateStr+'T23:59:59');
  const personalNames=new Set(CONFIG.PERSONAL_CALENDAR_NAMES);
  let total=0;
  busyIds.forEach(id=>{
    try{
      const cal=CalendarApp.getCalendarById(id);
      if(!cal){Logger.log('  캘린더 없음: '+id);return;}
      const isPersonal=personalNames.has(cal.getName());
      const evs=cal.getEvents(start,end);
      Logger.log(`  캘린더: "${cal.getName()}" (${evs.length}건)`);
      evs.forEach(ev=>{
        if(ev.isAllDayEvent()){Logger.log('    [종일] '+ev.getTitle());return;}
        const type=classifyEventType_(ev.getTitle()||'',isPersonal);
        Logger.log(`    [Type ${type}] ${ev.getTitle()} | ${ev.getStartTime().toTimeString().slice(0,5)}~${ev.getEndTime().toTimeString().slice(0,5)} | loc:"${ev.getLocation()||''}"`);
        total++;
      });
    }catch(e){Logger.log('  오류: '+id+' → '+e.message);}
  });
  Logger.log('\n총 이벤트: '+total+'건');

  // 4. 슬롯 계산 결과 (30분, studio 기준)
  Logger.log('\n[4] 해당 날짜 가용 슬롯 (studio, 60분 기준):');
  const events=getEventsForRange_(start,end);
  const slots=computeSlots_(dateStr,events,60,'studio');
  Logger.log(slots.length?slots.join(', '):'없음 (완전 차단)');

  Logger.log('\n=== 진단 완료 ===');
}

/**
 * ══════════════════════════════════════════════════════
 *  AVAILABILITY ENGINE — Dynamic Buffer Logic
 *
 *  Type A  (Passport)      : 0 min buffer
 *  Type B  (Studio/Profile): 15 min buffer
 *  Type C  (Outdoor/Snap)  : 60 min bidirectional buffer
 *  Type P  (Personal)      : 60 min buffer (same as outdoor/snap)
 *
 *  Same-location exception:
 *    C vs C, same location  → 15 min buffer
 *    C vs C, diff location  → 60 min buffer
 *
 *  MAX Principle: gap = MAX(new_buffer, existing_buffer)
 * ══════════════════════════════════════════════════════
 */

/** Classify a calendar event title → 'A' | 'B' | 'C' | 'P' */
function classifyEventType_(title, isPersonal){
  if(isPersonal) return 'P'; // Personal: 0 min buffer, but direct overlap still blocks
  if(/여권|비자|Passfoto|Passport|passport/i.test(title)) return 'A';
  if(CONFIG.OUTDOOR_TITLE_KEYWORDS.some(kw=>title.includes(kw))) return 'C';
  return 'B';
}

/** Classify a new booking's itemGroup → 'A' | 'B' | 'C' */
function classifyBookingType_(itemGroup){
  if(itemGroup==='pass') return 'A';
  if(itemGroup==='snap'||itemGroup==='wed') return 'C';
  return 'B';
}

/**
 * Required gap (minutes) between a new booking and an existing event.
 * Implements MAX principle + same-location exception.
 * @param {string} typeNew  'A'|'B'|'C'
 * @param {string} locNew   location string of new booking ('' = unknown)
 * @param {string} typeEx   'A'|'B'|'C'
 * @param {string} locEx    location string of existing event
 * @returns {number} buffer in minutes
 */
function getRequiredBuffer_(typeNew, locNew, typeEx, locEx){
  // P (Personal) → 60 min buffer (same as outdoor/snap Type C)
  if(typeNew==='P'||typeEx==='P') return CONFIG.BUFFER_OUTDOOR_MIN;
  // A vs A only → no buffer (passport back-to-back)
  if(typeNew==='A'&&typeEx==='A') return 0;
  // A vs B or B vs A → 15 min
  if(typeNew==='A'||typeEx==='A') return CONFIG.BUFFER_STUDIO_MIN;
  // Both C → same-location exception
  if(typeNew==='C'&&typeEx==='C'){
    const sameLocation=locNew&&locEx&&locNew.trim()===locEx.trim();
    return sameLocation?CONFIG.BUFFER_STUDIO_MIN:CONFIG.BUFFER_OUTDOOR_MIN;
  }
  // At least one C → 60 min
  if(typeNew==='C'||typeEx==='C') return CONFIG.BUFFER_OUTDOOR_MIN;
  // Both B → 15 min
  return CONFIG.BUFFER_STUDIO_MIN;
}

/**
 * Fetch calendar events for a time range.
 * Each event includes: start, end, type ('A'|'B'|'C'), location.
 */
function getEventsForRange_(start,end){
  const events=[];
  const personalCalNames=new Set(CONFIG.PERSONAL_CALENDAR_NAMES);
  getBusyCalendarIds_().forEach(id=>{
    try{
      const cal=CalendarApp.getCalendarById(id);if(!cal)return;
      const isPersonal=personalCalNames.has(cal.getName());
      cal.getEvents(start,end).forEach(ev=>{
        if(ev.isAllDayEvent())return;
        const title=ev.getTitle()||'';
        const type=classifyEventType_(title,isPersonal);
        const location=isPersonal?'':(ev.getLocation()||'');
        events.push({start:ev.getStartTime().getTime(),end:ev.getEndTime().getTime(),type,location});
      });
    }catch(e){Logger.log('캘린더 오류: '+e.message);}
  });
  // Merge iCloud events (private CalDAV + public ICS feeds) if any URL is configured
  const _props=PropertiesService.getScriptProperties().getProperties();
  const _hasIcloud=Object.keys(_props).some(k=>k==='ICLOUD_CAL_URL'||k==='ICLOUD_ICS_URL'||/^ICLOUD_(CAL|ICS)_URL_\d+$/.test(k));
  if(_hasIcloud){
    try{
      fetchAppleCalendarEvents_(start,end).forEach(ev=>events.push(ev));
    }catch(e){Logger.log('iCloud 통합 오류: '+e.message);}
  }
  return events;
}

/**
 * Returns true if placing a new booking [slotStart, slotEnd] conflicts
 * with any existing event, given dynamic per-pair buffer rules.
 *
 * @param {Array}  events      from getEventsForRange_
 * @param {number} slotStart   ms timestamp
 * @param {number} slotEnd     ms timestamp
 * @param {string} itemGroup   new booking's group key
 * @param {string} [newLocation='']  new booking's shooting location
 */
function checkConflict_(events,slotStart,slotEnd,itemGroup,newLocation){
  const newType=classifyBookingType_(itemGroup);
  const newLoc=newLocation||'';
  return events.some(ev=>{
    const bufMs=getRequiredBuffer_(newType,newLoc,ev.type,ev.location)*60000;
    // [slotStart - buf, slotEnd + buf] must not overlap [ev.start, ev.end]
    return (slotStart-bufMs)<ev.end&&(slotEnd+bufMs)>ev.start;
  });
}

/* ══════════════════════════════════════════════════════
 *  iCLOUD CalDAV INTEGRATION
 *
 *  Script Properties required:
 *    APPLE_ID           — Apple ID (email address)
 *    APPLE_APP_PASSWORD — App-specific password (not your Apple ID password)
 *    ICLOUD_CAL_URL     — Full CalDAV calendar URL, e.g.:
 *                         https://caldav.icloud.com/[principal-id]/calendars/[cal-id]/
 *
 *  How to find ICLOUD_CAL_URL:
 *    Mac Calendar → right-click calendar → Copy Link
 *    Strip the webcal:// prefix and replace with https://
 * ══════════════════════════════════════════════════════ */

function getIcloudBasicAuth_(){
  const props=PropertiesService.getScriptProperties();
  const id=props.getProperty('APPLE_ID');
  const pw=props.getProperty('APPLE_APP_PASSWORD');
  if(!id||!pw) throw new Error('iCloud credentials missing: APPLE_ID / APPLE_APP_PASSWORD');
  return 'Basic '+Utilities.base64Encode(id+':'+pw);
}

/** webcal:// → https:// 변환 */
function normalizeCalUrl_(u){
  return u.trim().replace(/^webcal:\/\//i,'https://');
}

/** Returns all private CalDAV URLs (require auth, support PUT). */
function getIcloudCalUrls_(){
  const props=PropertiesService.getScriptProperties();
  const urls=[];
  const single=props.getProperty('ICLOUD_CAL_URL');
  if(single) single.split(',').map(s=>normalizeCalUrl_(s)).filter(Boolean)
    .forEach(u=>urls.push(u.endsWith('/')?u:u+'/'));
  for(let i=1;i<=10;i++){
    const u=props.getProperty('ICLOUD_CAL_URL_'+i);
    if(!u) break;
    const n=normalizeCalUrl_(u);
    urls.push(n.endsWith('/')?n:n+'/');
  }
  return urls;
}

/** Returns all public ICS subscription URLs (no auth, read-only). */
function getIcloudIcsUrls_(){
  const props=PropertiesService.getScriptProperties();
  const urls=[];
  const single=props.getProperty('ICLOUD_ICS_URL');
  if(single) single.split(',').map(s=>normalizeCalUrl_(s)).filter(Boolean).forEach(u=>urls.push(u));
  for(let i=1;i<=10;i++){
    const u=props.getProperty('ICLOUD_ICS_URL_'+i);
    if(!u) break;
    urls.push(normalizeCalUrl_(u));
  }
  return urls;
}

/**
 * Fetch a public ICS subscription feed and return events in the given range.
 * Supports webcal:// and https:// public calendar links (no auth required).
 * @param {string} icsUrl
 * @param {Date} startDate
 * @param {Date} endDate
 * @returns {Array} [{start, end, type, location}]
 */
function fetchPublicIcsEvents_(icsUrl,startDate,endDate){
  const res=UrlFetchApp.fetch(icsUrl,{muteHttpExceptions:true});
  const code=res.getResponseCode();
  if(code!==200){
    Logger.log('Public ICS fetch failed ('+code+'): '+icsUrl);
    return[];
  }
  const startMs=startDate.getTime(), endMs=endDate.getTime();
  return parseIcsText_(res.getContentText())
    .filter(ev=>ev.end>startMs&&ev.start<endMs)
    .map(ev=>({
      start:ev.start,
      end:ev.end,
      type:classifyEventType_(ev.summary,false),
      location:ev.location||''
    }));
}

/**
 * Parse an ICS date line value → ms timestamp (UTC).
 * Handles: DTSTART:20240101T090000Z  and  DTSTART;TZID=Europe/Berlin:20240101T090000
 */
function parseIcsDate_(line){
  if(!line) return null;
  const val=line.split(':').pop().trim();
  if(val.length===8){
    // DATE-only (all-day): YYYYMMDD → treat as UTC midnight
    return new Date(val.slice(0,4)+'-'+val.slice(4,6)+'-'+val.slice(6,8)+'T00:00:00Z').getTime();
  }
  // YYYYMMDDTHHMMSS[Z]
  const iso=val.slice(0,4)+'-'+val.slice(4,6)+'-'+val.slice(6,8)+'T'+
            val.slice(9,11)+':'+val.slice(11,13)+':'+val.slice(13,15)+
            (val.endsWith('Z')?'Z':'');
  return new Date(iso).getTime();
}

/**
 * Unfold and parse raw ICS text → [{start, end, summary, location}].
 * RFC 5545 §3.1: continuation lines begin with SPACE or TAB.
 */
function parseIcsText_(ics){
  const unfolded=ics.replace(/\r?\n[ \t]/g,'');
  const events=[];
  const blocks=unfolded.split(/BEGIN:VEVENT/);
  for(let i=1;i<blocks.length;i++){
    const block=blocks[i];
    const match=prop=>{
      const m=block.match(new RegExp('^'+prop+'(?:;[^:]*)?:(.+)$','m'));
      return m?m[1].trim():'';
    };
    const startLine=block.match(/^DTSTART(?:;[^:]*)?:.+$/m);
    const endLine  =block.match(/^DTEND(?:;[^:]*)?:.+$/m);
    if(!startLine||!endLine) continue;
    const start=parseIcsDate_(startLine[0]);
    const end  =parseIcsDate_(endLine[0]);
    if(!start||!end||end<=start) continue;
    events.push({start,end,summary:match('SUMMARY'),location:match('LOCATION')});
  }
  return events;
}

/**
 * Fetch iCloud calendar events for [startDate, endDate] via CalDAV REPORT.
 * Returns [{start, end, type, location}] — identical shape to getEventsForRange_.
 *
 * @param {Date} startDate
 * @param {Date} endDate
 * @returns {Array}
 */
function fetchAppleCalendarEvents_(startDate,endDate){
  try{
    const auth=getIcloudBasicAuth_();
    const calUrls=getIcloudCalUrls_();
    if(!calUrls||calUrls.length===0) return[];
    const fmt=d=>Utilities.formatDate(d,'UTC',"yyyyMMdd'T'HHmmss'Z'");
    const reportBody=
      '<?xml version="1.0" encoding="UTF-8"?>'+
      '<C:calendar-query xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">'+
        '<D:prop><D:getetag/><C:calendar-data/></D:prop>'+
        '<C:filter>'+
          '<C:comp-filter name="VCALENDAR">'+
            '<C:comp-filter name="VEVENT">'+
              '<C:time-range start="'+fmt(startDate)+'" end="'+fmt(endDate)+'"/>'+
            '</C:comp-filter>'+
          '</C:comp-filter>'+
        '</C:filter>'+
      '</C:calendar-query>';
    const davNs=XmlService.getNamespace('DAV:');
    const calNs=XmlService.getNamespace('urn:ietf:params:xml:ns:caldav');
    const allEvents=[];
    calUrls.forEach(calUrl=>{
      try{
        const res=UrlFetchApp.fetch(calUrl,{
          method:'post',
          contentType:'application/xml; charset=UTF-8',
          headers:{'Authorization':auth,'Depth':'1'},
          payload:reportBody,
          muteHttpExceptions:true
        });
        const code=res.getResponseCode();
        if(code!==207){
          Logger.log('iCloud REPORT failed ('+code+') for '+calUrl+': '+res.getContentText().slice(0,200));
          return;
        }
        const root=XmlService.parse(res.getContentText()).getRootElement();
        root.getChildren('response',davNs).forEach(resp=>{
          try{
            const propstat=resp.getChild('propstat',davNs);
            if(!propstat) return;
            if(!(propstat.getChildText('status',davNs)||'').includes('200')) return;
            const prop=propstat.getChild('prop',davNs);
            if(!prop) return;
            const calData=prop.getChild('calendar-data',calNs);
            if(!calData) return;
            parseIcsText_(calData.getText()).forEach(ev=>{
              const type=classifyEventType_(ev.summary,false);
              allEvents.push({start:ev.start,end:ev.end,type,location:ev.location||''});
            });
          }catch(e){Logger.log('iCloud event parse error: '+e.message);}
        });
      }catch(e){Logger.log('iCloud fetch error for '+calUrl+': '+e.message);}
    });
    // Public ICS subscription feeds (webcal / published links)
    getIcloudIcsUrls_().forEach(icsUrl=>{
      try{
        fetchPublicIcsEvents_(icsUrl,startDate,endDate).forEach(ev=>allEvents.push(ev));
      }catch(e){Logger.log('Public ICS error for '+icsUrl+': '+e.message);}
    });
    Logger.log('iCloud total events fetched: '+allEvents.length+' (private CalDAV: '+calUrls.length+' cals)');
    return allEvents;
  }catch(e){
    Logger.log('fetchAppleCalendarEvents_ error: '+e.message);
    return[];
  }
}

/**
 * Push a new booking event to iCloud Calendar via CalDAV PUT.
 * Also call this after processForm() to keep iCloud in sync.
 *
 * @param {{uid?:string, title:string, location:string, startDate:Date, endDate:Date, description:string}} eventDetails
 * @returns {boolean}
 */
function createAppleCalendarEvent_(eventDetails){
  try{
    const auth=getIcloudBasicAuth_();
    const calUrl=getIcloudCalUrl_();
    const uid=eventDetails.uid||Utilities.getUuid();
    const fmt=d=>Utilities.formatDate(d,'UTC',"yyyyMMdd'T'HHmmss'Z'");
    const now=fmt(new Date());
    const escape=s=>(s||'').replace(/\\/g,'\\\\').replace(/;/g,'\\;').replace(/,/g,'\\,').replace(/\n/g,'\\n');
    const ics=[
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Studio mean//GAS//EN',
      'CALSCALE:GREGORIAN',
      'BEGIN:VEVENT',
      'UID:'+uid+'@studio.mean',
      'DTSTAMP:'+now,
      'DTSTART:'+fmt(eventDetails.startDate),
      'DTEND:'+fmt(eventDetails.endDate),
      'SUMMARY:'+escape(eventDetails.title),
      'LOCATION:'+escape(eventDetails.location),
      'DESCRIPTION:'+escape(eventDetails.description),
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\r\n');
    const eventUrl=calUrl+uid+'.ics';
    const res=UrlFetchApp.fetch(eventUrl,{
      method:'put',
      contentType:'text/calendar; charset=UTF-8',
      headers:{'Authorization':auth,'If-None-Match':'*'},
      payload:ics,
      muteHttpExceptions:true
    });
    const code=res.getResponseCode();
    if(code===201||code===204){
      Logger.log('iCloud event created: '+uid);
      return true;
    }
    Logger.log('iCloud PUT failed ('+code+'): '+res.getContentText().slice(0,300));
    return false;
  }catch(e){
    Logger.log('createAppleCalendarEvent_ error: '+e.message);
    return false;
  }
}

/**
 * ══════════════════════════════════════════════════════
 *  TEST SUITE — run manually from GAS editor
 *  執行: runConflictTests_()
 * ══════════════════════════════════════════════════════
 */
function runConflictTests_(){
  const PASS='\u2705',FAIL='\u274C';
  const results=[];
  function assert(name,actual,expected){
    const ok=actual===expected;
    results.push((ok?PASS:FAIL)+' '+name+(ok?'':` | expected ${expected}, got ${actual}`));
  }

  /* ── getRequiredBuffer_ unit tests ── */
  assert('A vs A → 0',                  getRequiredBuffer_('A','','A',''),0);
  assert('A vs B → 15',                 getRequiredBuffer_('A','','B',''),15);
  assert('B vs A → 15',                 getRequiredBuffer_('B','','A',''),15);
  assert('A vs C → 60',                 getRequiredBuffer_('A','','C','Park A'),60);
  assert('C vs A → 60',                 getRequiredBuffer_('C','Park A','A',''),60);
  assert('B vs B → 15',                 getRequiredBuffer_('B','','B',''),15);
  assert('B vs C → 60',                 getRequiredBuffer_('B','','C',''),60);
  assert('C vs B → 60',                 getRequiredBuffer_('C','','B',''),60);
  assert('C vs C diff location → 60',   getRequiredBuffer_('C','Park A','C','Park B'),60);
  assert('C vs C same location → 15',   getRequiredBuffer_('C','Taunus','C','Taunus'),15);
  assert('C vs C, locNew empty → 60',   getRequiredBuffer_('C','','C','Park A'),60);
  assert('C vs C, locEx empty → 60',    getRequiredBuffer_('C','Park A','C',''),60);
  assert('C vs C, both empty → 60',     getRequiredBuffer_('C','','C',''),60);
  assert('P vs A → 60',                 getRequiredBuffer_('P','','A',''),60);
  assert('P vs B → 60',                 getRequiredBuffer_('P','','B',''),60);
  assert('P vs C → 60',                 getRequiredBuffer_('P','','C',''),60);
  assert('B vs P → 60',                 getRequiredBuffer_('B','','P',''),60);

  /* ── checkConflict_ integration tests ── */
  // Helper: build a mock event
  function mkEv(startH,endH,type,loc){
    const d='2099-01-01';
    return{start:new Date(`${d}T${startH}:00:00`).getTime(),end:new Date(`${d}T${endH}:00:00`).getTime(),type,location:loc||''};
  }
  function mkSlot(startH,endH){
    const d='2099-01-01';
    return{s:new Date(`${d}T${startH}:00:00`).getTime(),e:new Date(`${d}T${endH}:00:00`).getTime()};
  }

  // Sandwich: B(09:00-10:00) → ? Type C slot → B(14:00-15:00)
  // C slot 11:00-13:00: needs 60 min gap before (ev_B1 ends 10:00 + 60 = 11:00 ✓) and after (13:00 + 60 = 14:00 ✓)
  const sandwich_evts=[mkEv('09:00','10:00','B'),mkEv('14:00','15:00','B')];
  const slotC_ok=mkSlot('11:00','13:00');
  assert('Sandwich C 11-13 — OK (60 min gap each side)',
    checkConflict_(sandwich_evts,slotC_ok.s,slotC_ok.e,'snap',''),false);

  // C slot 10:30-12:30: only 30 min gap after B(09:00-10:00) → conflict
  const slotC_tooEarly=mkSlot('10:30','12:30');
  assert('Sandwich C 10:30 start — conflict (only 30 min gap before)',
    checkConflict_(sandwich_evts,slotC_tooEarly.s,slotC_tooEarly.e,'snap',''),true);

  // C slot 11:00-13:30: 30 min gap before B(14:00) → conflict
  const slotC_tooLate=mkSlot('11:00','13:30');
  assert('Sandwich C ends 13:30 — conflict (only 30 min gap after)',
    checkConflict_(sandwich_evts,slotC_tooLate.s,slotC_tooLate.e,'snap',''),true);

  // Same-location exception: existing C at Park, new C at Park → 15 min buffer
  const evOutdoorSameLoc=[mkEv('10:00','12:00','C','Taunus Trail')];
  const slotCSameLoc=mkSlot('12:15','14:00');
  assert('C vs C same location 15 min gap — OK',
    checkConflict_(evOutdoorSameLoc,slotCSameLoc.s,slotCSameLoc.e,'snap','Taunus Trail'),false);

  // Same-location: 10 min gap → conflict even with same loc
  const slotCSameLocTooClose=mkSlot('12:10','14:00');
  assert('C vs C same location 10 min gap — conflict',
    checkConflict_(evOutdoorSameLoc,slotCSameLocTooClose.s,slotCSameLocTooClose.e,'snap','Taunus Trail'),true);

  // Diff-location: 15 min gap → NOT enough (need 60 min)
  const slotCDiffLoc=mkSlot('12:15','14:00');
  assert('C vs C diff location 15 min gap — conflict',
    checkConflict_(evOutdoorSameLoc,slotCDiffLoc.s,slotCDiffLoc.e,'snap','Römer Park'),true);

  // A vs A: back-to-back allowed (0 min buffer)
  const evPassport=[mkEv('09:00','09:15','A')];
  const slotA=mkSlot('09:15','09:30');
  assert('A vs A back-to-back — OK',
    checkConflict_(evPassport,slotA.s,slotA.e,'pass',''),false);

  // A vs A: exact overlap → conflict
  const slotAOverlap=mkSlot('09:00','09:15');
  assert('A vs A exact overlap — conflict',
    checkConflict_(evPassport,slotAOverlap.s,slotAOverlap.e,'pass',''),true);

  // B (studio) → A (passport): needs 15 min gap
  const evStudio=[mkEv('10:00','11:00','B')];
  assert('B→A 15 min gap — OK',
    checkConflict_(evStudio,mkSlot('11:15','11:30').s,mkSlot('11:15','11:30').e,'pass',''),false);
  assert('B→A 5 min gap — conflict',
    checkConflict_(evStudio,mkSlot('11:05','11:20').s,mkSlot('11:05','11:20').e,'pass',''),true);

  // A (passport) → B (studio): needs 15 min gap
  const evPassB=[mkEv('10:00','10:15','A')];
  assert('A→B 15 min gap — OK',
    checkConflict_(evPassB,mkSlot('10:30','11:30').s,mkSlot('10:30','11:30').e,'studio',''),false);
  assert('A→B 10 min gap — conflict',
    checkConflict_(evPassB,mkSlot('10:25','11:25').s,mkSlot('10:25','11:25').e,'studio',''),true);

  Logger.log('\n=== Conflict Tests ===\n'+results.join('\n'));
  const failed=results.filter(r=>r.startsWith(FAIL));
  Logger.log(failed.length===0?'\nAll tests passed.':'\n'+failed.length+' test(s) FAILED.');
  return results;
}

function getHessenHolidays(year){
  const h=[`${year}-01-01`,`${year}-05-01`,`${year}-10-03`,`${year}-12-25`,`${year}-12-26`];
  const G=year%19,C=Math.floor(year/100),H=(C-Math.floor(C/4)-Math.floor((8*C+13)/25)+19*G+15)%30;
  const I=H-Math.floor(H/28)*(1-Math.floor(29/(H+1))*Math.floor((21-G)/11));
  const J=(year+Math.floor(year/4)+I+2-C+Math.floor(C/4))%7;
  const L=I-J,m=3+Math.floor((L+40)/44),d=L+28-31*Math.floor(m/4);
  const easter=new Date(year,m-1,d);
  [-2,1,39,50,60].forEach(days=>{const dt=new Date(easter.getTime()+days*86400000);h.push(`${year}-${('0'+(dt.getMonth()+1)).slice(-2)}-${('0'+dt.getDate()).slice(-2)}`);});
  return h;
}
function isWeekendOrHolidayBlocked_(dateStr,itemGroup){
  if(itemGroup==='wed'||itemGroup==='biz') return false;
  const day=new Date(`${dateStr}T00:00:00`).getDay();
  if(day===0||day===1) return true;
  if(getHessenHolidays(new Date(`${dateStr}T00:00:00`).getFullYear()).includes(dateStr)) return true;
  return String(getSettingsMap_().custom_holidays||'').split(',').map(s=>s.trim()).filter(Boolean).includes(dateStr);
}

/**
 * ✅ 영업시간: 평일 9:30-12:00 / 15:00-17:30 (12-15시 쉬는 시간)
 */
function getTimeBlocksForDate_(dateStr,itemGroup){
  const day=new Date(`${dateStr}T00:00:00`).getDay();
  if(itemGroup==='wed'||itemGroup==='biz') return[{startHour:8,startMin:0,endHour:22,endMin:0}];
  if(day>=2&&day<=5) return[
    {startHour:9,startMin:30,endHour:12,endMin:0},
    {startHour:15,startMin:0,endHour:17,endMin:30}
  ];
  if(day===6) return[{startHour:9,startMin:0,endHour:16,endMin:0}];
  return[];
}

/** 슬롯 계산 공통 헬퍼 — 이미 가져온 events 재사용.
 *  newLocation: 신규 예약의 촬영 장소 (Type C 동일장소 예외 적용용, 기본 '') */
function computeSlots_(dateStr,events,totalDur,itemGroup,newLocation){
  const now=new Date().getTime(),slots=[],loc=newLocation||'';
  getTimeBlocksForDate_(dateStr,itemGroup).forEach(b=>{
    const bs=new Date(`${dateStr}T${('0'+b.startHour).slice(-2)}:${('0'+b.startMin).slice(-2)}:00`).getTime();
    const be=new Date(`${dateStr}T${('0'+b.endHour).slice(-2)}:${('0'+b.endMin).slice(-2)}:00`).getTime();
    for(let t=bs;t<be;t+=15*60000){
      if(t<=now||t+totalDur*60000>be) continue;
      if(!checkConflict_(events,t,t+totalDur*60000,itemGroup,loc)){const dt=new Date(t);slots.push(`${('0'+dt.getHours()).slice(-2)}:${('0'+dt.getMinutes()).slice(-2)}`);}
    }
  });
  return slots;
}

function getUnavailableDays(year,month,totalDur,itemGroup){
  const ver=getCalCacheVer_(),cacheKey=`unavail_v8_${ver}_${year}_${month}_${itemGroup}_${totalDur}`;
  const cache=CacheService.getScriptCache();
  try{const h=cache.get(cacheKey);if(h)return JSON.parse(h);}catch(e){}
  const unavail=[],slotCounts={},slotsByDate={},daysInMonth=new Date(year,month+1,0).getDate();
  const events=getEventsForRange_(new Date(year,month,1),new Date(year,month,daysInMonth,23,59,59));
  const now=new Date().getTime();
  const slotsTTL=Math.min(CONFIG.SLOTS_CACHE_TTL_SEC,CONFIG.UNAVAIL_CACHE_TTL_SEC);
  for(let d=1;d<=daysInMonth;d++){
    const dStr=`${year}-${('0'+(month+1)).slice(-2)}-${('0'+d).slice(-2)}`;
    if(new Date(`${dStr}T23:59:59`).getTime()<now||isWeekendOrHolidayBlocked_(dStr,itemGroup)){unavail.push(dStr);continue;}
    const daySlots=computeSlots_(dStr,events,totalDur,itemGroup);
    if(!daySlots.length){unavail.push(dStr);}else{
      slotCounts[dStr]=daySlots.length;
      slotsByDate[dStr]=daySlots;
      const sKey=`slots_v7_${ver}_${dStr}_${itemGroup}_${totalDur}`;
      try{cache.put(sKey,JSON.stringify(daySlots),slotsTTL);}catch(e){}
    }
  }
  const result={unavail,slotCounts,slotsByDate};
  try{cache.put(cacheKey,JSON.stringify(result),CONFIG.UNAVAIL_CACHE_TTL_SEC);}catch(e){}
  return result;
}

function getAvailableSlots(dateStr,totalDur,itemGroup){
  const ver=getCalCacheVer_(),cacheKey=`slots_v7_${ver}_${dateStr}_${itemGroup}_${totalDur}`;
  const cache=CacheService.getScriptCache();
  // 월 캘린더 로드 시 이미 캐싱됐으면 즉시 반환 (Calendar API 재호출 없음)
  try{const h=cache.get(cacheKey);if(h)return JSON.parse(h);}catch(e){}
  // 캐시 미스 시 fallback (직접 날짜 선택 등 예외 경우)
  if(isWeekendOrHolidayBlocked_(dateStr,itemGroup)) return[];
  const events=getEventsForRange_(new Date(`${dateStr}T00:00:00`),new Date(`${dateStr}T23:59:59`));
  const slots=computeSlots_(dateStr,events,totalDur,itemGroup);
  try{cache.put(cacheKey,JSON.stringify(slots),CONFIG.SLOTS_CACHE_TTL_SEC);}catch(e){}
  return slots;
}

function slotAvailable_(dateStr,timeStr,totalDur,itemGroup,newLocation){
  if(isWeekendOrHolidayBlocked_(dateStr,itemGroup)) return false;
  const start=new Date(`${dateStr}T${timeStr}:00`).getTime(),end=start+totalDur*60000;
  if(start<=new Date().getTime()) return false;
  const inBlock=getTimeBlocksForDate_(dateStr,itemGroup).some(b=>{
    const bs=new Date(`${dateStr}T${('0'+b.startHour).slice(-2)}:${('0'+b.startMin).slice(-2)}:00`).getTime();
    const be=new Date(`${dateStr}T${('0'+b.endHour).slice(-2)}:${('0'+b.endMin).slice(-2)}:00`).getTime();
    return start>=bs&&end<=be;
  });
  if(!inBlock) return false;
  return!checkConflict_(getEventsForRange_(new Date(`${dateStr}T00:00:00`),new Date(`${dateStr}T23:59:59`)),start,end,itemGroup,newLocation||'');
}

/* ====== 주소/이메일 ====== */
const MAP_URL='https://maps.app.goo.gl/pVtCh1R4WWGUMfD67';
const PARKING_1='https://maps.app.goo.gl/6JTrYv5p7cSSy5oY7';
const PARKING_2='https://maps.app.goo.gl/AW4qzE7b9RmnnzZJ8';
const PARKING_3='https://maps.app.goo.gl/S7zA3hEstWqhGhkUA';

const EMAIL_I18N={
  ko:{greeting:n=>`안녕하세요 <b>${n}</b>님,`,pending_intro:'예약 신청이 접수되었습니다. 일정 확인 후 최종 확정 메일을 보내드리겠습니다.',confirmed_intro:'신청하신 일정이 <b style="color:#10b981;">최종 확정</b>되었습니다. 🎉',cancelled_intro:'신청하신 예약이 <b style="color:#ef4444;">취소</b>되었습니다.',receipt_title:'[신청 내역]',lbl_product:'■ 상품:',lbl_datetime:'■ 일시:',lbl_total:'■ 총 금액:',lbl_deposit:'■ 계약금:',deposit_note:'(예약 확정 후 계좌 정보 안내)',confirmed_deposit_note:'<div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:14px 16px;margin:12px 0;font-size:13px;line-height:1.8;"><b style="color:#1d4ed8;">💳 계약금 계좌 안내</b><br>예금주: Taewoong Min<br>은행: Deutsche Bank<br>IBAN: <b>DE11 5007 0010 0659 1176 00</b><br>BIC: <b>DEUTDEFFXXX</b><br>송금 사유: 예약자명 + 촬영일</div>',refund_policy:'<div style="background:#fef3c7;border:1px solid #f0d060;border-radius:10px;padding:12px 16px;margin:12px 0;font-size:12px;color:#7a6000;line-height:1.7;"><b>📋 예약 취소 및 환불 규정</b><br>• 촬영 8일 이전 취소: 계약금 100% 환불<br>• 촬영 2~7일 전 취소: 계약금 50% 환불<br>• 촬영 전일 또는 당일 취소: 환불 불가<br>※ 프리웨딩 패키지는 별도 협의</div>',lbl_balance:'■ 현장 결제 잔금:',lbl_disc_product:'■ 상품 할인:',lbl_disc_return:'■ 재방문 할인:',return_auto:'(자동 적용됨)',lbl_disc_event:'■ 이벤트 할인:',payment_title:'💳 결제 안내',payment_body:'현장에서 <b>현금 또는 카드</b>로 결제 가능합니다.',invoice_note:'세금계산서(Invoice)가 필요하신 경우, 방문 전 미리 말씀해 주세요.',cancelled_contact:'문의사항은 언제든 연락 주세요.',pending_subject:(n,p)=>`[Studio mean] 예약 신청 접수 안내 (대기중)`,confirmed_subject:(n,p,d)=>`[Studio mean] 촬영 예약이 최종 확정되었습니다! 🎉`,cancelled_subject:(n,p)=>`[Studio mean] 예약이 취소되었습니다`,return_badge:'⭐ 재방문 할인이 자동 적용되었습니다!'},
  en:{greeting:n=>`Hello <b>${n}</b>,`,pending_intro:'Your booking request has been received. We will send a confirmation email once we have checked the schedule.',confirmed_intro:'Your booking has been <b style="color:#10b981;">confirmed</b>! 🎉',cancelled_intro:'Your booking has been <b style="color:#ef4444;">cancelled</b>.',receipt_title:'[Booking Details]',lbl_product:'■ Session:',lbl_datetime:'■ Date/Time:',lbl_total:'■ Total:',lbl_deposit:'■ Deposit:',deposit_note:'(Bank details after confirmation)',confirmed_deposit_note:'<div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:14px 16px;margin:12px 0;font-size:13px;line-height:1.8;"><b style="color:#1d4ed8;">💳 Deposit Bank Details</b><br>Account holder: Taewoong Min<br>Bank: Deutsche Bank<br>IBAN: <b>DE11 5007 0010 0659 1176 00</b><br>BIC: <b>DEUTDEFFXXX</b><br>Reference: Your name + shoot date</div>',refund_policy:'<div style="background:#fef3c7;border:1px solid #f0d060;border-radius:10px;padding:12px 16px;margin:12px 0;font-size:12px;color:#7a6000;line-height:1.7;"><b>📋 Cancellation & Refund Policy</b><br>• 8+ days before shoot: 100% deposit refund<br>• 2–7 days before: 50% deposit refund<br>• Day before or same day: No refund<br>※ Pre-wedding packages: separate agreement</div>',lbl_balance:'■ Balance on site:',lbl_disc_product:'■ Package discount:',lbl_disc_return:'■ Return customer discount:',return_auto:'(automatically applied)',lbl_disc_event:'■ Event discount:',payment_title:'💳 Payment',payment_body:'Payment by <b>cash or card</b> on site.',invoice_note:'If you need an invoice, please let us know before your visit.',cancelled_contact:'Please feel free to contact us if you have any questions.',pending_subject:(n,p)=>`[Studio mean] Booking Request Received`,confirmed_subject:(n,p,d)=>`[Studio mean] Your Booking is Confirmed! 🎉`,cancelled_subject:(n,p)=>`[Studio mean] Booking Cancelled`,return_badge:'⭐ Return customer discount applied automatically!'},
  de:{greeting:n=>`Hallo <b>${n}</b>,`,pending_intro:'Ihre Buchungsanfrage ist eingegangen. Wir senden Ihnen eine Bestätigungs-E-Mail nach der Terminprüfung.',confirmed_intro:'Ihr Termin wurde <b style="color:#10b981;">definitiv bestätigt</b>! 🎉',cancelled_intro:'Ihre Buchung wurde <b style="color:#ef4444;">storniert</b>.',receipt_title:'[Buchungsdetails]',lbl_product:'■ Paket:',lbl_datetime:'■ Termin:',lbl_total:'■ Gesamtbetrag:',lbl_deposit:'■ Anzahlung:',deposit_note:'(Kontodaten nach Bestätigung)',confirmed_deposit_note:'<div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:14px 16px;margin:12px 0;font-size:13px;line-height:1.8;"><b style="color:#1d4ed8;">💳 Anzahlungskonto</b><br>Kontoinhaber: Taewoong Min<br>Bank: Deutsche Bank<br>IBAN: <b>DE11 5007 0010 0659 1176 00</b><br>BIC: <b>DEUTDEFFXXX</b><br>Verwendungszweck: Name + Aufnahmedatum</div>',refund_policy:'<div style="background:#fef3c7;border:1px solid #f0d060;border-radius:10px;padding:12px 16px;margin:12px 0;font-size:12px;color:#7a6000;line-height:1.7;"><b>📋 Stornierung & Rückerstattung</b><br>• 8+ Tage vor dem Shooting: 100% Rückerstattung<br>• 2–7 Tage vorher: 50% Rückerstattung<br>• Vortag oder gleicher Tag: Keine Rückerstattung<br>※ Pre-Wedding-Pakete: separate Vereinbarung</div>',lbl_balance:'■ Restzahlung vor Ort:',lbl_disc_product:'■ Paketrabatt:',lbl_disc_return:'■ Stammkundenrabatt:',return_auto:'(automatisch angewendet)',lbl_disc_event:'■ Aktionsrabatt:',payment_title:'💳 Zahlung',payment_body:'Zahlung vor Ort per <b>Karte oder Bargeld</b> möglich.',invoice_note:'Wenn Sie eine Rechnung benötigen, teilen Sie uns dies bitte vor Ihrem Besuch mit.',cancelled_contact:'Bitte kontaktieren Sie uns, wenn Sie Fragen haben.',pending_subject:(n,p)=>`[Studio mean] Buchungsanfrage erhalten`,confirmed_subject:(n,p,d)=>`[Studio mean] Ihre Buchung ist bestätigt! 🎉`,cancelled_subject:(n,p)=>`[Studio mean] Buchung storniert`,return_badge:'⭐ Stammkundenrabatt wurde automatisch angewendet!'}
};

function _getDirectionHtml(lang){
  const ml=`<a href="${MAP_URL}" style="color:#2563eb;font-weight:bold;">🗺️ Google Maps</a>`;
  if(lang==='en') return`<b>📍 Directions</b><br><b>Address:</b> Holzweg-passage 3, 61440 Oberursel<br>${ml}<br><br>Studio is on the <b>2nd floor!</b> Enter through the door under the <b>ALIN / Das Boots</b> sign and come upstairs. Can't find us? Call — we'll come right down!<br><br><b>🅿️ Parking</b> (no dedicated lot)<br>• <a href="${PARKING_1}" style="color:#2563eb;">City Parkhaus</a> — underground<br>• <a href="${PARKING_2}" style="color:#2563eb;">Parkhaus Altstadt</a> — underground<br>• <a href="${PARKING_3}" style="color:#2563eb;">Rathausparkplatz</a> — surface lot<br><br><b>💳 Payment:</b> Card and cash both accepted. Invoice available on request.`;
  if(lang==='de') return`<b>📍 Anfahrt</b><br><b>Adresse:</b> Holzweg-passage 3, 61440 Oberursel<br>${ml}<br><br>Studio im <b>2. Stock!</b> Tür unter dem Schild <b>ALIN / Das Boots</b>, Treppe hochkommen. Nicht gefunden? Rufen Sie an!<br><br><b>🅿️ Parken</b> (kein eigener Parkplatz)<br>• <a href="${PARKING_1}" style="color:#2563eb;">City Parkhaus</a> — Tiefgarage<br>• <a href="${PARKING_2}" style="color:#2563eb;">Parkhaus Altstadt</a> — Tiefgarage<br>• <a href="${PARKING_3}" style="color:#2563eb;">Rathausparkplatz</a> — Oberirdisch<br><br><b>💳 Bezahlung:</b> Karte und Bargeld möglich. Rechnung auf Anfrage.`;
  return`<b>📍 오시는 길</b><br><b>주소:</b> Holzweg-passage 3, 61440 Oberursel<br>${ml}<br><br>도착하시면 <b>2층</b>에 스튜디오가 있습니다! <b>ALIN / Das Boots 간판 밑 문</b>으로 들어와 계단을 올라오세요. 찾기 어려우시면 연락 주세요, 바로 내려가겠습니다! 😊<br><br><b>🅿️ 주차 안내</b> (전용 주차장 없음)<br>• <a href="${PARKING_1}" style="color:#2563eb;">City Parkhaus</a> — 지하주차장<br>• <a href="${PARKING_2}" style="color:#2563eb;">Parkhaus Altstadt</a> — 지하주차장<br>• <a href="${PARKING_3}" style="color:#2563eb;">Rathausparkplatz</a> — 지상 주차장<br><br><b>💳 결제 안내:</b> 카드 및 현금 결제 모두 가능합니다. 인보이스 발행 필요 시 방문 전 말씀해 주세요.`;
}

function _getSignatureHtml(){
  return`<hr style="margin:24px 0;border:none;border-top:1px solid #e2e8f0;"><div style="font-size:12px;color:#64748b;line-height:1.9;">
감사합니다!<br>
Mit freundlichen Grüßen<br><br>
<b style="color:#2D2A26;font-size:13px;">Studio_mean</b><br>
Photographer &amp; Videographer<br>
<b>TAEWOONG MIN</b><br><br>
Holzwegpassage 3, 61440 Oberursel<br>
Tel: <a href="tel:+4917660939400" style="color:#2563eb;">+49 176 6093 9400</a><br>
E-mail: <a href="mailto:studio.mean.de@gmail.com" style="color:#2563eb;">studio.mean.de@gmail.com</a><br>
Instagram: <a href="https://www.instagram.com/studio_mean" style="color:#2563eb;">@studio_mean</a><br><br>
USt-IdNr: DE440009941
</div>`;
}

/* ====== 촬영 안내 이메일 (다국어) ====== */
// (문서 3의 _getGuideHtml 그대로 유지 - 이미 완전 다국어)
function _getGuideHtml(itemGroup,lang,surveyKeys){
  const sk=(surveyKeys||[]),isBaby=sk.includes('baby'),L=lang||'ko';
  if(itemGroup==='pass'){
    if(L==='en')return`<b>📸 [Booking Guide] Passport & Visa Photo</b><br>Welcome! 😊 We follow German biometric (E-passbild) and Korean passport regulations.<br><br><b>⚠️ Eyebrows must be fully visible</b> — Germany's E-passbild system identifies you by eyebrow contour. Bangs → very high rejection rate.<br>• Ears visible: recommended.<br><br><b>📋 Pre-shoot Checklist</b><br>• No white/light pastel tops. ❌<br>• Remove glasses (clear contacts only). ❌ coloured lenses.<br>• Neutral expression, mouth closed, no teeth. ❌<br><br><b>✅ Valid 6 months from shoot date</b> (35mm×45mm, face 32-36mm)<br><br><b>👶 Infants:</b> Lying down, eyes open, no caregiver hands/shadows visible.`;
    if(L==='de')return`<b>📸 [Buchungshinweise] Passfoto & Visum</b><br>Herzlich willkommen! 😊 Wir fotografieren nach deutschen E-passbild und koreanischen Vorschriften.<br><br><b>⚠️ Augenbrauen müssen vollständig sichtbar sein</b> — E-passbild-System identifiziert Sie anhand der Augenbrauenkontur. Pony → hohe Ablehnungsrate.<br>• Ohren sichtbar: empfohlen.<br><br><b>📋 Checkliste</b><br>• Keine weißen/hellen Pastelltöne. ❌<br>• Brille abnehmen empfohlen. Nur klare Kontaktlinsen. ❌ farbige Linsen.<br>• Neutraler Ausdruck, Mund geschlossen, keine Zähne. ❌<br><br><b>✅ Gültig 6 Monate</b> ab Aufnahmedatum (35mm×45mm, Gesicht 32-36mm)<br><br><b>👶 Kleinkinder:</b> Liegend fotografiert, Augen offen, keine Hände/Schatten sichtbar.`;
    return`<b>📸 [예약 안내] 여권 & 비자 촬영</b><br>고객님, 예약을 환영합니다! 😊 독일 E-passbild 및 한국 여권 규정에 맞춰 촬영해 드립니다.<br><br><b>⚠️ [필독] 눈썹 노출 — 가장 중요합니다</b><br>• 독일 E-passbild는 눈썹 윤곽으로 본인을 식별합니다. 앞머리가 눈썹을 가리면 반려 확률이 매우 높습니다.<br>• 귀 노출 권장.<br><br><b>📋 체크리스트</b><br>• 흰색/연한 파스텔톤 상의 피해주세요. ❌<br>• 안경 벗기 강력 권장. 투명 렌즈만 가능. ❌ 컬러렌즈.<br>• 입 다문 무표정, 치아 노출 불가. ❌<br><br><b>✅ 촬영일로부터 6개월 유효</b> (35mm×45mm, 얼굴 32-36mm)<br><br><b>👶 영유아:</b> 눕혀서 촬영, 눈 떠야 함, 보호자 손/그림자 미노출.`;
  }
  const bKo=isBaby?`<br><br><b>👶 아기 촬영 안내</b><br>• 의상 1~2벌, 기저귀·물티슈·간식·장난감 준비<br>• 한복 시: 흰색 이너 필수<br>• ⭐ 돌상 무료 셋팅 (100€ 이상 패키지)`:'';
  const bEn=isBaby?`<br><br><b>👶 Baby Shoot</b><br>• 1-2 outfits, diapers, snacks, toy<br>• Hanbok: white inner required<br>• ⭐ Free birthday table (packages €100+)`:'';
  const bDe=isBaby?`<br><br><b>👶 Baby-Shooting</b><br>• 1-2 Outfits, Windeln, Snacks, Spielzeug<br>• Hanbok: weißes Innenteil erforderlich<br>• ⭐ Kostenloser Geburtstagstisch (ab 100€)`:'';
  if(itemGroup==='prof'){
    if(L==='en')return`<b>📸 Profile Shoot Guide</b><br>1) Share purpose (LinkedIn/CV/SNS) and mood. Send 1-3 reference images.<br>2) Solid colour tops (white/navy/black/beige). No large logos. Bring 1-2 options.<br>3) Arrive 5-10 min early.${bEn}`;
    if(L==='de')return`<b>📸 Profil-Shooting Hinweise</b><br>1) Zweck (LinkedIn/Lebenslauf/SNS) und Stimmung mitteilen. 1-3 Referenzbilder senden.<br>2) Einfarbige Oberteile. Keine großen Logos. 1-2 Optionen mitbringen.<br>3) 5-10 Minuten früher ankommen.${bDe}`;
    return`<b>📸 프로필 촬영 안내</b><br>1) 목적(LinkedIn/이력서/SNS)과 원하는 분위기를 알려주세요. 레퍼런스 1~3장 환영.<br>2) 단색 상의(화이트/네이비/블랙/베이지). 큰 로고·강한 패턴 피하기. 1~2벌 준비.<br>3) 5~10분 전 도착 권장.${bKo}`;
  }
  if(itemGroup==='stud'){
    if(L==='en')return`<b>📸 Studio Shoot Guide</b><br>1) Share mood and purpose. Reference images welcome.<br>2) Matching tones: white/cream/beige/navy/pastel. Avoid large logos.<br>3) With children: bring diapers, snacks, small toy.<br>4) Arrive 10 min early.`;
    if(L==='de')return`<b>📸 Studio-Shooting Hinweise</b><br>1) Stimmung und Verwendungszweck mitteilen. Referenzbilder willkommen.<br>2) Aufeinander abgestimmte Töne. Keine großen Logos.<br>3) Mit Kindern: Windeln, Snacks, kleines Spielzeug.<br>4) 10 Minuten früher ankommen.`;
    return`<b>📸 스튜디오 촬영 안내</b><br>1) 원하는 분위기와 사용 목적을 알려주세요. 레퍼런스 환영.<br>2) 톤 맞춤 의상(화이트/크림/베이지/네이비). 큰 로고·패턴 피하기.<br>3) 아이 동반: 기저귀·간식·장난감 준비.<br>4) 10분 전 도착 권장.`;
  }
  if(itemGroup==='snap'){
    if(L==='en')return`<b>📸 Outdoor Snap Guide</b><br>1) Share references (1-5) and locations. Golden hour recommended.<br>2) Tone coordination: cream/beige/white/navy. 2 outfits suggested.<br>3) Strong makeup + hairspray. Correction makeup recommended.<br>4) Arrive 10-15 min early.`;
    if(L==='de')return`<b>📸 Outdoor-Schnappschuss Hinweise</b><br>1) Referenzen (1-5) und Orte mitteilen. Goldene Stunde empfohlen.<br>2) Aufeinander abgestimmte Töne. 2 Outfits empfohlen.<br>3) Kräftiges Make-up + Haarspray. Korrektiv-Make-up empfohlen.<br>4) 10-15 Minuten früher ankommen.`;
    return`<b>📸 야외스냅 촬영 안내</b><br>1) 레퍼런스(1~5장)와 장소/동선을 미리 공유해 주세요. 골든아워 추천.<br>2) 톤 맞춤 의상. 2벌 준비 추천.<br>3) 뚜렷한 메이크업·헤어 스프레이·수정 메이크업 챙기기.<br>4) 10~15분 전 도착 권장.`;
  }
  if(itemGroup==='wed'){
    if(L==='en')return`<b>📸 Pre-Wedding Shoot Guide</b><br>1) Share mood, references (1-5) and preferred colour tones.<br>2) Confirm locations + timeline. Golden hour recommended.<br>3) Matching outfits: cream/beige/white or navy/black. 2 outfits recommended.<br>4) Hairspray + correction makeup essential outdoors.<br>5) Arrive 10-15 min early.`;
    if(L==='de')return`<b>📸 Vorher-Hochzeit Shooting</b><br>1) Stimmung, Referenzen (1-5) und bevorzugte Farbtöne mitteilen.<br>2) Orte + Zeitplan bestätigen. Goldene Stunde empfohlen.<br>3) Aufeinander abgestimmte Outfits. 2 Outfits empfohlen.<br>4) Haarspray + Korrektiv-Make-up für draußen.<br>5) 10-15 Minuten früher ankommen.`;
    return`<b>📸 프리웨딩 촬영 안내</b><br>1) 무드·목적·레퍼런스(1~5장)·선호 색감을 미리 공유해 주세요.<br>2) 장소+동선 확인. 골든아워 강력 추천.<br>3) 톤 맞춤 의상. 2벌 준비 추천.<br>4) 야외: 헤어 스프레이·수정 메이크업 필수.<br>5) 10~15분 전 도착 권장.`;
  }
  if(L==='en')return`<b>📸 Shoot Notes</b><br>Your session is confirmed. Share preferred mood or reference images in advance.<br>Contact: studio.mean.de@gmail.com`;
  if(L==='de')return`<b>📸 Shooting-Hinweise</b><br>Ihr Termin ist bestätigt. Stimmung oder Referenzbilder bitte im Voraus mitteilen.<br>Kontakt: studio.mean.de@gmail.com`;
  return`<b>📸 촬영 안내</b><br>일정이 확정되었습니다. 원하시는 분위기나 레퍼런스를 미리 공유해 주세요.<br>문의: studio.mean.de@gmail.com`;
}

/* ====== 캘린더 이벤트 ====== */
function buildCalendarDescription_(data,quote,surveyStr,memo){
  const today=Utilities.formatDate(new Date(),CONFIG.TIMEZONE,'yyyy-MM-dd');
  const cleanPhone=String(data.phone||'').replace(/\s/g,'');
  const allCountries=[...(quote.passCountries||[]),...(quote.otherCountry?[quote.otherCountry]:[])].join(', ');
  const passInfo=allCountries?` (${allCountries})`:'';
  const lines=[`이름=${data.name}`,`전화=${cleanPhone}`,`이메일=${data.email}`,`분류=${quote.product.nameKo+passInfo}`,`패키지=${quote.itemGroup!=='pass'?quote.product.nameKo:''}`,`인원=${quote.people}`,`총비용=${quote.itemGroup==='biz'?'미정':quote.totalPrice+'€'}`,`계약금=${quote.depositAmount||0}|DB|${today}`,`잔금=${quote.balanceAmount||quote.totalPrice}|미정|${today}`,`마케팅=${quote.marketing?'Y':'N'}`,`상태=대기`,`---`];
  if(memo) lines.push(`요청: ${memo}`);
  if(surveyStr) lines.push(`분위기: ${surveyStr}`);
  if(data.businessDetails) lines.push(`행사상세: ${data.businessDetails}`);
  if(quote.isReturn) lines.push(`메모: 재방문 고객 — 할인 자동 적용됨`);
  return lines.join('\n');
}

/* ====== 예약 처리 ====== */
function processForm(data){
  try{
    if(!data.name||!data.phone||!data.email) throw new Error('필수 정보 누락');
    const isReturn=checkReturnCustomer_(data.name,data.phone,data.email);
    const quote=calculateQuote_({...data,isReturn});
    const startTime=new Date(`${data.date}T${data.time}:00`);
    const endTime=new Date(startTime.getTime()+quote.totalDuration*60000);
    if(!slotAvailable_(data.date,data.time,quote.totalDuration,quote.itemGroup,data.location||'')) throw new Error('예약이 마감된 시간입니다. 다른 시간을 선택해 주세요.');
    const calendar=CalendarApp.getCalendarById(CONFIG.MAIN_CALENDAR_ID)||CalendarApp.getDefaultCalendar();
    const cleanPhone=String(data.phone).replace(/[\s\-]/g,'');
    const koName=quote.product.nameKo;
    const localName=data.lang==='en'?quote.product.nameEn:(data.lang==='de'?quote.product.nameDe:koName);
    const surveyDict={clean:'깔끔/모던',warm:'따뜻/자연',pro:'전문/포멀',unique:'트렌디/유니크',baby:'백일/돌'};
    const surveyStr=(data.surveyKeys||[]).map(k=>surveyDict[k]||k).join(', ');
    const babyTypeLabel=data.babyType==='dol'?'돌촬영':data.babyType==='baekil'?'백일촬영':'';
    const bgs=(data.bgColors||[]).filter(Boolean);
    const bgColorLabel=bgs.length>1?bgs.map((c,i)=>`[배경${i+1}:${c}]`).join(''):(bgs.length===1?`[배경:${bgs[0]}]`:'');
    const passAddonLabel=data.passAddon?`[여권콤보:${data.passAddonPeople}명]`:'';
    const locationLabel=data.location?`[촬영장소:${data.location}]`:'';
    const memo=(babyTypeLabel?'['+babyTypeLabel+'] ':'')+(bgColorLabel?bgColorLabel+' ':'')+(passAddonLabel?passAddonLabel+' ':'')+(locationLabel?locationLabel+' ':'')+String(data.memo||'').trim();
    const priceLabel=quote.itemGroup==='biz'?'견적필요':quote.totalPrice+'€';
    const calendarLocation=(quote.itemGroup==='snap'||quote.itemGroup==='wed')&&String(data.location||'').trim()
      ? String(data.location).trim()
      : 'Holzweg-passage 3, 61440 Oberursel';
    const event=calendar.createEvent(`${koName} | ${data.name} | ${quote.people}인 | ${priceLabel}`,startTime,endTime,{description:buildCalendarDescription_(data,quote,surveyStr,memo),location:calendarLocation});
    const gdprStr=data.gdprConsent?'Y':'N';
    const marketingStr=data.marketing?'Y':'N';
    const aiConsentStr=data.aiConsent?'Y':'N';
    const consentTs=Utilities.formatDate(new Date(),CONFIG.TIMEZONE,'yyyy-MM-dd HH:mm:ss');
    getDbSheet().appendRow([`${data.date} ${data.time}`,'대기중',data.name,cleanPhone,data.email,data.lang,quote.itemGroup,koName,(data.optionKeys||[]).join(',')+(quote.passCountries.length?' | '+[...quote.passCountries,...(quote.otherCountry?[quote.otherCountry]:[])]:''),quote.people,quote.totalPrice,quote.isDeposit?`입금전(${quote.depositAmount}€)`:'0',quote.balanceAmount,'미결제',surveyStr||'해당없음',memo,event.getId(),quote.isDeposit?'계좌이체':'-','',isReturn?'재방문':'신규','',gdprStr,marketingStr,consentTs,'',aiConsentStr,String(data.address||'').trim()]);
    bumpCalCacheVer_();
    sendCustomerPendingEmail_(data,quote,localName,isReturn,event.getId());
    sendAdminNotificationEmail_(data,quote,koName,event.getId(),surveyStr,memo,isReturn);
    return{ok:true,quote,isReturn};
  }catch(err){return{ok:false,message:err.message};}
}

/* ====== 이메일 발송 ====== */
function sendAdminNotificationEmail_(data,quote,koName,eventId,surveyStr,memo,isReturn){
  const confirmUrl=createHtmlActionLink_('confirm',eventId);const cancelUrl=createHtmlActionLink_('cancel',eventId);
  const allCountries=[...(quote.passCountries||[]),...(quote.otherCountry?[quote.otherCountry]:[])].join(', ');
  const td=(l,v)=>`<tr><td style="padding:10px 14px;background:#f8fafc;font-weight:700;width:110px;border-bottom:1px solid #e2e8f0;font-size:13px;color:#475569;">${l}</td><td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;font-size:14px;">${v}</td></tr>`;
  const htmlBody=`<div style="font-family:-apple-system,sans-serif;max-width:600px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;"><div style="background:#2D2A26;padding:20px 25px;"><h2 style="margin:0;color:#fff;font-size:18px;">🆕 새 예약${isReturn?' ⭐재방문':''}</h2></div><div style="padding:25px;"><table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">${td('고객명',`<b>${data.name}</b>${isReturn?' <span style="background:#8b5cf6;color:#fff;padding:2px 6px;border-radius:4px;font-size:11px;">재방문</span>':''}`)}${td('연락처',data.phone)}${td('이메일',data.email)}${td('상품',`<b style="color:#2563eb;">${koName}</b>${allCountries?' ('+allCountries+')':''}`)}${td('일시',`<b>${data.date} ${data.time}</b>`)}${td('인원',quote.people+'명')}${td('총금액',`<b style="color:#10b981;">${quote.totalPrice}€</b>`)}${quote.isDeposit?td('계약금',`<span style="color:#ef4444;">${quote.depositAmount}€ 입금 필요</span>`):''} ${surveyStr?td('분위기',surveyStr):''}${memo?td('요청사항',`<div style="white-space:pre-wrap;">${memo}</div>`):''}</table><div style="text-align:center;margin:25px 0;display:flex;gap:12px;justify-content:center;"><a href="${confirmUrl}" style="background:#10b981;color:#fff;padding:14px 28px;text-decoration:none;border-radius:8px;font-weight:700;font-size:15px;display:inline-block;">✅ 예약 확정하기</a><a href="${cancelUrl}" style="background:#ef4444;color:#fff;padding:14px 28px;text-decoration:none;border-radius:8px;font-weight:700;font-size:15px;display:inline-block;">❌ 예약 취소하기</a></div><p style="text-align:center;font-size:12px;color:#94a3b8;">이 링크는 14일 후 만료됩니다.</p></div></div>`;
  MailApp.sendEmail({to:CONFIG.ADMIN_EMAIL,subject:`[새 예약${isReturn?' ⭐재방문':''}] ${data.name}님 — ${koName} (${data.date} ${data.time})`,htmlBody});
}

function sendCustomerPendingEmail_(request,quote,localProductName,isReturn,eventId){
  const lang=request.lang||'ko';const T=EMAIL_I18N[lang]||EMAIL_I18N.ko;
  const allCountries=[...(quote.passCountries||[]),...(quote.otherCountry?[quote.otherCountry]:[])].join(', ');
  const priceHtml=quote.isDeposit?`${T.lbl_total} ${quote.totalPrice}€<br>${T.lbl_deposit} <span style="color:#ef4444;font-weight:bold;">${quote.depositAmount}€</span> ${T.deposit_note}<br>${T.lbl_balance} ${quote.balanceAmount}€`:`${T.lbl_total} ${quote.totalPrice}€`;
  const mktDiscLabel={ko:'■ 마케팅 동의 할인:',en:'■ Marketing consent discount:',de:'■ Marketing-Rabatt:'};
  const discHtml=[quote.productDiscount>0?`${T.lbl_disc_product} -${quote.productDiscount}€`:'',quote.returnDiscount>0?`${T.lbl_disc_return} -${quote.returnDiscount}€ ${T.return_auto}`:'',quote.eventDiscount>0?`${T.lbl_disc_event} -${quote.eventDiscount}€`:'',quote.marketingDiscount>0?`${mktDiscLabel[lang]||mktDiscLabel.ko} -${quote.marketingDiscount}€`:''].filter(Boolean).join('<br>');
  const returnBadge=isReturn?`<br><b style="color:#8b5cf6;">${T.return_badge}</b>`:'';
  const refundBox=(quote.itemGroup!=='wed')?(T.refund_policy||''):'';
  // 취소/변경 신청 링크
  let cancelSection='';
  if(eventId){
    try{
      const cancelUrl=createHtmlActionLink_('customer_cancel',eventId);
      const rescheduleUrl=createHtmlActionLink_('customer_reschedule',eventId);
      const cancelLabel={ko:'예약 취소 요청',en:'Request Cancellation',de:'Stornierung anfragen'};
      const rescheduleLabel={ko:'일정 변경 신청',en:'Request Reschedule',de:'Termin ändern'};
      const infoText={ko:'예약 변경 또는 취소가 필요하신 경우 아래 버튼을 클릭해 주세요.',en:'To change or cancel your booking, please use the buttons below.',de:'Zum Ändern oder Stornieren Ihres Termins nutzen Sie bitte die Schaltflächen unten.'};
      cancelSection=`<hr style="margin:20px 0;border:none;border-top:1px solid #e2e8f0;"><p style="font-size:12px;color:#64748b;">${infoText[lang||'ko']}</p><div style="display:flex;gap:10px;flex-wrap:wrap;"><a href="${rescheduleUrl}" style="display:inline-block;padding:10px 20px;background:#eff6ff;color:#2563eb;border-radius:8px;text-decoration:none;font-size:13px;font-weight:600;">📅 ${rescheduleLabel[lang]||rescheduleLabel.ko}</a><a href="${cancelUrl}" style="display:inline-block;padding:10px 20px;background:#f1f5f9;color:#475569;border-radius:8px;text-decoration:none;font-size:13px;font-weight:600;">📩 ${cancelLabel[lang]||cancelLabel.ko}</a></div>`;
    }catch(e){Logger.log('pending cancelSection 오류:'+e.message);}
  }
  const body=`${T.greeting(request.name)}<br><br>${T.pending_intro}${returnBadge}<br><br><b>${T.receipt_title}</b><br>${T.lbl_product} ${localProductName}${allCountries?' ('+allCountries+')':''}<br>${T.lbl_datetime} ${request.date} ${request.time}<br>${priceHtml}${discHtml?'<br>'+discHtml:''}<br><br><b>${T.payment_title}</b><br>${T.payment_body}<br>${T.invoice_note}${refundBox}<br><br><hr><br>${_getDirectionHtml(lang)}<br><br>${cancelSection}${_getSignatureHtml()}`;
  MailApp.sendEmail({to:request.email,subject:T.pending_subject(request.name,localProductName),htmlBody:body});
}

function _sendConfirmEmail(name,email,lang,itemGroup,prodLocal,price,timeRaw,passCountries,surveyKeys,depositAmount,balanceAmount,eventId){
  if(!email||email.includes('수기등록')) return;
  const T=EMAIL_I18N[lang||'ko']||EMAIL_I18N.ko;
  const {obj:dt}=parseDateSafe_(timeRaw);
  const formattedTime=Utilities.formatDate(dt,CONFIG.TIMEZONE,'yyyy-MM-dd HH:mm');
  const allCountries=(passCountries||[]).join(', ');
  const guide=_getGuideHtml(itemGroup,lang||'ko',surveyKeys||[]);
  const dep=parseInt(depositAmount)||0;
  const bal=parseInt(balanceAmount)||0;
  const depositBox=dep>0?(T.confirmed_deposit_note||''):'';
  const refundBox=(itemGroup!=='wed')?(T.refund_policy||''):'';
  const priceHtml=dep>0?`${T.lbl_total} ${price}<br>${T.lbl_deposit} <span style="color:#ef4444;font-weight:bold;">${dep}€</span><br>${T.lbl_balance} ${bal}€${depositBox}`:`${T.lbl_total} ${price}€`;
  // 고객 취소요청 링크
  let cancelSection='';
  if(eventId){
    try{
      const cancelUrl=createHtmlActionLink_('customer_cancel',eventId);
      const rescheduleUrl=createHtmlActionLink_('customer_reschedule',eventId);
      const cancelLabel={ko:'예약 취소 요청',en:'Request Cancellation',de:'Stornierung anfragen'};
      const rescheduleLabel={ko:'일정 변경 신청',en:'Request Reschedule',de:'Termin ändern'};
      const infoText={ko:'예약 변경 또는 취소가 필요하신 경우 아래 버튼을 클릭해 주세요. 취소 정책에 따라 환불이 처리됩니다.',en:'If you need to change or cancel your booking, please click the button below.',de:'Wenn Sie Ihren Termin ändern oder stornieren möchten, klicken Sie bitte auf eine der Schaltflächen unten.'};
      cancelSection=`<br><hr style="margin:20px 0;border:none;border-top:1px solid #e2e8f0;"><p style="font-size:12px;color:#94a3b8;">${infoText[lang||'ko']}</p><div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:10px;"><a href="${rescheduleUrl}" style="display:inline-block;padding:10px 20px;background:#eff6ff;color:#2563eb;border-radius:8px;text-decoration:none;font-size:13px;font-weight:600;">📅 ${rescheduleLabel[lang]||rescheduleLabel.de}</a><a href="${cancelUrl}" style="display:inline-block;padding:10px 20px;background:#f1f5f9;color:#475569;border-radius:8px;text-decoration:none;font-size:13px;font-weight:600;">📩 ${cancelLabel[lang]||cancelLabel.de}</a></div>`;
    }catch(e){Logger.log('cancelSection 오류:'+e.message);}
  }
  const body=`${T.greeting(name)}<br><br>${T.confirmed_intro}<br><br>${T.lbl_product} ${prodLocal}${allCountries?' ('+allCountries+')':''}<br>${T.lbl_datetime} <b>${formattedTime}</b><br>${priceHtml}<br><br><b>${T.payment_title}</b><br>${T.payment_body}<br>${T.invoice_note}${refundBox}<br><br><hr><br>${guide}<br><br><hr><br>${_getDirectionHtml(lang||'ko')}${cancelSection}${_getSignatureHtml()}`;
  MailApp.sendEmail({to:email,subject:T.confirmed_subject(name,prodLocal,formattedTime),htmlBody:body});
}

/* ====== 액션 링크 ====== */
function handleActionRoute_(p){
  try{
    if(!p.action||!p.eventId||!p.exp||!p.sig) return HtmlService.createHtmlOutput('<h2>❌ 잘못된 링크입니다.</h2>');
    if(Number(p.exp)<Math.floor(Date.now()/1000)) return HtmlService.createHtmlOutput('<h2>⏰ 만료된 링크입니다.</h2>');
    const rawId=decodeURIComponent(p.eventId);
    if(signAction_(p.action,rawId,Number(p.exp))!==p.sig) return HtmlService.createHtmlOutput('<h2>❌ 유효하지 않은 서명입니다.</h2>');
    if(p.action==='confirm') return confirmBooking(rawId);
    if(p.action==='cancel') return cancelBooking(rawId);
    if(p.action==='customer_cancel') return customerCancelRequest_(rawId);
    if(p.action==='customer_reschedule') return customerRescheduleForm_(rawId);
    if(p.action==='approve_retouch') return approveRetouch_(rawId,p);
    if(p.action==='revise_retouch') return reviseRetouch_(rawId,p);
    return HtmlService.createHtmlOutput('<h2>❌ 알 수 없는 액션입니다.</h2>');
  }catch(err){return HtmlService.createHtmlOutput(`<h2>❌ ${err.message}</h2>`);}
}
function createActionLink_(action,eventId){const exp=Math.floor(Date.now()/1000)+CONFIG.ACTION_LINK_TTL_SEC;const sig=signAction_(action,eventId,exp);return`${ScriptApp.getService().getUrl()}?action=${encodeURIComponent(action)}&eventId=${encodeURIComponent(eventId)}&exp=${exp}&sig=${encodeURIComponent(sig)}`;}
function createHtmlActionLink_(action,eventId){return createActionLink_(action,eventId).replace(/&/g,'&amp;');}
function signAction_(action,eventId,exp){const secret=PropertiesService.getScriptProperties().getProperty('ACTION_SECRET');return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(`${action}|${eventId}|${exp}`,secret)).replace(/=+$/g,'');}

function confirmBooking(eventId){
  try{
    const sh=getDbSheet(),data=sh.getDataRange().getValues();
    const idx=data.slice(1).findIndex(r=>String(r[16]).trim()===String(eventId).trim());
    if(idx===-1) return HtmlService.createHtmlOutput('<h2>❌ 예약 정보를 찾을 수 없습니다.</h2>');
    const row=data[idx+1];
    if(row[1]==='확정됨') return HtmlService.createHtmlOutput('<h2>ℹ️ 이미 확정된 예약입니다.</h2>');
    if(row[1]==='취소됨') return HtmlService.createHtmlOutput('<h2>ℹ️ 취소된 예약은 확정할 수 없습니다.</h2>');
    sh.getRange(idx+2,2).setValue('확정됨');
    try{const ev=(CalendarApp.getCalendarById(CONFIG.MAIN_CALENDAR_ID)||CalendarApp.getDefaultCalendar()).getEventById(eventId);if(ev){ev.setColor(CalendarApp.EventColor.PALE_GREEN);const t=ev.getTitle();if(t.startsWith('[대기] '))ev.setTitle(t.slice(5));}}catch(e){}
    const lang=String(row[5]||'ko').toLowerCase().trim();
    const products=getCachedProducts_();const product=products.find(p=>p.nameKo===row[7]);
    const prodLocal=product?(lang==='en'?product.nameEn:(lang==='de'?product.nameDe:product.nameKo)):row[7];
    const passCountries=String(row[8]||'').split('|').map(s=>s.trim()).filter(s=>s&&!['kids','dog','bg','outfit'].includes(s));
    // row[11] = 계약금 문자열(예: "입금전(50€)"), row[12] = 잔금
    const depMatch=String(row[11]||'').match(/\d+/);
    const depAmt=depMatch?parseInt(depMatch[0]):0;
    const balAmt=parseInt(String(row[12]||'').replace(/[^0-9]/g,''))||0;
    _sendConfirmEmail(row[2],row[4],lang,row[6],prodLocal,row[10],row[0],passCountries,String(row[14]||'').split(','),depAmt,balAmt,eventId);
    return HtmlService.createHtmlOutput('<div style="font-family:sans-serif;text-align:center;padding:40px;"><h2 style="color:#10b981;">✅ 예약 확정 완료</h2><p>고객에게 확정 이메일이 발송되었습니다.</p></div>');
  }catch(err){return HtmlService.createHtmlOutput(`<h2>❌ ${err.message}</h2>`);}
}

function cancelBooking(eventId){
  try{
    const sh=getDbSheet(),data=sh.getDataRange().getValues();
    const idx=data.slice(1).findIndex(r=>String(r[16]).trim()===String(eventId).trim());
    if(idx===-1) return HtmlService.createHtmlOutput('<h2>❌ 예약 정보를 찾을 수 없습니다.</h2>');
    const row=data[idx+1];
    if(row[1]==='취소됨') return HtmlService.createHtmlOutput('<h2>ℹ️ 이미 취소된 예약입니다.</h2>');
    sh.getRange(idx+2,2).setValue('취소됨');
    try{const ev=(CalendarApp.getCalendarById(CONFIG.MAIN_CALENDAR_ID)||CalendarApp.getDefaultCalendar()).getEventById(eventId);if(ev){ev.deleteEvent();}}catch(e){}
    const email=String(row[4]||'');const rowLang=String(row[5]||'ko').toLowerCase().trim();
    const TC=EMAIL_I18N[rowLang]||EMAIL_I18N.ko;const formattedDt=parseDateSafe_(row[0]).str||String(row[0]);
    const products=getCachedProducts_();const product=products.find(p=>p.nameKo===row[7]);
    const prodLocal=product?(rowLang==='en'?product.nameEn:(rowLang==='de'?product.nameDe:product.nameKo)):row[7];
    if(email&&!email.includes('수기등록')&&email.includes('@')) MailApp.sendEmail({to:email,subject:TC.cancelled_subject(row[2],prodLocal),htmlBody:`${TC.greeting(row[2])}<br><br>${TC.cancelled_intro}<br><br>${TC.lbl_product} ${prodLocal}<br>${TC.lbl_datetime} ${formattedDt}<br><br>${TC.cancelled_contact}<br><br><b>Studio mean</b><br>studio.mean.de@gmail.com`});
    bumpCalCacheVer_();
    return HtmlService.createHtmlOutput('<div style="font-family:sans-serif;text-align:center;padding:40px;"><h2 style="color:#ef4444;">🚫 예약이 취소되었습니다.</h2></div>');
  }catch(err){return HtmlService.createHtmlOutput(`<h2>❌ ${err.message}</h2>`);}
}

/* ====== 고객 취소 요청 ====== */
function customerCancelRequest_(eventId){
  try{
    const sh=getDbSheet(),data=sh.getDataRange().getValues();
    const idx=data.slice(1).findIndex(r=>String(r[16]).trim()===String(eventId).trim());
    if(idx===-1) return HtmlService.createHtmlOutput('<div style="font-family:sans-serif;text-align:center;padding:40px;"><h2>❌ 예약 정보를 찾을 수 없습니다.</h2></div>');
    const row=data[idx+1];
    if(row[1]==='취소됨') return HtmlService.createHtmlOutput('<div style="font-family:sans-serif;text-align:center;padding:40px;"><h2>ℹ️ 이미 취소된 예약입니다.</h2></div>');
    const name=String(row[2]||'');
    const email=String(row[4]||'');
    const lang=String(row[5]||'ko');
    const formattedDt=parseDateSafe_(row[0]).str||String(row[0]);
    const product=String(row[7]||'');
    const phone=String(row[3]||'');
    // 어드민 알림
    MailApp.sendEmail({
      to:CONFIG.ADMIN_EMAIL,
      subject:`[취소요청] ${name}님 — ${product} (${formattedDt})`,
      htmlBody:`<h3>📩 고객 예약 취소 요청</h3><table style="border-collapse:collapse;"><tr><td style="padding:8px 12px;background:#f8fafc;font-weight:700;">고객명</td><td style="padding:8px 12px;">${name}</td></tr><tr><td style="padding:8px 12px;background:#f8fafc;font-weight:700;">연락처</td><td style="padding:8px 12px;">${phone}</td></tr><tr><td style="padding:8px 12px;background:#f8fafc;font-weight:700;">이메일</td><td style="padding:8px 12px;">${email}</td></tr><tr><td style="padding:8px 12px;background:#f8fafc;font-weight:700;">예약일시</td><td style="padding:8px 12px;">${formattedDt}</td></tr><tr><td style="padding:8px 12px;background:#f8fafc;font-weight:700;">상품</td><td style="padding:8px 12px;">${product}</td></tr></table><br><p>어드민 페이지에서 직접 취소 처리해 주세요.</p>`
    });
    // 고객 응답 페이지
    const msgs={
      ko:'<h2 style="color:#2D2A26;">📩 취소 요청이 접수되었습니다</h2><p>빠른 시일 내에 연락드리겠습니다.<br>문의: studio.mean.de@gmail.com</p>',
      en:'<h2 style="color:#2D2A26;">📩 Cancellation request received</h2><p>We will contact you as soon as possible.<br>Contact: studio.mean.de@gmail.com</p>',
      de:'<h2 style="color:#2D2A26;">📩 Stornierungsanfrage eingegangen</h2><p>Wir werden uns so schnell wie möglich bei Ihnen melden.<br>Kontakt: studio.mean.de@gmail.com</p>'
    };
    return HtmlService.createHtmlOutput(`<div style="font-family:-apple-system,sans-serif;text-align:center;padding:60px 20px;max-width:500px;margin:0 auto;">${msgs[lang]||msgs.de}</div>`);
  }catch(err){return HtmlService.createHtmlOutput(`<h2>❌ ${err.message}</h2>`);}
}

/* ====== 고객 일정변경 신청 ====== */
function customerRescheduleForm_(eventId){
  try{
    const sh=getDbSheet(),data=sh.getDataRange().getValues();
    const idx=data.slice(1).findIndex(r=>String(r[16]).trim()===String(eventId).trim());
    if(idx===-1) return HtmlService.createHtmlOutput('<div style="font-family:sans-serif;text-align:center;padding:40px;"><h2>❌ 예약 정보를 찾을 수 없습니다.</h2></div>');
    const row=data[idx+1];
    if(row[1]==='취소됨') return HtmlService.createHtmlOutput('<div style="font-family:sans-serif;text-align:center;padding:40px;"><h2>ℹ️ 이미 취소된 예약입니다.</h2></div>');
    const lang=String(row[5]||'ko');
    const name=String(row[2]||'');
    const product=String(row[7]||'');
    const dateStr=parseDateSafe_(row[0]).str||'';
    const title={ko:'일정 변경 신청',en:'Request Reschedule',de:'Terminänderungsanfrage'};
    const labels={
      ko:{cur:'현재 예약 일시',prod:'상품',pref:'희망 날짜',timeLabel:'희망 시간',timePh:'시간 선택',note:'변경 사유',notePh:'변경 사유 또는 참고사항을 입력해 주세요.',submit:'변경 신청하기',done:'변경 신청이 접수되었습니다. 빠른 시일 내에 연락드리겠습니다.',err:'오류가 발생했습니다. 다시 시도해 주세요.',dateReq:'날짜를 선택해 주세요.'},
      en:{cur:'Current booking',prod:'Service',pref:'Preferred date',timeLabel:'Preferred time',timePh:'Select time',note:'Reason for change',notePh:'Please describe your preferred date or reason for change.',submit:'Submit Request',done:'Your reschedule request has been received. We will contact you soon.',err:'An error occurred. Please try again.',dateReq:'Please select a date.'},
      de:{cur:'Aktueller Termin',prod:'Leistung',pref:'Gewünschtes Datum',timeLabel:'Gewünschte Uhrzeit',timePh:'Uhrzeit wählen',note:'Grund der Änderung',notePh:'Bitte geben Sie Ihren Wunschtermin oder den Grund an.',submit:'Anfrage senden',done:'Ihre Terminänderungsanfrage wurde erhalten. Wir melden uns bald.',err:'Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.',dateReq:'Bitte wählen Sie ein Datum.'}
    };
    const L=labels[lang]||labels.de;
    const tomorrow=new Date();tomorrow.setDate(tomorrow.getDate()+1);
    const minDate=Utilities.formatDate(tomorrow,CONFIG.TIMEZONE,'yyyy-MM-dd');
    const noSlotMsg={ko:'선택한 날짜에 예약 가능한 시간이 없습니다.',en:'No available time slots on this date.',de:'Keine verfügbaren Zeitfenster an diesem Tag.'};
    const slotLoadingMsg={ko:'가능한 시간 확인 중...',en:'Checking availability...',de:'Verfügbarkeit wird geprüft...'};
    const html=`<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title[lang]||title.de} — Studio mean</title>
<style>*{box-sizing:border-box;}body{font-family:-apple-system,sans-serif;background:#f8fafc;margin:0;padding:20px;}
.card{background:#fff;border-radius:14px;padding:28px;max-width:480px;margin:0 auto;box-shadow:0 2px 12px rgba(0,0,0,.08);}
h2{font-size:20px;margin:0 0 6px;}.sub{color:#64748b;font-size:13px;margin-bottom:20px;}
.info-box{background:#f1f5f9;border-radius:8px;padding:12px 14px;font-size:13px;margin-bottom:20px;display:grid;grid-template-columns:auto 1fr;gap:4px 12px;}
.info-lbl{color:#94a3b8;font-size:12px;}
label{display:block;font-size:13px;font-weight:600;margin-bottom:6px;color:#374151;}
input,textarea{width:100%;border:1px solid #d1d5db;border-radius:8px;padding:10px 12px;font-size:14px;margin-bottom:16px;font-family:inherit;background:#fff;}
textarea{resize:vertical;min-height:80px;}
.slot-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:16px;}
.slot-btn{padding:10px 6px;border:1.5px solid #e5e7eb;border-radius:8px;background:#fff;cursor:pointer;font-size:14px;font-weight:500;color:#374151;transition:all .15s;text-align:center;}
.slot-btn:hover{border-color:#2D2A26;background:#f5f3ef;}
.slot-btn.selected{background:#2D2A26;color:#fff;border-color:#2D2A26;font-weight:700;}
.slot-msg{font-size:13px;color:#94a3b8;margin-bottom:16px;}
button.submit-btn{width:100%;padding:13px;background:#2D2A26;color:#fff;border:none;border-radius:10px;font-size:15px;font-weight:700;cursor:pointer;}
button.submit-btn:disabled{background:#9ca3af;}
.done{text-align:center;padding:40px 20px;}.done h2{color:#16a34a;}
</style></head>
<body>
<div class="card" id="formCard">
  <h2>📅 ${title[lang]||title.de}</h2>
  <div class="sub">Studio mean</div>
  <div class="info-box">
    <span class="info-lbl">${L.cur}</span><span>${dateStr}</span>
    <span class="info-lbl">${L.prod}</span><span>${product}</span>
  </div>
  <label>${L.pref}</label>
  <input type="date" id="prefDate" min="${minDate}" onchange="loadSlots(this.value)">
  <div id="slotSection" style="display:none;">
    <label>${L.timeLabel}</label>
    <div id="slotGrid" class="slot-grid"></div>
    <div id="slotMsg" class="slot-msg"></div>
  </div>
  <label>${L.note}</label>
  <textarea id="note" placeholder="${L.notePh}"></textarea>
  <button class="submit-btn" id="submitBtn" onclick="doSubmit()">${L.submit}</button>
</div>
<div class="done" id="doneCard" style="display:none;"><h2>✅</h2><p>${L.done}</p></div>
<script>
var selectedSlot='';
function loadSlots(d){
  if(!d){document.getElementById('slotSection').style.display='none';return;}
  selectedSlot='';
  document.getElementById('slotSection').style.display='block';
  document.getElementById('slotGrid').innerHTML='';
  document.getElementById('slotMsg').textContent='${slotLoadingMsg[lang]||slotLoadingMsg.ko}';
  google.script.run
    .withSuccessHandler(function(slots){
      const grid=document.getElementById('slotGrid');
      const msg=document.getElementById('slotMsg');
      grid.innerHTML='';
      if(!slots||!slots.length){msg.textContent='${noSlotMsg[lang]||noSlotMsg.ko}';return;}
      msg.textContent='';
      slots.forEach(function(s){
        const btn=document.createElement('button');
        btn.className='slot-btn';btn.textContent=s;btn.type='button';
        btn.onclick=function(){
          document.querySelectorAll('.slot-btn').forEach(function(b){b.classList.remove('selected');});
          btn.classList.add('selected');selectedSlot=s;
        };
        grid.appendChild(btn);
      });
    })
    .withFailureHandler(function(){document.getElementById('slotMsg').textContent='오류가 발생했습니다.';})
    .getRescheduleSlotsForEvent('${eventId}',d);
}
function doSubmit(){
  const d=document.getElementById('prefDate').value;
  if(!d){alert('${L.dateReq}');return;}
  if(!selectedSlot){alert('${L.timePh}');return;}
  const pref=d+' '+selectedSlot;
  const note=document.getElementById('note').value.trim();
  document.getElementById('submitBtn').disabled=true;
  google.script.run
    .withSuccessHandler(function(){document.getElementById('formCard').style.display='none';document.getElementById('doneCard').style.display='block';})
    .withFailureHandler(function(){alert('${L.err}');document.getElementById('submitBtn').disabled=false;})
    .submitRescheduleRequest('${eventId}',pref,note);
}
<\/script>
</body></html>`;
    return HtmlService.createHtmlOutput(html).addMetaTag('viewport','width=device-width,initial-scale=1').setTitle(title[lang]||title.de).setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }catch(err){return HtmlService.createHtmlOutput(`<h2>❌ ${err.message}</h2>`);}
}

function getRescheduleSlotsForEvent(eventId,dateStr){
  const sh=getDbSheet(),data=sh.getDataRange().getValues();
  const idx=data.slice(1).findIndex(r=>String(r[16]).trim()===String(eventId).trim());
  if(idx===-1) return[];
  const row=data[idx+1];
  const itemGroup=String(row[6]||'');
  const productName=String(row[7]||'');
  const products=getCachedProducts_();
  const prod=products.find(p=>p.nameKo===productName);
  const totalDur=prod?(prod.d+(prod.prep||0)):60;
  return getAvailableSlots(dateStr,totalDur,itemGroup);
}

function submitRescheduleRequest(eventId,preferredDate,note){
  const sh=getDbSheet(),data=sh.getDataRange().getValues();
  const idx=data.slice(1).findIndex(r=>String(r[16]).trim()===String(eventId).trim());
  if(idx===-1) throw new Error('예약을 찾을 수 없습니다.');
  const row=data[idx+1];
  const name=String(row[2]||'');
  const product=String(row[7]||'');
  const dateStr=parseDateSafe_(row[0]).str||'';
  const phone=String(row[3]||'');
  const email=String(row[4]||'');
  const reqText=`[${Utilities.formatDate(new Date(),CONFIG.TIMEZONE,'yyyy-MM-dd HH:mm')}] 희망: ${preferredDate} / ${note||'-'}`;
  sh.getRange(idx+2,25).setValue(reqText);
  // ✅ 캘린더 이벤트 자동 반영
  let calUpdated=false;
  const newDate=new Date(preferredDate.replace(' ','T'));
  if(!isNaN(newDate.getTime())){
    try{
      const products=getCachedProducts_();
      const prod=products.find(p=>p.nameKo===String(row[7]||''));
      const durationMin=prod?(prod.d+(prod.prep||0)):60;
      const endDate=new Date(newDate.getTime()+durationMin*60000);
      const calEventId=String(row[16]||'').trim();
      if(calEventId){
        const cal=CalendarApp.getCalendarById(CONFIG.MAIN_CALENDAR_ID)||CalendarApp.getDefaultCalendar();
        const ev=cal.getEventById(calEventId);
        if(ev){ev.setTime(newDate,endDate);calUpdated=true;}
      }
      if(calUpdated){
        const newFmt=Utilities.formatDate(newDate,CONFIG.TIMEZONE,"yyyy-MM-dd'T'HH:mm:ss");
        sh.getRange(idx+2,1).setValue(newFmt);
        sh.getRange(idx+2,2).setValue('변경대기');
        bumpCalCacheVer_();
      }
    }catch(e){Logger.log('캘린더 반영 오류: '+e.message);}
  }
  const calNote=calUpdated?'<br><br>✅ <b>캘린더 일정이 자동으로 변경됐습니다.</b> 확인 후 최종 확정 메일을 발송해 주세요.':'<br><br>⚠️ 캘린더 자동 반영 실패. 어드민 예약 장부에서 직접 수정해 주세요.';
  MailApp.sendEmail({
    to:CONFIG.ADMIN_EMAIL,
    subject:`[일정변경요청] ${name}님 — ${product} (현재: ${dateStr})`,
    htmlBody:`<h3>📅 고객 일정 변경 요청</h3>
<table style="border-collapse:collapse;">
<tr><td style="padding:6px 12px;background:#f8fafc;font-weight:700;">고객명</td><td style="padding:6px 12px;">${name}</td></tr>
<tr><td style="padding:6px 12px;background:#f8fafc;font-weight:700;">연락처</td><td style="padding:6px 12px;">${phone}</td></tr>
<tr><td style="padding:6px 12px;background:#f8fafc;font-weight:700;">이메일</td><td style="padding:6px 12px;">${email}</td></tr>
<tr><td style="padding:6px 12px;background:#f8fafc;font-weight:700;">현재 일시</td><td style="padding:6px 12px;">${dateStr}</td></tr>
<tr><td style="padding:6px 12px;background:#f8fafc;font-weight:700;">상품</td><td style="padding:6px 12px;">${product}</td></tr>
<tr><td style="padding:6px 12px;background:#fffbeb;font-weight:700;color:#92400e;">희망 일정</td><td style="padding:6px 12px;font-weight:700;color:#92400e;">${preferredDate}</td></tr>
<tr><td style="padding:6px 12px;background:#f8fafc;font-weight:700;">메모</td><td style="padding:6px 12px;">${note||'-'}</td></tr>
</table>${calNote}`
  });
  return{ok:true,calUpdated};
}

function rescheduleBookingAdmin(token,bookingRowIndex,newDateTimeStr,memo){
  assertAdmin_(token);
  const {bookingSheet}=ensureSheets_();
  const data=bookingSheet.getDataRange().getValues();
  if(bookingRowIndex<2||bookingRowIndex>data.length) throw new Error('잘못된 행 번호');
  const row=data[bookingRowIndex-1];
  const newDate=new Date(newDateTimeStr);
  if(isNaN(newDate.getTime())) throw new Error('유효하지 않은 날짜: '+newDateTimeStr);
  // 상품 duration 조회
  const products=getCachedProducts_();
  const prod=products.find(p=>p.nameKo===String(row[7]||''));
  const durationMin=prod?(prod.d+(prod.prep||0)):60;
  const endDate=new Date(newDate.getTime()+durationMin*60000);
  // 캘린더 이벤트 시간 수정
  const eventId=String(row[16]||'').trim();
  if(eventId){
    try{
      const cal=CalendarApp.getCalendarById(CONFIG.MAIN_CALENDAR_ID)||CalendarApp.getDefaultCalendar();
      const ev=cal.getEventById(eventId);
      if(ev) ev.setTime(newDate,endDate);
    }catch(e){Logger.log('cal reschedule error: '+e.message);}
  }
  // 시트 업데이트: 예약일시(col1) + 변경요청 초기화(col25)
  const newFmt=Utilities.formatDate(newDate,CONFIG.TIMEZONE,"yyyy-MM-dd'T'HH:mm:ss");
  bookingSheet.getRange(bookingRowIndex,1).setValue(newFmt);
  bookingSheet.getRange(bookingRowIndex,25).setValue('');
  // 고객 알림 이메일
  const email=String(row[4]||'');
  const lang=String(row[5]||'ko').toLowerCase().trim();
  const name=String(row[2]||'');
  const newDateDisplay=Utilities.formatDate(newDate,CONFIG.TIMEZONE,'yyyy-MM-dd HH:mm');
  if(email&&email.includes('@')&&!email.includes('수기등록')){
    const subjects={ko:`[Studio mean] ${name}님, 예약 일정이 변경되었습니다`,en:`[Studio mean] ${name}, your booking has been rescheduled`,de:`[Studio mean] ${name}, Ihr Termin wurde bestätigt`};
    const bodies={
      ko:`안녕하세요, ${name}님!<br><br>예약 일정이 변경되었습니다.<br><br>📅 새 예약 일시: <b>${newDateDisplay}</b><br>🛍 상품: ${row[7]}${memo?'<br><br>메모: '+memo:''}<br><br>문의: studio.mean.de@gmail.com<br><br><b>Studio mean</b>`,
      en:`Dear ${name},<br><br>Your booking has been rescheduled.<br><br>📅 New date & time: <b>${newDateDisplay}</b><br>🛍 Service: ${row[7]}${memo?'<br><br>Note: '+memo:''}<br><br>Contact: studio.mean.de@gmail.com<br><br><b>Studio mean</b>`,
      de:`Liebe/r ${name},<br><br>Ihr Termin wurde geändert.<br><br>📅 Neuer Termin: <b>${newDateDisplay}</b><br>🛍 Leistung: ${row[7]}${memo?'<br><br>Hinweis: '+memo:''}<br><br>Kontakt: studio.mean.de@gmail.com<br><br><b>Studio mean</b>`
    };
    MailApp.sendEmail({to:email,subject:subjects[lang]||subjects.de,htmlBody:bodies[lang]||bodies.de});
  }
  bumpCalCacheVer_();
  return{ok:true,newDate:newFmt};
}

/* ====== 보정본 승인 / 재수정 요청 ====== */
function approveRetouch_(sessionId,p){
  try{
    const selSh=ensureSheets_().ss.getSheetByName(SELECT_SHEET_NAME);
    if(!selSh)return HtmlService.createHtmlOutput('<h2>❌ 시스템 오류</h2>');
    const rows=selSh.getDataRange().getValues();
    const idx=rows.slice(1).findIndex(r=>String(r[0])===String(sessionId));
    if(idx===-1)return HtmlService.createHtmlOutput('<h2>❌ 세션을 찾을 수 없습니다.</h2>');
    const row=rows[idx+1];const rowLang=String(row[SELECT_COL['언어']]||'ko');
    selSh.getRange(idx+2,SELECT_COL['상태']+1).setValue('보정본확인완료');
    try{MailApp.sendEmail({to:CONFIG.ADMIN_EMAIL,subject:`[셀렉] ${row[2]}님 최종 승인 완료`,htmlBody:`<p><b>${row[2]}</b>님이 보정본을 최종 승인했습니다. 인화 작업을 진행해 주세요.<br>상품: ${row[7]}</p>`});}catch(e){}
    const msgs={ko:'<h2 style="color:#10b981;">✅ 최종 승인이 완료되었습니다!</h2><p>Studio mean에서 인화 작업을 진행할 예정입니다. 감사합니다.</p>',en:'<h2 style="color:#10b981;">✅ Final Approval Complete!</h2><p>Studio mean will proceed with printing. Thank you!</p>',de:'<h2 style="color:#10b981;">✅ Endgültige Bestätigung abgeschlossen!</h2><p>Studio mean wird mit dem Druck beginnen. Vielen Dank!</p>'};
    return HtmlService.createHtmlOutput(`<div style="font-family:sans-serif;text-align:center;padding:40px;">${msgs[rowLang]||msgs.ko}</div>`);
  }catch(err){return HtmlService.createHtmlOutput(`<h2>❌ ${err.message}</h2>`);}
}

function reviseRetouch_(sessionId,p){
  try{
    const selSh=ensureSheets_().ss.getSheetByName(SELECT_SHEET_NAME);
    if(!selSh)return HtmlService.createHtmlOutput('<h2>❌ 시스템 오류</h2>');
    const rows=selSh.getDataRange().getValues();
    const idx=rows.slice(1).findIndex(r=>String(r[0])===String(sessionId));
    if(idx===-1)return HtmlService.createHtmlOutput('<h2>❌ 세션을 찾을 수 없습니다.</h2>');
    const row=rows[idx+1];const rowNum=idx+2;const rowLang=String(row[SELECT_COL['언어']]||'ko');
    const revCount=parseInt(row[SELECT_COL['재수정요청횟수']])||0;
    if(revCount>=2){
      const msgs={ko:'<h2 style="color:#ef4444;">⚠️ 재수정 가능 횟수(2회)를 초과했습니다.</h2><p>추가 수정이 필요하시면 직접 연락 주세요: studio.mean.de@gmail.com</p>',en:'<h2 style="color:#ef4444;">⚠️ Maximum revisions (2) reached.</h2><p>Please contact us: studio.mean.de@gmail.com</p>',de:'<h2 style="color:#ef4444;">⚠️ Maximale Überarbeitungen (2) erreicht.</h2><p>Kontakt: studio.mean.de@gmail.com</p>'};
      return HtmlService.createHtmlOutput(`<div style="font-family:sans-serif;text-align:center;padding:40px;">${msgs[rowLang]||msgs.ko}</div>`);
    }
    const newCount=revCount+1;
    selSh.getRange(rowNum,SELECT_COL['상태']+1).setValue('재수정요청');
    selSh.getRange(rowNum,SELECT_COL['재수정요청횟수']+1).setValue(newCount);
    try{MailApp.sendEmail({to:CONFIG.ADMIN_EMAIL,subject:`[셀렉] ${row[2]}님 재수정 요청 (${newCount}/2회)`,htmlBody:`<p><b>${row[2]}</b>님이 보정본 재수정을 요청했습니다 (${newCount}/2회).<br>상품: ${row[7]}<br>어드민에서 [📤 수정본 발송] 버튼을 사용해 주세요.</p>`});}catch(e){}
    const msgs={ko:`<h2 style="color:#f59e0b;">✏️ 재수정 요청이 접수되었습니다 (${newCount}/2회)</h2><p>Studio mean에서 수정 후 다시 보내드리겠습니다. 감사합니다.</p>`,en:`<h2 style="color:#f59e0b;">✏️ Revision Request Received (${newCount}/2)</h2><p>Studio mean will revise and resend your photos. Thank you!</p>`,de:`<h2 style="color:#f59e0b;">✏️ Überarbeitungsanfrage erhalten (${newCount}/2)</h2><p>Studio mean wird die Fotos überarbeiten und erneut zusenden.</p>`};
    return HtmlService.createHtmlOutput(`<div style="font-family:sans-serif;text-align:center;padding:40px;">${msgs[rowLang]||msgs.ko}</div>`);
  }catch(err){return HtmlService.createHtmlOutput(`<h2>❌ ${err.message}</h2>`);}
}

/* ====== 강화된 수기 등록 ====== */
function addManualBookingAdmin(token, data) {
  try {
    assertAdmin_(token);
    const sh = getDbSheet(), cal = CalendarApp.getCalendarById(CONFIG.MAIN_CALENDAR_ID) || CalendarApp.getDefaultCalendar();
    
    // 원화 입력 시 환전 로직
    let priceText = String(data.price).trim();
    if (priceText.indexOf('원') > -1) {
      const krw = parseInt(priceText.replace(/[^0-9]/g, ''), 10);
      if (krw > 0) {
        try {
          const res = UrlFetchApp.fetch('https://open.er-api.com/v6/latest/KRW', {muteHttpExceptions:true});
          if (res.getResponseCode() === 200) {
            const rd = JSON.parse(res.getContentText());
            if (rd.rates && rd.rates.EUR) {
              priceText = `${Math.round(krw * rd.rates.EUR)}€ (${krw.toLocaleString()}원)`;
            }
          }
        } catch(e) { priceText = `${krw.toLocaleString()}원 (환전실패)`; }
      }
    }
    
    const emailToSave = data.email || '수기등록(메일없음)';
    const langToSave = data.lang || 'ko';
    const groupToSave = data.itemGroup || '기타';
    const peopleToSave = parseInt(data.people) || 1;
    
    // 캘린더 등록 로직
    let eventId = '';
    if (data.addCalendar) {
      const s = new Date(`${data.date}T${data.time}:00`);
      const e2 = new Date(s.getTime() + (Number(data.duration) || 60) * 60000);
      const priceLabel = priceText.replace(/€.*$/, '€').trim();
      
      const ev = cal.createEvent(`[수기/확정] ${data.product} | ${data.name} | ${peopleToSave}인 | ${priceLabel}`, s, e2, {
        description: `이름=${data.name}\n전화=${data.phone}\n이메일=${emailToSave}\n분류=${data.product}\n인원=${peopleToSave}\n총비용=${priceText}\n마케팅=N\n상태=확정\n---\n메모: ${data.memo||''}`,
        location: 'Holzweg-passage 3, 61440 Oberursel'
      });
      ev.setColor(CalendarApp.EventColor.PALE_GREEN);
      eventId = ev.getId();
    }
    
    const depositAmt = parseInt(data.deposit) || 0;
    const balanceAmt = parseInt(data.balance) || Math.max(0, (parseInt(data.price) || 0) - depositAmt);
    const depPayMethod = data.depositPayMethod || '-';
    const optionsStr = data.options || '';

    // 엑셀 장부 등록
    // [예약일시,상태,고객명,연락처,이메일,언어,촬영종류,상품,옵션,인원,총결제액,계약금,잔금,결제수단,분위기,요청사항,캘린더ID,계약금수단,추가항목,재방문,잔금결제일]
    sh.appendRow([
      `${data.date} ${data.time}`, '확정됨', data.name, data.phone, emailToSave, langToSave, groupToSave, data.product,
      optionsStr, peopleToSave, priceText, depositAmt > 0 ? String(depositAmt)+'€' : '0',
      balanceAmt > 0 ? String(balanceAmt)+'€' : priceText, data.payMethod, '수기등록', data.memo, eventId,
      depPayMethod, '', '수기', '', '', '', '', '', '', String(data.address||'').trim()
    ]);

    bumpCalCacheVer_();

    // 📧 메일 즉시 발송 체크 시 메일 발송 실행
    if (data.sendEmail && emailToSave.includes('@') && !emailToSave.includes('수기등록')) {
      try {
        _sendConfirmEmail(data.name, emailToSave, langToSave, groupToSave, data.product, priceText, `${data.date} ${data.time}`, [], [], depositAmt, balanceAmt);
      } catch(e) { Logger.log('수기등록 메일 발송 실패: ' + e.message); }
    }

    const depositText = depositAmt > 0 ? depositAmt + '€' : '';
    return {ok: true, priceText, depositText};
  } catch(err) { 
    return {ok: false, message: err.message}; 
  }
}
/* ====== 인화 ====== */
function savePrintOrder(token,order){
  assertAdmin_(token);const sh=ensureSheets_().printSheet;
  const nowTime=Utilities.formatDate(new Date(),CONFIG.TIMEZONE,'HH:mm');
  // 선택한 날짜에 현재 시간을 조합하여 저장 (선택 날짜 없으면 현재 일시)
  const finalDate = order.date ? `${order.date} ${nowTime}` : Utilities.formatDate(new Date(),CONFIG.TIMEZONE,'yyyy-MM-dd HH:mm');
  const printItems=(order.printItems||[]).map(i=>`${i.label} ×${i.qty}(${i.price}€)`).join(', ');
  const retouchItems=(order.retouchItems||[]).map(i=>`보정 ${i.label} ×${i.qty}(${i.price}€)`).join(', ');
  const total=(order.printItems||[]).reduce((s,i)=>s+(i.price*i.qty),0)+(order.retouchItems||[]).reduce((s,i)=>s+(i.price*i.qty),0);
  sh.appendRow([finalDate,order.name,order.phone,printItems||'-',retouchItems||'-',order.totalQty||0,total,order.payMethod,order.memo||'','완료']);
  return{ok:true,total};
}
/* 인화 주문 수정 (통합 버전 - dateStr/status와 printItems/salesDate 모두 처리) */
function updatePrintOrderAdmin(token,rowIdx,d){
  assertAdmin_(token);const sh=ensureSheets_().printSheet;
  if(d.dateStr!==undefined) sh.getRange(rowIdx,1).setValue(d.dateStr||'');
  sh.getRange(rowIdx,2).setValue(d.name||'');
  sh.getRange(rowIdx,3).setValue(d.phone||'');
  const items=d.printItems!==undefined?d.printItems:(d.items!==undefined?d.items:undefined);
  if(items!==undefined) sh.getRange(rowIdx,4).setValue(items||'');
  if(d.retouchItems!==undefined) sh.getRange(rowIdx,5).setValue(d.retouchItems||'');
  if(d.total!==undefined) sh.getRange(rowIdx,7).setValue(Number(d.total)||0);
  if(d.payMethod!==undefined) sh.getRange(rowIdx,8).setValue(d.payMethod||'');
  if(d.memo!==undefined) sh.getRange(rowIdx,9).setValue(d.memo||'');
  if(d.status!==undefined) sh.getRange(rowIdx,10).setValue(d.status||'');
  if(d.salesDate!==undefined) sh.getRange(rowIdx,11).setValue(d.salesDate||'');
  return{ok:true};
}
function getPrintOrdersAdmin(token){
  assertAdmin_(token);const result=[];
  ensureSheets_().printSheet.getDataRange().getValues().slice(1).forEach((r,i)=>{if(!r[0])return;result.push({rowIdx:i+2,dateStr:parseDateSafe_(r[0]).str,name:r[1],phone:r[2],items:r[3],retouchItems:r[4],qty:r[5],total:r[6],payMethod:r[7],memo:r[8],status:r[9],salesDate:r[10]||''});});
  return result.reverse();
}
function searchCustomersForPrint(token,query){
  assertAdmin_(token);if(!query||String(query).trim().length<1)return[];
  const q=String(query).trim().toLowerCase();const data=getDbSheet().getDataRange().getValues();const results=[];
  for(let r=1;r<data.length;r++){const row=data[r];if(!row[0])continue;const name=String(row[2]||'');const phone=String(row[3]||'').replace(/[\s\-]/g,'');if(name.toLowerCase().includes(q)||phone.includes(q.replace(/[\s\-]/g,''))){const{str:dStr}=parseDateSafe_(row[0]);results.push({name,phone:String(row[3]||''),email:String(row[4]||''),dateStr:dStr.slice(0,10),product:String(row[7]||''),status:String(row[1]||'')});if(results.length>=8)break;}}
  return results;
}
function deletePrintOrderAdmin(token,rowIdx){assertAdmin_(token);ensureSheets_().printSheet.deleteRow(rowIdx);return{ok:true};}

/* ====== 대시보드 ====== */
function getDashboardData_(){
  const sh=getDbSheet(),data=sh.getDataRange().getValues();const customers=[],monthly={};
  for(let m=1;m<=12;m++) monthly[m]={revenue:0,count:0};
  let totReal=0,totExp=0;const pay={cash:0,card:0,transfer:0,myreal:0,none:0};const prod={};const now=new Date().getTime();
  for(let r=1;r<data.length;r++){
    const row=data[r];if(!row[0])continue;
    const{obj:dObj,str:dStr}=parseDateSafe_(row[0]);const m=dObj.getMonth()+1;if(isNaN(m))continue;
    const status=String(row[1]||''),price=parseInt(String(row[10]||'0').replace(/[^0-9]/g,''))||0;
    const payStr=String(row[13]||''),g=String(row[6]||'');
    const depositRaw=String(row[11]||''),balanceRaw=String(row[12]||'');
    
    // ✅ 추가: 엑셀 21번째 칸(row[20])에서 balanceDate(잔금입금일) 읽어오기
    let bDate = String(row[20]||'').trim();
    if(bDate && bDate.includes('GMT')) { bDate = parseDateSafe_(row[20]).str.slice(0,10); }

    const rescheduleReq=String(row[24]||'').trim();
    customers.push({rowIndex:r+1,dateStr:dStr,dateObj:dObj.getTime(),month:m,status,name:row[2],phone:row[3],email:row[4],lang:row[5],itemGroup:g,product:row[7],optionStr:row[8],people:row[9],price,deposit:depositRaw,depositRaw,balance:balanceRaw,payMethod:payStr,depPayMethod:row[17],extraItem:row[18],memo:row[15],isReturn:String(row[19]||'')==='재방문', balanceDate:bDate,rescheduleReq,address:String(row[26]||'')});
    
    const CONFIRMED_STATUSES=['확정됨','촬영완료','셀렉완료','작업완료'];
    if(CONFIRMED_STATUSES.includes(status)&&dObj.getTime()<=now){totReal+=price;monthly[m].revenue+=price;monthly[m].count++;prod[g]=(prod[g]||0)+price;if(payStr.includes('현금'))pay.cash+=price;else if(payStr.includes('카드'))pay.card+=price;else if(payStr.includes('계좌이체'))pay.transfer+=price;else if(payStr.includes('마이리얼트립'))pay.myreal+=price;else pay.none+=price;}
    else if(status!=='취소됨'&&dObj.getTime()>now) totExp+=price;
  }
  customers.sort((a,b)=>b.dateObj-a.dateObj);
  return{totalRealizedRevenue:totReal,totalExpectedRevenue:totExp,totalNet:Math.round(totReal/1.19),totalTax:totReal-Math.round(totReal/1.19),monthlyStats:monthly,payStats:pay,prodStats:prod,customers};
}

function sendTestSelectEmail(token){
  assertAdmin_(token);
  const testData={
    name:'테스트 고객',
    email:'studio.mean.de@gmail.com',
    lang:'ko',
    product:'스튜디오 촬영 스탠다드'
  };
  const testUrl='https://script.google.com/macros/s/TEST_SESSION_ID/exec?session=TESTSESSION123';
  const testDriveLink='https://drive.google.com/drive/folders/example';
  _sendSelectLinkEmail(testData,testUrl,testDriveLink,3,10);
  return{ok:true,message:'테스트 메일이 studio.mean.de@gmail.com 으로 발송되었습니다.'};
}

function debugSelectDashboard(token){
  assertAdmin_(token);
  const bookSh=getDbSheet();
  const bookRows=bookSh.getDataRange().getValues().slice(1);
  const now=new Date();
  const todayStr=Utilities.formatDate(now,CONFIG.TIMEZONE,'yyyy-MM-dd');
  const allRows=bookRows.filter(r=>r[0]);
  // 상태별 카운트
  const statusCount={};
  allRows.forEach(row=>{const s=String(row[1]||'').trim();statusCount[s]=(statusCount[s]||0)+1;});
  // 촬영완료/셀렉완료 행 상세
  const shootDoneRows=allRows.map((row,r)=>({row:r+2,status:String(row[1]||'').trim(),rawDate:String(row[0]).slice(0,30)}))
    .filter(x=>x.status==='촬영완료'||x.status==='셀렉완료');
  return{todayStr,totalRows:allRows.length,statusCount,shootDoneRows};
}

function quickUpdateBookingStatus(token,rIdx,status){
  assertAdmin_(token);
  const sh=getDbSheet();
  sh.getRange(rIdx,2).setValue(status);
  if(status==='취소됨'){
    try{const eventId=String(sh.getRange(rIdx,17).getValue()||'');if(eventId){const ev=(CalendarApp.getCalendarById(CONFIG.MAIN_CALENDAR_ID)||CalendarApp.getDefaultCalendar()).getEventById(eventId);if(ev)ev.deleteEvent();}}catch(e){}
  }
  return{ok:true};
}

function updateBookingAdmin(token,rIdx,d){
  assertAdmin_(token);const sh=getDbSheet();
  sh.getRange(rIdx,2).setValue(d.status);sh.getRange(rIdx,3).setValue(d.name);sh.getRange(rIdx,4).setValue(d.phone);
  sh.getRange(rIdx,11).setValue(d.price);sh.getRange(rIdx,12).setValue(d.deposit);sh.getRange(rIdx,13).setValue(d.balance);
  sh.getRange(rIdx,14).setValue(d.payMethod);sh.getRange(rIdx,16).setValue(d.memo);sh.getRange(rIdx,18).setValue(d.depPayMethod);
  sh.getRange(rIdx,19).setValue(d.extraItem);
  if(d.address!==undefined) sh.getRange(rIdx,27).setValue(d.address||'');
  
  // ✅ 추가: 엑셀 21번째 열(U열)에 잔금입금일 쓰기
  sh.getRange(rIdx,21).setValue(d.balanceDate||'');
  if(d.status==='취소됨'){
    try{const eventId=String(sh.getRange(rIdx,17).getValue()||'');if(eventId){const ev=(CalendarApp.getCalendarById(CONFIG.MAIN_CALENDAR_ID)||CalendarApp.getDefaultCalendar()).getEventById(eventId);if(ev)ev.deleteEvent();}}catch(e){}
  }
  return{ok:true};
}

function clearRescheduleRequest(token,bookingRowIndex){
  assertAdmin_(token);
  const {bookingSheet}=ensureSheets_();
  bookingSheet.getRange(bookingRowIndex,25).setValue('');
  return{ok:true};
}

function batchUpdateAdvanced(token,list,type,val){
  assertAdmin_(token);const sh=getDbSheet();
  if(type==='delete')list.sort((a,b)=>b.rowIndex-a.rowIndex).forEach(i=>sh.deleteRow(i.rowIndex));
  else list.forEach(i=>{if(type==='status')sh.getRange(i.rowIndex,2).setValue(val);else if(type==='payMethod')sh.getRange(i.rowIndex,14).setValue(val);});
  return{ok:true};
}

/* ====== 회계장부 ====== */
function getAccountingLedger(token, startDate, endDate) {
  assertAdmin_(token);
  const entries = [];
  const bookSh = getDbSheet();
  const bookData = bookSh.getDataRange().getValues();
  for(let r=1; r<bookData.length; r++) {
    const row = bookData[r]; if(!row[0]) continue;
    const {str:dStr} = parseDateSafe_(row[0]);
    let dateOnly = dStr.slice(0,10);
    let bDate = String(row[20]||'').trim();
    if(bDate) { if(bDate.includes('GMT')) bDate = parseDateSafe_(row[20]).str.slice(0,10); dateOnly = bDate; }
    if(startDate && dateOnly < startDate) continue;
    if(endDate && dateOnly > endDate) continue;
    if(!['촬영완료','셀렉완료','작업완료'].includes(String(row[1]))) continue;
    const gross = parseInt(String(row[10]||'0').replace(/[^0-9]/g,''))||0;
    if(gross===0) continue;
    const net = Math.round(gross/1.19);
    const tax = gross - net;
    entries.push({date: dateOnly, dateStr: dStr, type: '촬영예약', category: String(row[6]||''), name:String(row[2]||''), description: `${row[7]||''} - ${row[2]||''}`, gross, net, tax, payMethod: String(row[13]||''), status: '완료', invoice: String(row[16]||'').slice(-8), note: String(row[15]||''), source: 'booking', flow:'income', rowIndex: r+1});
  }
  const printSh = ensureSheets_().printSheet;
  const printData = printSh.getDataRange().getValues();
  for(let r=1; r<printData.length; r++) {
    const row = printData[r]; if(!row[0]) continue;
    const salesDateRaw = row[10]||row[0]; 
    const {str:dStr} = parseDateSafe_(salesDateRaw);
    const dateOnly = dStr.slice(0,10);
    if(startDate && dateOnly < startDate) continue;
    if(endDate && dateOnly > endDate) continue;
    const gross = Number(row[6])||0; 
    if(gross===0) continue;
    const net = Math.round(gross/1.19);
    const tax = gross - net;
    entries.push({date: dateOnly, dateStr: parseDateSafe_(row[0]).str, type: '인화/보정', category: 'print', name:String(row[1]||''), description: `추가인화 - ${row[1]||''}`, gross, net, tax, payMethod: String(row[7]||''), status: String(row[9]||'완료'), invoice: '', note: String(row[8]||''), source: 'print', flow:'income', rowIndex: r+1});
  }
  const expenseSh = ensureSheets_().expenseSheet;
  const expenseData = expenseSh.getDataRange().getValues();
  for(let r=1; r<expenseData.length; r++) {
    const row = expenseData[r]; if(!row[0]) continue;
    const dStr = parseDateSafe_(row[0]).str;
    const dateOnly = dStr.slice(0,10);
    if(startDate && dateOnly < startDate) continue;
    if(endDate && dateOnly > endDate) continue;
    const gross = Math.round((Number(row[4])||0)*100)/100;
    const net = Math.round((Number(row[5])||0)*100)/100;
    const tax = Math.round((Number(row[6])||0)*100)/100;
    if(gross===0 && net===0) continue;
    entries.push({
      date: dateOnly,
      dateStr: dStr,
      type: '지출',
      category: String(row[2]||''),
      name: String(row[1]||''),
      description: String(row[3]||''),
      gross,
      net,
      tax,
      payMethod: String(row[7]||''),
      status: String(row[10]||'확정'),
      invoice: '',
      note: String(row[8]||''),
      evidenceLink: String(row[9]||''),
      source: 'expense',
      flow: 'expense',
      rowIndex: r+1
    });
  }
  entries.sort((a,b)=>a.date>b.date?-1:a.date<b.date?1:0);
  const incomeEntries=entries.filter(e=>e.flow==='income');
  const expenseEntries=entries.filter(e=>e.flow==='expense');
  const totalGross = incomeEntries.reduce((s,e)=>s+e.gross,0);
  const totalNet = incomeEntries.reduce((s,e)=>s+e.net,0);
  const totalTax = incomeEntries.reduce((s,e)=>s+e.tax,0);
  const totalExpenseGross = expenseEntries.reduce((s,e)=>s+e.gross,0);
  const totalExpenseNet = expenseEntries.reduce((s,e)=>s+e.net,0);
  const totalExpenseTax = expenseEntries.reduce((s,e)=>s+e.tax,0);
  return {
    entries,
    totalGross,
    totalNet,
    totalTax,
    totalExpenseGross,
    totalExpenseNet,
    totalExpenseTax,
    profitGross: Math.round((totalGross-totalExpenseGross)*100)/100,
    vatPayable: Math.round((totalTax-totalExpenseTax)*100)/100
  };
}

function saveExpenseAdmin(token, expense){
  assertAdmin_(token);
  const sh=ensureSheets_().expenseSheet;
  const gross=Math.max(0,Math.round((Number(expense.gross)||0)*100)/100);
  const tax=Math.max(0,Math.round((Number(expense.tax)||0)*100)/100);
  const net=expense.net!==undefined && expense.net!=='' ? Math.max(0,Math.round((Number(expense.net)||0)*100)/100) : Math.round((gross-tax)*100)/100;
  const dateStr=String(expense.date||Utilities.formatDate(new Date(),CONFIG.TIMEZONE,'yyyy-MM-dd')).slice(0,10);
  sh.appendRow([
    dateStr,
    String(expense.vendor||'').trim(),
    String(expense.category||'기타').trim(),
    String(expense.description||'').trim(),
    gross,
    net,
    tax,
    String(expense.payMethod||'').trim(),
    String(expense.note||'').trim(),
    String(expense.evidenceLink||'').trim(),
    String(expense.status||'확정').trim()
  ]);
  return {ok:true};
}

/* ====== 사진 셀렉 시스템 ====== */
const SELECT_SHEET_NAME='사진셀렉';
const SELECT_HEADERS=['세션ID','생성일시','고객명','이메일','연락처','촬영일','촬영종류','상품','기본보정수','리터칭단가','언어','드라이브링크','예약장부행','제출일시','선택사진','추가보정수','추가보정금액','추가인화','추가인화금액','마케팅동의','총추가금액','상태','재발송횟수','재발송일시','어드민알림','보정본발송일시','셀렉마감일','1차알림일','2차알림일','3차알림일','최종알림단계','재수정요청횟수','추가금인보이스번호'];
const SELECT_COL=SELECT_HEADERS.reduce((acc,h,i)=>{acc[h]=i;return acc;},{});
// 상태 흐름: 대기중→제출완료→보정본발송→보정본확인완료→출력→우편발송→최종작업완료

function ensureSelectSheet_(ss){
  let sh=ss.getSheetByName(SELECT_SHEET_NAME);
  if(!sh){
    sh=ss.insertSheet(SELECT_SHEET_NAME);
    sh.appendRow(SELECT_HEADERS);
    sh.getRange(1,1,1,SELECT_HEADERS.length).setFontWeight('bold').setBackground('#f8fafc');
    sh.setFrozenRows(1);
  } else {
    // 기존 시트에 신규 컬럼 추가 (마이그레이션)
    const existing=sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0];
    SELECT_HEADERS.forEach((h,i)=>{
      if(!existing.includes(h)) sh.getRange(1,sh.getLastColumn()+1).setValue(h);
    });
  }
  return sh;
}

function generateSessionId_(){
  const c='ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let id='';for(let i=0;i<20;i++)id+=c[Math.floor(Math.random()*c.length)];return id;
}

function _selectSchedule_(baseDate){
  const d=new Date(baseDate);
  const deadline=new Date(d);
  deadline.setMonth(deadline.getMonth()+1);
  const reminder2=new Date(d.getTime()+42*86400000);
  const reminder3=new Date(d.getTime()+56*86400000);
  return {
    deadline: Utilities.formatDate(deadline,CONFIG.TIMEZONE,'yyyy-MM-dd'),
    reminder1: Utilities.formatDate(deadline,CONFIG.TIMEZONE,'yyyy-MM-dd'),
    reminder2: Utilities.formatDate(reminder2,CONFIG.TIMEZONE,'yyyy-MM-dd'),
    reminder3: Utilities.formatDate(reminder3,CONFIG.TIMEZONE,'yyyy-MM-dd')
  };
}

function _makeSelectRow_(data){
  const nowDate=new Date();
  const now=Utilities.formatDate(nowDate,CONFIG.TIMEZONE,'yyyy-MM-dd HH:mm');
  const sessionId=generateSessionId_();
  const schedule=_selectSchedule_(nowDate);
  const row=new Array(SELECT_HEADERS.length).fill('');
  row[SELECT_COL['세션ID']]=sessionId;
  row[SELECT_COL['생성일시']]=now;
  row[SELECT_COL['고객명']]=data.name||'';
  row[SELECT_COL['이메일']]=data.email||'';
  row[SELECT_COL['연락처']]=data.phone||'';
  row[SELECT_COL['촬영일']]=data.date||data.dateStr||'';
  row[SELECT_COL['촬영종류']]=data.itemGroup||'';
  row[SELECT_COL['상품']]=data.product||'';
  row[SELECT_COL['기본보정수']]=parseInt(data.baseRetouchCount,10)||0;
  row[SELECT_COL['리터칭단가']]=parseInt(data.retouchPrice,10)||10;
  row[SELECT_COL['언어']]=data.lang||'ko';
  row[SELECT_COL['드라이브링크']]=data.driveLink||'';
  row[SELECT_COL['예약장부행']]=data.bookingRowIndex||'';
  row[SELECT_COL['상태']]='대기중';
  row[SELECT_COL['재발송횟수']]=parseInt(data.resendCount,10)||0;
  row[SELECT_COL['재발송일시']]=data.resendAt||'';
  row[SELECT_COL['셀렉마감일']]=schedule.deadline;
  row[SELECT_COL['1차알림일']]=schedule.reminder1;
  row[SELECT_COL['2차알림일']]=schedule.reminder2;
  row[SELECT_COL['3차알림일']]=schedule.reminder3;
  row[SELECT_COL['최종알림단계']]='';
  row[SELECT_COL['재수정요청횟수']]=0;
  row[SELECT_COL['추가금인보이스번호']]='';
  return {sessionId,row,now,schedule};
}

function getRetouchInfo_(itemGroup,productName){
  const n=(productName||'').toLowerCase();
  if(itemGroup==='wed')return{count:n.includes('premium')?40:30,price:20};
  if(itemGroup==='snap')return{count:n.includes('premium')?20:n.includes('plus')?10:7,price:10};
  if(itemGroup==='stud')return{count:n.includes('premium')?7:n.includes('plus')?5:3,price:10};
  if(itemGroup==='prof')return{count:n.includes('professional')||n.includes('pro')?3:n.includes('business')?2:1,price:10};
  return{count:0,price:10};
}

function searchDriveFoldersAdmin(token,customerName,dateStr){
  assertAdmin_(token);
  const raw=String(dateStr||'').replace(/-/g,'');
  // "20260403" → "260403", "260403" → "260403"
  const ymd=raw.length>=8?raw.slice(2,8):raw;
  const results=[];
  const seen=new Set();

  function addFolder(f){
    if(!seen.has(f.getId())){seen.add(f.getId());results.push({id:f.getId(),name:f.getName(),url:f.getUrl()});}
  }

  try{
    // Drive 전체에서 이름으로 탐색 (getFoldersByName은 기존에 이미 허가된 DriveApp 메서드)
    const names=[ymd+'_'+customerName, ymd+'_'+customerName+'_1', ymd+'_'+customerName+'_2'];
    names.forEach(function(name){
      try{var it=DriveApp.getFoldersByName(name);while(it.hasNext())addFolder(it.next());}catch(e){}
    });

    // 못 찾으면 내 드라이브 전체를 순회해 날짜 prefix로 필터
    if(results.length===0){
      var all=DriveApp.getFolders();
      while(all.hasNext()){
        var f=all.next();
        var n=f.getName();
        if(n.indexOf(ymd+'_')===0||n.indexOf(customerName)>=0) addFolder(f);
      }
    }
  }catch(e){Logger.log('Drive search error:'+e.message);}
  return results;
}

function createSelectSession(token,data){
  try{
    assertAdmin_(token);
    const sheets=ensureSheets_();
    const selSh=ensureSelectSheet_(sheets.ss);
    let driveLink=data.driveLink||'';
    if(data.driveFolderId){
      try{const f=DriveApp.getFolderById(data.driveFolderId);f.setSharing(DriveApp.Access.ANYONE_WITH_LINK,DriveApp.Permission.EDIT);driveLink=f.getUrl();}
      catch(e){Logger.log('Drive sharing error:'+e.message);}
    }
    const ri=getRetouchInfo_(data.itemGroup,data.product);
    const baseCount=parseInt(data.baseRetouchCount,10)||ri.count;
    const retouchPrice=ri.price;
    const built=_makeSelectRow_({
      name:data.name,
      email:data.email,
      phone:data.phone||'',
      date:data.date||'',
      itemGroup:data.itemGroup,
      product:data.product,
      baseRetouchCount:baseCount,
      retouchPrice,
      lang:data.lang||'ko',
      driveLink,
      bookingRowIndex:data.bookingRowIndex||''
    });
    selSh.appendRow(built.row);
    const url='https://select.studio-mean.com?id='+encodeURIComponent(built.sessionId);
    _sendSelectLinkEmail(data,url,driveLink,baseCount,retouchPrice);
    return{ok:true,sessionId:built.sessionId,selectUrl:url};
  }catch(err){return{ok:false,message:err.message};}
}

function _sendSelectLinkEmail(data,selectUrl,driveLink,baseCount,retouchPrice){
  const lang=data.lang||'ko';
  const L=lang;
  const subj={ko:`[Studio mean] 📷 사진 셀렉 안내 — ${data.name}님`,en:`[Studio mean] 📷 Photo Selection — Dear ${data.name}`,de:`[Studio mean] 📷 Fotoauswahl — ${data.name}`};
  const greet={ko:`안녕하세요, <b>${data.name}</b>님! 😊`,en:`Dear <b>${data.name}</b>,`,de:`Hallo <b>${data.name}</b>,`};
  const intro={
    ko:`촬영이 완료되었습니다! 🎉<br>아래 링크에서 보정 받으실 사진을 직접 선택하고, 인화 사이즈 및 추가 옵션을 설정해 주세요.`,
    en:`Your photo session is complete! 🎉<br>Please use the link below to select your photos for retouching and set your print preferences.`,
    de:`Ihr Fotoshooting ist abgeschlossen! 🎉<br>Bitte wählen Sie über den folgenden Link Ihre Fotos zur Bearbeitung aus.`
  };
  const steps={
    ko:['📂 촬영 사진 확인 (드라이브 링크)','✅ 마케팅 동의 여부 선택 (동의 시 보너스 컷 추가)','🖼 보정 받을 사진 번호 입력','📮 인화 사이즈 및 추가 인화 선택','📤 최종 제출'],
    en:['📂 View your photos (Drive link)','✅ Marketing consent (bonus shots if agreed)','🖼 Enter photo numbers for retouching','📮 Select print sizes and extras','📤 Final submission'],
    de:['📂 Fotos ansehen (Drive-Link)','✅ Marketing-Einwilligung (Bonus-Fotos bei Zustimmung)','🖼 Fotonummern für Retusche eingeben','📮 Druckgrößen und Extras wählen','📤 Abschließende Einreichung']
  };
  const retouchStr={ko:`기본 보정 <b>${baseCount}장</b> 포함 · 추가 보정 <b>${retouchPrice}€/장</b>`,en:`<b>${baseCount}</b> retouches included · Extra retouch <b>€${retouchPrice}/photo</b>`,de:`<b>${baseCount}</b> Bearbeitungen inkl. · Weitere Retusche <b>${retouchPrice}€/Foto</b>`};
  const viewBtn={ko:'📂 촬영 사진 보기',en:'📂 View Your Photos',de:'📂 Fotos ansehen'};
  const selBtn={ko:'✅ 사진 셀렉 시작하기',en:'✅ Start Photo Selection',de:'✅ Fotoauswahl starten'};
  const deadline={ko:'⏱ 보정 완료까지 약 2–3주 소요됩니다. 가급적 빠른 제출 부탁드립니다.',en:'⏱ Retouching takes approximately 2–3 weeks. Please submit as soon as possible.',de:'⏱ Die Bearbeitung dauert ca. 2–3 Wochen. Bitte reichen Sie so bald wie möglich ein.'};
  const contact={ko:'문의사항이 있으시면 언제든 연락 주세요.',en:'Please feel free to contact us if you have any questions.',de:'Bei Fragen stehen wir Ihnen gerne zur Verfügung.'};
  const stepsHtml=(steps[L]||steps.ko).map((s,i)=>`<div style="display:flex;align-items:flex-start;gap:10px;padding:8px 0;border-bottom:1px solid #f1f5f9;"><div style="background:#2D2A26;color:#fff;border-radius:50%;width:22px;height:22px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0;">${i+1}</div><div style="font-size:13px;color:#475569;line-height:1.4;">${s}</div></div>`).join('');
  const html=`<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:600px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;">
  <div style="background:linear-gradient(135deg,#2D2A26 0%,#4a4540 100%);padding:28px 25px;text-align:center;">
    <h1 style="margin:0;color:#fff;font-size:22px;font-weight:800;letter-spacing:0.5px;">📷 Studio mean</h1>
    <p style="margin:6px 0 0;color:rgba(255,255,255,.7);font-size:13px;">${data.product||''}</p>
  </div>
  <div style="padding:28px 25px;">
    <p style="font-size:16px;margin-bottom:6px;">${greet[L]}</p>
    <p style="font-size:14px;color:#475569;line-height:1.7;margin-bottom:20px;">${intro[L]}</p>
    <div style="background:#f8fafc;border-radius:10px;padding:14px;margin-bottom:20px;">
      <div style="font-size:12px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px;">${L==='ko'?'진행 순서':L==='en'?'How it works':'So gehts'}</div>
      ${stepsHtml}
    </div>
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:14px;margin-bottom:20px;font-size:13px;color:#15803d;">
      📦 ${retouchStr[L]}
    </div>
    <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:20px;">
      ${driveLink?`<a href="${driveLink}" style="display:block;text-align:center;background:#f1f5f9;color:#1e293b;padding:13px 28px;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;border:1.5px solid #e2e8f0;">${viewBtn[L]}</a>`:''}
      <a href="${selectUrl}" style="display:block;text-align:center;background:#2D2A26;color:#fff;padding:15px 32px;text-decoration:none;border-radius:8px;font-weight:700;font-size:15px;">${selBtn[L]}</a>
    </div>
    <p style="font-size:12px;color:#94a3b8;margin-bottom:6px;">${deadline[L]}</p>
    <p style="font-size:12px;color:#94a3b8;">${contact[L]}</p>
  </div>
  <div style="background:#f8fafc;padding:16px 25px;text-align:center;font-size:11px;color:#94a3b8;border-top:1px solid #e2e8f0;">
    Studio mean · studio.mean.de@gmail.com · Holzweg-passage 3, 61440 Oberursel
  </div>
</div>`;
  MailApp.sendEmail({to:data.email,subject:subj[L],htmlBody:html});
}

function getSelectSession(sessionId){
  try{
    const ss=ensureSheets_().ss;
    const sh=ss.getSheetByName(SELECT_SHEET_NAME);
    if(!sh)return{ok:false,message:'준비 중입니다.'};
    const rows=sh.getDataRange().getValues();
    const row=rows.slice(1).find(r=>String(r[0])===String(sessionId));
    if(!row)return{ok:false,message:'유효하지 않은 링크입니다.'};
    // 예약장부에서 마케팅 동의 여부 확인 (이미 동의했으면 셀렉 페이지에서 재요청 불필요)
    let bookingMarketing='';
    try{
      const bri=parseInt(row[SELECT_COL['예약장부행']])||0;
      if(bri>=2){
        const bookSh=ensureSheets_().bookingSheet;
        const bRow=bookSh.getRange(bri,1,1,bookSh.getLastColumn()).getValues()[0];
        bookingMarketing=String(bRow[21]||''); // col22 = 마케팅동의
      }
    }catch(e){}
    const base={
      name:row[SELECT_COL['고객명']],
      email:row[SELECT_COL['이메일']],
      date:String(row[SELECT_COL['촬영일']]||'').slice(0,10),
      itemGroup:row[SELECT_COL['촬영종류']],
      product:row[SELECT_COL['상품']],
      baseRetouchCount:parseInt(row[SELECT_COL['기본보정수']])||0,
      retouchPrice:parseInt(row[SELECT_COL['리터칭단가']])||10,
      lang:row[SELECT_COL['언어']]||'ko',
      driveLink:row[SELECT_COL['드라이브링크']]||'',
      bookingMarketing,
      deadline:String(row[SELECT_COL['셀렉마감일']]||''),
      revisionCount:parseInt(row[SELECT_COL['재수정요청횟수']])||0,
      extraInvoiceNumber:String(row[SELECT_COL['추가금인보이스번호']]||'')
    };
    if(row[SELECT_COL['상태']]==='제출완료'){
      let existingPhotos=[],existingPrints=[];
      try{existingPhotos=JSON.parse(String(row[SELECT_COL['선택사진']]||'[]'));}catch(e){}
      try{existingPrints=JSON.parse(String(row[SELECT_COL['추가인화']]||'[]'));}catch(e){}
      return{ok:false,submitted:true,canEdit:true,...base,existingPhotos,existingPrints,existingMarketing:String(row[SELECT_COL['마케팅동의']]||'N')};
    }
    return{ok:true,...base};
  }catch(e){return{ok:false,message:e.message};}
}

/* 인화 사이즈 ID → 라벨/단가 매핑 */
const PRINT_LABELS={'basic_10x15':{label:'기본 10×15cm',price:5},'premium_10x15':{label:'프리미엄 10×15cm',price:8},'basic_a4':{label:'기본 A4',price:15},'premium_a4':{label:'프리미엄 A4',price:20},'premium_a3':{label:'프리미엄 A3',price:50}};
function _enrichPrint(p){if(p.label!==undefined&&p.price!==undefined)return p;const info=PRINT_LABELS[p.printId]||{label:p.printId||'인화',price:0};return{...p,label:info.label,price:info.price};}

function submitPhotoSelection(sessionId,sub){
  try{
    const sheets=ensureSheets_();
    const selSh=sheets.ss.getSheetByName(SELECT_SHEET_NAME);
    if(!selSh)return{ok:false,message:'시스템 오류'};
    const rows=selSh.getDataRange().getValues();
    const idx=rows.slice(1).findIndex(r=>String(r[0])===String(sessionId));
    if(idx===-1)return{ok:false,message:'세션을 찾을 수 없습니다.'};
    const row=rows[idx+1];
    if(row[SELECT_COL['상태']]==='제출완료')return{ok:false,submitted:true};
    const now=Utilities.formatDate(new Date(),CONFIG.TIMEZONE,'yyyy-MM-dd HH:mm');
    const photos=sub.photos||[];
    const prints=(sub.prints||[]).map(_enrichPrint);
    const baseCount=parseInt(row[SELECT_COL['기본보정수']])||0;
    const retouchPrice=parseInt(row[SELECT_COL['리터칭단가']])||10;
    const extraRetouch=Math.max(0,photos.length-baseCount);
    const extraRetouchAmt=extraRetouch*retouchPrice;
    const extraPrintsAmt=prints.reduce((s,p)=>s+(Number(p.price)||0)*(Number(p.qty)||1),0);
    const totalExtra=extraRetouchAmt+extraPrintsAmt;
    const rowNum=idx+2;
    selSh.getRange(rowNum,SELECT_COL['제출일시']+1,1,9).setValues([[now,JSON.stringify(photos),extraRetouch,extraRetouchAmt,JSON.stringify(prints),extraPrintsAmt,sub.marketing||'N',totalExtra,'제출완료']]);
    const bookingRow=parseInt(row[SELECT_COL['예약장부행']]);
    let extraInvoiceNumber='';
    if(bookingRow>1){
      try{
        const bSh=sheets.bookingSheet;
        bSh.getRange(bookingRow,2).setValue('셀렉완료');
        const existing=String(bSh.getRange(bookingRow,19).getValue()||'');
        const summary=`[셀렉${now.slice(0,10)}]보정${photos.length}장(+${extraRetouch})${prints.length?'/인화'+prints.length+'건':''}${sub.marketing==='Y'?'/마케팅동의':''}`;
        bSh.getRange(bookingRow,19).setValue(existing?existing+' | '+summary:summary);
      }catch(e){}
    }
    if(totalExtra>0){
      try{
        const pSh=sheets.printSheet;
        const printItems=prints.map(p=>`${p.photoNum}번 ${p.label}×${p.qty}(${p.price}€)`).join(', ');
        const retouchItems=extraRetouch>0?`추가보정×${extraRetouch}(${retouchPrice}€)`:'';
        const totalQty=prints.reduce((s,p)=>s+(Number(p.qty)||1),0)+extraRetouch;
        const salesDate=Utilities.formatDate(new Date(),CONFIG.TIMEZONE,'yyyy-MM-dd');
        pSh.appendRow([now,row[2],row[3],printItems||'-',retouchItems||'-',totalQty,totalExtra,'미결제','셀렉:'+sessionId.slice(0,8),'대기중',salesDate]);
      }catch(e){}
      try{
        const items=[];
        if(extraRetouch>0){
          items.push({description:`추가 보정 ${extraRetouch}장`,qty:1,unitGross:extraRetouchAmt});
        }
        prints.forEach(p=>{
          items.push({description:`${p.photoNum}번 ${p.label}`,qty:Number(p.qty)||1,unitGross:Number(p.price)||0});
        });
        const res=createInvoiceRecord_({
          bookingRowIndex:bookingRow||'',
          type:'셀렉추가금',
          customerName:String(row[SELECT_COL['고객명']]||''),
          customerEmail:String(row[SELECT_COL['이메일']]||''),
          customerPhone:String(row[SELECT_COL['연락처']]||''),
          customerAddress:(()=>{
            try{
              if(bookingRow>1){
                const bookRow=sheets.bookingSheet.getRange(bookingRow,1,1,sheets.bookingSheet.getLastColumn()).getValues()[0];
                return String(bookRow[26]||'');
              }
            }catch(e){}
            return '';
          })(),
          dateStr:String(row[SELECT_COL['촬영일']]||''),
          customProduct:'셀렉 추가금',
          memo:`사진셀렉 제출 자동 생성 (${sessionId.slice(0,8)})`,
          items
        });
        extraInvoiceNumber=res.invoiceNumber||'';
        if(extraInvoiceNumber) selSh.getRange(rowNum,SELECT_COL['추가금인보이스번호']+1).setValue(extraInvoiceNumber);
      }catch(e){Logger.log('submitPhotoSelection invoice error: '+e.message);}
    }
    _sendSelectSubmitAlert(row,photos,prints,extraRetouch,extraRetouchAmt,extraPrintsAmt,totalExtra,sub.marketing);
    try{_sendCustomerSelectReceipt(row,photos,prints,extraRetouch,extraRetouchAmt,extraPrintsAmt,totalExtra,sub.marketing);}catch(e){Logger.log('고객 영수증 메일 오류:'+e.message);}
    return{ok:true};
  }catch(e){return{ok:false,message:e.message};}
}

function _sendSelectSubmitAlert(row,photos,prints,extraRetouch,extraRetouchAmt,extraPrintsAmt,totalExtra,marketing){
  const td=(l,v)=>`<tr><td style="padding:8px 12px;background:#f8fafc;font-weight:700;width:90px;border-bottom:1px solid #e2e8f0;font-size:12px;">${l}</td><td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-size:13px;">${v}</td></tr>`;
  const html=`<div style="font-family:-apple-system,sans-serif;max-width:600px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;"><div style="background:#2D2A26;padding:16px 20px;"><h2 style="margin:0;color:#fff;font-size:16px;">📷 사진 셀렉 제출됨</h2></div><div style="padding:20px;"><table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;margin-bottom:16px;">${td('고객명',`<b>${row[2]}</b>`)}${td('상품',row[7])}${td('보정선택',`${photos.length}장 (추가 ${extraRetouch}장 × ${row[9]}€ = ${extraRetouchAmt}€)`)}${td('추가인화',prints.length?`${prints.length}건 (${extraPrintsAmt}€)`:'없음')}${td('마케팅',marketing==='Y'?'✅ 동의':'미동의')}${td('추가금액',`<b style="color:#10b981;">${totalExtra}€</b>`)}</table><b>보정 요청:</b><ul style="margin:6px 0;">${photos.map(p=>`<li><b>${p.num}번</b>${p.note?': '+String(p.note).replace(/\n/g,'<br>'):''}</li>`).join('')}</ul><b>추가 인화:</b><ul style="margin:6px 0;">${prints.length?prints.map(p=>`<li>${p.photoNum}번 — ${p.label} ×${p.qty} (${Number(p.price)*Number(p.qty)}€)</li>`).join(''):'<li>없음</li>'}</ul></div></div>`;
  MailApp.sendEmail({to:CONFIG.ADMIN_EMAIL,subject:`[사진셀렉] ${row[2]}님 제출 — 추가금액 ${totalExtra}€`,htmlBody:html});
}

function _sendCustomerSelectReceipt(row,photos,prints,extraRetouch,extraRetouchAmt,extraPrintsAmt,totalExtra,marketing){
  const email=String(row[3]||'');if(!email||!email.includes('@'))return;
  const lang=String(row[10]||'ko');
  const subj={ko:`[Studio mean] 📷 사진 셀렉 접수 완료 — ${row[2]}님`,en:`[Studio mean] 📷 Photo Selection Received — ${row[2]}`,de:`[Studio mean] 📷 Fotoauswahl erhalten — ${row[2]}`};
  const greet={ko:`안녕하세요 <b>${row[2]}</b>님,`,en:`Dear <b>${row[2]}</b>,`,de:`Hallo <b>${row[2]}</b>,`};
  const intro={ko:'사진 셀렉 내용이 정상적으로 접수되었습니다. 아래 내용을 확인해 주세요.',en:'Your photo selection has been received. Please review the details below.',de:'Ihre Fotoauswahl wurde eingegangen. Bitte überprüfen Sie die Details unten.'};
  const photoListHtml=`<ul style="margin:6px 0 0;padding-left:18px;">${photos.map(p=>`<li style="margin-bottom:6px;"><b>${p.num}번</b>${p.note?'<br><span style="color:#475569;font-size:12px;">'+String(p.note).replace(/\n/g,'<br>')+'</span>':''}</li>`).join('')}</ul>`;
  const printListHtml=prints.length?`<ul style="margin:6px 0 0;padding-left:18px;">${prints.map(p=>`<li>${p.photoNum}번 — ${p.label} ×${p.qty} (${p.price}€/장)</li>`).join('')}</ul>`:'';
  const summaryHtml=`<div style="border:1px solid #e2e8f0;border-radius:10px;padding:14px;margin:14px 0;font-size:13px;line-height:2.0;"><b>${lang==='ko'?'접수 내역':lang==='en'?'Summary':'Zusammenfassung'}</b><br>• ${lang==='ko'?'보정 선택':lang==='en'?'Photos selected':'Ausgewählt'}: <b>${photos.length}장</b>${extraRetouch>0?` (+${extraRetouch}장 × ${row[9]}€ = ${extraRetouchAmt}€)`:''}<br>${prints.length?`• ${lang==='ko'?'추가 인화':lang==='en'?'Extra prints':'Zusätzliche Drucke'}: ${prints.length}건 (${extraPrintsAmt}€)<br>`:''}<br>• ${lang==='ko'?'마케팅 동의':lang==='en'?'Marketing':'Marketing'}: ${marketing==='Y'?'✅':'❌'}<br>${totalExtra>0?`• <b style="color:#ef4444;">${lang==='ko'?'총 추가금액':lang==='en'?'Total extra':'Gesamtaufpreis'}: ${totalExtra}€</b>`:''}</div>`;
  const html=`<div style="font-family:-apple-system,sans-serif;max-width:600px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;"><div style="background:#2D2A26;padding:20px 25px;text-align:center;"><h2 style="margin:0;color:#fff;font-size:18px;">📷 Studio mean</h2><p style="margin:4px 0 0;color:rgba(255,255,255,.7);font-size:13px;">${row[7]||''}</p></div><div style="padding:24px 25px;">${greet[lang]}<br><br>${intro[lang]}${summaryHtml}<b>${lang==='de'?'Ausgewählte Fotos':lang==='en'?'Selected Photos':'선택 사진 목록'}</b>${photoListHtml}${prints.length?`<br><b>${lang==='de'?'Zusätzliche Drucke':lang==='en'?'Additional Prints':'추가 인화 목록'}</b>${printListHtml}`:''}<br><br><p style="font-size:12px;color:#94a3b8;">보정 완료까지 약 2~3주 소요됩니다. 문의: studio.mean.de@gmail.com</p></div><div style="background:#f8fafc;padding:12px 25px;text-align:center;font-size:11px;color:#94a3b8;border-top:1px solid #e2e8f0;">Studio mean · studio.mean.de@gmail.com</div></div>`;
  MailApp.sendEmail({to:email,subject:subj[lang]||subj.ko,htmlBody:html});
}

function _sendSelectReminderEmail_(row, stage){
  const email=String(row[SELECT_COL['이메일']]||'');
  if(!email||!email.includes('@')) return;
  const lang=String(row[SELECT_COL['언어']]||'ko');
  const name=String(row[SELECT_COL['고객명']]||'');
  const sessionId=String(row[SELECT_COL['세션ID']]||'');
  const selectUrl='https://select.studio-mean.com?id='+encodeURIComponent(sessionId);
  const driveLink=String(row[SELECT_COL['드라이브링크']]||'');
  const deadline=String(row[SELECT_COL['셀렉마감일']]||'');
  const stageText={ko:`${stage}차`,en:`Reminder ${stage}`,de:`Erinnerung ${stage}`};
  const subj={
    ko:`[Studio mean] 사진 셀렉 리마인드 (${stage}차) — ${name}님`,
    en:`[Studio mean] Photo selection reminder (${stage}) — ${name}`,
    de:`[Studio mean] Erinnerung zur Fotoauswahl (${stage}) — ${name}`
  };
  const intro={
    ko:`안녕하세요 <b>${name}</b>님,<br><br>아직 사진 셀렉이 제출되지 않아 안내드립니다. ${deadline?`마감일은 <b>${deadline}</b>입니다.`:''}`,
    en:`Dear <b>${name}</b>,<br><br>Your photo selection is still pending. ${deadline?`The current deadline is <b>${deadline}</b>.`:''}`,
    de:`Hallo <b>${name}</b>,<br><br>Ihre Fotoauswahl ist noch offen. ${deadline?`Die aktuelle Frist ist <b>${deadline}</b>.`:''}`
  };
  const html=`<div style="font-family:-apple-system,sans-serif;max-width:600px;margin:0 auto;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;">
  <div style="background:#2D2A26;padding:20px 24px;color:#fff;font-weight:700;">📷 Studio mean · ${stageText[lang]||stageText.ko}</div>
  <div style="padding:24px;font-size:14px;line-height:1.8;color:#334155;">
    ${intro[lang]||intro.ko}
    <div style="margin:18px 0;display:flex;flex-direction:column;gap:10px;">
      ${driveLink?`<a href="${driveLink}" style="display:block;text-align:center;background:#f1f5f9;color:#1e293b;padding:12px 18px;text-decoration:none;border-radius:8px;border:1px solid #e2e8f0;">촬영 사진 보기</a>`:''}
      <a href="${selectUrl}" style="display:block;text-align:center;background:#2D2A26;color:#fff;padding:14px 18px;text-decoration:none;border-radius:8px;font-weight:700;">사진 셀렉 제출하기</a>
    </div>
    <div style="font-size:12px;color:#64748b;">문의: ${CONFIG.ADMIN_EMAIL}</div>
  </div></div>`;
  MailApp.sendEmail({to:email,subject:subj[lang]||subj.ko,htmlBody:html});
}

function updatePhotoSelection(sessionId,sub){
  try{
    const sheets=ensureSheets_();
    const selSh=sheets.ss.getSheetByName(SELECT_SHEET_NAME);
    if(!selSh)return{ok:false,message:'시스템 오류'};
    const rows=selSh.getDataRange().getValues();
    const idx=rows.slice(1).findIndex(r=>String(r[0])===String(sessionId));
    if(idx===-1)return{ok:false,message:'세션을 찾을 수 없습니다.'};
    const row=rows[idx+1];
    const now=Utilities.formatDate(new Date(),CONFIG.TIMEZONE,'yyyy-MM-dd HH:mm');
    const photos=sub.photos||[];
    const prints=(sub.prints||[]).map(_enrichPrint);
    const baseCount=parseInt(row[SELECT_COL['기본보정수']])||0;
    const retouchPrice=parseInt(row[SELECT_COL['리터칭단가']])||10;
    const extraRetouch=Math.max(0,photos.length-baseCount);
    const extraRetouchAmt=extraRetouch*retouchPrice;
    const extraPrintsAmt=prints.reduce((s,p)=>s+(Number(p.price)||0)*(Number(p.qty)||1),0);
    const totalExtra=extraRetouchAmt+extraPrintsAmt;
    const rowNum=idx+2;
    selSh.getRange(rowNum,SELECT_COL['제출일시']+1,1,9).setValues([[now,JSON.stringify(photos),extraRetouch,extraRetouchAmt,JSON.stringify(prints),extraPrintsAmt,sub.marketing||'N',totalExtra,'제출완료']]);
    // 어드민 수정 알림 메일
    const td=(l,v)=>`<tr><td style="padding:8px 12px;background:#f8fafc;font-weight:700;width:90px;border-bottom:1px solid #e2e8f0;font-size:12px;">${l}</td><td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-size:13px;">${v}</td></tr>`;
    const html=`<div style="font-family:-apple-system,sans-serif;max-width:600px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;"><div style="background:#f59e0b;padding:16px 20px;"><h2 style="margin:0;color:#fff;font-size:16px;">✏️ 사진 셀렉 수정됨</h2></div><div style="padding:20px;"><p style="color:#92400e;background:#fef3c7;padding:10px;border-radius:8px;font-size:13px;margin-bottom:14px;">⚠️ ${row[2]}님이 기존 셀렉 내용을 수정했습니다.</p><table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;margin-bottom:16px;">${td('고객명',`<b>${row[2]}</b>`)}${td('상품',row[7])}${td('보정선택',`${photos.length}장 (추가 ${extraRetouch}장 × ${row[9]}€ = ${extraRetouchAmt}€)`)}${td('추가인화',prints.length?`${prints.length}건 (${extraPrintsAmt}€)`:'없음')}${td('마케팅',sub.marketing==='Y'?'✅ 동의':'미동의')}${td('추가금액',`<b style="color:#10b981;">${totalExtra}€</b>`)}</table><b>보정 요청:</b><ul style="margin:6px 0;">${photos.map(p=>`<li><b>${p.num}번</b>${p.note?': '+p.note:''}</li>`).join('')}</ul></div></div>`;
    MailApp.sendEmail({to:CONFIG.ADMIN_EMAIL,subject:`[셀렉수정] ${row[2]}님 — 추가금액 ${totalExtra}€`,htmlBody:html});
    return{ok:true};
  }catch(e){return{ok:false,message:e.message};}
}

function getPhotoSelectionsAdmin(token){
  assertAdmin_(token);
  const sh=ensureSheets_().ss.getSheetByName(SELECT_SHEET_NAME);
  if(!sh)return[];
  return sh.getDataRange().getValues().slice(1).filter(r=>r[0]).map((r,i)=>{
    let photoCount=0;try{photoCount=(JSON.parse(r[SELECT_COL['선택사진']]||'[]')||[]).length;}catch(e){}
    return{
      rowIdx:i+2,sessionId:r[SELECT_COL['세션ID']],sentAt:String(r[SELECT_COL['생성일시']]||'').slice(0,16),
      name:r[SELECT_COL['고객명']],email:r[SELECT_COL['이메일']],date:String(r[SELECT_COL['촬영일']]||'').slice(0,10),
      itemGroup:r[SELECT_COL['촬영종류']],product:r[SELECT_COL['상품']],baseCount:r[SELECT_COL['기본보정수']],lang:r[SELECT_COL['언어']],
      driveLink:r[SELECT_COL['드라이브링크']],submittedAt:String(r[SELECT_COL['제출일시']]||'').slice(0,16),photoCount,
      extraRetouch:r[SELECT_COL['추가보정수']]||0,extraRetouchAmt:r[SELECT_COL['추가보정금액']]||0,extraPrintsAmt:r[SELECT_COL['추가인화금액']]||0,
      marketing:r[SELECT_COL['마케팅동의']]||'',totalExtra:r[SELECT_COL['총추가금액']]||0,status:r[SELECT_COL['상태']]||'대기중',
      resendCount:parseInt(r[SELECT_COL['재발송횟수']])||0,resendAt:String(r[SELECT_COL['재발송일시']]||'').slice(0,16),
      retouchSentAt:String(r[SELECT_COL['보정본발송일시']]||'').slice(0,16),deadline:String(r[SELECT_COL['셀렉마감일']]||''),
      reminderStage:parseInt(r[SELECT_COL['최종알림단계']])||0,revisionCount:parseInt(r[SELECT_COL['재수정요청횟수']])||0,
      extraInvoiceNumber:String(r[SELECT_COL['추가금인보이스번호']]||'')
    };
  }).reverse();
}

/* === 사진셀렉 통합 대시보드 === */
function getSelectDashboard(token){
  try{
    assertAdmin_(token);
    const sheets=ensureSheets_();
    const now=new Date();
    const todayStr=Utilities.formatDate(now,CONFIG.TIMEZONE,'yyyy-MM-dd');

    // 1. 사진셀렉 시트 → bookingRowIndex로 인덱스
    // selectedPhotos/extraPrintsData는 대용량 배열이므로 count만 보관 (직렬화 크기 제한 방지)
    const selByBooking={};
    try{
      const selSh=ensureSelectSheet_(sheets.ss);
      if(selSh.getLastRow()>1){
        const selData=selSh.getDataRange().getValues();
        for(let i=1;i<selData.length;i++){
          const sr=selData[i];
          if(!sr[0]) continue;
          const bri=String(sr[SELECT_COL['예약장부행']]||'');
          if(!bri) continue;
          const existing=selByBooking[bri];
          if(!existing||String(sr[SELECT_COL['생성일시']])>String(existing.sentAt)){
            let photoCount=0;
            try{ photoCount=JSON.parse(String(sr[SELECT_COL['선택사진']]||'[]')).length; }catch(_){}
            let extraPrintsCount=0;
            try{ extraPrintsCount=JSON.parse(String(sr[SELECT_COL['추가인화']]||'[]')).length; }catch(_){}
            selByBooking[bri]={
              rowIdx:i+2,
              sessionId:String(sr[SELECT_COL['세션ID']]),
              sentAt:parseDateSafe_(sr[SELECT_COL['생성일시']]).str.slice(0,16),
              email:String(sr[SELECT_COL['이메일']]||''),
              lang:String(sr[SELECT_COL['언어']]||''),
              driveLink:String(sr[SELECT_COL['드라이브링크']]||''),
              submittedAt:parseDateSafe_(sr[SELECT_COL['제출일시']]).str.slice(0,16),
              photoCount:photoCount,
              extraRetouchCount:parseInt(sr[SELECT_COL['추가보정수']])||0,
              extraRetouchAmt:parseInt(sr[SELECT_COL['추가보정금액']])||0,
              extraPrintsCount:extraPrintsCount,
              extraPrintsAmt:parseInt(sr[SELECT_COL['추가인화금액']])||0,
              marketing:String(sr[SELECT_COL['마케팅동의']]||''),
              status:String(sr[SELECT_COL['상태']]||'대기중'),
              resendCount:parseInt(sr[SELECT_COL['재발송횟수']])||0,
              resendAt:parseDateSafe_(sr[SELECT_COL['재발송일시']]).str.slice(0,16),
              retouchSentAt:parseDateSafe_(sr[SELECT_COL['보정본발송일시']]).str.slice(0,16),
              totalExtra:Number(sr[SELECT_COL['총추가금액']])||0,
              product:String(sr[SELECT_COL['상품']]||''),
              baseCount:Number(sr[SELECT_COL['기본보정수']])||0,
              deadline:String(sr[SELECT_COL['셀렉마감일']]||''),
              reminder1:String(sr[SELECT_COL['1차알림일']]||''),
              reminder2:String(sr[SELECT_COL['2차알림일']]||''),
              reminder3:String(sr[SELECT_COL['3차알림일']]||''),
              reminderStage:parseInt(sr[SELECT_COL['최종알림단계']])||0,
              revisionCount:parseInt(sr[SELECT_COL['재수정요청횟수']])||0,
              extraInvoiceNumber:String(sr[SELECT_COL['추가금인보이스번호']]||''),
              selectedPhotos:String(sr[SELECT_COL['선택사진']]||'[]'),
              extraPrintsData:String(sr[SELECT_COL['추가인화']]||'[]')
            };
          }
        }
      }
    }catch(e){Logger.log('getSelectDashboard selByBooking error:'+e.message);}

    // 2. 예약장부 스캔 (읽기 전용 — 상태 변경은 별도 autoUpdateShootStatus() 함수로 처리)
    const bookSh=sheets.bookingSheet;
    if(!bookSh) throw new Error('bookingSheet null');
    const bookRows=bookSh.getDataRange().getValues().slice(1);

    const result=[];
    bookRows.forEach(function(row,r){
      if(!row[0]) return;
      const status=String(row[1]||'').trim();
      if(status==='취소됨'||status==='작업완료') return;

      const dStr=parseDateSafe_(row[0]).str.slice(0,10);

      // 셀렉 탭: 촬영완료·셀렉완료만 표시
      if(status!=='촬영완료'&&status!=='셀렉완료') return;

      const bri=String(r+2);
      const sel=selByBooking[bri]||null;

      let selectStatus='미발송';
      let daysSinceSent=null;
      if(sel){
        const sentD=sel.sentAt?new Date(sel.sentAt.replace(' ','T')):null;
        const sentMs=sentD&&!isNaN(sentD.getTime())?now-sentD:null;
        daysSinceSent=sentMs!==null?Math.floor(sentMs/86400000):null;
        if(['보정본발송','재수정요청','보정본확인완료','출력','우편발송','최종작업완료'].includes(sel.status)){
          selectStatus=sel.status;
        }else if(sel.status==='제출완료'||sel.status==='작업대기'){
          selectStatus='작업대기';
        }else if(sel.resendCount>0){
          selectStatus='재발송';
        }else{
          selectStatus='발송';
        }
      }

      const shootDate=new Date((dStr||'1970-01-01')+'T00:00:00');
      const daysSinceShoot=isNaN(shootDate.getTime())?0:Math.floor((now-shootDate)/86400000);
      result.push({
        rowIndex:r+2,
        dateStr:dStr,
        name:String(row[2]||''),
        phone:String(row[3]||''),
        email:String(row[4]||''),
        lang:String(row[5]||'ko'),
        itemGroup:String(row[6]||''),
        product:String(row[7]||''),
        bookingStatus:status,
        selectStatus:selectStatus,
        daysSinceShoot:daysSinceShoot,
        daysSinceSent:daysSinceSent,
        sel:sel
      });
    });
    return result.reverse();
  }catch(e){
    Logger.log('getSelectDashboard FATAL: '+e.message+'\n'+e.stack);
    throw new Error('getSelectDashboard 오류: '+e.message);
  }
}

/* === 확정됨 → 촬영완료 자동 전환 (별도 호출) === */
function autoUpdateShootStatus(token){
  try{
    assertAdmin_(token);
    const sheets=ensureSheets_();
    const bookSh=sheets.bookingSheet;
    if(!bookSh) return{ok:false,message:'bookingSheet null'};
    const todayStr=Utilities.formatDate(new Date(),CONFIG.TIMEZONE,'yyyy-MM-dd');
    const rows=bookSh.getDataRange().getValues();
    const statusCol=rows.slice(1).map(function(row){return [String(row[1]||'').trim()];});
    let count=0;
    rows.slice(1).forEach(function(row,r){
      if(!row[0]) return;
      if(statusCol[r][0]==='확정됨'){
        const dStr=parseDateSafe_(row[0]).str.slice(0,10);
        if(dStr<todayStr){statusCol[r][0]='촬영완료';count++;}
      }
    });
    if(count>0) bookSh.getRange(2,2,statusCol.length,1).setValues(statusCol);
    return{ok:true,updated:count};
  }catch(e){return{ok:false,message:e.message};}
}

/* === 기본 보정 수량 수정 === */
function updateBaseRetouchCount(token,selRowIdx,newCount){
  try{
    assertAdmin_(token);
    const sheets=ensureSheets_();
    const selSh=ensureSelectSheet_(sheets.ss);
    const idx=parseInt(selRowIdx);
    if(!idx||idx<2) return{ok:false,message:'유효하지 않은 행 번호'};
    selSh.getRange(idx,9).setValue(parseInt(newCount)||0); // col 9 = baseRetouchCount
    return{ok:true};
  }catch(e){
    return{ok:false,message:e.message};
  }
}

/* === 재발송 === */
function resendSelectLinkAdmin(token,bookingRowIndex){
  try{
    assertAdmin_(token);
    const sheets=ensureSheets_();
    const bookSh=getDbSheet();
    const bookRow=bookSh.getRange(bookingRowIndex,1,1,20).getValues()[0];
    const data={
      rowIndex:bookingRowIndex,
      name:String(bookRow[2]||''),
      email:String(bookRow[4]||''),
      phone:String(bookRow[3]||''),
      lang:String(bookRow[5]||'ko'),
      itemGroup:String(bookRow[6]||''),
      product:String(bookRow[7]||''),
      dateStr:String(bookRow[0]||'').slice(0,10),
      bookingRowIndex:String(bookingRowIndex)
    };

    // 기존 세션 있으면 업데이트, 없으면 신규 생성
    const selSh=ensureSelectSheet_(sheets.ss);
    const selRows=selSh.getDataRange().getValues();
    let existingRow=null;
    for(let i=1;i<selRows.length;i++){
      if(String(selRows[i][12])===String(bookingRowIndex)){existingRow=i+1;break;}
    }

    const ri=getRetouchInfo_(data.itemGroup,data.product);
    const baseCount=ri.count;
    const retouchPrice=ri.price;
    const driveLink=existingRow?String(selRows[existingRow-1][11]||''):'';

    const built=_makeSelectRow_({
      name:data.name,email:data.email,phone:data.phone,date:data.dateStr,itemGroup:data.itemGroup,
      product:data.product,baseRetouchCount:baseCount,retouchPrice,lang:data.lang,driveLink,bookingRowIndex:String(bookingRowIndex),
      resendCount:existingRow?(parseInt(selRows[existingRow-1][SELECT_COL['재발송횟수']])||0)+1:1,
      resendAt:Utilities.formatDate(new Date(),CONFIG.TIMEZONE,'yyyy-MM-dd HH:mm')
    });
    const url='https://select.studio-mean.com?id='+encodeURIComponent(built.sessionId);

    if(existingRow){
      selSh.getRange(existingRow,1,1,SELECT_HEADERS.length).setValues([built.row]);
    } else {
      // Drive 폴더 찾기 시도
      let dLink='';
      try{
        const yymmdd=data.dateStr.replace(/-/g,'').slice(2);
        const folderName=yymmdd+'_'+data.name;
        const root=DriveApp.getFolderById(DRIVE_ROOT_FOLDER_ID);
        const it=root.getFoldersByName(folderName);
        if(it.hasNext()){const f=it.next();f.setSharing(DriveApp.Access.ANYONE_WITH_LINK,DriveApp.Permission.EDIT);dLink=f.getUrl();}
      }catch(e){}
      const first=_makeSelectRow_({
        name:data.name,email:data.email,phone:data.phone,date:data.dateStr,itemGroup:data.itemGroup,
        product:data.product,baseRetouchCount:baseCount,retouchPrice,lang:data.lang,driveLink:dLink,bookingRowIndex:data.bookingRowIndex,
        resendCount:1,resendAt:Utilities.formatDate(new Date(),CONFIG.TIMEZONE,'yyyy-MM-dd HH:mm')
      });
      selSh.appendRow(first.row);
    }

    _sendSelectLinkEmail(data,url,driveLink||'',baseCount,retouchPrice);
    return{ok:true,selectUrl:url};
  }catch(e){return{ok:false,message:e.message};}
}

/* === 보정본 발송 === */
function sendRetouchCompleteAdmin(token,bookingRowIndex){
  try{
    assertAdmin_(token);
    const sheets=ensureSheets_();
    const selSh=ensureSelectSheet_(sheets.ss);
    const selRows=selSh.getDataRange().getValues();
    let selRowIdx=null;
    let selRow=null;
    for(let i=1;i<selRows.length;i++){
      if(String(selRows[i][12])===String(bookingRowIndex)){selRowIdx=i+1;selRow=selRows[i];break;}
    }
    if(!selRowIdx)return{ok:false,message:'셀렉 발송 기록이 없습니다.'};

    const name=String(selRow[2]||'');
    const email=String(selRow[3]||'');
    const lang=String(selRow[10]||'ko');
    const driveLink=String(selRow[11]||'');
    const now=Utilities.formatDate(new Date(),CONFIG.TIMEZONE,'yyyy-MM-dd HH:mm');

    // 보정본 서브폴더 링크 찾기
    let retouchFolderLink=driveLink;
    if(driveLink){
      try{
        const folderId=driveLink.match(/folders\/([a-zA-Z0-9_-]+)/)?.[1];
        if(folderId){
          const folder=DriveApp.getFolderById(folderId);
          const subIt=folder.getFoldersByName('보정본');
          if(subIt.hasNext()){
            const sub=subIt.next();
            sub.setSharing(DriveApp.Access.ANYONE_WITH_LINK,DriveApp.Permission.VIEW);
            retouchFolderLink=sub.getUrl();
          }
        }
      }catch(e){Logger.log('보정본 폴더 탐색 오류:'+e.message);}
    }

    const sessionId=String(selRow[0]||'');
    const reviseCount=parseInt(selRow[SELECT_COL['재수정요청횟수']])||0;
    const approveUrl=sessionId?createHtmlActionLink_('approve_retouch',sessionId):'';
    const reviseUrl=(sessionId&&reviseCount<2)?createHtmlActionLink_('revise_retouch',sessionId):'';
    const actionBtns=`<div style="display:flex;gap:12px;flex-wrap:wrap;margin:20px 0;">${approveUrl?`<a href="${approveUrl}" style="background:#10b981;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;">✅ ${lang==='ko'?'최종 승인':lang==='en'?'Approve':'Bestätigen'}</a>`:''}${reviseUrl?`<a href="${reviseUrl}" style="background:#f59e0b;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;">✏️ ${lang==='ko'?'재수정 요청':lang==='en'?'Request Revision':'Überarbeitung anfordern'}</a>`:`<span style="font-size:12px;color:#94a3b8;">${lang==='ko'?'재수정 횟수 초과':lang==='en'?'Max revisions reached':'Max. Überarbeitungen erreicht'}</span>`}</div>`;
    const subj={
      ko:`[Studio mean] 보정본이 완성되었습니다 — ${name}님`,
      en:`[Studio mean] Your retouched photos are ready — ${name}`,
      de:`[Studio mean] Ihre bearbeiteten Fotos sind fertig — ${name}`
    };
    const body={
      ko:`안녕하세요 <b>${name}</b>님,<br><br>촬영 보정본이 완성되었습니다! 아래 링크에서 확인해 주세요.<br><br><a href="${retouchFolderLink}" style="background:#2D2A26;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700;">📂 보정본 확인하기</a><br><br>확인 후 아래 버튼을 클릭해 주세요:${actionBtns}감사합니다,<br>Studio mean`,
      en:`Hello <b>${name}</b>,<br><br>Your retouched photos are ready! Please check them via the link below.<br><br><a href="${retouchFolderLink}" style="background:#2D2A26;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700;">📂 View Retouched Photos</a><br><br>After reviewing, please click below:${actionBtns}Thank you,<br>Studio mean`,
      de:`Hallo <b>${name}</b>,<br><br>Ihre bearbeiteten Fotos sind fertig! Bitte schauen Sie sich diese über den unten stehenden Link an.<br><br><a href="${retouchFolderLink}" style="background:#2D2A26;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700;">📂 Bearbeitete Fotos ansehen</a><br><br>Bitte klicken Sie nach der Überprüfung:${actionBtns}Vielen Dank,<br>Studio mean`
    };
    const html=`<!DOCTYPE html><html><body style="font-family:-apple-system,sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#1e293b;"><div style="background:#2D2A26;padding:20px;text-align:center;border-radius:12px 12px 0 0;"><span style="color:#fff;font-size:18px;font-weight:700;">📷 Studio mean</span></div><div style="background:#fff;border:1px solid #e2e8f0;border-radius:0 0 12px 12px;padding:24px;">${body[lang]||body.ko}</div></body></html>`;
    MailApp.sendEmail({to:email,subject:subj[lang]||subj.ko,htmlBody:html});

    // SMS 발송
    const phone=String(selRow[4]||'');
    const smsBody={
      ko:`[Studio mean] ${name}님, 보정본이 완성되었습니다! 이메일을 확인해 주세요.`,
      en:`[Studio mean] ${name}, your retouched photos are ready! Please check your email.`,
      de:`[Studio mean] ${name}, Ihre bearbeiteten Fotos sind fertig! Bitte prüfen Sie Ihre E-Mail.`
    };
    try{sendSms_(phone,smsBody[lang]||smsBody.de);}catch(e){Logger.log('보정본 SMS 오류:'+e.message);}

    selSh.getRange(selRowIdx,SELECT_COL['상태']+1).setValue('보정본발송');
    selSh.getRange(selRowIdx,SELECT_COL['보정본발송일시']+1).setValue(now);
    return{ok:true};
  }catch(e){return{ok:false,message:e.message};}
}

/* === 상태 업데이트 === */
function updateSelectStatusAdmin(token,bookingRowIndex,newStatus){
  try{
    assertAdmin_(token);
    const sheets=ensureSheets_();
    const selSh=ensureSelectSheet_(sheets.ss);
    const selRows=selSh.getDataRange().getValues();
    // 기존 셀렉 기록 검색
    for(let i=1;i<selRows.length;i++){
      if(String(selRows[i][12])===String(bookingRowIndex)){
        selSh.getRange(i+1,SELECT_COL['상태']+1).setValue(newStatus);
        if(newStatus==='최종작업완료'){
          const bRow=parseInt(bookingRowIndex);
          if(bRow>1) sheets.bookingSheet.getRange(bRow,2).setValue('작업완료');
        }
        return{ok:true};
      }
    }
    // 셀렉 기록 없음 → 예약 데이터로 최소 행 생성 후 상태 저장
    const bRow=parseInt(bookingRowIndex);
    if(bRow<2) return{ok:false,message:'잘못된 예약 행 번호'};
    const bookRow=sheets.bookingSheet.getRange(bRow,1,1,21).getValues()[0];
    const ri=getRetouchInfo_(String(bookRow[6]||''),String(bookRow[7]||''));
    const now=new Date();
    const built=_makeSelectRow_({
      name:String(bookRow[2]||''),email:String(bookRow[4]||''),phone:String(bookRow[3]||''),
      date:parseDateSafe_(bookRow[0]).str.slice(0,10),itemGroup:String(bookRow[6]||''),
      product:String(bookRow[7]||''),baseRetouchCount:ri.count,retouchPrice:ri.price,
      lang:String(bookRow[5]||'ko'),driveLink:'',bookingRowIndex:String(bookingRowIndex)
    });
    const newRow=built.row;
    newRow[SELECT_COL['상태']]=newStatus;
    selSh.appendRow(newRow);
    if(newStatus==='최종작업완료') sheets.bookingSheet.getRange(bRow,2).setValue('작업완료');
    return{ok:true};
  }catch(e){return{ok:false,message:e.message};}
}

/* === 수기 셀렉 수정 === */
function updateSelectManualAdmin(token,bookingRowIndex,manualData){
  try{
    assertAdmin_(token);
    const sheets=ensureSheets_();
    const selSh=ensureSelectSheet_(sheets.ss);
    const selRows=selSh.getDataRange().getValues();
    let selRowIdx=null,selRow=null;
    for(let i=1;i<selRows.length;i++){
      if(String(selRows[i][12])===String(bookingRowIndex)){selRowIdx=i+1;selRow=selRows[i];break;}
    }
    if(!selRowIdx)return{ok:false,message:'셀렉 세션을 찾을 수 없습니다.'};
    const baseCount=parseInt(selRow[8])||0;
    const retouchPrice=parseInt(selRow[9])||10;
    const totalPhotos=parseInt(manualData.totalPhotos)||0;
    const extraRetouch=Math.max(0,totalPhotos-baseCount);
    const extraRetouchAmt=extraRetouch*retouchPrice;
    const extraPrintsAmt=parseInt(manualData.extraPrintsAmt)||0;
    const totalExtra=extraRetouchAmt+extraPrintsAmt;
    const now=Utilities.formatDate(new Date(),CONFIG.TIMEZONE,'yyyy-MM-dd HH:mm');
    const photos=Array.from({length:totalPhotos},(_,i)=>({num:i+1,note:''}));
    selSh.getRange(selRowIdx,14,1,9).setValues([[now,JSON.stringify(photos),extraRetouch,extraRetouchAmt,'[]',extraPrintsAmt,manualData.marketing||'N',totalExtra,'제출완료']]);
    return{ok:true,totalExtra};
  }catch(e){return{ok:false,message:e.message};}
}

/* === 자동화: 매일 확인 (트리거) === */
function autoSelectDailyCheck(){
  const sheets=ensureSheets_();
  const selSh=ensureSelectSheet_(sheets.ss);
  const selRows=selSh.getDataRange().getValues().slice(1);
  const now=new Date();
  const bookSh=sheets.bookingSheet;
  const todayStr=Utilities.formatDate(now,CONFIG.TIMEZONE,'yyyy-MM-dd');

  // 0. 확정됨 + 촬영일 지남 → 촬영완료 자동 전환
  try{
    const bookData=bookSh.getDataRange().getValues().slice(1);
    const statusCol=bookData.map(function(row){return [String(row[1]||'').trim()];});
    let cnt=0;
    bookData.forEach(function(row,r){
      if(!row[0]) return;
      if(statusCol[r][0]==='확정됨'){
        const dStr=parseDateSafe_(row[0]).str.slice(0,10);
        if(dStr<todayStr){statusCol[r][0]='촬영완료';cnt++;}
      }
    });
    if(cnt>0){
      bookSh.getRange(2,2,statusCol.length,1).setValues(statusCol);
      Logger.log('autoSelectDailyCheck: 촬영완료 자동전환 '+cnt+'건');
    }
  }catch(e){Logger.log('autoSelectDailyCheck 촬영완료전환 오류:'+e.message);}

  // 1. 발송 후 단계별 리마인드
  selRows.forEach((r,i)=>{
    const status=String(r[SELECT_COL['상태']]||'');
    if(status!=='대기중') return;
    try{
      const stage=parseInt(r[SELECT_COL['최종알림단계']])||0;
      const reminderTargets=[
        {no:1,date:String(r[SELECT_COL['1차알림일']]||'')},
        {no:2,date:String(r[SELECT_COL['2차알림일']]||'')},
        {no:3,date:String(r[SELECT_COL['3차알림일']]||'')}
      ];
      const next=reminderTargets.find(t=>t.no>stage&&t.date&&todayStr>=t.date);
      if(!next) return;
      _sendSelectReminderEmail_(r,next.no);
      selSh.getRange(i+2,SELECT_COL['최종알림단계']+1).setValue(next.no);
      Logger.log('셀렉 리마인드 발송: '+String(r[SELECT_COL['고객명']]||'')+' / '+next.no+'차');
    }catch(e){Logger.log('셀렉 리마인드 오류:'+e.message);}
  });

  // 2. 예약장부: 촬영일 기준 7일 이상, 셀렉 미발송인 확정됨 건 → 어드민 알림
  const bookRows=bookSh.getDataRange().getValues().slice(1);
  const sentBri=new Set(selRows.map(r=>String(r[SELECT_COL['예약장부행']]||'')).filter(Boolean));
  const alert7=[];
  bookRows.forEach((row,r)=>{
    if(String(row[1]||'')!=='확정됨') return;
    const bri=String(r+2);
    if(sentBri.has(bri)) return;
    const dStr=String(row[0]||'').slice(0,10);
    if(!dStr) return;
    const shootDate=new Date(dStr+'T00:00:00');
    const days=Math.floor((now-shootDate)/86400000);
    if(days>=7) alert7.push({name:String(row[2]||''),dateStr:dStr,product:String(row[7]||''),days});
  });
  if(alert7.length>0){
    const rows=alert7.map(a=>`<tr><td>${a.dateStr}</td><td>${a.name}</td><td>${a.product}</td><td style="color:#ef4444;font-weight:bold;">${a.days}일 경과</td></tr>`).join('');
    const html=`<h2>📷 사진셀렉 미발송 알림</h2><p>촬영 후 7일 이상 셀렉 링크를 보내지 않은 고객이 있습니다.</p><table border="1" cellpadding="8" style="border-collapse:collapse;"><tr><th>촬영일</th><th>고객명</th><th>상품</th><th>경과일</th></tr>${rows}</table>`;
    MailApp.sendEmail({to:CONFIG.ADMIN_EMAIL,subject:`[Studio mean] 셀렉 미발송 알림 — ${alert7.length}건`,htmlBody:html});
  }
}

/* === 트리거 설정 (어드민이 한 번만 실행) === */
function setupSelectAutomation(token){
  assertAdmin_(token);
  // 기존 트리거 제거
  ScriptApp.getProjectTriggers().forEach(t=>{if(t.getHandlerFunction()==='autoSelectDailyCheck')ScriptApp.deleteTrigger(t);});
  // 매일 오전 9시(베를린 기준 근사) 실행
  ScriptApp.newTrigger('autoSelectDailyCheck').timeBased().everyDays(1).atHour(9).create();
  return{ok:true};
}

/* ====== Twilio SMS ====== */
function sendSms_(phone,body){
  const props=PropertiesService.getScriptProperties();
  const sid=props.getProperty('TWILIO_ACCOUNT_SID');
  const auth=props.getProperty('TWILIO_AUTH_TOKEN');
  const from=props.getProperty('TWILIO_FROM_NUMBER');
  if(!sid||!auth||!from||!phone){Logger.log('SMS skip: config or phone missing');return false;}
  let to=String(phone).replace(/[\s\-\(\)]/g,'');
  if(to.startsWith('0'))to='+49'+to.slice(1);
  if(!to.startsWith('+'))to='+49'+to;
  try{
    const resp=UrlFetchApp.fetch('https://api.twilio.com/2010-04-01/Accounts/'+sid+'/Messages.json',{
      method:'post',
      headers:{Authorization:'Basic '+Utilities.base64Encode(sid+':'+auth)},
      payload:{To:to,From:from,Body:body},
      muteHttpExceptions:true
    });
    const json=JSON.parse(resp.getContentText());
    if(json.error_code){Logger.log('SMS error: '+json.message);return false;}
    Logger.log('SMS sent to '+to);
    return true;
  }catch(e){Logger.log('SMS exception: '+e.message);return false;}
}

function saveTwilioConfig(token,sid,authToken,fromNumber){
  assertAdmin_(token);
  const props=PropertiesService.getScriptProperties();
  props.setProperty('TWILIO_ACCOUNT_SID',sid||'');
  props.setProperty('TWILIO_AUTH_TOKEN',authToken||'');
  props.setProperty('TWILIO_FROM_NUMBER',fromNumber||'');
  return{ok:true};
}

function testTwilioSms(token,phone){
  assertAdmin_(token);
  const ok=sendSms_(phone,'[Studio mean] SMS 테스트 메시지입니다. Twilio 설정이 완료되었습니다!');
  return{ok,phone};
}

function getTwilioConfig(token){
  assertAdmin_(token);
  const props=PropertiesService.getScriptProperties();
  return{
    sid:props.getProperty('TWILIO_ACCOUNT_SID')||'',
    from:props.getProperty('TWILIO_FROM_NUMBER')||''
  };
}

/* ====== 인보이스 ====== */
function ensureInvoiceFolder_(){
  const props=PropertiesService.getScriptProperties();
  const existingId=props.getProperty('INVOICE_FOLDER_ID');
  if(existingId){
    try{return DriveApp.getFolderById(existingId);}catch(e){}
  }
  const folders=DriveApp.getFoldersByName(CONFIG.INVOICE_FOLDER_NAME);
  const folder=folders.hasNext()?folders.next():DriveApp.createFolder(CONFIG.INVOICE_FOLDER_NAME);
  props.setProperty('INVOICE_FOLDER_ID',folder.getId());
  return folder;
}

function escapeHtml_(s){
  return String(s||'')
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;');
}

function buildInvoiceEmailDefaults_(inv, lang){
  const L=lang||'de';
  const subjectMap={
    ko:`[Studio mean] 인보이스 ${inv.number}`,
    en:`[Studio mean] Invoice ${inv.number}`,
    de:`[Studio mean] Rechnung ${inv.number}`
  };
  const bodyMap={
    ko:`안녕하세요 ${inv.name||''}님,\n\n첨부드린 인보이스를 확인해 주세요.\n인보이스 번호: ${inv.number}\n총 금액: €${Number(inv.total||0).toFixed(2)}\n\n문의사항이 있으시면 언제든 연락 주세요.\nStudio mean`,
    en:`Hello ${inv.name||''},\n\nPlease find your invoice attached.\nInvoice number: ${inv.number}\nTotal amount: €${Number(inv.total||0).toFixed(2)}\n\nIf you have any questions, please contact us.\nStudio mean`,
    de:`Hallo ${inv.name||''},\n\nanbei senden wir Ihnen Ihre Rechnung.\nRechnungsnummer: ${inv.number}\nGesamtbetrag: €${Number(inv.total||0).toFixed(2)}\n\nBei Fragen melden Sie sich gerne bei uns.\nStudio mean`
  };
  return {subject:subjectMap[L]||subjectMap.de, body:bodyMap[L]||bodyMap.de};
}

function buildInvoiceHtml_(inv, lang){
  const L=lang||'de';
  const isRefund=inv.type==='취소/환불';
  const items=(inv.items&&inv.items.length)?inv.items:[{description:inv.product||'-',qty:1,unitGross:parseFloat(inv.total)||0}];
  const brutto=parseFloat(inv.total)||items.reduce((sum,item)=>sum+((parseInt(item.qty,10)||1)*(parseFloat(item.unitGross)||0)),0);
  const netto=Math.round((brutto/1.19)*100)/100;
  const vat=Math.round((brutto-netto)*100)/100;
  const refund=parseFloat(inv.refund)||0;
  const finalAmt=isRefund&&refund>0?Math.round((brutto-refund)*100)/100:brutto;
  const dtParts=(inv.issuedAt||'').split('-');
  const fmtDate=dtParts.length===3?`${dtParts[2]}/${dtParts[1]}/${dtParts[0]}`:(inv.issuedAt||'');
  const T={
    de:{invLabel:'Rechnungnummer',dateLabel:'Rechnungdatum',pos:'Pos.',bez:'Bezeichnung',qty:'Qty',ep:'Einzelpreis',gp:'Gesamtpreis(netto)',net:'Netto-Summe',mwst:'MwSt. 19%',end:'Endbetrag',dep:'Anzahlung (bereits bezahlt)',ref:'Rückerstattung',notes:'Sonstiges'},
    ko:{invLabel:'인보이스 번호',dateLabel:'발행일',pos:'번호',bez:'항목',qty:'수량',ep:'단가(세전)',gp:'합계(세전)',net:'공급가액',mwst:'부가세 19%',end:'최종 금액',dep:'계약금 (기납부)',ref:'환불 금액',notes:'기타사항'},
    en:{invLabel:'Invoice No.',dateLabel:'Invoice Date',pos:'Pos.',bez:'Description',qty:'Qty',ep:'Unit Price',gp:'Total (net)',net:'Net Total',mwst:'VAT 19%',end:'Total Amount',dep:'Deposit (already paid)',ref:'Refund',notes:'Notes'}
  };
  const t=T[L]||T.de;
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${escapeHtml_(inv.number||'Invoice')}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box;}
body{font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#1a1a1a;background:#fff;padding:22px 34px;margin:0 auto;}
.page{min-height:250mm;display:flex;flex-direction:column;}
.header{display:flex;justify-content:space-between;align-items:flex-start;}
.logo-wrap{flex:1;max-width:52%;}
.logo-img{width:240px;height:auto;display:block;}
.sender-line{border-top:1px solid #aaa;width:74%;margin-top:10px;padding-top:5px;font-size:9.5px;color:#666;}
.customer-block{margin-top:28px;font-size:11px;line-height:1.55;min-height:90px;white-space:pre-line;}
.customer-name{font-weight:700;margin-bottom:4px;}
.biz-info{text-align:left;font-size:11px;line-height:1.75;min-width:215px;}
.inv-meta{margin:26px 0 18px;}
.inv-meta-row{display:flex;align-items:flex-end;gap:8px;margin-bottom:4px;}
.inv-meta-main{margin-bottom:2px;}
.inv-meta-label{font-size:17px;font-weight:700;white-space:nowrap;}
.inv-meta-label-sm{font-size:11px;white-space:nowrap;}
.inv-meta-colon{font-size:17px;font-weight:700;line-height:1;}
.inv-meta-value{font-size:17px;font-weight:700;white-space:nowrap;}
.inv-meta-value-sm{font-size:11px;white-space:nowrap;}
.invoice-table{width:100%;border-collapse:collapse;margin-top:16px;}
.invoice-table thead tr{border-top:1px solid #bbb;border-bottom:1px solid #bbb;}
.invoice-table th{padding:7px 10px;text-align:left;font-size:11px;font-weight:normal;background:#fff;}
.invoice-table td{padding:7px 10px;font-size:11px;}
.invoice-table tbody tr{border-bottom:1px solid #ddd;}
.r{text-align:right;}
.totals{margin-top:28px;margin-left:auto;width:260px;}
.t-row{display:flex;justify-content:space-between;padding:3px 0;font-size:11px;}
.t-end{font-weight:bold;font-size:12px;border-top:1px solid #1a1a1a;margin-top:5px;padding-top:6px;}
.memo-block{margin:18px 0 0 auto;width:360px;border:1px solid #d1d5db;border-radius:8px;padding:10px 12px;font-size:10.5px;line-height:1.7;color:#555;}
.memo-title{font-weight:700;color:#1f2937;margin-bottom:4px;}
.footer{margin-top:auto;padding-top:18px;}
.footer-sep{border-top:1px solid #999;padding-top:5px;font-size:10px;color:#555;margin-bottom:10px;}
.footer-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:20px;font-size:10px;line-height:1.8;}
</style></head><body>
<div class="page">
<div class="header">
  <div class="logo-wrap">
    <img class="logo-img" src="${LOGO_B64}" alt="Studio mean">
    <div class="sender-line">Taewoong Min _ Holzwegpassage 3, 61440 Oberursel</div>
    <div class="customer-block">${inv.name?`<div class="customer-name">${escapeHtml_(inv.name)}</div>`:''}${escapeHtml_(inv.customerAddress||'')}</div>
  </div>
  <div class="biz-info">
    Taewoong Min<br>Holzwegpassage 3<br>61440 Oberursel(Taunus)<br>Deutschland<br><br>
    Tel : +49 176 6093 9400<br>Email : studio.mean.de@gmail.com<br>
    Steuernummer : 003 846 66574<br>USt-IdNr: DE440009941<br>
    Deutsche Bank<br>IBAN: DE11500700100659117600<br>BIC: DEUTDEFFXXX
  </div>
</div>
<div class="inv-meta">
  <div class="inv-meta-row inv-meta-main"><span class="inv-meta-label">${t.invLabel}</span><span class="inv-meta-colon">:</span><span class="inv-meta-value">${escapeHtml_(inv.number||'')}</span></div>
  <div class="inv-meta-row"><span class="inv-meta-label-sm">${t.dateLabel}</span><span class="inv-meta-colon" style="font-size:11px;font-weight:400;">:</span><span class="inv-meta-value-sm">${escapeHtml_(fmtDate)}</span></div>
</div>
<table class="invoice-table"><thead><tr><th style="width:36px;">${t.pos}</th><th>${t.bez}</th><th style="width:36px;text-align:center;">${t.qty}</th><th style="width:110px;text-align:right;">${t.ep}</th><th style="width:140px;text-align:right;">${t.gp}</th></tr></thead><tbody>
${items.map((item,idx)=>{const qty=Math.max(1,parseInt(item.qty,10)||1);const lineGross=qty*(parseFloat(item.unitGross)||0);const unitNet=Math.round((((parseFloat(item.unitGross)||0)/1.19))*100)/100;const lineNet=Math.round(((lineGross/1.19))*100)/100;return `<tr><td>${idx+1}</td><td>${escapeHtml_(item.description||inv.product||'-')}</td><td class="r">${qty}</td><td class="r">€${unitNet.toFixed(2)}</td><td class="r">€${lineNet.toFixed(2)}</td></tr>`;}).join('')}
${isRefund&&refund>0?`<tr><td>${items.length+1}</td><td>${t.ref}</td><td class="r">1</td><td class="r" style="color:#c00;">-€${refund.toFixed(2)}</td><td class="r" style="color:#c00;">-€${refund.toFixed(2)}</td></tr>`:''}
</tbody></table>
<div class="totals">
  <div class="t-row"><span>${t.net}</span><span>€${netto.toFixed(2)}</span></div>
  <div class="t-row"><span>${t.mwst}</span><span>€${vat.toFixed(2)}</span></div>
  ${isRefund&&refund>0?`<div class="t-row" style="color:#c00;"><span>${t.ref}</span><span>-€${refund.toFixed(2)}</span></div>`:''}
  <div class="t-row t-end"><span>${t.end}</span><span>€${finalAmt.toFixed(2)}</span></div>
</div>
${inv.memo?`<div class="memo-block"><div class="memo-title">${t.notes}</div><div>${escapeHtml_(inv.memo)}</div></div>`:''}
<div class="footer"><div class="footer-sep">${t.invLabel} : ${escapeHtml_(inv.number||'')}</div><div class="footer-grid"><div>Taewoong Min<br>Holzwegpassage 3<br>61440 Oberursel(Taunus)<br>Deutschland</div><div>Tel : +49 176 6093 9400<br>Email : studio.mean.de@gmail.com<br>Steuernummer : 003 846 66574<br>USt-IdNr: DE440009941</div><div>Deutsche Bank<br>IBAN: DE11500700100659117600<br>BIC: DEUTDEFFXXX</div></div></div>
</div></body></html>`;
}

function createInvoicePdf_(inv, lang){
  const folder=ensureInvoiceFolder_();
  const safeName=String(inv.name||'').replace(/\s+/g,'').replace(/[^a-zA-Z0-9가-힣]/g,'');
  const safeNum=String(inv.number||'').replace(/-/g,'_');
  const fileName=`Studiomean_${safeNum}_${safeName||'customer'}_${Number(inv.total||0).toFixed(2)}EUR.pdf`;
  const html=buildInvoiceHtml_(inv, lang||'de');
  const pdfBlob=Utilities.newBlob(html,'text/html',fileName.replace(/\.pdf$/i,'.html')).getAs(MimeType.PDF).setName(fileName);
  const file=folder.createFile(pdfBlob);
  return {fileId:file.getId(), url:file.getUrl(), name:file.getName()};
}

function sendInvoiceEmailInternal_(inv, subject, body){
  if(!inv.email||!String(inv.email).includes('@')) throw new Error('고객 이메일이 없습니다.');
  const invoiceSheet=ensureSheets_().invoiceSheet;
  const rows=invoiceSheet.getDataRange().getValues();
  const idx=rows.slice(1).findIndex(r=>String(r[INVOICE_COL['인보이스번호']]||'')===String(inv.number||''));
  if(idx===-1) throw new Error('인보이스를 찾을 수 없습니다.');
  const rowIndex=idx+2;
  let pdfFileId=String(rows[idx+1][INVOICE_COL['PDF파일ID']]||'');
  let pdfUrl=String(rows[idx+1][INVOICE_COL['PDF링크']]||'');
  let file=null;
  if(pdfFileId){
    try{file=DriveApp.getFileById(pdfFileId);}catch(e){file=null;}
  }
  if(!file){
    const pdf=createInvoicePdf_(inv,'de');
    pdfFileId=pdf.fileId;
    pdfUrl=pdf.url;
    file=DriveApp.getFileById(pdf.fileId);
    invoiceSheet.getRange(rowIndex,INVOICE_COL['PDF파일ID']+1).setValue(pdfFileId);
    invoiceSheet.getRange(rowIndex,INVOICE_COL['PDF링크']+1).setValue(pdfUrl);
  }
  const finalSubject=String(subject||'').replace(/\{\{invoiceNumber\}\}/g,inv.number||'').trim();
  const finalBody=String(body||'').replace(/\{\{invoiceNumber\}\}/g,inv.number||'').trim();
  const htmlBody=`<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;line-height:1.8;color:#334155;white-space:pre-line;">${escapeHtml_(finalBody).replace(/\n/g,'<br>')}<br><br>${_getSignatureHtml()}</div>`;
  MailApp.sendEmail({
    to:inv.email,
    subject:finalSubject,
    htmlBody,
    attachments:[file.getBlob()]
  });
  const sentAt=Utilities.formatDate(new Date(),CONFIG.TIMEZONE,'yyyy-MM-dd HH:mm:ss');
  invoiceSheet.getRange(rowIndex,INVOICE_COL['메일제목']+1).setValue(finalSubject);
  invoiceSheet.getRange(rowIndex,INVOICE_COL['메일본문']+1).setValue(finalBody);
  invoiceSheet.getRange(rowIndex,INVOICE_COL['메일발송일시']+1).setValue(sentAt);
  return {ok:true, sentAt, pdfUrl};
}

function invoiceRowToObject_(row,rowIndex){
  const issued=parseDateSafe_(row[INVOICE_COL['발행일']]||'').str||String(row[INVOICE_COL['발행일']]||'');
  let items=[];
  try{items=JSON.parse(String(row[INVOICE_COL['품목JSON']]||'[]'));}catch(e){items=[];}
  return {
    rowIndex:rowIndex||0,
    number:String(row[INVOICE_COL['인보이스번호']]||''),
    issuedAt:issued.slice(0,10),
    issuedAtRaw:String(row[INVOICE_COL['발행일']]||''),
    type:String(row[INVOICE_COL['타입']]||''),
    bookingRowIndex:parseInt(row[INVOICE_COL['예약행번호']])||0,
    name:String(row[INVOICE_COL['고객명']]||''),
    email:String(row[INVOICE_COL['이메일']]||''),
    phone:String(row[INVOICE_COL['연락처']]||''),
    dateStr:String(row[INVOICE_COL['촬영일시']]||''),
    itemGroup:String(row[INVOICE_COL['촬영종류']]||''),
    product:String(row[INVOICE_COL['상품']]||''),
    total:parseFloat(row[INVOICE_COL['총금액(€)']])||0,
    deposit:parseFloat(row[INVOICE_COL['계약금(€)']])||0,
    refund:parseFloat(row[INVOICE_COL['환불금액(€)']])||0,
    memo:String(row[INVOICE_COL['메모']]||''),
    status:String(row[INVOICE_COL['상태']]||''),
    customerAddress:String(row[INVOICE_COL['고객주소']]||''),
    items:Array.isArray(items)?items:[],
    pdfFileId:String(row[INVOICE_COL['PDF파일ID']]||''),
    pdfUrl:String(row[INVOICE_COL['PDF링크']]||''),
    mailSubject:String(row[INVOICE_COL['메일제목']]||''),
    mailBody:String(row[INVOICE_COL['메일본문']]||''),
    mailSentAt:String(row[INVOICE_COL['메일발송일시']]||'')
  };
}

function generateInvoiceNumber_(invSh){
  const yy=new Date().getFullYear().toString().slice(-2);
  // PropertiesService에 저장된 오프셋 읽기 (수기 발행분 반영)
  const offset=parseInt(PropertiesService.getScriptProperties().getProperty('INVOICE_SEQ_'+yy)||'0');
  let maxNum=offset;
  if(invSh.getLastRow()>1){
    invSh.getDataRange().getValues().slice(1).forEach(r=>{
      const num=String(r[0]||'');
      if(num.startsWith('STMIN-'+yy)){
        const n=parseInt(num.slice(-4))||0;
        if(n>maxNum) maxNum=n;
      }
    });
  }
  return 'STMIN-'+yy+String(maxNum+1).padStart(4,'0');
}

function createInvoiceRecord_(payload){
  const {bookingSheet, invoiceSheet}=ensureSheets_();
  const data=bookingSheet.getDataRange().getValues();
  const linkedBookingRow=parseInt(payload.bookingRowIndex)||0;
  const row=(linkedBookingRow>=2&&linkedBookingRow<=data.length)?data[linkedBookingRow-1]:null;
  let invNo=String(payload.customInvNumber||payload.invoiceNumber||'').trim();
  if(!invNo) invNo=generateInvoiceNumber_(invoiceSheet);
  if(invoiceSheet.getLastRow()>1){
    const existing=invoiceSheet.getDataRange().getValues().slice(1).map(r=>String(r[0]||'').trim());
    if(existing.includes(invNo)) throw new Error(`인보이스 번호 ${invNo}가 이미 존재합니다.`);
  }
  const now=Utilities.formatDate(new Date(),CONFIG.TIMEZONE,"yyyy-MM-dd'T'HH:mm:ss");
  const items=(payload.items||[]).map(item=>({
    productId:String(item.productId||''),
    description:String(item.description||'').trim(),
    qty:Math.max(1,parseInt(item.qty,10)||1),
    unitGross:Math.max(0,Number(item.unitGross)||0)
  })).filter(item=>item.description&&item.unitGross>=0);
  const dateStr=row?parseDateSafe_(row[0]).str.slice(0,16):String(payload.dateStr||'');
  const price=items.length
    ?Math.round(items.reduce((sum,item)=>sum+(item.qty*item.unitGross),0)*100)/100
    :(payload.customAmount!=null&&payload.customAmount!==''?parseFloat(payload.customAmount)||0:(row?parseInt(String(row[10]||'0').replace(/[^0-9]/g,''))||0:0));
  const deposit=row?(parseInt(String(row[11]||'0').replace(/[^0-9]/g,''))||0):(parseFloat(payload.depositAmount)||0);
  const refund=parseFloat(payload.refundAmount)||0;
  const product=payload.customProduct||(row?String(row[7]||'').trim():'')||(items[0]&&items[0].description)||'';
  const customerName=String(payload.customerName|| (row?row[2]:'') || '').trim();
  const customerEmail=String(payload.customerEmail|| (row?row[4]:'') || '').trim();
  const customerPhone=String(payload.customerPhone|| (row?row[3]:'') || '').trim();
  const customerAddress=String(payload.customerAddress|| (row?row[26]:'') || '').trim();
  const mailLang=String(payload.mailLang||'de').toLowerCase();
  if(!customerName) throw new Error('고객명을 입력해 주세요.');
  if(!product&&!items.length) throw new Error('인보이스 항목을 입력해 주세요.');
  const defaults=buildInvoiceEmailDefaults_({
    number:invNo,
    name:customerName,
    total:price
  },mailLang);
  const mailSubject=String(payload.mailSubject||defaults.subject||'').trim();
  const mailBody=String(payload.mailBody||defaults.body||'').trim();
  invoiceSheet.appendRow([
    invNo, now, payload.type||(linkedBookingRow?'예약':'수기'), linkedBookingRow||'',
    customerName, customerEmail, customerPhone, dateStr, row?row[6]:'', product,
    price, deposit, refund, payload.memo||'', '발행', customerAddress, JSON.stringify(items),
    '', '', mailSubject, mailBody, ''
  ]);
  const newRowIndex=invoiceSheet.getLastRow();
  const inv={
    number:invNo,
    issuedAt:now.slice(0,10),
    type:payload.type||(linkedBookingRow?'예약':'수기'),
    bookingRowIndex:linkedBookingRow||0,
    name:customerName,
    email:customerEmail,
    phone:customerPhone,
    dateStr,
    itemGroup:row?String(row[6]||''):'',
    product,
    total:price,
    deposit,
    refund,
    memo:String(payload.memo||''),
    status:'발행',
    customerAddress,
    items
  };
  const pdf=createInvoicePdf_(inv,mailLang);
  invoiceSheet.getRange(newRowIndex,INVOICE_COL['PDF파일ID']+1).setValue(pdf.fileId);
  invoiceSheet.getRange(newRowIndex,INVOICE_COL['PDF링크']+1).setValue(pdf.url);
  let mailSentAt='';
  if(payload.sendMail){
    const sent=sendInvoiceEmailInternal_(inv,mailSubject,mailBody);
    mailSentAt=sent.sentAt||'';
  }
  return {ok:true, invoiceNumber:invNo, pdfUrl:pdf.url, mailSentAt, mailSubject, mailBody};
}

function setInvoiceSeq(token, yy, lastNum){
  assertAdmin_(token);
  const key='INVOICE_SEQ_'+String(yy).slice(-2);
  PropertiesService.getScriptProperties().setProperty(key, String(parseInt(lastNum)||0));
  return{ok:true, key, value:parseInt(lastNum)||0};
}

function getInvoiceSeq(token){
  assertAdmin_(token);
  const yy=new Date().getFullYear().toString().slice(-2);
  const val=parseInt(PropertiesService.getScriptProperties().getProperty('INVOICE_SEQ_'+yy)||'0');
  return{ok:true, yy, lastNum:val};
}

function createInvoiceAdmin(token, bookingRowIndex, type, refundAmount, memo, customAmount, customProduct, customInvNumber){
  assertAdmin_(token);
  let payload=null;
  if(typeof bookingRowIndex==='object'&&bookingRowIndex){
    payload=bookingRowIndex;
  } else {
    payload={
      bookingRowIndex,
      type,
      refundAmount,
      memo,
      customAmount,
      customProduct,
      customInvNumber
    };
  }
  return createInvoiceRecord_(payload);
}

function sendInvoiceEmailAdmin(token, invNumber, subject, body){
  assertAdmin_(token);
  const {invoiceSheet}=ensureSheets_();
  const rows=invoiceSheet.getDataRange().getValues();
  const idx=rows.slice(1).findIndex(r=>String(r[INVOICE_COL['인보이스번호']]||'').trim()===String(invNumber||'').trim());
  if(idx===-1) throw new Error('인보이스를 찾을 수 없습니다.');
  const inv=invoiceRowToObject_(rows[idx+1],idx+2);
  return sendInvoiceEmailInternal_(inv,subject||inv.mailSubject||'',body||inv.mailBody||'');
}

function deleteInvoiceAdmin(token, invNumber){
  assertAdmin_(token);
  const {invoiceSheet}=ensureSheets_();
  if(invoiceSheet.getLastRow()<=1) return{ok:false,message:'인보이스가 없습니다.'};
  const rows=invoiceSheet.getDataRange().getValues();
  const idx=rows.slice(1).findIndex(r=>String(r[0]||'').trim()===String(invNumber).trim());
  if(idx===-1) return{ok:false,message:'인보이스를 찾을 수 없습니다.'};
  invoiceSheet.deleteRow(idx+2);
  return{ok:true};
}

function cancelBookingAdmin(token, bookingRowIndex, refundAmount, issueInvoice, memo){
  assertAdmin_(token);
  const {bookingSheet}=ensureSheets_();
  const data=bookingSheet.getDataRange().getValues();
  if(bookingRowIndex<2||bookingRowIndex>data.length) throw new Error('잘못된 예약 행 번호');
  const row=data[bookingRowIndex-1];
  if(String(row[1])===('취소됨')) return {ok:false, message:'이미 취소된 예약입니다.'};
  // 상태 변경
  bookingSheet.getRange(bookingRowIndex,2).setValue('취소됨');
  // 캘린더 이벤트 삭제
  const eventId=String(row[16]||'').trim();
  if(eventId){
    try{
      const cal=CalendarApp.getCalendarById(CONFIG.MAIN_CALENDAR_ID)||CalendarApp.getDefaultCalendar();
      const ev=cal.getEventById(eventId);
      if(ev) ev.deleteEvent();
    }catch(e){Logger.log('cal delete error: '+e.message);}
  }
  // 취소 이메일 발송
  const email=String(row[4]||'');
  const lang=String(row[5]||'ko').toLowerCase().trim();
  const TC=EMAIL_I18N[lang]||EMAIL_I18N.ko;
  const formattedDt=parseDateSafe_(row[0]).str||String(row[0]);
  const products=getCachedProducts_();
  const product=products.find(p=>p.nameKo===row[7]);
  const prodLocal=product?(lang==='en'?product.nameEn:(lang==='de'?product.nameDe:product.nameKo)):row[7];
  if(email&&!email.includes('수기등록')&&email.includes('@')){
    let refundNote='';
    const refund=parseFloat(refundAmount)||0;
    if(refund>0){
      const refundLabel={ko:`환불 금액: €${refund}`,en:`Refund amount: €${refund}`,de:`Rückerstattungsbetrag: €${refund}`};
      refundNote=`<br><br><b>${refundLabel[lang]||refundLabel.de}</b>`;
    }
    MailApp.sendEmail({
      to:email,
      subject:TC.cancelled_subject(row[2],prodLocal),
      htmlBody:`${TC.greeting(row[2])}<br><br>${TC.cancelled_intro}<br><br>${TC.lbl_product} ${prodLocal}<br>${TC.lbl_datetime} ${formattedDt}${refundNote}<br><br>${TC.cancelled_contact}<br><br><b>Studio mean</b><br>studio.mean.de@gmail.com`
    });
  }
  bumpCalCacheVer_();
  // 인보이스 발행
  let invoiceNumber=null;
  if(issueInvoice){
    const res=createInvoiceAdmin(token,bookingRowIndex,'취소/환불',refundAmount,memo||'취소 처리');
    invoiceNumber=res.invoiceNumber;
  }
  return {ok:true, invoiceNumber};
}

function getInvoiceList(token){
  assertAdmin_(token);
  const {invoiceSheet}=ensureSheets_();
  const rows=invoiceSheet.getDataRange().getValues();
  if(rows.length<=1) return {ok:true, invoices:[]};
  const invoices=rows.slice(1).map((r,i)=>invoiceRowToObject_(r,i+2)).reverse();
  return {ok:true, invoices};
}


/* ====== B2: 자동 리마인더 트리거 ====== */
function installDailyTrigger(){
  ScriptApp.getProjectTriggers()
    .filter(t=>t.getHandlerFunction()==='dailyTasks')
    .forEach(t=>ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('dailyTasks')
    .timeBased().atHour(8).everyDays(1)
    .inTimezone(CONFIG.TIMEZONE).create();
  return 'Daily trigger installed (08:00 Berlin)';
}

function dailyTasks(){
  try{sendBookingReminders_();}catch(e){Logger.log('B2 error: '+e.message);}
  try{autoSelectDailyCheck();}catch(e){Logger.log('C2 error: '+e.message);}
}

function sendBookingReminders_(){
  const sh=ensureSheets_().bookingSheet;
  const data=sh.getDataRange().getValues();
  const tz=CONFIG.TIMEZONE;
  const tomorrow=new Date();
  tomorrow.setDate(tomorrow.getDate()+1);
  const tomorrowStr=Utilities.formatDate(tomorrow,tz,'yyyy-MM-dd');
  const props=PropertiesService.getScriptProperties();

  data.slice(1).forEach(row=>{
    if(String(row[1])!=='확정됨') return;
    const dateInfo=parseDateSafe_(row[0]);
    if(!dateInfo.str||!dateInfo.str.startsWith(tomorrowStr)) return;
    const email=String(row[4]||'').trim();
    if(!email||!email.includes('@')||email.includes('수기')) return;
    const eventId=String(row[16]||'').trim();
    if(!eventId) return;
    // MD5 기반 짧은 키 (PropertiesService 키 길이 제한 대비)
    const remKey='rem24_'+Utilities.computeDigest(Utilities.DigestAlgorithm.MD5,eventId).map(b=>('0'+(b&0xFF).toString(16)).slice(-2)).join('').slice(0,16);
    if(props.getProperty(remKey)) return;
    const lang=String(row[5]||'ko').toLowerCase();
    const name=String(row[2]||'');
    const product=String(row[7]||'');
    const dateStr=dateInfo.str;
    const T={
      ko:{subject:`[Studio mean] 내일 촬영 일정 안내 — ${name}님`,body:`안녕하세요, ${name}님! 😊<br><br>내일 촬영 일정을 안내드립니다.<br><br>📅 <b>촬영 일시:</b> ${dateStr}<br>🛍 <b>상품:</b> ${product}<br>📍 <b>주소:</b> Holzweg-passage 3, 61440 Oberursel<br><br>🚗 <a href="${MAP_URL}">오시는 길 보기</a><br><br>촬영 당일 <b>10분 전</b>까지 도착해 주시면 감사하겠습니다.<br>문의: ${CONFIG.ADMIN_EMAIL}<br><br>${_getSignatureHtml()}`},
      en:{subject:`[Studio mean] Your session is tomorrow — ${name}`,body:`Dear ${name},<br><br>This is a friendly reminder of your upcoming session tomorrow.<br><br>📅 <b>Date & Time:</b> ${dateStr}<br>🛍 <b>Service:</b> ${product}<br>📍 <b>Address:</b> Holzweg-passage 3, 61440 Oberursel<br><br>🚗 <a href="${MAP_URL}">Get directions</a><br><br>Please arrive <b>10 minutes early</b>.<br>Questions? ${CONFIG.ADMIN_EMAIL}<br><br>${_getSignatureHtml()}`},
      de:{subject:`[Studio mean] Ihr Termin ist morgen — ${name}`,body:`Liebe/r ${name},<br><br>Wir möchten Sie an Ihren morgigen Fototermin erinnern.<br><br>📅 <b>Datum & Uhrzeit:</b> ${dateStr}<br>🛍 <b>Leistung:</b> ${product}<br>📍 <b>Adresse:</b> Holzweg-passage 3, 61440 Oberursel<br><br>🚗 <a href="${MAP_URL}">Route anzeigen</a><br><br>Bitte kommen Sie <b>10 Minuten früher</b>.<br>Fragen? ${CONFIG.ADMIN_EMAIL}<br><br>${_getSignatureHtml()}`}
    };
    const msg=T[lang]||T.de;
    try{
      MailApp.sendEmail({to:email,subject:msg.subject,htmlBody:msg.body});
      props.setProperty(remKey,Utilities.formatDate(new Date(),tz,'yyyy-MM-dd'));
      Logger.log('B2 reminder sent to '+email);
    }catch(e){Logger.log('B2 send failed: '+e.message);}
  });
}

/* ====== C2: 셀렉 미제출 리마인더 (3일 후) ====== */
function sendSelectReminders_(){
  autoSelectDailyCheck();
}
