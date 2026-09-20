/* ⚠️ 생성 파일 — 직접 수정 금지.
 * 정본: appscript/Code.gs. 재생성: node scripts/build-public-api.mjs
 * 생성 시각: 2026-09-20T19:21:20.650Z
 * 포함 함수 173개 / 상수 35개. 라우팅·인증·시트 해석은 Shim.gs 에 있다. */
const CONFIG = {
  APP_TITLE: 'Studio mean',
  TIMEZONE: 'Europe/Berlin',
  DB_NAME: 'Studio mean 예약 DB',
  BOOKING_SHEET: '예약장부',
  WALKIN_SHEET: '워크인접수',
  SETTINGS_SHEET: '설정',
  PRODUCTS_SHEET: '상품설정',
  PRINT_SHEET: '인화주문',
  INVOICE_SHEET: '인보이스',
  MESSAGE_LOG_SHEET: '메일로그',
  AUTOMATION_LOG_SHEET: '자동화로그',
  LEAD_SHEET: '문의리드',
  CONSULTATION_SHEET: '상담장부',
  SETTLEMENT_SHEET: '결제대조',
  TRAVEL_SHEET: '출장장부',
  MARKETING_SHEET: '마케팅게시스케줄',
  INSTA_REVIEW_SHEET: '인스타검수',
  CASH_SHEET: '현금장부',
  THREAD_SHEET: '문의스레드',
  PARTNER_SHEET: '협력업체',
  PARTNER_CLICK_SHEET: '협력업체클릭',
  INVOICE_FOLDER_NAME: 'Studio mean Invoices',
  QUOTE_SHEET: '견적서',
  QUOTE_FOLDER_NAME: 'Studio mean Angebote',
  GUTSCHEIN_SHEET: '굿샤인',
  GUTSCHEIN_FOLDER_NAME: 'Studio mean Gutscheine',
  GUTSCHEIN_VALID_MONTHS: 36,
  QUOTE_VALID_DAYS: 30,
  QUOTE_VAT_RATE: 0.19,
  EXPENSE_SHEET: '지출장부',
  ADMIN_EMAIL: 'studio.mean.de@gmail.com',
  MAIN_CALENDAR_ID: 'studio.mean.de@gmail.com',
  ADMIN_SESSION_TTL_SEC: 60 * 60 * 8,
  ACTION_LINK_TTL_SEC: 60 * 60 * 24 * 14,
  PRODUCTS_CACHE_TTL_SEC: 3600,
  UNAVAIL_CACHE_TTL_SEC: 1800,
  SLOTS_CACHE_TTL_SEC: 1800,
  MIN_BOOKING_NOTICE_MIN: 180,
  BUFFER_OUTDOOR_MIN: 60,
  BUFFER_STUDIO_MIN: 15,
  BUFFER_PASSPORT_MIN: 0,
  OUTDOOR_TITLE_KEYWORDS: ['야외','스냅','웨딩','결혼식','암트','행사','이벤트','snap','Snap','wedding','Wedding','outdoor','Outdoor','event','Event','Standesamt','civil','Civil'],
  BOOKING_HEADERS: ['예약일시','상태','고객명','연락처','이메일','언어','촬영종류','상품','옵션','인원','총결제액','계약금','잔금','결제수단','분위기','요청사항','캘린더ID','계약금수단','추가항목','재방문','잔금입금일','GDPR동의','마케팅동의','동의시각','변경요청','AI동의','고객주소','촬영후감사메일발송일시','돌촬영추천메일발송일시','계약금입금여부','계약금입금일','계약금입금금액','잔금결제여부','잔금결제금액','Lexware결제상태','Lexware동기화일시','확정일시','입금경고일시','자동취소일시','입금자명','사업자송장필요','사업자명','사업자주소','사업자VAT번호','사업자송장이메일','사업자송장참조','굿샤인코드','굿샤인차감금액','적용전총액','적용후총액','굿샤인적용일시','굿샤인적용방식','추천시간상태','확정처리모드','빠른확정가능','인접예약거리분','추천기준예약','수동확인필요','contract_terms_version','contract_terms_accepted','privacy_terms_accepted','accepted_at','accepted_language','selected_service','shooting_date','shooting_time','shooting_location','total_price_brutto','deposit_price_brutto','balance_price_brutto','프로필나이','가족구성','결제연결유형','결제연결그룹','결제연결행','결제분할내역','결제메모','예약유형','기념일추천메일발송일시','환불내역JSON','환불누계금액','추가일정JSON','샘플링크','샘플발송일시','부가세모드','early_start_requested','캘린더동기화일시'],
  WALKIN_HEADERS: ['접수일시','상태','고객명','연락처','이메일','언어','서비스분류','서비스표시명','고객주소','입금자명','아기이름','요청사항','GDPR동의','AI동의','마케팅동의','사업자송장필요','사업자명','사업자주소','사업자VAT번호','사업자송장이메일','사업자송장참조','접수경로','연결예약행','관리메모','예약내용','촬영장소','희망일정','보안검증'],
  /* ⚠ 새 열은 **맨 뒤**에만 붙인다. 중간 삽입 금지 — 레거시 판정이 colMap['매출날짜']===1 로
     헤더 위치를 보고, 읽기는 헤더 이름 기반 colMap 이라 뒤에 붙는 건 안전하다.
     뒤 6개는 대형 외주(월아트) 추적용 — Phase 2 make-vs-buy 리포트의 원천 데이터다(2026-09-10). */
  PRINT_HEADERS: ['주문일시','고객명','연락처','인화항목','보정항목','총수량','금액','결제수단','메모','상태','매출날짜',
                  '외주업체','랩매입_총액','랩매입_인화분','규격_cm','액자포함','발주일','입고일'],
  EXPENSE_HEADERS: ['지출일','거래처','카테고리','설명','총액(Brutto)','순액(Netto)','부가세(Vorsteuer)','결제수단','메모','증빙링크','상태','회계분류','LexwareVoucherId','LexwareSyncStatus','LexwareSyncedAt'],
  TARGET_CALENDAR_NAMES: ['사진촬영 일정'],
  // '스케쥴/스케줄' 두 표기 모두 — 이름 정확일치로 매칭하므로 한 글자 다르면 개인 일정이 슬롯을 못 막는다
  PERSONAL_CALENDAR_NAMES: ['여보랑나랑', '태웅 개인스케줄', '태웅 개인스케쥴']
};

const BOOKING_COL=CONFIG.BOOKING_HEADERS.reduce((acc,h,i)=>{acc[h]=i;return acc;},{});

const PUBLIC_API_CONFIG = {
  ALLOWED_ORIGINS: [
    'https://booking.studio-mean.com',
    'https://select.studio-mean.com',
    'https://studio-mean.com',
    'https://www.studio-mean.com',
    'https://portfolio.studio-mean.com',
    'https://print.studio-mean.com',
    'https://studio-mean-print.netlify.app',
    'http://localhost:5173',
    'http://127.0.0.1:5173'
  ],
  REQUEST_ID_TTL_SEC: 60 * 10,
  WALKIN_TOKEN_TTL_SEC: 60 * 30,
  WALKIN_MIN_ELAPSED_MS: 2500,
  HONEYPOT_FIELD: 'website',
  MAX_BOOKING_DATE_STR: '2027-06-30'   // 2026-09-17 사장님 지시로 연장 (구: 2027-03-31, 그 전 2026-12-31) — 예약 페이지는 /api/init settings.maxBookingDate 로 이 값을 읽는다
};

const PROMO_CONFIG = {
  START: '2026-06-23',
  END: '2026-08-15',
  ITEM_IDS: ['promo_schultuete_mini_2026', 'promo_schultuete_classic_2026', 'promo_schultuete_family_2026']
};

const DEFAULT_BOOKING_HOURS = {
  weekday: '09:30-13:00,15:30-18:00',   // 2026-08-17 사장님 변경 (구: 09:30-11:30,15:00-17:30)
  saturday: '09:00-16:00'
};

const MORNING_BLOCK_CUTOFF_MIN = 13 * 60;   // morning_block_ranges 의 '오전' 경계 = 13:00 (평일 오전 세션의 끝)

const DAY_CHARS_ = '일월화수목금토';        // getDay() 인덱스와 일치 — 요일 조건 표기용

const SLOT_RECOMMENDATION_DEFAULTS = {
  beforeHours: 2,
  afterHours: 2,
  maxRecommended: 4
};

const WEEKDAY_MORNING_END_MIN = 13 * 60;

const SELECT_PICKUP_EVENT_PREFIX = '[픽업]';

const STUDIO_PRESENCE_EVENT_MARKER = '[studio_presence_auto]';

const WEDDING_EARLY_BOOKING_MONTHS = 6;

const WEDDING_EARLY_BOOKING_DISCOUNT_RATE = 10;

const WEDDING_MARKETING_DISCOUNT_RATE = 5;

const PARTNER_HEADERS=['id','분류','업체명','한줄설명KO','한줄설명EN','한줄설명DE','상담언어','지역','상담링크','인스타링크','적용그룹','노출위치','순서','활성','제휴메모'];

const DATE_SETTING_KEYS=['event_start','event_end','promo_start','promo_end'];

let SETTINGS_MAP_CACHE = null;

function sanitizeInitDataForApi_(data){
  return {
    products:data&&data.products||[],
    promoProducts:data&&data.promoProducts||[],
    tfpProducts:data&&data.tfpProducts||[],   // 포트폴리오 협업 전용 페이지가 소요시간을 읽는다
    settings:data&&data.settings||{},
    partners:data&&data.partners||[],
    serverTime:Utilities.formatDate(new Date(),CONFIG.TIMEZONE,"yyyy-MM-dd'T'HH:mm:ss")
  };
}

function parsePublicJsonBody_(e){
  const body=String((e&&e.postData&&e.postData.contents)||'').trim();
  if(!body) return {};
  try{return JSON.parse(body);}catch(err){throw new Error('Invalid JSON body');}
}

function getPublicPayloadFromRequest_(e){
  const p=(e&&e.parameter)||{};
  const rawPayload=String(p.payload||'').trim();
  if(rawPayload){
    try{
      const parsed=JSON.parse(rawPayload);
      return {body:parsed||{},payload:(parsed&&parsed.data)||parsed||{}};
    }catch(err){
      throw new Error('Invalid payload parameter');
    }
  }
  const body=parsePublicJsonBody_(e);
  return {body:body||{},payload:(body&&body.data)||body||{}};
}

function isPublicTruthy_(value){
  if(value===true) return true;
  const s=String(value||'').trim().toLowerCase();
  return s==='true'||s==='1'||s==='y'||s==='yes'||s==='on';
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

function _openSpreadsheetByIdSafe_(id){
  const safeId=String(id||'').trim();
  if(!safeId) return null;
  try{
    return SpreadsheetApp.openById(safeId);
  }catch(e){
    return null;
  }
}

let _sheetsBundleCache_ = null;

function getSheetsReadonly_(){
  if(_sheetsBundleCache_) return _sheetsBundleCache_;
  try{
    const dbId=PropertiesService.getScriptProperties().getProperty('DB_SHEET_ID');
    const ss=_openSpreadsheetByIdSafe_(dbId);
    if(!ss) return ensureSheets_();
    const bookingSheet=ss.getSheetByName(CONFIG.BOOKING_SHEET);
    if(!bookingSheet) return ensureSheets_();
    return {ss:ss,bookingSheet:bookingSheet,readonly:true};
  }catch(e){return ensureSheets_();}
}

function getPartners_(){
  const cache=CacheService.getScriptCache();
  try{
    const hit=cache.get('partners_v1');
    if(hit){const p=JSON.parse(hit);if(Array.isArray(p)) return p;}
  }catch(e){}
  let out=[];
  try{
    const sh=ensurePartnerSheet_(ensureSheets_().ss);
    const last=sh.getLastRow();
    if(last>=2){
      const rows=sh.getRange(2,1,last-1,PARTNER_HEADERS.length).getValues();
      out=rows.map(function(r){
        const consultLink=String(r[8]||'').trim(),instaLink=String(r[9]||'').trim();
        /* 상담(메신저)과 인스타를 **둘 다** 노출한다. slot 은 /go/<id>?l=<slot> 의 선택자 —
           둘 중 하나만 있어도 그대로 동작한다(예전처럼 하나로 접히지 않는다). */
        const links=[];
        if(consultLink) links.push({slot:'chat',kind:partnerLinkKind_(consultLink),url:consultLink});
        if(instaLink) links.push({slot:'insta',kind:'instagram',url:instaLink});
        return{
          links:links,
          id:String(r[0]||'').trim(),
          category:String(r[1]||'').trim(),
          name:String(r[2]||'').trim(),
          descKo:String(r[3]||'').trim(),
          descEn:String(r[4]||'').trim(),
          descDe:String(r[5]||'').trim(),
          langs:String(r[6]||'').trim(),
          area:String(r[7]||'').trim(),
          url:consultLink||instaLink,           // 하위호환(구 캐시·구 Edge 대비)
          linkKind:consultLink?partnerLinkKind_(consultLink):(instaLink?'instagram':''),
          groups:String(r[10]||'').split(',').map(t=>t.trim().toLowerCase()).filter(Boolean),
          placements:String(r[11]||'').split(',').map(t=>t.trim().toLowerCase()).filter(Boolean),
          order:Number(r[12]||0)||0,
          active:String(r[13]||'').trim().toUpperCase()!=='N'
        };
      }).filter(p=>p.id&&p.name&&p.links.length&&p.active)
        .sort((a,b)=>a.order-b.order);
    }
  }catch(e){Logger.log('getPartners_ 실패: '+e.message);}
  try{cache.put('partners_v1',JSON.stringify(out),600);}catch(e){}
  return out;
}

function partnerLinkKind_(url){
  const u=String(url||'').toLowerCase();
  if(u.indexOf('kakao')>-1) return 'kakao';
  if(u.indexOf('instagram.com')>-1||u.indexOf('ig.me')>-1) return 'instagram';
  if(u.indexOf('wa.me')>-1||u.indexOf('whatsapp')>-1) return 'whatsapp';
  if(u.indexOf('mailto:')===0) return 'email';
  if(u.indexOf('tel:')===0) return 'phone';
  return 'web';
}

function normalizeConsultationPlaceType_(method,location,explicitType){
  const explicit=String(explicitType||'').trim().toLowerCase();
  if(/^(studio|스튜디오|visit_studio|studio_visit)$/.test(explicit)) return 'studio';
  if(/^(external|outside|onsite|출장|외부|고객사|venue)$/.test(explicit)) return 'external';
  if(/^(remote|online|phone|video|전화|화상|원격)$/.test(explicit)) return 'remote';
  const text=[method,location].map(function(v){return String(v||'');}).join(' ');
  if(/외부|출장|고객사|행사장|venue|onsite|on-site|location|vor ort|außerhalb|ausserhalb/i.test(text)) return 'external';
  if(isStudioLocation_(location)||/스튜디오|studio/i.test(text)) return 'studio';
  if(/전화|phone|call|telefon|anruf|화상|video|zoom|online|온라인|원격|remote/i.test(text)) return 'remote';
  if(/방문|visit/i.test(text)) return 'studio';
  return location?'external':'remote';
}

function getSettingsMap_() {
  if(SETTINGS_MAP_CACHE) return SETTINGS_MAP_CACHE;
  const sh=ensureSheets_().settingsSheet,vals=sh.getDataRange().getValues(),map={};
  for(let i=1;i<vals.length;i++) if(vals[i][0]){
    const key=String(vals[i][0]).trim();
    map[key]=normalizeSettingCellValue_(key,vals[i][1]);
  }
  SETTINGS_MAP_CACHE=map;
  return map;
}

function normalizeSettingCellValue_(key,value){
  if(value===null||value===undefined) return '';
  if(Object.prototype.toString.call(value)==='[object Date]'){
    const pattern=DATE_SETTING_KEYS.indexOf(String(key))>=0?'yyyy-MM-dd':'yyyy-MM-dd HH:mm';
    return Utilities.formatDate(value,CONFIG.TIMEZONE,pattern);
  }
  return String(value).trim();
}

function parsePercentSetting_(value,fallback,maxRate){
  const fallbackRate=Number(fallback)||0;
  const max=Number(maxRate)||100;
  const raw=String(value===null||value===undefined?'':value).trim();
  const accidentalDate=raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:\s|$)/);
  if(accidentalDate){
    const monthRate=Number(accidentalDate[2]);
    if(isFinite(monthRate)&&monthRate>=0&&monthRate<=max) return monthRate;
  }
  const num=Number(raw.replace('%','').replace(',','.'));
  if(isFinite(num)&&num>=0&&num<=max) return num;
  return fallbackRate;
}

function getEventDiscountRate_(){
  return parsePercentSetting_(getSettingsMap_().event_rate,0,100);
}

function getReturnDiscountRate_(){
  return parsePercentSetting_(getSettingsMap_().return_discount,10,50);
}

const PASS_FAMILY_DISCOUNT_MIN_PEOPLE=5;

function getPassportFamilyDiscountRate_(){
  // 여권 5인 이상 가족 단체 할인 % — 설정 시트 pass_family_discount (기본 10, 상한 50)
  const v=getSettingsMap_().pass_family_discount;
  // 설정 행이 아직 없으면 10. parsePercentSetting_ 은 빈 값을 0 으로 읽는다(Number('')===0) — 하네스로 잡힌 버그.
  if(v===undefined||v===null||String(v).trim()==='') return 10;
  return parsePercentSetting_(v,10,50);
}

function parseDateListSetting_(value){
  const seen={};
  return String(value||'').split(/[,\s]+/).map(function(v){return String(v||'').trim();})
    .filter(function(v){
      if(!/^\d{4}-\d{2}-\d{2}$/.test(v)||seen[v]) return false;
      seen[v]=true;
      return true;
    })
    .sort();
}

let _fastDateFmtOk_=null;

function _canFormatDateFast_(){
  if(_fastDateFmtOk_===null){
    try{_fastDateFmtOk_=(String(Session.getScriptTimeZone())===String(CONFIG.TIMEZONE));}catch(e){_fastDateFmtOk_=false;}
  }
  return _fastDateFmtOk_;
}

function formatDateMinuteFast_(d){
  const p=function(n){return (n<10?'0':'')+n;};
  return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate())+' '+p(d.getHours())+':'+p(d.getMinutes());
}

function formatDateMinute_(d){
  return _canFormatDateFast_() ? formatDateMinuteFast_(d) : Utilities.formatDate(d,CONFIG.TIMEZONE,'yyyy-MM-dd HH:mm');
}

function parseDateSafe_(rawDate) {
  if(Object.prototype.toString.call(rawDate)==='[object Date]'){
    return{obj:rawDate,str:isNaN(rawDate.getTime())?'':formatDateMinute_(rawDate)};
  }
  const str=String(rawDate||'').trim();
  if(!str) return {obj:new Date(NaN),str:''};
  const candidates=[str];
  if(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/.test(str)) candidates.push(str.replace(' ','T'));
  if(/^\d{4}-\d{2}-\d{2}$/.test(str)) candidates.push(str+'T00:00:00');
  let obj=new Date(NaN);
  for(let i=0;i<candidates.length;i++){
    const candidate=candidates[i];
    const parsed=new Date(candidate);
    if(!isNaN(parsed.getTime())){
      obj=parsed;
      break;
    }
  }
  return{obj,str:!isNaN(obj.getTime())?formatDateMinute_(obj):str};
}

function getPassportComboDurationMin_(people){
  /* 여권 촬영시간(분). 4인 초과는 인당 +10분 — 사장님 확정 2026-09-15.
     이전엔 40분 고정이라 5인 이상이 온라인으로 들어오면 슬롯이 모자랐다(여권은 앞뒤 버퍼 0분).
     같은 표가 AdminV2.html passportDurationMin / booking.js passportDurationMin 에도 있다 — 같이 고칠 것. */
  const n=Math.max(1,parseInt(people,10)||1);
  const table=[0,15,20,30,40];
  return n<=4?table[n]:40+(n-4)*10;
}

function getPromoConfig_(){
  const s=getSettingsMap_();
  const start=String(s.promo_start||PROMO_CONFIG.START||'').trim()||PROMO_CONFIG.START;
  const end=String(s.promo_end||PROMO_CONFIG.END||'').trim()||PROMO_CONFIG.END;
  if(isLegacyFamilyPromoWindow_(start,end)) return {start:PROMO_CONFIG.START,end:PROMO_CONFIG.END};
  return {start,end};
}

function isLegacyFamilyPromoWindow_(start,end){
  return String(start||'').trim()==='2026-04-20' && String(end||'').trim()==='2026-05-10';
}

function isPromoEnabledForCustomer_(settings){
  const raw=String(settings&&settings.promo_enabled||'').trim();
  if(/^(Y|TRUE|1)$/i.test(raw)) return true;
  const start=String(settings&&settings.promo_start||'').trim();
  const end=String(settings&&settings.promo_end||'').trim();
  return isLegacyFamilyPromoWindow_(start,end);
}

function getPromoContent_(){
  const raw=String(getSettingsMap_().promo_content_json||'').trim();
  if(!raw) return {};
  try{
    const parsed=JSON.parse(raw);
    return parsed&&typeof parsed==='object'&&!Array.isArray(parsed) ? parsed : {};
  }catch(e){
    return {};
  }
}

function formatHourMin_(hour,min){
  return `${('0'+hour).slice(-2)}:${('0'+min).slice(-2)}`;
}

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

function isPublicBookingItemGroup_(itemGroup){
  return String(itemGroup||'').trim()!=='마이리얼트립';
}

function isPublicBookingProduct_(product){
  return !!product && !isMyRealTripProduct_(product);
}

function getCustomerProducts_(){
  return getCachedProducts_().filter(isPublicBookingProduct_);
}

function getTfpProducts_(){
  return [{
    id:'tfp_portfolio',
    g:'tfp',
    t:'tfp',
    nameKo:'포트폴리오 협업 촬영',
    nameEn:'Portfolio Collaboration Session',
    nameDe:'Portfolio-Kollaboration',
    p:0,
    d:60,
    prep:15,
    descKo:'상호 무페이 협업 촬영 · 60분 · 결과물은 양측 포트폴리오에 사용합니다.',
    descEn:'Unpaid collaboration session (TFP) · 60 min · images used for both portfolios.',
    descDe:'Unbezahltes Kollaborations-Shooting (TFP) · 60 Min. · Bilder für beide Portfolios.'
  }];
}

function getPromoProducts_(){
  return [
    {
      id:'promo_schultuete_mini_2026',
      g:'promo',
      t:'promoSchultueteMini',
      nameKo:'Schultüte Mini',
      nameEn:'Schultüte Mini',
      nameDe:'Schultüte Mini',
      p:69,
      d:20,
      prep:15,
      descKo:'입학 예정 아이 1명 단독 / 20분 촬영 / 보정본 2장',
      descEn:'One school starter child / 20 min session / 2 retouched photos',
      descDe:'Ein Einschulungskind / 20 Min. Shooting / 2 bearbeitete Bilder'
    },
    {
      id:'promo_schultuete_classic_2026',
      g:'promo',
      t:'promoSchultueteClassic',
      nameKo:'Schultüte Classic',
      nameEn:'Schultüte Classic',
      nameDe:'Schultüte Classic',
      p:119,
      d:30,
      prep:15,
      descKo:'입학 예정 아이 1명 + 가족 짧은 컷 / 30분 촬영 / 보정본 4장',
      descEn:'One school starter child + short family portraits / 30 min session / 4 retouched photos',
      descDe:'Ein Einschulungskind + kurze Familienbilder / 30 Min. Shooting / 4 bearbeitete Bilder'
    },
    {
      id:'promo_schultuete_family_2026',
      g:'promo',
      t:'promoSchultueteFamily',
      nameKo:'Schultüte Family',
      nameEn:'Schultüte Family',
      nameDe:'Schultüte Family',
      p:159,
      d:40,
      prep:15,
      descKo:'가족 최대 4인 / 40분 촬영 / 보정본 5장',
      descEn:'Family up to 4 people / 40 min session / 5 retouched photos',
      descDe:'Familie bis 4 Personen / 40 Min. Shooting / 5 bearbeitete Bilder'
    }
  ];
}

function isPromoDateAllowed_(dateStr){
  const promo=getPromoConfig_();
  return !!dateStr && dateStr>=promo.start && dateStr<=promo.end;
}

function getInitDataCustomer() {
  const s=getSettingsMap_();
  const promo=getPromoConfig_();
  return{settings:{ko:s.notice_ko||'',en:s.notice_en||'',de:s.notice_de||'',customHolidays:s.custom_holidays||'',publicHolidayOpenDates:s.public_holiday_open_dates||'',customPublicHolidays:s.custom_public_holidays||'',morningBlockRanges:s.morning_block_ranges||'',weekdayHours:getWeekdayBookingHours_(),saturdayHours:getSaturdayBookingHours_(),eventRate:String(getEventDiscountRate_()),eventStart:s.event_start||'',eventEnd:s.event_end||'',returnDiscount:String(getReturnDiscountRate_()),passFamilyDiscount:String(getPassportFamilyDiscountRate_()),promoEnabled:isPromoEnabledForCustomer_(s),promoStart:promo.start,promoEnd:promo.end,promoContent:getPromoContent_(),recommendBeforeHours:s.recommend_before_hours||String(SLOT_RECOMMENDATION_DEFAULTS.beforeHours),recommendAfterHours:s.recommend_after_hours||String(SLOT_RECOMMENDATION_DEFAULTS.afterHours),recommendMaxSlots:s.recommend_max_slots||String(SLOT_RECOMMENDATION_DEFAULTS.maxRecommended),recommendForceSlots:s.recommend_force_slots||'',recommendExcludeSlots:s.recommend_exclude_slots||'',maxBookingDate:PUBLIC_API_CONFIG.MAX_BOOKING_DATE_STR},products:getCustomerProducts_(),promoProducts:getPromoProducts_(),tfpProducts:getTfpProducts_(),partners:getPartners_().map(function(p){
    return{id:p.id,name:p.name,links:p.links,descKo:p.descKo,descEn:p.descEn,descDe:p.descDe,
      langs:p.langs,area:p.area,groups:p.groups,placements:p.placements};
  })};
}

function getPublicCalendarBatch_(year,month,totalDur,itemGroup){
  if(!isPublicBookingItemGroup_(itemGroup)) return buildClosedMonthSummary_(year,month);
  const d=new Date(year,month,1);
  const y=d.getFullYear();
  const m=d.getMonth();
  const key=`${y}_${m}`;
  if(new Date(y,m,1).getTime()>new Date(`${PUBLIC_API_CONFIG.MAX_BOOKING_DATE_STR}T23:59:59`).getTime()){
    return buildClosedMonthSummary_(y,m);
  }
  const ver=getCalCacheVer_();
  const cacheKey=`public_batch_v7_${ver}_${y}_${m}_${itemGroup}_${totalDur}`;
  const cache=CacheService.getScriptCache();
  try{
    const hit=cache.get(cacheKey);
    if(hit){
      const parsed=JSON.parse(hit);
      if(parsed&&typeof parsed==='object') return parsed;
    }
  }catch(e){}
  const monthSummary=itemGroup==='promo'
    ? getPublicCalendarMonthLite_(y,m,itemGroup)
    : getUnavailableDays(y,m,totalDur,itemGroup,true);
  const out={};
  out[key]={unavail:monthSummary.unavail||[],closed:monthSummary.closed||[],slotCounts:{},slotsByDate:{}};
  /* 캘린더 읽기 실패로 '전 일자 마감'이 된 결과를 여기서 캐시하면, 아래층(getUnavailableDays)이
     캐시를 안 심어도 이 래퍼가 30분간 굳힌다 — fail-open 을 막으려다 '한 달 전체 마감'을 굳히는
     반대 극성 사고. 이 응답만 내보내고 캐시는 건너뛴다(warmupCacheTrigger 도 이 경로를 탄다). */
  if(monthSummary&&monthSummary.calReadFailed) return out;
  try{cache.put(cacheKey,JSON.stringify(out),CONFIG.UNAVAIL_CACHE_TTL_SEC);}catch(e){}
  return out;
}

function _monthEventsTtlSec_(){
  return (typeof PUBLIC_MONTH_EVENT_TTL_SEC_!=='undefined'&&Number(PUBLIC_MONTH_EVENT_TTL_SEC_)>0)?Number(PUBLIC_MONTH_EVENT_TTL_SEC_):120;
}

function getCachedMonthEvents_(year,month,wantDetailed){
  const ver=getCalCacheVer_();
  const cache=CacheService.getScriptCache();
  const key=`month_evt_${wantDetailed?'d':'e'}_v2_${ver}_${year}_${month}`;
  try{
    const h=cache.get(key);
    if(h){ const p=JSON.parse(h); if(Array.isArray(p)){ if(!wantDetailed) CAL_READ_FAILED_=false; return p; } }
  }catch(e){}
  const dim=new Date(year,month+1,0).getDate();
  const start=new Date(year,month,1),end=new Date(year,month,dim,23,59,59);
  const events=wantDetailed
    ? getBusyEventsDetailedForRange_(start,end)
    : getEventsForRange_(start,end);
  if(wantDetailed||!CAL_READ_FAILED_){
    try{ const j=JSON.stringify(events); if(j.length<95000) cache.put(key,j,_monthEventsTtlSec_()); }catch(e){}
  }
  return events;
}

function getPublicSlots_(dateStr,totalDur,itemGroup,skipCache){
  if(!isPublicBookingItemGroup_(itemGroup)) return [];
  if(itemGroup==='promo'&&!isPromoDateAllowed_(dateStr)) return[];
  const cache=CacheService.getScriptCache();
  const cacheKey=`public_slots_v1_${getCalCacheVer_()}_${dateStr}_${itemGroup}_${totalDur}`;
  if(skipCache!==true){
    try{
      const hit=cache.get(cacheKey);
      if(hit){
        const parsed=JSON.parse(hit);
        if(Array.isArray(parsed)) return parsed;
      }
    }catch(e){}
  }
  const y=parseInt(dateStr.slice(0,4),10),mo=parseInt(dateStr.slice(5,7),10)-1;
  const dayStartMs=new Date(`${dateStr}T00:00:00`).getTime(),dayEndMs=new Date(`${dateStr}T23:59:59`).getTime();
  /* 표시 경로는 월 캐시에서 당일 이벤트를 잘라 쓰고(빠름), skipCache(제출 메타 재계산)는 신선 조회.
     computeSlots_ 는 당일 시간창만 보므로 월 이벤트를 넘겨도 당일 결과가 동일하다(다른 날 이벤트는
     겹치지 않음). 상세는 추천 라벨용(가용성 비필수). */
  const getDayDetailed=function(){
    return (skipCache===true)
      ? getBusyEventsDetailedForRange_(new Date(`${dateStr}T00:00:00`),new Date(`${dateStr}T23:59:59`))
      : getCachedMonthEvents_(y,mo,true).filter(function(ev){return ev.start<dayEndMs&&ev.end>dayStartMs;});
  };
  let studioPresenceEvents=[];
  let hasStudioAutoOpenBlocks=false;
  if(isStudioAutoOpenEligibleGroup_(itemGroup)){
    studioPresenceEvents=getDayDetailed();
    hasStudioAutoOpenBlocks=getStudioAutoOpenBlocksForDate_(dateStr,studioPresenceEvents).length>0;
  }
  // 닫힌 날짜도 빈 배열을 캐시한다 — 캐시 안 하면 '닫힘' 응답마다 캘린더를 다시 훑는다
  if(isBeyondPublicBookingRange_(dateStr)||(isWeekendOrHolidayBlocked_(dateStr,itemGroup)&&!hasStudioAutoOpenBlocks)){
    if(skipCache!==true){ try{cache.put(cacheKey,'[]',getAvailabilityCacheTtlSec_(itemGroup));}catch(e){} }
    return[];
  }
  const events=(skipCache===true)
    ? getEventsForRange_(new Date(`${dateStr}T00:00:00`),new Date(`${dateStr}T23:59:59`))
    : getCachedMonthEvents_(y,mo,false);
  if(CAL_READ_FAILED_){
    // 불완전한 이벤트 목록으로 계산한 '가용'은 거짓말이다. 빈 슬롯으로 응답하되 **캐시는 심지 않는다**.
    return [];
  }
  const slotStrings = computeSlots_(dateStr,events,totalDur,itemGroup,'',studioPresenceEvents);
  const detailedEvents = (studioPresenceEvents && studioPresenceEvents.length)
    ? studioPresenceEvents
    : getDayDetailed();
  const out = buildPublicSlotEntries_(dateStr, slotStrings, totalDur, detailedEvents, itemGroup);
  if(skipCache!==true){
    // 스튜디오 자동오픈 그룹은 상주 일정에 따라 자주 바뀌므로 짧은 TTL(기존 규칙 재사용)
    try{cache.put(cacheKey,JSON.stringify(out),getAvailabilityCacheTtlSec_(itemGroup));}catch(e){}
  }
  return out;
}

function getPublicCalendarMonthLite_(year,month,itemGroup){
  const unavail=[],closed=[],slotCounts={},slotsByDate={};
  const daysInMonth=new Date(year,month+1,0).getDate();
  const now=new Date().getTime();
  for(let d=1;d<=daysInMonth;d++){
    const dStr=`${year}-${('0'+(month+1)).slice(-2)}-${('0'+d).slice(-2)}`;
    const isPast=new Date(`${dStr}T23:59:59`).getTime()<now;
    const isClosed=isWeekendOrHolidayBlocked_(dStr,itemGroup)||(itemGroup==='promo'&&!isPromoDateAllowed_(dStr));
    if(isPast){unavail.push(dStr);continue;}
    if(isClosed){unavail.push(dStr);closed.push(dStr);}
  }
  return {unavail,closed,slotCounts,slotsByDate};
}

function isBeyondPublicBookingRange_(dateStr){
  return new Date(`${dateStr}T23:59:59`).getTime()>new Date(`${PUBLIC_API_CONFIG.MAX_BOOKING_DATE_STR}T23:59:59`).getTime();
}

function buildClosedMonthSummary_(year,month){
  const daysInMonth=new Date(year,month+1,0).getDate();
  const unavail=[];
  for(let d=1;d<=daysInMonth;d++){
    unavail.push(`${year}-${('0'+(month+1)).slice(-2)}-${('0'+d).slice(-2)}`);
  }
  const out={};
  out[`${year}_${month}`]={unavail,closed:unavail.slice(),slotCounts:{},slotsByDate:{}};
  return out;
}

function getProductById_(itemId){
  const p=getCachedProducts_().concat(getPromoProducts_()).concat(getTfpProducts_()).find(x=>x.id===itemId);
  if(!p)throw new Error('유효하지 않은 상품입니다.');
  return p;
}

function isGenericBusinessProduct_(item){
  return !!item&&item.g==='biz'&&item.id==='biz';
}

function isMyRealTripProduct_(item){
  if(!item) return false;
  const hay=[item.id,item.g,item.nameKo,item.nameEn,item.nameDe,item.descKo,item.descEn,item.descDe]
    .map(function(v){return String(v||'');}).join(' ');
  return /myrealtrip|my real trip|마이리얼트립/i.test(hay);
}

function getWeekendSurcharge_(item,dateStr){
  if(!item||!dateStr) return 0;
  if(isMyRealTripProduct_(item)) return 0;
  const d=parseYmdDateAtNoon_(dateStr);
  if(!d||d.getDay()!==6) return 0;
  const map={amtp:50,dolp:50,ob:20,op:30,oprm:40};
  return map[item.id]||0;
}

function parseYmdDateAtNoon_(dateStr){
  const m=String(dateStr||'').trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if(!m) return null;
  return new Date(Number(m[1]),Number(m[2])-1,Number(m[3]),12,0,0,0);
}

function addMonthsClamped_(date,months){
  const d=new Date(date.getTime());
  const originalDay=d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth()+months);
  const lastDay=new Date(d.getFullYear(),d.getMonth()+1,0).getDate();
  d.setDate(Math.min(originalDay,lastDay));
  return d;
}

function isWeddingEarlyBookingEligible_(shootDateStr,baseDate){
  const shootDate=parseYmdDateAtNoon_(shootDateStr);
  if(!shootDate) return false;
  const base=baseDate instanceof Date?new Date(baseDate.getTime()):new Date();
  const thresholdBase=new Date(base.getFullYear(),base.getMonth(),base.getDate(),12,0,0,0);
  const threshold=addMonthsClamped_(thresholdBase,WEDDING_EARLY_BOOKING_MONTHS);
  return shootDate.getTime()>=threshold.getTime();
}

function roundCurrency_(value){
  return Math.round((Number(value)||0)*100)/100;
}

function formatEuroAmount_(value){
  const rounded=roundCurrency_(value);
  return Number.isInteger(rounded)?String(rounded):rounded.toFixed(2);
}

function calculateQuote_(request){
  const item=getProductById_(request.itemId);
  const people=Math.max(1,parseInt(request.people)||1);
  const optionKeys=(request.optionKeys||[]).filter(Boolean);
  const passPersonCountries=(request.passPersonCountries||[])
    .map(function(entry){
      if(Array.isArray(entry)) return entry.filter(Boolean);
      return entry ? [entry] : [];
    })
    .filter(function(entry){ return entry.length; });
  const passCountries=(request.passCountries||[]).filter(Boolean);
  const otherCountry=(request.otherCountry||'').trim();
  const totalCountries=passPersonCountries.reduce(function(sum,codes){
    return sum + codes.filter(function(code){ return code && code!=='OTHER'; }).length;
  },0) + (otherCountry?1:0);
  let total=item.p;
  const isQuoteOnly=item.t==='custom'||Number(item.p)<=0;
  let productLabelKo=item.nameKo, productLabelEn=item.nameEn, productLabelDe=item.nameDe;
  let businessMode=String(request.businessMode||'photo');
  if(['photo','video','hybrid'].indexOf(businessMode)<0) businessMode='photo';
  let businessHours=Math.min(8,Math.max(2,parseInt(request.businessHours,10)||2));
  let businessVideoEdit=String(request.businessVideoEdit||'raw');
  const businessAddonKeys=(request.businessAddonKeys||[]).filter(Boolean);
  if(isGenericBusinessProduct_(item)){
    // 행사/기업 촬영 금액은 상담 후 견적으로만 안내 — 시간제 단가표 계산 제거 (roadmap #10 Phase 1)
    total=0;
    const hourKo=businessHours+'시간';
    const hourEn=businessHours+'h';
    const hourDe=businessHours+' Std.';
    const usesVideo=businessMode==='video'||businessMode==='hybrid';
    if(usesVideo){
      const editKo=businessVideoEdit==='basic'?'기본 편집':businessVideoEdit==='full'?'풀 편집':'촬영만';
      const editEn=businessVideoEdit==='basic'?'Basic Edit':businessVideoEdit==='full'?'Full Edit':'Raw Footage';
      const editDe=businessVideoEdit==='basic'?'Basis-Schnitt':businessVideoEdit==='full'?'Vollschnitt':'Rohmaterial';
      if(businessMode==='hybrid'){
        productLabelKo='행사 사진+영상 '+hourKo+' ('+editKo+')';
        productLabelEn='Event Photo+Video '+hourEn+' ('+editEn+')';
        productLabelDe='Event Foto+Video '+hourDe+' ('+editDe+')';
      }else{
        productLabelKo='행사 영상 '+hourKo+' ('+editKo+')';
        productLabelEn='Event Video '+hourEn+' ('+editEn+')';
        productLabelDe='Event Video '+hourDe+' ('+editDe+')';
      }
    }else{
      productLabelKo='행사 사진 '+hourKo;
      productLabelEn='Event Photo '+hourEn;
      productLabelDe='Event Foto '+hourDe;
    }
  }
  else if(item.g==='promo'){
    if(item.id==='promo_schultuete_mini_2026'){
      total=69;
    }else if(item.id==='promo_schultuete_classic_2026'){
      total=119;
    }else if(item.id==='promo_schultuete_family_2026'){
      total=159;
    }
    const promoOptionKeys=(request.optionKeys||[]).map(function(k){return String(k||'').trim();}).filter(Boolean);
    const hasPromoOption=function(key){return promoOptionKeys.indexOf(key)>-1;};
    const schoolChildCount=String(request.schoolChildCount||'').trim();
    const siblingOption=String(request.siblingOption||'').trim();
    const extraRetouchFromKey=promoOptionKeys.reduce(function(max,key){
      const m=key.match(/^extra_retouch_(\d+)$/);
      return m?Math.max(max,parseInt(m[1],10)||0):max;
    },0);
    const extraRetouchCount=Math.max(0,Math.min(10,parseInt(request.extraRetouchCount,10)||extraRetouchFromKey||0));
    if(schoolChildCount==='2'||hasPromoOption('school_child_2')) total+=40;
    if(siblingOption==='together'||siblingOption==='both'||hasPromoOption('sibling_together')) total+=20;
    if(siblingOption==='solo'||siblingOption==='both'||hasPromoOption('sibling_solo')) total+=30;
    if(people>4) total+=(people-4)*20;
    if(extraRetouchCount) total+=extraRetouchCount*15;
    }
  let familyDiscount=0;
  if(item.t==='passport'){
    total=passPersonCountries.reduce(function(sum,codes){
      const extra=Math.max(0,codes.filter(function(code){ return code && code!=='OTHER'; }).length-1)*5;
      return sum + item.p + extra;
    },0);
    if(!passPersonCountries.length) total=item.p*people;
    // 5인 이상 가족 단체 할인(%) — 사장님 확정 2026-09-15. 법인 인보이스 체크 건은 회사 단체로 보고 제외.
    if(people>=PASS_FAMILY_DISCOUNT_MIN_PEOPLE&&!isPublicTruthy_(request.businessInvoiceNeeded)){
      familyDiscount=roundCurrency_(total*(getPassportFamilyDiscountRate_()/100));
      total=roundCurrency_(total-familyDiscount);
    }
  }
  else if(item.t==='group'&&people>2) total+=(people-2)*30;
  else if(item.t==='snap'&&!isMyRealTripProduct_(item)&&people>2) total+=(people-2)*30;
  else if(item.t==='snap'&&!isMyRealTripProduct_(item)&&people===1) total-=30;
  const weekendSurcharge=getWeekendSurcharge_(item,request.date);
  if(weekendSurcharge) total+=weekendSurcharge;
  const optMeta={dog:15,bg:20,outfit:20};
  if(item.t!=='custom') optionKeys.forEach(k=>{if(optMeta[k])total+=optMeta[k];});
  // 연령 기반 프로필 가격 로직
  const ageGroup=request.ageGroup||'adult';
  let kidsDiscount=0,seniorFree=false;
  let seniorDiscApplied=false;
  let seniorDiscount=0,seniorDiscountKind='';
  if(item.g==='prof'){
    if(ageGroup==='kids'){kidsDiscount=10;total=Math.max(0,total-kidsDiscount);}
    else if(ageGroup==='senior'&&request.date){
      const d=new Date(request.date+'T12:00:00'),day=d.getDay();
      if(item.id==='pb'){
        // 프로필 Basic: 시니어 평일(화~금) 무료
        if(day>=2&&day<=5){seniorFree=true;seniorDiscount=roundCurrency_(total);seniorDiscountKind='weekday_free';total=0;}
      } else if(item.id==='pbus'||item.id==='pp'){
        // 프로필 Business/Professional: 시니어 평일 -50€
        if(day>=2&&day<=5){seniorDiscount=50;seniorDiscountKind='weekday';total=Math.max(0,total-seniorDiscount);seniorDiscApplied=true;}
        // 프로필 Professional: 시니어 토요일 -30€
        else if(day===6&&item.id==='pp'){seniorDiscount=30;seniorDiscountKind='saturday';total=Math.max(0,total-seniorDiscount);seniorDiscApplied=true;}
      }
    }
  }
  const seniorDiscountLabel=seniorDiscountKind==='weekday_free'
    ? '시니어 평일 무료 혜택'
    : (seniorDiscountKind==='weekday'
      ? '시니어 평일 할인 -'+formatEuroAmount_(seniorDiscount)+'€'
      : (seniorDiscountKind==='saturday'?'시니어 토요일 할인 -'+formatEuroAmount_(seniorDiscount)+'€':''));
  let productDiscount=0,eventDiscount=0,returnDiscount=0;
  productDiscount=0;
  const settings=getSettingsMap_();const evRate=getEventDiscountRate_();
  if(evRate>0&&settings.event_start&&settings.event_end&&request.date&&request.date>=settings.event_start&&request.date<=settings.event_end){eventDiscount=Math.round(total*(evRate/100));total-=eventDiscount;}
  if(request.isReturn && isReturnDiscountEligibleItem_(item)){
    const rate=getReturnDiscountRate_();
    returnDiscount=roundCurrency_(total*(rate/100));
    total=roundCurrency_(total-returnDiscount);
  }
  const weddingDiscountBase=item.g==='wed'?roundCurrency_(Math.max(0,total)):0;
  let earlyBirdDiscount=0;
  if(item.g==='wed'&&request.date&&isWeddingEarlyBookingEligible_(request.date,new Date())){earlyBirdDiscount=roundCurrency_(weddingDiscountBase*(WEDDING_EARLY_BOOKING_DISCOUNT_RATE/100));}
  let marketingDiscount=0;
  if(item.g==='wed'&&request.marketing){marketingDiscount=roundCurrency_(weddingDiscountBase*(WEDDING_MARKETING_DISCOUNT_RATE/100));}
  if(item.g==='wed') total=roundCurrency_(total-earlyBirdDiscount-marketingDiscount);
  const duration=isGenericBusinessProduct_(item)
    ? businessHours*60
    : (item.t==='passport'?getPassportComboDurationMin_(people):item.d);
  // 여권 콤보 추가 시 duration에 합산
  const passAddon=(item.g==='prof'||item.g==='stud')&&!!request.passAddon;
  const passAddonPeople=parseInt(request.passAddonPeople)||1;
  const passAddonDur=passAddon?getPassportComboDurationMin_(passAddonPeople):0;
  const passItem=passAddon?getCachedProducts_().find(x=>x.g==='pass'):null;
  const passAddonPrice=passItem?passItem.p*passAddonPeople:0;
  if(passAddon)total+=passAddonPrice;
  const isDeposit=total>100&&item.g!=='pass'&&item.g!=='biz'&&item.g!=='promo'&&!isQuoteOnly;
  const depositAmount=total<=100?0:(item.g==='wed'?roundCurrency_(total*0.20):(isDeposit?50:0));
  return{itemId:item.id,itemGroup:item.g,itemType:item.t,people,totalPrice:roundCurrency_(Math.max(0,total)),duration,prep:item.prep,totalDuration:duration+item.prep+passAddonDur,isDeposit,depositAmount,balanceAmount:roundCurrency_(Math.max(0,total-depositAmount)),product:item,optionKeys,passCountries,passPersonCountries,otherCountry,totalCountries,productDiscount,returnDiscount,familyDiscount,eventDiscount,earlyBirdDiscount,marketingDiscount,weekendSurcharge,isQuoteOnly,isReturn:!!(request.isReturn&&isReturnDiscountEligibleItem_(item)),marketing:request.marketing||false,passAddon,passAddonPeople,passAddonDur,productLabelKo,productLabelEn,productLabelDe,businessMode,businessHours,businessVideoEdit,businessAddonKeys,ageGroup,kidsDiscount,seniorFree,seniorDiscApplied,seniorDiscount,seniorDiscountKind,seniorDiscountLabel};
}

function isReturnDiscountEligibleItem_(item){
  if(!item) return false;
  return !(String(item.g||'').trim()==='pass' || String(item.t||'').trim()==='passport');
}

function getBusyCalendarIds_(){
  return getBusyCalendarMeta_().map(m=>m.id);
}

var MISSING_BUSY_CALS_={target:[],personal:[]};

function getBusyCalendarMeta_(){
  const cache=CacheService.getScriptCache();
  try{
    const h=cache.get('busy_cal_meta_v3');
    if(h){
      const parsed=JSON.parse(h);
      MISSING_BUSY_CALS_=parsed.missing||{target:[],personal:[]};
      /* 대상 캘린더('사진촬영 일정') 소실은 **보고만** 한다 — 확정 예약은 항상 메인에도 있어
         (실측 13/13, 양쪽 등록) 가용성은 메인만으로 완결된다. 2026-07-29 A안(메인 캘린더를
         와이프 계정에 직접 공유) 채택으로 사본 관행이 은퇴 수순 — fail-closed 로 두면 나중에
         그 캘린더를 정리하는 순간 예약 전체가 마감되는 지뢰가 된다. */
      return parsed.items||[];
    }
  }catch(e){}
  const personalSet=new Set(CONFIG.PERSONAL_CALENDAR_NAMES);
  const targetSet=new Set(CONFIG.TARGET_CALENDAR_NAMES);
  const mainId=CONFIG.MAIN_CALENDAR_ID;
  const meta=[];
  const seenIds=new Set();
  const foundNames=new Set();
  // 메인 캘린더를 항상 포함
  try{
    const mainCal=CalendarApp.getCalendarById(mainId);
    const mainName=mainCal?mainCal.getName():'';
    meta.push({id:mainId,name:mainName,isPersonal:personalSet.has(mainName)});
    seenIds.add(mainId);
    if(mainName) foundNames.add(mainName);
  }catch(e){meta.push({id:mainId,name:'',isPersonal:false});seenIds.add(mainId);}
  // 대상/개인 캘린더 추가
  CalendarApp.getAllCalendars().forEach(cal=>{
    const name=cal.getName(),id=cal.getId();
    if(seenIds.has(id))return;
    if(targetSet.has(name)||personalSet.has(name)){
      meta.push({id,name,isPersonal:personalSet.has(name)});
      seenIds.add(id);
      foundNames.add(name);
    }
  });
  // 개인 캘린더는 표기 변형('스케줄/스케쥴')을 CONFIG 에 중복 등록하는 관행 — 정규화해 묶고,
  // 변형 전부가 안 보일 때만 소실로 보고한다(아니면 미사용 변형이 매일 가짜 경보를 낸다).
  const normP=function(n){return String(n).replace(/스케쥴/g,'스케줄');};
  const foundNorm=new Set(Array.from(foundNames).map(normP));
  MISSING_BUSY_CALS_={
    target:CONFIG.TARGET_CALENDAR_NAMES.filter(function(n){return !foundNames.has(n);}),
    personal:CONFIG.PERSONAL_CALENDAR_NAMES.map(normP)
      .filter(function(n,i,arr){return arr.indexOf(n)===i;})
      .filter(function(n){return !foundNorm.has(n);})
  };
  try{cache.put('busy_cal_meta_v3',JSON.stringify({items:meta,missing:MISSING_BUSY_CALS_}),600);}catch(e){}  // 10분 캐시
  return meta;
}

function getStudioPresenceCalendar_(){
  // ERP/shortcut에서 Studio Open을 만들 때는 반드시 쓰기 가능한 메인 캘린더를 우선 사용한다.
  // 같은 이름의 구독/읽기 전용 캘린더를 잡으면 `허용되지 않는 작업` 예외가 날 수 있다.
  try{
    const mainCal=CalendarApp.getCalendarById(CONFIG.MAIN_CALENDAR_ID);
    if(mainCal) return mainCal;
  }catch(e){}
  const targetNames=new Set(CONFIG.TARGET_CALENDAR_NAMES);
  const targetMeta=getBusyCalendarMeta_().find(function(meta){
    return targetNames.has(meta.name);
  });
  if(targetMeta){
    try{
      const targetCal=CalendarApp.getCalendarById(targetMeta.id);
      if(targetCal) return targetCal;
    }catch(e){}
  }
  return CalendarApp.getDefaultCalendar();
}

function getManagedStudioPresenceEvents_(calendar,start,end){
  return calendar.getEvents(start,end).filter(function(ev){
    const desc=String(ev.getDescription()||'');
    return desc.indexOf(STUDIO_PRESENCE_EVENT_MARKER)>=0;
  });
}

function getManagedStudioPresenceDetailedEvents_(start,end){
  try{
    const calendar=getStudioPresenceCalendar_();
    return getManagedStudioPresenceEvents_(calendar,start,end).map(function(ev){
      return {
        id:ev.getId(),
        start:ev.getStartTime().getTime(),
        end:ev.getEndTime().getTime(),
        title:ev.getTitle()||'',
        location:ev.getLocation()||'',
        isPersonal:false
      };
    });
  }catch(e){
    Logger.log('managed studio presence detail error: '+e.message);
    return [];
  }
}

function getStudioPresenceCalendarDetailedEvents_(start,end){
  try{
    const calendar=getStudioPresenceCalendar_();
    return calendar.getEvents(start,end)
      .filter(function(ev){
        if(ev.isAllDayEvent()) return false;
        return isStudioAutoOpenEventByFields_(ev.getTitle()||'',ev.getLocation()||'',false);
      })
      .map(function(ev){
        return {
          id:ev.getId(),
          start:ev.getStartTime().getTime(),
          end:ev.getEndTime().getTime(),
          title:ev.getTitle()||'',
          location:ev.getLocation()||'',
          isPersonal:false
        };
      });
  }catch(e){
    Logger.log('studio presence calendar detail error: '+e.message);
    return [];
  }
}

function classifyEventType_(title, isPersonal, location){
  if(isPersonal) return 'P'; // Personal: 0 min buffer, but direct overlap still blocks
  const safeTitle=String(title||'');
  const safeLocation=String(location||'');
  if(/^\[상담:(외부|출장)\]/.test(safeTitle)) return 'C';
  if(/^\[상담:(원격|전화|화상)\]/.test(safeTitle)) return 'R';
  if(/^\[상담:(스튜디오|방문)\]/.test(safeTitle)) return 'B';
  if(/^\[상담/.test(safeTitle)){
    const placeType=normalizeConsultationPlaceType_(safeTitle,safeLocation,'');
    if(placeType==='external') return 'C';
    if(placeType==='remote') return 'R';
    return 'B';
  }
  if(/여권|비자|Passfoto|Passport|passport/i.test(safeTitle)) return 'A';
  if(CONFIG.OUTDOOR_TITLE_KEYWORDS.some(kw=>safeTitle.includes(kw))) return 'C';
  return 'B';
}

function classifyBookingType_(itemGroup){
  if(itemGroup==='pass') return 'A';
  if(itemGroup==='snap'||itemGroup==='wed'||itemGroup==='biz') return 'C';
  return 'B';
}

function isStudioAutoOpenEligibleGroup_(itemGroup){
  return itemGroup==='pass'||itemGroup==='prof'||itemGroup==='stud';
}

function getAvailabilityCacheTtlSec_(itemGroup){
  return isStudioAutoOpenEligibleGroup_(itemGroup)?120:CONFIG.SLOTS_CACHE_TTL_SEC;
}

function isStudioAutoOpenEventByFields_(title,location,isPersonal){
  if(isPersonal) return false;
  const safeTitle=String(title||'');
  if(!safeTitle) return false;
  const explicitOpen=/studio[\s_-]*(open|presence|available)|studio open|studio presence|스튜디오[\s_-]*(오픈|상주|가능)|상주/i;
  if(explicitOpen.test(safeTitle)) return true;
  if(!isStudioLocation_(location)) return false;
  return false;
}

var TRAVEL_MIN_MEMO_={};

function travelOneWayMinForLocation_(loc){
  const key=String(loc||'').trim();
  if(!key||isStudioLocation_(key)) return null;
  if(Object.prototype.hasOwnProperty.call(TRAVEL_MIN_MEMO_,key)) return TRAVEL_MIN_MEMO_[key];
  const hit=travelKmLookup_(key);
  const min=hit?Math.min(180,Math.max(20,Math.round(hit.km*0.9))):null;
  TRAVEL_MIN_MEMO_[key]=min;
  return min;
}

function travelAwareOutdoorBuffer_(loc){
  const oneWay=travelOneWayMinForLocation_(loc);
  if(oneWay==null) return CONFIG.BUFFER_OUTDOOR_MIN;
  return Math.max(CONFIG.BUFFER_OUTDOOR_MIN, oneWay+15);
}

function getRequiredBuffer_(typeNew, locNew, typeEx, locEx){
  // R (Remote consultation) → direct overlap only, no travel/setup buffer.
  if(typeNew==='R'||typeEx==='R') return 0;
  // P (Personal) → 60 min buffer (same as outdoor/snap Type C)
  if(typeNew==='P'||typeEx==='P') return CONFIG.BUFFER_OUTDOOR_MIN;
  // A vs A only → no buffer (passport back-to-back)
  if(typeNew==='A'&&typeEx==='A') return 0;
  /* ⚠️ C 판정을 A 일반 규칙보다 **먼저** 둔다. 원래 A||A→15 가 앞에 있어 여권↔야외가
     15분으로 뚫려 있었다(내장 assert 'A vs C → 60' 은 이미 60을 기대 — 코드만 어긋난
     잠복 버그, 2026-08-16 이동시간 버퍼 작업 중 로컬 하네스로 발견). */
  // Both C → same-location exception (같은 현장 연속 세션), 다른 장소면 두 이동 중 큰 쪽
  if(typeNew==='C'&&typeEx==='C'){
    const sameLocation=locNew&&locEx&&locNew.trim()===locEx.trim();
    if(sameLocation) return CONFIG.BUFFER_STUDIO_MIN;
    return Math.max(travelAwareOutdoorBuffer_(locNew),travelAwareOutdoorBuffer_(locEx));
  }
  // At least one C (A↔C, B↔C 포함) → 이동시간 인식 버퍼 (C 쪽의 장소 기준)
  if(typeNew==='C'||typeEx==='C') return travelAwareOutdoorBuffer_(typeNew==='C'?locNew:locEx);
  // A vs B → 15 min (여권↔스튜디오/프로필)
  if(typeNew==='A'||typeEx==='A') return CONFIG.BUFFER_STUDIO_MIN;
  // Both B → 15 min
  return CONFIG.BUFFER_STUDIO_MIN;
}

var CAL_READ_FAILED_=false;

var ICLOUD_DETAIL_READ_FAILED_=false;

function getEventsForRange_(start,end){
  CAL_READ_FAILED_=false;
  const events=[];
  const titleTypeCache={};
  getBusyCalendarMeta_().forEach(m=>{
    try{
      const cal=CalendarApp.getCalendarById(m.id);
      if(!cal){CAL_READ_FAILED_=true;Logger.log('캘린더 접근 불가(null): '+m.id);return;}
      const isPersonal=m.isPersonal;
      cal.getEvents(start,end).forEach(ev=>{
        if(ev.isAllDayEvent())return;
        const title=ev.getTitle()||'';
        const location=isPersonal?'':(ev.getLocation()||'');
        if(isStudioAutoOpenEventByFields_(title,location,isPersonal)) return;
        const cacheKey=(isPersonal?'P|':'')+title+'|'+location;
        let type=titleTypeCache[cacheKey];
        if(type===undefined){type=classifyEventType_(title,isPersonal,location);titleTypeCache[cacheKey]=type;}
        events.push({start:ev.getStartTime().getTime(),end:ev.getEndTime().getTime(),type,location,id:ev.getId()});
      });
    }catch(e){CAL_READ_FAILED_=true;Logger.log('캘린더 오류: '+e.message);}
  });
  // Merge iCloud events (private CalDAV + public ICS feeds) if any URL is configured
  const _props=PropertiesService.getScriptProperties().getProperties();
  const _hasIcloud=Object.keys(_props).some(k=>k==='ICLOUD_CAL_URL'||k==='ICLOUD_ICS_URL'||/^ICLOUD_(CAL|ICS)_URL_\d+$/.test(k));
  if(_hasIcloud){
    try{
      fetchAppleCalendarEvents_(start,end).forEach(ev=>events.push(ev));
    }catch(e){CAL_READ_FAILED_=true;Logger.log('iCloud 통합 오류: '+e.message);}
  }
  // 정렬 (start 오름차순) — checkConflict_ 조기 종료 지원
  events.sort((a,b)=>a.start-b.start);
  return events;
}

function checkConflict_(events,slotStart,slotEnd,itemGroup,newLocation){
  const newType=classifyBookingType_(itemGroup);
  const newLoc=newLocation||'';
  const MAX_BUF_MS=CONFIG.BUFFER_OUTDOOR_MIN*60000;  // 최대 버퍼 (60분)
  // events가 start asc로 정렬되어 있다고 가정 → 조기 종료 적용
  for(let i=0;i<events.length;i++){
    const ev=events[i];
    // 이벤트 시작이 slotEnd + MAX_BUF 이후면 이후 이벤트도 모두 범위 밖 → 종료
    if(ev.start>=slotEnd+MAX_BUF_MS) break;
    // 이벤트 종료가 slotStart - MAX_BUF 이전이면 이 이벤트는 무관 → 다음
    if(ev.end<=slotStart-MAX_BUF_MS) continue;
    const bufMs=getRequiredBuffer_(newType,newLoc,ev.type,ev.location)*60000;
    if((slotStart-bufMs)<ev.end&&(slotEnd+bufMs)>ev.start) return true;
  }
  return false;
}

function getIcloudBasicAuth_(){
  const props=PropertiesService.getScriptProperties();
  const id=props.getProperty('APPLE_ID');
  const pw=props.getProperty('APPLE_APP_PASSWORD');
  if(!id||!pw) throw new Error('iCloud credentials missing: APPLE_ID / APPLE_APP_PASSWORD');
  return 'Basic '+Utilities.base64Encode(id+':'+pw);
}

function normalizeCalUrl_(u){
  return u.trim().replace(/^webcal:\/\//i,'https://');
}

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
    .filter(ev=>!isStudioAutoOpenEventByFields_(ev.summary,ev.location,false))
    .map(ev=>({
      start:ev.start,
      end:ev.end,
      type:classifyEventType_(ev.summary,false,ev.location||''),
      location:ev.location||''
    }));
}

function fetchPublicIcsDetailedEvents_(icsUrl,startDate,endDate){
  const res=UrlFetchApp.fetch(icsUrl,{muteHttpExceptions:true});
  const code=res.getResponseCode();
  if(code!==200){
    Logger.log('Public ICS detailed fetch failed ('+code+'): '+icsUrl);
    return[];
  }
  const startMs=startDate.getTime(), endMs=endDate.getTime();
  return parseIcsText_(res.getContentText())
    .filter(ev=>ev.end>startMs&&ev.start<endMs)
    .map(ev=>({
      id:'',
      start:ev.start,
      end:ev.end,
      title:ev.summary||'',
      location:ev.location||'',
      isPersonal:false
    }));
}

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

function fetchAppleCalendarEvents_(startDate,endDate){
  try{
    /* ⚠️ 2026-08-16 실사고: CalDAV URL 이 0개면 여기서 조기 return 해 **아래 공개 ICS 읽기가
       죽은 코드**였다. ICS-only 구성(현재)에서는 애플 일정이 가용성에 한 번도 반영된 적이 없고,
       구글 구독 캘린더(수 시간 지연)만 실제로 막고 있었다. CalDAV 블록만 조건부로 바꾼다. */
    const calUrls=getIcloudCalUrls_();
    const allEvents=[];
    if(calUrls&&calUrls.length>0){
    const auth=getIcloudBasicAuth_();
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
          /* ⚠ 확정 예약은 애플 캘린더로 이관되는 운영 관행(2026-07-28 사장님 확인) — 애플 피드가
             조용히 빠지면 확정 예약 전체가 가용으로 보인다. 피드 단위 실패는 fail-closed 로 올린다. */
          CAL_READ_FAILED_=true;
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
              if(isStudioAutoOpenEventByFields_(ev.summary,ev.location,false)) return;
              const type=classifyEventType_(ev.summary,false,ev.location||'');
              allEvents.push({start:ev.start,end:ev.end,type,location:ev.location||''});
            });
          }catch(e){Logger.log('iCloud event parse error: '+e.message);}
        });
      }catch(e){CAL_READ_FAILED_=true;Logger.log('iCloud fetch error for '+calUrl+': '+e.message);}
    });
    } // ← CalDAV 블록 끝 (URL 있을 때만)
    // Public ICS subscription feeds (webcal / published links) — CalDAV 유무와 무관하게 항상 읽는다
    getIcloudIcsUrls_().forEach(icsUrl=>{
      try{
        fetchPublicIcsEvents_(icsUrl,startDate,endDate).forEach(ev=>allEvents.push(ev));
      }catch(e){CAL_READ_FAILED_=true;Logger.log('Public ICS error for '+icsUrl+': '+e.message);}
    });
    Logger.log('iCloud total events fetched: '+allEvents.length+' (CalDAV '+(calUrls?calUrls.length:0)+'개 · ICS '+getIcloudIcsUrls_().length+'개)');
    return allEvents;
  }catch(e){
    CAL_READ_FAILED_=true;
    Logger.log('fetchAppleCalendarEvents_ error: '+e.message);
    return[];
  }
}

function fetchAppleCalendarDetailedEvents_(startDate,endDate){
  ICLOUD_DETAIL_READ_FAILED_=false;
  try{
    const auth=getIcloudBasicAuth_();
    const calUrls=getIcloudCalUrls_();
    if(!calUrls||calUrls.length===0) return[]; // 미설정은 실패가 아니다
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
          ICLOUD_DETAIL_READ_FAILED_=true;
          Logger.log('iCloud detailed REPORT failed ('+code+') for '+calUrl+': '+res.getContentText().slice(0,200));
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
              allEvents.push({
                id:'',
                start:ev.start,
                end:ev.end,
                title:ev.summary||'',
                location:ev.location||'',
                isPersonal:false
              });
            });
          }catch(e){Logger.log('iCloud detailed event parse error: '+e.message);}
        });
      }catch(e){ICLOUD_DETAIL_READ_FAILED_=true;Logger.log('iCloud detailed fetch error for '+calUrl+': '+e.message);}
    });
    getIcloudIcsUrls_().forEach(icsUrl=>{
      try{
        fetchPublicIcsDetailedEvents_(icsUrl,startDate,endDate).forEach(ev=>allEvents.push(ev));
      }catch(e){ICLOUD_DETAIL_READ_FAILED_=true;Logger.log('Public ICS detailed error for '+icsUrl+': '+e.message);}
    });
    return allEvents;
  }catch(e){
    ICLOUD_DETAIL_READ_FAILED_=true;
    Logger.log('fetchAppleCalendarDetailedEvents_ error: '+e.message);
    return[];
  }
}

function getHessenHolidayItems(year){
  const h=[
    {date:`${year}-01-01`,name:'Neujahr'},
    {date:`${year}-05-01`,name:'Tag der Arbeit'},
    {date:`${year}-10-03`,name:'Tag der Deutschen Einheit'},
    {date:`${year}-12-25`,name:'1. Weihnachtstag'},
    {date:`${year}-12-26`,name:'2. Weihnachtstag'}
  ];
  const G=year%19,C=Math.floor(year/100),H=(C-Math.floor(C/4)-Math.floor((8*C+13)/25)+19*G+15)%30;
  const I=H-Math.floor(H/28)*(1-Math.floor(29/(H+1))*Math.floor((21-G)/11));
  const J=(year+Math.floor(year/4)+I+2-C+Math.floor(C/4))%7;
  const L=I-J,m=3+Math.floor((L+40)/44),d=L+28-31*Math.floor(m/4);
  const easter=new Date(year,m-1,d);
  [
    [-2,'Karfreitag'],
    [1,'Ostermontag'],
    [39,'Christi Himmelfahrt'],
    [50,'Pfingstmontag'],
    [60,'Fronleichnam']
  ].forEach(function(item){
    const dt=new Date(easter.getTime()+item[0]*86400000);
    h.push({date:`${year}-${('0'+(dt.getMonth()+1)).slice(-2)}-${('0'+dt.getDate()).slice(-2)}`,name:item[1]});
  });
  return h.sort(function(a,b){return String(a.date).localeCompare(String(b.date));});
}

function getHessenHolidays(year){
  return getHessenHolidayItems(year).map(function(item){return item.date;});
}

function getCustomPublicHolidayDates_(){
  return parseDateListSetting_(getSettingsMap_().custom_public_holidays||'');
}

function getPublicHolidayDatesForYear_(year){
  const seen={};
  const dates=getHessenHolidays(year).concat(getCustomPublicHolidayDates_().filter(function(date){
    return String(date).slice(0,4)===String(year);
  }));
  return dates.filter(function(date){
    if(seen[date]) return false;
    seen[date]=true;
    return true;
  }).sort();
}

function isWeekendOrHolidayBlocked_(dateStr,itemGroup){
  const settings=getSettingsMap_();
  const holidayOpenDates=parseDateListSetting_(settings.public_holiday_open_dates||'');
  const isOpenOverride=holidayOpenDates.indexOf(dateStr)>-1;
  /* 사장님이 지정한 휴무일(custom_holidays)은 **전 상품** 차단 — 부재중(예: 한국 일정)이면
     웨딩·기업 촬영도 불가능하다. 아래 주말/공휴일 정기휴무의 wed/biz 예외와 구분해야 한다:
     그건 "본식은 주말에 한다"는 정책이지 부재 사유가 아니다. */
  if(!isOpenOverride && parseDateListSetting_(settings.custom_holidays||'').indexOf(dateStr)>-1) return true;
  if(itemGroup==='wed'||itemGroup==='biz') return false;
  const year=new Date(`${dateStr}T00:00:00`).getFullYear();
  const isPublicHoliday=getPublicHolidayDatesForYear_(year).indexOf(dateStr)>-1;
  if(isOpenOverride && isPublicHoliday) return false;
  const day=new Date(`${dateStr}T00:00:00`).getDay();
  if(day===0||day===1) return true;
  if(isPublicHoliday) return true;
  return false;   // custom_holidays 는 위에서 이미 판정됨 (전 상품 공통)
}

function parseTimeBlock_(raw){
  const match=String(raw||'').trim().match(/^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$/);
  if(!match) return null;
  const startHour=parseInt(match[1],10),startMin=parseInt(match[2],10),endHour=parseInt(match[3],10),endMin=parseInt(match[4],10);
  if([startHour,endHour].some(v=>!isFinite(v)||v<0||v>23)) return null;
  if([startMin,endMin].some(v=>![0,15,30,45].includes(v))) return null;
  if(startHour*60+startMin>=endHour*60+endMin) return null;
  return {startHour,startMin,endHour,endMin};
}

function normalizeLegacyTimeBlocksSetting_(raw){
  return String(raw||'').trim().replace(/\b11:40\b/g,'11:30');
}

function parseTimeBlocksSetting_(raw,fallback){
  const source=normalizeLegacyTimeBlocksSetting_(raw);
  const fallbackSource=normalizeLegacyTimeBlocksSetting_(fallback);
  const blocks=(source||fallbackSource).split(',').map(parseTimeBlock_).filter(Boolean);
  if(blocks.length) return blocks;
  if(source&&fallbackSource&&source!==fallbackSource) return fallbackSource.split(',').map(parseTimeBlock_).filter(Boolean);
  return [];
}

function normalizeWeekdayBookingBlocks_(blocks){
  return (blocks||[]).map(block=>{
    const startMin=block.startHour*60+block.startMin;
    const endMin=block.endHour*60+block.endMin;
    if(startMin>=12*60||endMin<=WEEKDAY_MORNING_END_MIN) return block;
    if(startMin>=WEEKDAY_MORNING_END_MIN) return null;
    return {startHour:block.startHour,startMin:block.startMin,endHour:Math.floor(WEEKDAY_MORNING_END_MIN/60),endMin:WEEKDAY_MORNING_END_MIN%60};
  }).filter(Boolean);
}

function ensureWeekdayMorningBookingBlocks_(blocks){
  const normalized=normalizeWeekdayBookingBlocks_(blocks);
  const morningBlock={startHour:9,startMin:30,endHour:Math.floor(WEEKDAY_MORNING_END_MIN/60),endMin:WEEKDAY_MORNING_END_MIN%60};
  return mergeTimeBlocks_(normalized.concat([morningBlock]));
}

function blocksToSettingString_(blocks){
  return (blocks||[]).map(block=>`${formatHourMin_(block.startHour,block.startMin)}-${formatHourMin_(block.endHour,block.endMin)}`).join(',');
}

function roundDownToQuarterHour_(ms){
  const step=15*60000;
  return Math.floor(ms/step)*step;
}

function minutesToTimeBlock_(startMinutes,endMinutes){
  const safeStart=Math.max(0,startMinutes);
  const safeEnd=Math.min(24*60,endMinutes);
  if(safeEnd<=safeStart) return null;
  return {
    startHour:Math.floor(safeStart/60),
    startMin:safeStart%60,
    endHour:Math.floor(safeEnd/60),
    endMin:safeEnd%60
  };
}

function mergeTimeBlocks_(blocks){
  const ranges=(blocks||[]).map(block=>{
    if(!block) return null;
    const start=block.startHour*60+block.startMin;
    const end=block.endHour*60+block.endMin;
    if(end<=start) return null;
    return {start,end};
  }).filter(Boolean).sort((a,b)=>a.start-b.start);
  if(!ranges.length) return [];
  const merged=[ranges[0]];
  for(let i=1;i<ranges.length;i+=1){
    const current=ranges[i];
    const prev=merged[merged.length-1];
    if(current.start<=prev.end){
      prev.end=Math.max(prev.end,current.end);
      continue;
    }
    merged.push({start:current.start,end:current.end});
  }
  return merged.map(range=>minutesToTimeBlock_(range.start,range.end)).filter(Boolean);
}

function getStudioAutoOpenWindows_(events){
  const candidates=(events||[])
    .filter(ev=>isStudioAutoOpenEventByFields_(ev&&ev.title,ev&&ev.location,!!(ev&&ev.isPersonal)))
    .map(ev=>({start:ev.start,end:ev.end}))
    .sort((a,b)=>a.start-b.start);
  if(!candidates.length) return [];
  const merged=[candidates[0]];
  for(let i=1;i<candidates.length;i+=1){
    const current=candidates[i];
    const prev=merged[merged.length-1];
    if(current.start<=prev.end){
      prev.end=Math.max(prev.end,current.end);
      continue;
    }
    merged.push({start:current.start,end:current.end});
  }
  return merged;
}

function getLastStudioBookingEndMsForDate_(events){
  return (events||[])
    .filter(function(ev){
      if(!ev) return false;
      if(isStudioAutoOpenEventByFields_(ev.title,ev.location,!!ev.isPersonal)) return false;
      return isStudioPresenceEvent_(ev);
    })
    .reduce(function(maxEnd,ev){
      const endMs=Number(ev.end)||0;
      return endMs>maxEnd?endMs:maxEnd;
    },0);
}

function getStudioAutoOpenBlocksForDate_(dateStr,events){
  const windows=getStudioAutoOpenWindows_(events);
  if(!windows.length) return [];
  const dayStart=new Date(`${dateStr}T00:00:00`).getTime();
  const dayEnd=new Date(`${dateStr}T23:59:59`).getTime()+1000;
  const lastStudioBookingEndMs=getLastStudioBookingEndMsForDate_(events);
  const extendedEndMs=lastStudioBookingEndMs>0
    ? Math.min(dayEnd,lastStudioBookingEndMs+(30*60000))
    : 0;
  return windows.map(window=>{
    const start=roundUpToQuarterHour_(Math.max(window.start,dayStart));
    const effectiveWindowEnd=extendedEndMs>0?Math.max(window.end,extendedEndMs):window.end;
    const end=roundDownToQuarterHour_(Math.min(effectiveWindowEnd,dayEnd));
    if(end<=start) return null;
    return minutesToTimeBlock_(
      Math.floor((start-dayStart)/60000),
      Math.floor((end-dayStart)/60000)
    );
  }).filter(Boolean);
}

function getBookingTimeBlocksForDate_(dateStr,itemGroup,studioPresenceEvents){
  return applyMorningBlock_(dateStr,getBookingTimeBlocksForDateRaw_(dateStr,itemGroup,studioPresenceEvents));
}

function getBookingTimeBlocksForDateRaw_(dateStr,itemGroup,studioPresenceEvents){
  const baseBlocks=getTimeBlocksForDate_(dateStr,itemGroup);
  if(!isStudioAutoOpenEligibleGroup_(itemGroup)) return baseBlocks;
  const extraBlocks=getStudioAutoOpenBlocksForDate_(dateStr,studioPresenceEvents||[]);
  if(!extraBlocks.length) return baseBlocks;
  const todayStr=Utilities.formatDate(new Date(),CONFIG.TIMEZONE,'yyyy-MM-dd');
  if(dateStr===todayStr){
    return extraBlocks;
  }
  return mergeTimeBlocks_(baseBlocks.concat(extraBlocks));
}

function parseDateRangeListSetting_(raw){
  return String(raw||'').split(',').map(part=>part.trim()).filter(Boolean).map(function(part){
    let days=null;
    const dayMatch=part.match(/[\s(]+([일월화수목금토]{1,7})\)?$/);
    if(dayMatch){
      const parsed=dayMatch[1].split('').map(ch=>DAY_CHARS_.indexOf(ch));
      days=parsed.filter((d,i)=>parsed.indexOf(d)===i).sort((a,b)=>a-b);
      part=part.slice(0,dayMatch.index).trim();
    }
    const range=part.match(/^(\d{4}-\d{2}-\d{2})\s*[~–—]\s*(\d{4}-\d{2}-\d{2})$/);
    if(range){
      const from=range[1]<=range[2]?range[1]:range[2],to=range[1]<=range[2]?range[2]:range[1];
      return{from,to,days};
    }
    if(/^\d{4}-\d{2}-\d{2}$/.test(part)) return{from:part,to:part,days};
    return null;
  }).filter(Boolean);
}

function isMorningBlockedDate_(dateStr){
  const day=new Date(`${dateStr}T00:00:00`).getDay();
  return parseDateRangeListSetting_(getSettingsMap_().morning_block_ranges||'')
    .some(r=>dateStr>=r.from&&dateStr<=r.to&&(!r.days||!r.days.length||r.days.indexOf(day)>-1));
}

function applyMorningBlock_(dateStr,blocks){
  if(!blocks.length||!isMorningBlockedDate_(dateStr)) return blocks;
  const cut=MORNING_BLOCK_CUTOFF_MIN;
  return blocks.map(function(b){
    const start=b.startHour*60+b.startMin,end=b.endHour*60+b.endMin;
    if(end<=cut) return null;      // 통째로 오전 → 삭제
    if(start>=cut) return b;       // 통째로 오후 → 유지
    return {startHour:Math.floor(cut/60),startMin:cut%60,endHour:b.endHour,endMin:b.endMin};  // 걸침 → 13:00부터
  }).filter(Boolean);
}

function getLeadTimeCutoffMs_(dateStr,itemGroup,studioPresenceEvents){
  const now=Date.now();
  if(isStudioAutoOpenEligibleGroup_(itemGroup)){
    const autoOpenBlocks=getStudioAutoOpenBlocksForDate_(dateStr,studioPresenceEvents||[]);
    const todayStr=Utilities.formatDate(new Date(),CONFIG.TIMEZONE,'yyyy-MM-dd');
    if(autoOpenBlocks.length&&dateStr===todayStr){
      return roundUpToQuarterHour_(now);
    }
  }
  return now+(CONFIG.MIN_BOOKING_NOTICE_MIN*60000);
}

function getWeekdayBookingBlocks_(){
  const settings=getSettingsMap_();
  return ensureWeekdayMorningBookingBlocks_(parseTimeBlocksSetting_(settings.weekday_hours,DEFAULT_BOOKING_HOURS.weekday));
}

function getWeekdayBookingHours_(){
  return blocksToSettingString_(getWeekdayBookingBlocks_())||DEFAULT_BOOKING_HOURS.weekday;
}

function getSaturdayBookingBlocks_(){
  const settings=getSettingsMap_();
  return parseTimeBlocksSetting_(settings.saturday_hours,DEFAULT_BOOKING_HOURS.saturday);
}

function getSaturdayBookingHours_(){
  return blocksToSettingString_(getSaturdayBookingBlocks_())||DEFAULT_BOOKING_HOURS.saturday;
}

function parsePositiveNumberSetting_(value, fallback){
  const num = Number(value);
  return isFinite(num) && num > 0 ? num : fallback;
}

function parseRecommendationSlotMap_(rawValue){
  const result = {};
  const raw = String(rawValue || '').trim();
  if(!raw) return result;
  raw.split(';').map(function(entry){ return String(entry || '').trim(); }).filter(Boolean).forEach(function(entry){
    const parts = entry.split('=');
    if(parts.length < 2) return;
    const dateKey = String(parts[0] || '').trim();
    if(!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return;
    const times = String(parts.slice(1).join('=') || '')
      .split(',')
      .map(function(time){ return String(time || '').trim(); })
      .filter(function(time){ return /^\d{2}:\d{2}$/.test(time); });
    if(!times.length) return;
    result[dateKey] = new Set(times);
  });
  return result;
}

function getSlotRecommendationConfig_(){
  const settings = getSettingsMap_();
  return {
    beforeWindowMin: Math.round(parsePositiveNumberSetting_(settings.recommend_before_hours, SLOT_RECOMMENDATION_DEFAULTS.beforeHours) * 60),
    afterWindowMin: Math.round(parsePositiveNumberSetting_(settings.recommend_after_hours, SLOT_RECOMMENDATION_DEFAULTS.afterHours) * 60),
    maxRecommended: Math.max(0, Math.round(parsePositiveNumberSetting_(settings.recommend_max_slots, SLOT_RECOMMENDATION_DEFAULTS.maxRecommended))),
    manualIncludeByDate: parseRecommendationSlotMap_(settings.recommend_force_slots),
    manualExcludeByDate: parseRecommendationSlotMap_(settings.recommend_exclude_slots)
  };
}

function isPublicRecommendationAnchorEvent_(ev){
  if(!ev) return false;
  if(ev.isPersonal) return false;
  const title = String(ev.title || '').trim();
  if(!title) return false;
  if(isSelectPickupEventTitle_(title)) return false;
  if(title.indexOf(STUDIO_PRESENCE_EVENT_MARKER) >= 0) return false;
  if(/Studio Open|Studio Presence|Studio Available|스튜디오 오픈|스튜디오 상주/i.test(title)) return false;
  return true;
}

function isExternalRecommendationAnchorTitle_(title){
  const safeTitle = String(title || '').trim();
  if(!safeTitle) return false;
  if(/^\[상담:(외부|출장|원격|전화|화상)\]/.test(safeTitle)) return true;
  if(CONFIG.OUTDOOR_TITLE_KEYWORDS.some(function(kw){ return safeTitle.indexOf(kw) >= 0; })) return true;
  return /기업\s*\/\s*행사|기업행사|Corporate\s*\/\s*Event|Corporate Event|Firmenevent|Eventshooting/i.test(safeTitle);
}

function formatTimeKeyFromMs_(ms){
  const date = new Date(ms);
  return `${('0'+date.getHours()).slice(-2)}:${('0'+date.getMinutes()).slice(-2)}`;
}

function buildRecommendationAnchorLabel_(ev){
  if(!ev) return '';
  return `${formatTimeKeyFromMs_(ev.start)}–${formatTimeKeyFromMs_(ev.end)}`;
}

function isRecommendationEligibleGroup_(itemGroup){
  return itemGroup === 'pass' || itemGroup === 'prof' || itemGroup === 'stud';
}

function buildPublicSlotEntries_(dateStr, availableSlots, totalDur, detailedEvents, itemGroup){
  const config = getSlotRecommendationConfig_();
  const recommendationEnabled = isRecommendationEligibleGroup_(itemGroup);
  const anchors = (detailedEvents || [])
    .filter(isPublicRecommendationAnchorEvent_)
    .filter(function(ev){
      return !isExternalRecommendationAnchorTitle_(ev && ev.title);
    })
    .sort(function(a,b){ return a.start - b.start; });
  const manualInclude = config.manualIncludeByDate[dateStr] || new Set();
  const manualExclude = config.manualExcludeByDate[dateStr] || new Set();
  const totalDurMs = Number(totalDur || 0) * 60000;
  const entries = (availableSlots || []).map(function(time){
    const startMs = new Date(`${dateStr}T${time}:00`).getTime();
    const endMs = startMs + totalDurMs;
    let nearest = null;
    anchors.forEach(function(ev){
      let distanceMin = null;
      let edge = '';
      if(endMs <= ev.start){
        distanceMin = Math.round((ev.start - endMs) / 60000);
        edge = 'before';
        if(distanceMin > config.beforeWindowMin) return;
      }else if(startMs >= ev.end){
        distanceMin = Math.round((startMs - ev.end) / 60000);
        edge = 'after';
        if(distanceMin > config.afterWindowMin) return;
      }else{
        return;
      }
      if(!nearest || distanceMin < nearest.distanceMin || (distanceMin === nearest.distanceMin && ev.start < nearest.start)){
        nearest = {
          distanceMin: distanceMin,
          edge: edge,
          start: ev.start,
          end: ev.end,
          title: String(ev.title || '')
        };
      }
    });
    return {
      time: time,
      endTime: formatTimeKeyFromMs_(endMs),
      status: 'request_only',
      confirmationMode: 'manual_review_required',
      fastConfirm: false,
      manualReviewRequired: true,
      distanceMin: nearest ? nearest.distanceMin : '',
      anchorWindow: nearest ? buildRecommendationAnchorLabel_(nearest) : '',
      anchorTitle: nearest ? nearest.title : '',
      recommendationSource: '',
      _candidate: !!nearest,
      _manualInclude: manualInclude.has(time),
      _manualExclude: manualExclude.has(time)
    };
  });

  const manualRecommendedTimes = new Set(entries.filter(function(entry){
    return entry._manualInclude;
  }).map(function(entry){
    return entry.time;
  }));

  const autoCandidates = entries
    .filter(function(entry){
      return entry._candidate && !entry._manualInclude && !entry._manualExclude;
    })
    .sort(function(a,b){
      const diff = (Number(a.distanceMin) || 9999) - (Number(b.distanceMin) || 9999);
      if(diff) return diff;
      return String(a.time).localeCompare(String(b.time));
    });

  const autoLimit = config.maxRecommended <= 0 ? autoCandidates.length : Math.max(0, config.maxRecommended - manualRecommendedTimes.size);
  const autoRecommendedTimes = new Set(autoCandidates.slice(0, autoLimit).map(function(entry){
    return entry.time;
  }));

  entries.forEach(function(entry){
    const recommended = recommendationEnabled && (entry._manualInclude || autoRecommendedTimes.has(entry.time));
    if(recommended){
      entry.status = 'recommended';
      entry.confirmationMode = 'fast_confirmation_pending';
      entry.fastConfirm = true;
      entry.manualReviewRequired = false;
      entry.recommendationSource = entry._manualInclude ? 'manual_override' : 'nearby_booking';
    }else{
      entry.status = 'request_only';
      entry.confirmationMode = 'manual_review_required';
      entry.fastConfirm = false;
      entry.manualReviewRequired = true;
      entry.recommendationSource = recommendationEnabled && entry._manualExclude ? 'manual_exclude' : '';
      if(!recommendationEnabled){
        entry.distanceMin = '';
        entry.anchorWindow = '';
        entry.anchorTitle = '';
      }
    }
    delete entry._candidate;
    delete entry._manualInclude;
    delete entry._manualExclude;
  });

  return entries.sort(function(a,b){
    return String(a.time).localeCompare(String(b.time));
  });
}

function getTimeBlocksForDate_(dateStr,itemGroup){
  const day=new Date(`${dateStr}T00:00:00`).getDay();
  if(itemGroup==='wed'||itemGroup==='biz') return[{startHour:8,startMin:0,endHour:22,endMin:0}];
  if(day>=2&&day<=5) return getWeekdayBookingBlocks_();
  if(day===6) return getSaturdayBookingBlocks_();
  return[];
}

function computeSlots_(dateStr,events,totalDur,itemGroup,newLocation,studioPresenceEvents){
  const slotSet={},loc=newLocation||'';
  const leadTimeCutoff=getLeadTimeCutoffMs_(dateStr,itemGroup,studioPresenceEvents);
  getBookingTimeBlocksForDate_(dateStr,itemGroup,studioPresenceEvents).forEach(b=>{
    const bs=new Date(`${dateStr}T${('0'+b.startHour).slice(-2)}:${('0'+b.startMin).slice(-2)}:00`).getTime();
    const be=new Date(`${dateStr}T${('0'+b.endHour).slice(-2)}:${('0'+b.endMin).slice(-2)}:00`).getTime();
    for(let t=bs;t<be;t+=15*60000){
      if(t<leadTimeCutoff||t+totalDur*60000>be) continue;
      if(!checkConflict_(events,t,t+totalDur*60000,itemGroup,loc)){
        const dt=new Date(t);
        const key=`${('0'+dt.getHours()).slice(-2)}:${('0'+dt.getMinutes()).slice(-2)}`;
        slotSet[key]=true;
      }
    }
  });
  return Object.keys(slotSet).sort();
}

function getUnavailableDays(year,month,totalDur,itemGroup,lightMode){
  const ver=getCalCacheVer_(),cacheKey=`unavail_v13_${ver}_${year}_${month}_${itemGroup}_${totalDur}`;
  const cache=CacheService.getScriptCache();
  try{const h=cache.get(cacheKey);if(h)return JSON.parse(h);}catch(e){}
  const unavail=[],closed=[],slotCounts={},slotsByDate={},daysInMonth=new Date(year,month+1,0).getDate();
  const events=getCachedMonthEvents_(year,month,false);   // 표시 경로 — 월 이벤트 캐시(가드 아님, 신선도 동일)
  if(CAL_READ_FAILED_){
    /* 한 번의 월간 조회 실패가 한 달 전체를 '전부 가용'으로 오염시키고 30분 캐시로 굳는 게 최악의
       경로였다. 못 읽었으면 전 일자 마감으로 응답하고 캐시(월간·일별 프리시드 모두)는 심지 않는다
       — 다음 요청이 회복된 캘린더로 즉시 정상 계산한다. */
    const allDays=[];
    for(let d=1;d<=daysInMonth;d++){allDays.push(`${year}-${('0'+(month+1)).slice(-2)}-${('0'+d).slice(-2)}`);}
    return {unavail:allDays,closed:[],slotCounts:{},slotsByDate:{},calReadFailed:true};
  }
  const useStudioAutoOpen=isStudioAutoOpenEligibleGroup_(itemGroup);
  const detailedEvents=useStudioAutoOpen?getCachedMonthEvents_(year,month,true):[];   // 표시 경로 — 캐시 재사용
  const detailedEventsByDate={};
  if(useStudioAutoOpen){
    detailedEvents.forEach(ev=>{
      const dateKey=Utilities.formatDate(new Date(ev.start),CONFIG.TIMEZONE,'yyyy-MM-dd');
      if(!detailedEventsByDate[dateKey]) detailedEventsByDate[dateKey]=[];
      detailedEventsByDate[dateKey].push(ev);
    });
  }
  const now=new Date().getTime();
  const slotsTTL=Math.min(getAvailabilityCacheTtlSec_(itemGroup),CONFIG.UNAVAIL_CACHE_TTL_SEC);
  for(let d=1;d<=daysInMonth;d++){
    const dStr=`${year}-${('0'+(month+1)).slice(-2)}-${('0'+d).slice(-2)}`;
    const isPast=new Date(`${dStr}T23:59:59`).getTime()<now;
    const isOutOfRange=isBeyondPublicBookingRange_(dStr);
    const studioPresenceEvents=useStudioAutoOpen?(detailedEventsByDate[dStr]||[]):[];
    const hasStudioAutoOpenBlocks=useStudioAutoOpen&&getStudioAutoOpenBlocksForDate_(dStr,studioPresenceEvents).length>0;
    const isClosed=isWeekendOrHolidayBlocked_(dStr,itemGroup)&&!hasStudioAutoOpenBlocks;
    if(isPast||isOutOfRange){unavail.push(dStr);continue;}
    if(isClosed){unavail.push(dStr);closed.push(dStr);continue;}
    const daySlots=lightMode?null:computeSlots_(dStr,events,totalDur,itemGroup,'',studioPresenceEvents);
    const hasSlots=lightMode?hasAnySlot_(dStr,events,totalDur,itemGroup,'',studioPresenceEvents):!!daySlots.length;
    if(!hasSlots){unavail.push(dStr);}else if(daySlots){
      slotCounts[dStr]=daySlots.length;
      slotsByDate[dStr]=daySlots;
      const sKey=`slots_v11_${ver}_${dStr}_${itemGroup}_${totalDur}`;
      try{cache.put(sKey,JSON.stringify(daySlots),slotsTTL);}catch(e){}
    }
  }
  const result={unavail,closed,slotCounts,slotsByDate};
  const unavailTtl=isStudioAutoOpenEligibleGroup_(itemGroup)?120:CONFIG.UNAVAIL_CACHE_TTL_SEC;
  try{cache.put(cacheKey,JSON.stringify(result),unavailTtl);}catch(e){}
  return result;
}

function hasAnySlot_(dateStr,events,totalDur,itemGroup,newLocation,studioPresenceEvents){
  const loc=newLocation||'';
  const leadTimeCutoff=getLeadTimeCutoffMs_(dateStr,itemGroup,studioPresenceEvents);
  return getBookingTimeBlocksForDate_(dateStr,itemGroup,studioPresenceEvents).some(b=>{
    const bs=new Date(`${dateStr}T${('0'+b.startHour).slice(-2)}:${('0'+b.startMin).slice(-2)}:00`).getTime();
    const be=new Date(`${dateStr}T${('0'+b.endHour).slice(-2)}:${('0'+b.endMin).slice(-2)}:00`).getTime();
    for(let t=bs;t<be;t+=15*60000){
      if(t<leadTimeCutoff||t+totalDur*60000>be) continue;
      if(!checkConflict_(events,t,t+totalDur*60000,itemGroup,loc)) return true;
    }
    return false;
  });
}

function isSelectPickupEventTitle_(title){
  return String(title||'').indexOf(SELECT_PICKUP_EVENT_PREFIX)===0;
}

function isStudioLocation_(location){
  const safe=String(location||'').toLowerCase().replace(/[\s,.-]/g,'');
  if(!safe) return false;
  return safe.indexOf('holzwegpassage3')>=0
    || safe.indexOf('61440oberursel')>=0
    || safe.indexOf('holzwegpassgae3')>=0;
}

function isStudioPresenceEvent_(ev){
  const isPersonal=!!(ev&&ev.isPersonal);
  if(isPersonal) return false;
  const safeTitle=String(ev&&ev.title||'');
  if(!safeTitle||isSelectPickupEventTitle_(safeTitle)) return false;
  /* ⚠️ 부재(야외) 판정을 **위치보다 먼저** 본다. 수기/MRT 예약 이벤트에는 스튜디오 주소가
     location 으로 박히는 경우가 있어, 위치를 먼저 믿으면 야외 촬영이 "재실"로 둔갑한다 —
     2026-08-30(일) MRT 야외촬영 시간에 픽업 슬롯이 열려 실제 예약이 들어온 사고(차수진 16:00).
     픽업 가능 시간 = 사장님이 스튜디오에 머무는 시간(사장님 규칙 2026-08-16). */
  if(CONFIG.OUTDOOR_TITLE_KEYWORDS.some(kw=>safeTitle.indexOf(kw)>=0)) return false;
  if(/기업|행사|영상|Corporate|Event|Video|Firmen|Individualangebot/i.test(safeTitle)) return false;
  if(/마이리얼트립|리얼트립|MRT|출장/i.test(safeTitle)) return false;
  if(isStudioLocation_(ev&&ev.location)) return true;
  if(/여권|비자|Passfoto|Passport|passport/i.test(safeTitle)) return true;
  return /프로필|profile|Profil|스튜디오|studio|가족|family|커플|couple|백일|돌|baby/i.test(safeTitle);
}

function getBusyEventsDetailedForRange_(start,end){
  const events=[];
  const personalCalNames=new Set(CONFIG.PERSONAL_CALENDAR_NAMES);
  getBusyCalendarIds_().forEach(id=>{
    try{
      const cal=CalendarApp.getCalendarById(id);
      if(!cal) return;
      const isPersonal=personalCalNames.has(cal.getName());
      cal.getEvents(start,end).forEach(ev=>{
        if(ev.isAllDayEvent()) return;
        events.push({
          id:ev.getId()||'',
          start:ev.getStartTime().getTime(),
          end:ev.getEndTime().getTime(),
          title:ev.getTitle()||'',
          location:ev.getLocation()||'',
          isPersonal
        });
      });
    }catch(e){
      Logger.log('pickup calendar detail error: '+e.message);
    }
  });
  try{
    getManagedStudioPresenceDetailedEvents_(start,end).forEach(function(ev){
      events.push(ev);
    });
  }catch(e){
    Logger.log('pickup managed studio presence error: '+e.message);
  }
  try{
    getStudioPresenceCalendarDetailedEvents_(start,end).forEach(function(ev){
      events.push(ev);
    });
  }catch(e){
    Logger.log('pickup direct studio presence error: '+e.message);
  }
  const props=PropertiesService.getScriptProperties().getProperties();
  const hasIcloud=Object.keys(props).some(k=>k==='ICLOUD_CAL_URL'||k==='ICLOUD_ICS_URL'||/^ICLOUD_(CAL|ICS)_URL_\d+$/.test(k));
  if(hasIcloud){
    try{
      fetchAppleCalendarDetailedEvents_(start,end).forEach(ev=>events.push(ev));
    }catch(e){
      Logger.log('pickup icloud detail error: '+e.message);
    }
  }
  return events;
}

function roundUpToQuarterHour_(ms){
  const step=15*60000;
  return Math.ceil(ms/step)*step;
}

const WIDERRUF_TEXT_=/* WIDERRUF_TEXT:BEGIN */
{
  "version": "WB-2026-09",
  "url": "https://booking.studio-mean.com/widerruf/",
  "de": {
    "intro": "Verbraucherinnen und Verbrauchern (§ 13 BGB) steht ein Widerrufsrecht nach Maßgabe der folgenden Widerrufsbelehrung zu.",
    "title": "Widerrufsbelehrung",
    "sections": [
      {
        "h": "Widerrufsrecht",
        "ps": [
          "Sie haben das Recht, binnen vierzehn Tagen ohne Angabe von Gründen diesen Vertrag zu widerrufen.",
          "Die Widerrufsfrist beträgt vierzehn Tage ab dem Tag des Vertragsabschlusses.",
          "Um Ihr Widerrufsrecht auszuüben, müssen Sie uns (Studio mean, Inhaber Taewoong Min, Holzweg-Passage 3, 61440 Oberursel, Telefon: +49 176 6093 9400, E-Mail: studio.mean.de@gmail.com) mittels einer eindeutigen Erklärung (z. B. ein mit der Post versandter Brief oder eine E-Mail) über Ihren Entschluss, diesen Vertrag zu widerrufen, informieren. Sie können dafür das beigefügte Muster-Widerrufsformular verwenden, das jedoch nicht vorgeschrieben ist.",
          "Sie können Ihr Widerrufsrecht auch online unter https://booking.studio-mean.com/widerruf/ ausüben. Wenn Sie diese Online-Funktion nutzen, übermitteln wir Ihnen auf einem dauerhaften Datenträger (z. B. durch eine E-Mail) unverzüglich eine Eingangsbestätigung mit Informationen zum Inhalt der Widerrufserklärung sowie dem Datum und der Uhrzeit ihres Eingangs.",
          "Zur Wahrung der Widerrufsfrist reicht es aus, dass Sie die Mitteilung über die Ausübung des Widerrufsrechts vor Ablauf der Widerrufsfrist absenden."
        ]
      },
      {
        "h": "Folgen des Widerrufs",
        "ps": [
          "Wenn Sie diesen Vertrag widerrufen, haben wir Ihnen alle Zahlungen, die wir von Ihnen erhalten haben, einschließlich der Lieferkosten (mit Ausnahme der zusätzlichen Kosten, die sich daraus ergeben, dass Sie eine andere Art der Lieferung als die von uns angebotene, günstigste Standardlieferung gewählt haben), unverzüglich und spätestens binnen vierzehn Tagen ab dem Tag zurückzuzahlen, an dem die Mitteilung über Ihren Widerruf dieses Vertrags bei uns eingegangen ist. Für diese Rückzahlung verwenden wir dasselbe Zahlungsmittel, das Sie bei der ursprünglichen Transaktion eingesetzt haben, es sei denn, mit Ihnen wurde ausdrücklich etwas anderes vereinbart; in keinem Fall werden Ihnen wegen dieser Rückzahlung Entgelte berechnet.",
          "Haben Sie verlangt, dass die Dienstleistungen während der Widerrufsfrist beginnen soll, so haben Sie uns einen angemessenen Betrag zu zahlen, der dem Anteil der bis zu dem Zeitpunkt, zu dem Sie uns von der Ausübung des Widerrufsrechts hinsichtlich dieses Vertrags unterrichten, bereits erbrachten Dienstleistungen im Vergleich zum Gesamtumfang der im Vertrag vorgesehenen Dienstleistungen entspricht."
        ]
      }
    ],
    "noteTitle": "Vorzeitiges Erlöschen des Widerrufsrechts",
    "note": "Ihr Widerrufsrecht erlischt vorzeitig mit der vollständigen Erbringung der Dienstleistung, wenn Sie vor Beginn der Erbringung ausdrücklich zugestimmt haben, dass wir mit der Erbringung der Dienstleistung vor Ablauf der Widerrufsfrist beginnen, und Ihre Kenntnis davon bestätigt haben, dass Ihr Widerrufsrecht mit vollständiger Vertragserfüllung durch uns erlischt.",
    "formTitle": "Muster-Widerrufsformular",
    "formNote": "(Wenn Sie den Vertrag widerrufen wollen, dann füllen Sie bitte dieses Formular aus und senden Sie es zurück.)",
    "form": [
      "– An Studio mean, Inhaber Taewoong Min, Holzweg-Passage 3, 61440 Oberursel, studio.mean.de@gmail.com:",
      "– Hiermit widerrufe(n) ich/wir (*) den von mir/uns (*) abgeschlossenen Vertrag über den Kauf der folgenden Waren (*)/die Erbringung der folgenden Dienstleistung (*)",
      "– Bestellt am (*)/erhalten am (*)",
      "– Name des/der Verbraucher(s)",
      "– Anschrift des/der Verbraucher(s)",
      "– Unterschrift des/der Verbraucher(s) (nur bei Mitteilung auf Papier)",
      "– Datum",
      "(*) Unzutreffendes streichen."
    ],
    "earlyStart": "Ich verlange ausdrücklich, dass Studio mean vor Ablauf der Widerrufsfrist mit der Ausführung der gebuchten Leistung (dem Shooting) beginnt. Mir ist bekannt, dass ich bei einem Widerruf einen angemessenen Betrag für die bis dahin erbrachten Leistungen zahlen muss und dass mein Widerrufsrecht mit vollständiger Vertragserfüllung durch Studio mean erlischt.",
    "passNote": "Die Terminreservierung für Pass- und Visafotos ist unverbindlich und kostenfrei. Der Vertrag über die Aufnahmen kommt erst vor Ort im Studio zustande; bis dahin entstehen Ihnen keine Kosten, auch wenn Sie den Termin nicht wahrnehmen. Bitte sagen Sie den Termin ab, wenn Sie nicht kommen können.",
    "stornoNote": "Das gesetzliche Widerrufsrecht für Verbraucherinnen und Verbraucher (siehe Widerrufsbelehrung) bleibt unberührt und geht dieser Staffel innerhalb der Widerrufsfrist vor.",
    "statement": "Hiermit widerrufe ich den von mir abgeschlossenen Vertrag.",
    "withdrawLabel": "Vertrag widerrufen",
    "confirmLabel": "Widerruf bestätigen",
    "earlyStartRetouch": "Ich verlange ausdrücklich, dass Studio mean vor Ablauf der Widerrufsfrist mit der bestellten Zusatzretusche beginnt. Mir ist bekannt, dass ich bei einem Widerruf einen angemessenen Betrag für die bis dahin erbrachten Leistungen zahlen muss und dass mein Widerrufsrecht mit vollständiger Vertragserfüllung durch Studio mean erlischt.",
    "printNoWiderruf": "Für Abzüge, Rahmen und Fotokarten, die nach Ihrer Auswahl angefertigt werden, besteht kein Widerrufsrecht (§ 312g Abs. 2 Nr. 1 BGB).",
    "orderButton": "Zahlungspflichtig bestellen",
    "bookButton": "Zahlungspflichtig buchen",
    "vatIncluded": "inkl. MwSt.",
    "selectContract": "Zusatzbestellung aus der Fotoauswahl (Retusche/Abzüge)"
  },
  "ko": {
    "intro": "소비자(독일 민법 제13조)에게는 아래 철회 안내에 따른 철회권이 있습니다.",
    "title": "철회 안내",
    "bindingNote": "참고 번역입니다. 법적 효력은 아래 독일어 원문(Widerrufsbelehrung)에 있습니다.",
    "sections": [
      {
        "h": "철회권",
        "ps": [
          "귀하는 이유를 밝히지 않고 14일 이내에 이 계약을 철회할 권리가 있습니다.",
          "철회기간은 계약 체결일로부터 14일입니다.",
          "철회권을 행사하려면 계약을 철회하겠다는 결정을 명확한 의사표시(예: 우편으로 보낸 편지 또는 이메일)로 저희(Studio mean, Inhaber Taewoong Min, Holzweg-Passage 3, 61440 Oberursel, 전화 +49 176 6093 9400, 이메일 studio.mean.de@gmail.com)에게 알려 주셔야 합니다. 함께 드리는 철회 서식을 쓰실 수 있지만 의무는 아닙니다.",
          "https://booking.studio-mean.com/widerruf/ 에서 온라인으로도 철회하실 수 있습니다. 이 온라인 기능을 이용하시면 철회 내용과 접수 날짜·시각이 담긴 수신 확인을 지체 없이 영구 보관이 가능한 매체(예: 이메일)로 보내 드립니다.",
          "철회기간을 지키려면 기간이 끝나기 전에 철회 통지를 보내시는 것으로 충분합니다."
        ]
      },
      {
        "h": "철회의 효과",
        "ps": [
          "이 계약을 철회하시면 저희는 귀하에게서 받은 모든 대금을 배송비를 포함하여(저희가 제공하는 가장 저렴한 기본 배송 대신 다른 배송 방식을 고르셔서 생긴 추가 비용은 제외) 철회 통지가 저희에게 도착한 날부터 지체 없이, 늦어도 14일 안에 돌려드립니다. 반환은 처음 결제하실 때와 같은 결제수단으로 하며, 따로 명시적으로 합의한 경우는 예외입니다. 반환 때문에 귀하에게 수수료가 부과되는 일은 없습니다.",
          "철회기간 중에 서비스를 시작해 달라고 요청하셨다면, 철회를 알려 주신 시점까지 이미 제공된 서비스가 계약상 전체 서비스에서 차지하는 비율만큼 적정한 금액을 저희에게 지불하셔야 합니다."
        ]
      }
    ],
    "noteTitle": "철회권의 조기 소멸",
    "note": "서비스가 시작되기 전에, 철회기간이 끝나기 전에 서비스를 시작하는 데 명시적으로 동의하고 계약이 완전히 이행되면 철회권이 소멸한다는 점을 확인하셨다면, 서비스가 완전히 제공되는 때 철회권은 기간보다 먼저 소멸합니다.",
    "formTitle": "철회 서식 (Muster-Widerrufsformular)",
    "formNote": "(계약을 철회하시려면 이 서식을 작성해 보내 주세요. 법정 서식이라 독일어 원문 그대로 싣습니다.)",
    "earlyStart": "철회기간(14일)이 끝나기 전에 Studio mean 이 예약한 서비스(촬영)를 시작해 줄 것을 명시적으로 요청합니다. 철회하면 그때까지 제공된 서비스에 대한 적정 금액을 지불해야 하고, Studio mean 이 계약을 완전히 이행하면 철회권이 소멸한다는 점을 알고 있습니다.",
    "passNote": "여권·비자 사진 예약은 무료이며 구속력이 없습니다. 촬영 계약은 스튜디오 현장에서 성립하며, 그 전까지는 예약 시간에 오지 못하셔도 비용이 생기지 않습니다. 오지 못하시게 되면 예약을 취소해 주세요.",
    "stornoNote": "소비자의 법정 철회권(철회 안내 참조)은 이 규정과 관계없이 보장되며, 철회기간 안에는 이 환불 규정보다 우선합니다.",
    "statement": "본인이 체결한 계약을 철회합니다.",
    "withdrawLabel": "계약 철회 · Vertrag widerrufen",
    "confirmLabel": "철회 확정 · Widerruf bestätigen",
    "earlyStartRetouch": "철회기간(14일)이 끝나기 전에 Studio mean 이 주문한 추가 보정을 시작해 줄 것을 명시적으로 요청합니다. 철회하면 그때까지 제공된 서비스에 대한 적정 금액을 지불해야 하고, Studio mean 이 계약을 완전히 이행하면 철회권이 소멸한다는 점을 알고 있습니다.",
    "printNoWiderruf": "고르신 사진으로 만드는 인화·액자·포토카드는 맞춤 제작품이라 철회권이 없습니다(독일 민법 제312g조 제2항 제1호).",
    "orderButton": "결제 의무가 있는 주문하기",
    "bookButton": "결제 의무가 있는 예약하기",
    "vatIncluded": "부가세 포함",
    "selectContract": "셀렉 추가 주문(추가 보정·인화)"
  },
  "en": {
    "intro": "Consumers (Section 13 German Civil Code, BGB) have a right of withdrawal in accordance with the following instructions.",
    "title": "Withdrawal instructions",
    "bindingNote": "Courtesy translation. The German original (Widerrufsbelehrung) below is legally binding.",
    "sections": [
      {
        "h": "Right of withdrawal",
        "ps": [
          "You have the right to withdraw from this contract within 14 days without giving any reason.",
          "The withdrawal period will expire after 14 days from the day of the conclusion of the contract.",
          "To exercise the right of withdrawal, you must inform us (Studio mean, Inhaber Taewoong Min, Holzweg-Passage 3, 61440 Oberursel, Germany, phone +49 176 6093 9400, email studio.mean.de@gmail.com) of your decision to withdraw from this contract by an unequivocal statement (e.g. a letter sent by post or an email). You may use the attached model withdrawal form, but it is not obligatory.",
          "You can also exercise your right of withdrawal online at https://booking.studio-mean.com/widerruf/. If you use this online function, we will send you an acknowledgement of receipt on a durable medium (e.g. by email) without delay, containing the content of your withdrawal statement and the date and time of its receipt.",
          "To meet the withdrawal deadline, it is sufficient for you to send your communication concerning your exercise of the right of withdrawal before the withdrawal period has expired."
        ]
      },
      {
        "h": "Effects of withdrawal",
        "ps": [
          "If you withdraw from this contract, we shall reimburse to you all payments received from you, including the costs of delivery (with the exception of the supplementary costs resulting from your choice of a type of delivery other than the least expensive type of standard delivery offered by us), without undue delay and in any event not later than 14 days from the day on which we are informed about your decision to withdraw from this contract. We will carry out such reimbursement using the same means of payment as you used for the initial transaction, unless you have expressly agreed otherwise; in any event, you will not incur any fees as a result of such reimbursement.",
          "If you requested to begin the performance of services during the withdrawal period, you shall pay us an amount which is in proportion to what has been provided until you have communicated us your withdrawal from this contract, in comparison with the full coverage of the contract."
        ]
      }
    ],
    "noteTitle": "Early expiry of the right of withdrawal",
    "note": "Your right of withdrawal expires early upon complete performance of the service if, before performance began, you expressly consented to us beginning the service before the end of the withdrawal period and acknowledged that your right of withdrawal expires once we have fully performed the contract.",
    "formTitle": "Model withdrawal form (Muster-Widerrufsformular)",
    "formNote": "(Complete and return this form only if you wish to withdraw from the contract. It is a statutory form and is reproduced in the German original.)",
    "earlyStart": "I expressly request that Studio mean begin the booked service (the shoot) before the withdrawal period ends. I understand that if I withdraw, I must pay a reasonable amount for the services provided up to that point, and that my right of withdrawal expires once Studio mean has fully performed the contract.",
    "passNote": "Reservations for passport and visa photos are free and non-binding. The contract for the photos is only concluded on site at the studio; until then no costs arise, even if you do not attend. Please cancel your reservation if you cannot come.",
    "stornoNote": "Consumers' statutory right of withdrawal (see the withdrawal instructions) remains unaffected and takes precedence over this schedule during the withdrawal period.",
    "statement": "I hereby withdraw from the contract I concluded.",
    "withdrawLabel": "Withdraw from contract · Vertrag widerrufen",
    "confirmLabel": "Confirm withdrawal · Widerruf bestätigen",
    "earlyStartRetouch": "I expressly request that Studio mean begin the ordered additional retouching before the withdrawal period ends. I understand that if I withdraw, I must pay a reasonable amount for the services provided up to that point, and that my right of withdrawal expires once Studio mean has fully performed the contract.",
    "printNoWiderruf": "Prints, frames and photo cards made from the photos you select are made to your specification, so there is no right of withdrawal (Section 312g(2) no. 1 German Civil Code).",
    "orderButton": "Order with obligation to pay",
    "bookButton": "Book with obligation to pay",
    "vatIncluded": "incl. VAT",
    "selectContract": "Additional order from the photo selection (retouching/prints)"
  }
}/* WIDERRUF_TEXT:END */;

function buildSelectLegalPayload_(){
  const W=WIDERRUF_TEXT_,out={version:W.version,url:W.url};
  ['ko','en','de'].forEach(function(l){
    const t=W[l];
    out[l]={earlyStartRetouch:t.earlyStartRetouch,printNoWiderruf:t.printNoWiderruf,orderButton:t.orderButton,vatIncluded:t.vatIncluded,withdrawLabel:t.withdrawLabel,title:t.title};
  });
  return out;
}

function buildSelectWithdrawUrl_(bookingRowIndex,bookingRow){
  const base=WIDERRUF_TEXT_.url+'?what=select';
  if(!(bookingRowIndex>=2)||!bookingRow) return base;
  try{return WIDERRUF_TEXT_.url+'?ref='+encodeURIComponent(createBookingRowActionRef_(bookingRowIndex,bookingRow))+'&what=select';}
  catch(e){return base;}
}

function bookingRowActionSeedPart_(v){
  if(Object.prototype.toString.call(v)==='[object Date]') return Utilities.formatDate(v,CONFIG.TIMEZONE,'yyyy-MM-dd HH:mm:ss');
  return String(v==null?'':v).trim();
}

function bookingRowActionTokenFromSeed_(seed){
  const secret=PropertiesService.getScriptProperties().getProperty('ACTION_SECRET')||'studio-mean-action';
  return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(seed,secret)).replace(/=+$/g,'').slice(0,18);
}

function bookingRowActionToken_(row){
  const seed=[
    bookingRowActionSeedPart_(row[BOOKING_COL['고객명']]),
    bookingRowActionSeedPart_(row[BOOKING_COL['연락처']]),
    bookingRowActionSeedPart_(row[BOOKING_COL['이메일']]).toLowerCase(),
    bookingRowActionSeedPart_(row[BOOKING_COL['동의시각']])
  ].join('|');
  return bookingRowActionTokenFromSeed_(seed);
}

function createBookingRowActionRef_(rowIndex,row){
  return `row:${rowIndex}:${bookingRowActionToken_(row)}`;
}

function findBookingProductMeta_(products,itemGroup,productName){
  const g=String(itemGroup||'').trim();
  const name=String(productName||'').trim();
  if(!g||!name) return null;
  return (products||[]).find(function(p){
    return String(p.g||'').trim()===g && [p.nameKo,p.nameEn,p.nameDe,p.id].some(function(v){
      return String(v||'').trim()===name;
    });
  })||null;
}

const SELECT_SHEET_NAME='사진셀렉';

const SELECT_HEADERS=['세션ID','생성일시','고객명','이메일','연락처','촬영일','촬영종류','상품','기본보정수','리터칭단가','언어','드라이브링크','예약장부행','제출일시','선택사진','추가보정수','추가보정금액','추가인화','추가인화금액','마케팅동의','총추가금액','상태','재발송횟수','재발송일시','어드민알림','보정본발송일시','셀렉마감일','1차알림일','2차알림일','3차알림일','최종알림단계','재수정요청횟수','추가금인보이스번호','보정후안내메일발송일시','수령방식','픽업일시','우편주소','픽업캘린더ID','페이지버전','재수정요청메모','재수정요청이력JSON','포토카드선택','마케팅보너스수','서비스컷수','고객출력주문JSON','고객출력주문일시','고객출력주문상태','출력완료일시','출력완료매수','픽업안내메일발송일시','수령완료일시','수령방법','수령메모','픽업리마인드발송일시','픽업리마인드횟수','수령직전상태','별점JSON','압축본링크','추가보정조기이행요청'];

const SELECT_COL=SELECT_HEADERS.reduce((acc,h,i)=>{acc[h]=i;return acc;},{});

function normalizeSelectPageVersion_(value){
  return String(value||'').toLowerCase().trim()==='v2' ? 'v2' : 'classic';
}

function getDefaultSelectMarketingBonusCount_(itemGroup,productName,payMethod){
  const haystack=[itemGroup,productName,payMethod].map(function(v){return String(v||'').trim();}).join(' ').toLowerCase();
  if(/myrealtrip|my real trip|마이리얼트립/.test(haystack)) return 5;
  return 2;
}

function selectIsMyRealTrip_(itemGroup,productName,payMethod){
  const haystack=[itemGroup,productName,payMethod].map(function(v){return String(v||'').trim();}).join(' ').toLowerCase();
  return /myrealtrip|my real trip|마이리얼트립/.test(haystack);
}

function selectOutputExcludedByText_(text){
  return /출력물\s*없음|인화\s*없음|프린트\s*없음|우편\s*없음|배송\s*없음|디지털\s*(전용|만|only)|파일\s*(전용|만)|원본\s*전달\s*만|digital\s*only|files?\s*only|no\s*prints?|prints?\s*not\s*included|without\s*prints?|ohne\s*(druck|ausdruck|abzug)|kein(?:e|en)?\s*(druck|ausdruck|abzug)|nur\s*(digital|datei|dateien)/i.test(String(text||''));
}

function selectTextHasPhysicalOutput_(text){
  const value=String(text||'');
  if(selectOutputExcludedByText_(value)) return false;
  return /출력|인화|프린트|우편발송|배송|print|prints|printed|druck|ausdruck|abzug|fotokarte|포토카드|photocard|photo card|10\s*[×x]\s*15|6\s*[×x]\s*4|a[34]\b/i.test(value);
}

function getSelectProductMeta_(itemGroup,productName){
  try{
    return findBookingProductMeta_(getCachedProducts_().concat(getPromoProducts_()),itemGroup,productName);
  }catch(e){
    return null;
  }
}

function buildSelectProductText_(itemGroup,productName,productMeta){
  return [
    itemGroup,
    productName,
    productMeta&&productMeta.id,
    productMeta&&productMeta.nameKo,
    productMeta&&productMeta.nameEn,
    productMeta&&productMeta.nameDe,
    productMeta&&productMeta.descKo,
    productMeta&&productMeta.descEn,
    productMeta&&productMeta.descDe
  ].map(function(v){return String(v||'').trim();}).filter(Boolean).join(' ');
}

const SELECT_INCLUDED_PRINT_QUOTA_BY_PRODUCT_={
  pb:[{id:'basic_10x15',qty:1}],
  pbus:[{id:'basic_10x15',qty:2}],
  pp:[{id:'basic_10x15',qty:3}],
  sb:[{id:'basic_a4',qty:1},{id:'basic_10x15',qty:2}],
  sp:[{id:'basic_a4',qty:1},{id:'basic_10x15',qty:4}],
  sprm:[{id:'basic_a4',qty:1},{id:'basic_10x15',qty:6}],
  ob:[{id:'basic_10x15',qty:5}],
  op:[{id:'basic_10x15',qty:7}],       // 2026-08-07 사장님 확정 (이전 빈값 → 포함 인화 없음으로 취급됐다)
  oprm:[{id:'basic_10x15',qty:10}],    // 〃
  wp:[{id:'premium_a3',qty:1},{id:'basic_a4',qty:2},{id:'basic_10x15',qty:3}],
  wprm:[{id:'premium_a3',qty:1},{id:'basic_a4',qty:2},{id:'basic_10x15',qty:3}],
  amtp:[{id:'basic_10x15',qty:15}]
};

function normalizeSelectProductKeyText_(value){
  return String(value||'').toLowerCase().replace(/\s+/g,'').replace(/[._\-()［］\[\]{}+]/g,'');
}

function getSelectProductKey_(itemGroup,productName){
  const productMeta=getSelectProductMeta_(itemGroup,productName);
  if(productMeta&&productMeta.id) return String(productMeta.id||'').trim();
  const group=String(itemGroup||'').trim().toLowerCase();
  const text=normalizeSelectProductKeyText_(productName);
  if(group==='prof'){
    if(/professional|프로필professional|프로페셔널/.test(text)) return 'pp';
    if(/business|프로필business|비즈니스/.test(text)) return 'pbus';
    if(/basic|프로필basic|베이직/.test(text)) return 'pb';
  }
  if(group==='stud'){
    if(/premium|프리미엄/.test(text)) return 'sprm';
    if(/plus|플러스/.test(text)) return 'sp';
    if(/basic|베이직/.test(text)) return 'sb';
  }
  if(group==='snap'){
    if(/premium|프리미엄/.test(text)) return 'oprm';
    if(/plus|플러스/.test(text)) return 'op';
    if(/basic|베이직/.test(text)) return 'ob';
  }
  if(group==='wed'){
    if(/premium|프리미엄/.test(text)) return 'wprm';
    if(/plus|플러스/.test(text)) return 'wp';
  }
  if(group==='biz'&&/(암트결혼식사진촬영|civilweddingphoto|standesamtfoto)/.test(text)) return 'amtp';
  return '';
}

function getSelectIncludedPrintQuota_(itemGroup,productName){
  const key=getSelectProductKey_(itemGroup,productName);
  const quota=SELECT_INCLUDED_PRINT_QUOTA_BY_PRODUCT_[key];
  if(!quota) return null;
  return quota.map(function(item){return{id:item.id,qty:parseInt(item.qty,10)||0};});
}

function selectProductHasFixedPrintQuota_(itemGroup,productName){
  const key=getSelectProductKey_(itemGroup,productName);
  return key&&Object.prototype.hasOwnProperty.call(SELECT_INCLUDED_PRINT_QUOTA_BY_PRODUCT_,key);
}

function selectSessionRequiresDelivery_(itemGroup,productName,payMethod){
  if(selectIsMyRealTrip_(itemGroup,productName,payMethod)) return false;
  if(selectProductHasFixedPrintQuota_(itemGroup,productName)){
    const quota=getSelectIncludedPrintQuota_(itemGroup,productName)||[];
    return quota.some(function(item){return Number(item.qty)>0;});
  }
  const productMeta=getSelectProductMeta_(itemGroup,productName);
  const text=buildSelectProductText_(itemGroup,productName,productMeta);
  if(selectOutputExcludedByText_(text)) return false;
  return selectTextHasPhysicalOutput_(text);
}

function normalizeSelectMarketingBonusCount_(value,itemGroup,productName,payMethod){
  if(value!==undefined&&value!==null&&String(value).trim()!==''){
    const n=parseInt(value,10);
    return isNaN(n)||n<0 ? 0 : n;
  }
  return getDefaultSelectMarketingBonusCount_(itemGroup,productName,payMethod);
}

function formatDriveSizeShort_(bytes){
  const n=Number(bytes)||0;
  if(n>=1024*1024*1024)return(n/(1024*1024*1024)).toFixed(1)+'GB';
  if(n>=1024*1024)return Math.round(n/(1024*1024))+'MB';
  return Math.max(1,Math.round(n/1024))+'KB';
}

function listSelectZipBundle_(folderRef){
  const folderId=_extractDriveFolderId_(folderRef);
  if(!folderId)return[];
  const cache=CacheService.getScriptCache();
  const key='selzips:v1:'+folderId;
  const cached=cache.get(key);
  if(cached){try{return JSON.parse(cached);}catch(e){}}
  const out=[];
  try{
    const it=DriveApp.getFolderById(folderId).getFiles();
    while(it.hasNext()&&out.length<40){
      const f=it.next();
      const name=String(f.getName()||'');
      if(!/\.zip$/i.test(name))continue;
      const id=f.getId();
      out.push({
        id:id,
        name:name,
        bytes:Number(f.getSize())||0,
        size:formatDriveSizeShort_(Number(f.getSize())||0),
        // uc?export=download 는 대용량에서 바이러스 검사 안내가 한 번 끼지만 "그래도 다운로드"로 이어진다.
        download:'https://drive.google.com/uc?export=download&id='+encodeURIComponent(id),
        view:'https://drive.google.com/file/d/'+encodeURIComponent(id)+'/view'
      });
    }
  }catch(e){return[];} // 폴더를 못 읽으면 없는 것으로 — 셀렉페이지는 기존 버튼으로 폴백
  out.sort(function(a,b){return String(a.name).localeCompare(String(b.name),undefined,{numeric:true});});
  try{cache.put(key,JSON.stringify(out),900);}catch(e){}
  return out;
}

function isSelectFinalLockedStatus_(status){
  const s=String(status||'').trim();
  return ['최종작업완료','작업완료'].indexOf(s)>-1;
}

function selectJsonArrayHasItems_(raw){
  try{
    const parsed=JSON.parse(String(raw||'[]'));
    return Array.isArray(parsed)&&parsed.length>0;
  }catch(e){
    return false;
  }
}

function hasSelectSubmittedContent_(row){
  if(!row) return false;
  if(String(row[SELECT_COL['제출일시']]||'').trim()) return true;
  if(selectJsonArrayHasItems_(row[SELECT_COL['선택사진']])) return true;
  if(selectJsonArrayHasItems_(row[SELECT_COL['추가인화']])) return true;
  if(String(row[SELECT_COL['포토카드선택']]||'').trim()) return true;
  return false;
}

function buildSubmittedSelectSessionPayload_(row,base){
  let existingPhotos=[],existingPrints=[],existingPhotocard=null;
  try{existingPhotos=JSON.parse(String(row[SELECT_COL['선택사진']]||'[]'));}catch(e){}
  try{existingPrints=JSON.parse(String(row[SELECT_COL['추가인화']]||'[]'));}catch(e){}
  try{existingPhotocard=parseSelectPhotocard_(row[SELECT_COL['포토카드선택']]);}catch(e){}
  return {
    ok:false,
    submitted:true,
    canEdit:true,
    status:String(row[SELECT_COL['상태']]||''),
    ...base,
    existingPhotos,
    existingPrints,
    existingPhotocard,
    existingMarketing:String(row[SELECT_COL['마케팅동의']]||'N')
  };
}

function getSelectSession(sessionId){
  try{
    const _t0=Date.now(); const _timing={};
    const bundle=getSheetsReadonly_();
    _timing.sheets=Date.now()-_t0;
    const sh=bundle.ss.getSheetByName(SELECT_SHEET_NAME);
    if(!sh)return{ok:false,message:'준비 중입니다.'};
    const rows=sh.getDataRange().getValues();
    _timing.read=Date.now()-_t0;
    const row=rows.slice(1).find(r=>String(r[0])===String(sessionId));
    if(!row)return{ok:false,message:'유효하지 않은 링크입니다.'};
    // 예약장부에서 마케팅 동의 여부 확인 (이미 동의했으면 셀렉 페이지에서 재요청 불필요)
    let bookingMarketing='';
    let bookingAddress='';
    let bookingPayMethod='';
    let selectWithdrawUrl=buildSelectWithdrawUrl_(0,null);
    try{
      const bri=parseInt(row[SELECT_COL['예약장부행']])||0;
      if(bri>=2){
        const bookSh=bundle.bookingSheet;
        const bRow=bookSh.getRange(bri,1,1,bookSh.getLastColumn()).getValues()[0];
        selectWithdrawUrl=buildSelectWithdrawUrl_(bri,bRow);
        bookingMarketing=String(bRow[BOOKING_COL['마케팅동의']]||'');
        bookingAddress=String(bRow[BOOKING_COL['고객주소']]||'');
        bookingPayMethod=String(bRow[BOOKING_COL['결제수단']]||'');
      }
    }catch(e){}
    _timing.booking=Date.now()-_t0;
    const productMeta=getSelectProductMeta_(row[SELECT_COL['촬영종류']],row[SELECT_COL['상품']]);
    _timing.meta=Date.now()-_t0;
    const productDescription=String((productMeta&&(productMeta.descKo||productMeta.descEn||productMeta.descDe))||'');
    const existingMail=parseSelectMailAddressText_(row[SELECT_COL['우편주소']],row[SELECT_COL['고객명']]);
    const base={
      name:row[SELECT_COL['고객명']],
      email:row[SELECT_COL['이메일']],
      date:parseDateSafe_(row[SELECT_COL['촬영일']]).str.slice(0,10),
      itemGroup:row[SELECT_COL['촬영종류']],
      product:row[SELECT_COL['상품']],
      productDescription:productDescription,
      baseRetouchCount:parseInt(row[SELECT_COL['기본보정수']])||0,
      retouchPrice:parseInt(row[SELECT_COL['리터칭단가']])||10,
      volumeTiers:{retouch:getSelectVolumeTiers_('retouch'),print:getSelectVolumeTiers_('print')},
      existingRatings:(function(){
        try{
          if(SELECT_COL['별점JSON']==null) return {};
          const parsed=JSON.parse(String(row[SELECT_COL['별점JSON']]||'{}'));
          return (parsed&&typeof parsed==='object'&&!Array.isArray(parsed))?parsed:{};
        }catch(e){return {};}
      })(),
      marketingBonusCount:normalizeSelectMarketingBonusCount_(row[SELECT_COL['마케팅보너스수']],row[SELECT_COL['촬영종류']],row[SELECT_COL['상품']],bookingPayMethod),
      serviceCutCount:Math.max(0,parseInt(row[SELECT_COL['서비스컷수']],10)||0),
      lang:row[SELECT_COL['언어']]||'ko',
      driveLink:row[SELECT_COL['드라이브링크']]||'',
      zipFolderLink:SELECT_COL['압축본링크']!=null?String(row[SELECT_COL['압축본링크']]||''):'',
      zips:SELECT_COL['압축본링크']!=null?listSelectZipBundle_(row[SELECT_COL['압축본링크']]):[],
      bookingMarketing,
      bookingAddress,
      deadline:String(row[SELECT_COL['셀렉마감일']]||''),
      revisionCount:parseInt(row[SELECT_COL['재수정요청횟수']])||0,
      extraInvoiceNumber:String(row[SELECT_COL['추가금인보이스번호']]||''),
      pageVersion:normalizeSelectPageVersion_(row[SELECT_COL['페이지버전']]),
      existingDeliveryMethod:String(row[SELECT_COL['수령방식']]||''),
      existingPickupAt:parseDateSafe_(row[SELECT_COL['픽업일시']]).str.slice(0,16), // 시트 Date 자동변환 정규화

      existingMailName:existingMail.mailName,
      existingMailAddress:existingMail.mailAddress,
      existingMailAddressRaw:String(row[SELECT_COL['우편주소']]||''),
      existingPickupEventId:String(row[SELECT_COL['픽업캘린더ID']]||''),
      hasPhotocard:selectHasIncludedPhotocard_(row),
      requiresDelivery:selectSessionRequiresDelivery_(row[SELECT_COL['촬영종류']],row[SELECT_COL['상품']],bookingPayMethod),
      photocardSupported:true,
      printOrderStatus:SELECT_COL['고객출력주문상태']!=null?String(row[SELECT_COL['고객출력주문상태']]||''):'',
      printOrderSubmittedAt:SELECT_COL['고객출력주문일시']!=null?parseDateSafe_(row[SELECT_COL['고객출력주문일시']]).str:'',
      printDoneAt:SELECT_COL['출력완료일시']!=null?parseDateSafe_(row[SELECT_COL['출력완료일시']]).str:'',
      printDoneCount:SELECT_COL['출력완료매수']!=null?(parseInt(row[SELECT_COL['출력완료매수']],10)||0):0,
      handoverAt:SELECT_COL['수령완료일시']!=null?parseDateSafe_(row[SELECT_COL['수령완료일시']]).str.slice(0,16):'',
      // 유료 추가 주문의 법정 문구(서버 정본) + 하단 「Vertrag widerrufen」 링크 — docs/select-widerruf-plan.md
      legal:buildSelectLegalPayload_(),
      withdrawUrl:selectWithdrawUrl
    };
    _timing.build=Date.now()-_t0;
    base._timing=_timing;
    const rawStatus=String(row[SELECT_COL['상태']]||'').trim();
    if(hasSelectSubmittedContent_(row)){
      if(isSelectFinalLockedStatus_(rawStatus)){
        /* 마감된 세션 — 쓰기는 계속 막되(제출·수정·픽업예약·우편전환 가드는 그대로), 읽기는 안내가 되게 한다.
           맨 {ok:false,message} 로 내려보내면 api-select 가 throw 로 바꿔 셀렉 v2 는 오류 패널,
           픽업 페이지는 빨간 배너(언어 교체 전이라 EN/DE 고객도 한국어)를 본다.
           수령 기록이 이제 자동으로 마감을 찍으므로 픽업 고객 전원이 그 화면을 만나게 된다.
           submitted 를 붙여 프론트가 정상 응답으로 받게 하고, finalLocked 로 완료 화면을 띄우게 한다.
           필드는 최소한만 — 열린 세션이 이미 주는 것보다 적게(주소·이메일·보정 선택내역 제외).
           단 existingPrints 는 남긴다: 인화앱이 재인화 주문을 이 필드로 읽으므로(print/app.js
           select-session → existingPrints), 빼면 마감된 건은 사장님이 재인화를 못 건다. */
        let lockedPrints=[];
        try{lockedPrints=JSON.parse(String(row[SELECT_COL['추가인화']]||'[]'));}catch(e){}
        return{
          ok:false,submitted:true,finalLocked:true,
          lang:base.lang,name:base.name,driveLink:base.driveLink,
          zipFolderLink:base.zipFolderLink,zips:base.zips, // 마감 후에도 원본 내려받기는 열어 둔다
          handoverAt:base.handoverAt,
          existingDeliveryMethod:base.existingDeliveryMethod,
          existingPrints:Array.isArray(lockedPrints)?lockedPrints:[],
          // 인화앱의 '이미 출력한 세션입니다' 재인화 경고가 이 두 필드로 뜬다. 빼면 경고가 가장 필요한
          // 케이스(이미 건네준 건)에서만 조용히 사라져 중복 출력이 난다.
          printDoneAt:base.printDoneAt,printDoneCount:base.printDoneCount,
          message:'최종 작업이 완료되어 수정 제출이 마감되었습니다.'
        };
      }
      return buildSubmittedSelectSessionPayload_(row,base);
    }
    return{ok:true,...base};
  }catch(e){return{ok:false,message:e.message};}
}

const SELECT_VOLUME_TIER_DEFAULTS_={retouch:'5:10,10:15,20:20',print:'5:10,10:15,20:20'};

function getSelectVolumeTiers_(kind){
  const key='select_volume_discount_'+String(kind||'');
  let raw='';
  try{ raw=String(getSettingsMap_()[key]||'').trim(); }catch(e){}
  if(!raw) raw=SELECT_VOLUME_TIER_DEFAULTS_[kind]||'';
  const tiers=[];
  raw.split(',').forEach(function(tok){
    const m=String(tok||'').trim().match(/^(\d+)\s*:\s*(\d+)$/);
    if(!m) return;
    const count=parseInt(m[1],10),pct=parseInt(m[2],10);
    // 퍼센트 상한 50 — 설정 오타(예: 10:90)가 매출을 반토막 내지 않게 방어
    if(count>0&&pct>0&&pct<=50) tiers.push({count:count,percent:pct});
  });
  tiers.sort(function(a,b){return a.count-b.count;});
  return tiers;
}

function selectHasIncludedPhotocard_(row){
  const text=String((row&&row[SELECT_COL['상품']]||'')+' '+(row&&row[SELECT_COL['촬영종류']]||'')).toLowerCase();
  return /포토카드|photocard|photo card|fotokarte/.test(text);
}

function parseSelectPhotocard_(raw){
  if(!raw) return null;
  if(typeof raw==='object') return raw;
  try{
    const parsed=JSON.parse(String(raw||''));
    return parsed&&typeof parsed==='object'?parsed:null;
  }catch(e){
    return null;
  }
}

function normalizeSelectMailAddress_(value){
  return String(value||'')
    .replace(/\r\n?/g,'\n')
    .split('\n')
    .map(function(line){return line.replace(/\s+/g,' ').trim();})
    .filter(Boolean)
    .join('\n');
}

function normalizeSelectMailName_(value){
  return String(value||'').replace(/\s+/g,' ').trim();
}

function parseSelectMailAddressText_(value,fallbackName){
  let lines=normalizeSelectMailAddress_(value).split('\n').filter(Boolean);
  let mailName='';
  if(lines.length){
    const nameMatch=lines[0].match(/^(?:수령인|받으실\s*분\s*성함|성함|recipient|name|empf[aä]nger(?:in)?)\s*[:：]\s*(.+)$/i);
    if(nameMatch){
      mailName=normalizeSelectMailName_(nameMatch[1]);
      lines=lines.slice(1);
    }
  }
  if(lines.length){
    const addressMatch=lines[0].match(/^(?:주소|배송\s*주소|address|adresse)\s*[:：]\s*(.*)$/i);
    if(addressMatch){
      lines[0]=addressMatch[1]||'';
    }
  }
  return {
    mailName:mailName||normalizeSelectMailName_(fallbackName),
    mailAddress:normalizeSelectMailAddress_(lines.join('\n'))
  };
}

function warmupCacheTrigger(){
  /* **이벤트 캐시** 프리워밍 — 슬롯의 진짜 병목은 캘린더 다중읽기(~5s)다. 이벤트는 totalDur 무관이라
     달당 한 번만 데우면 **모든 콤보·모든 날짜**의 슬롯이 그 위에서 fresh 하게 빠르게 계산된다
     (getCachedMonthEvents_). 3개월 × (이벤트+상세) = 6읽기로 끝 — 예전 콤보별 슬롯 워밍(~200읽기)이
     예산 터뜨려 month+2 굶던 문제가 원천 해소. 세션 내 다중 날짜 클릭은 첫 조회가 이미 캐시를 채워 항상
     빠름. 트리거 5분·이벤트 TTL 120초라 첫 클릭 커버는 부분적이지만, 캐시 자체가 다중날짜를 커버한다. */
  const now=new Date();
  for(let offset=0;offset<3;offset++){
    const d=new Date(now.getFullYear(),now.getMonth()+offset,1);
    try{
      getCachedMonthEvents_(d.getFullYear(),d.getMonth(),false);
      getCachedMonthEvents_(d.getFullYear(),d.getMonth(),true);
    }catch(e){ Logger.log('warmup events '+d.getFullYear()+'-'+(d.getMonth()+1)+': '+e.message); }
  }
  _pingWebAppWarmup_();
}

function _pingWebAppWarmup_(){
  try{
    const now=new Date();
    const h=Number(Utilities.formatDate(now,CONFIG.TIMEZONE,'H'));
    const m=Number(Utilities.formatDate(now,CONFIG.TIMEZONE,'m'));
    if(h<8||h>=22) return;
    if(m%10>=5) return;
    const url=GAS_LIVE_EXEC_URL_+'?api=warmup&_ts='+Date.now();
    const res=UrlFetchApp.fetch(url,{muteHttpExceptions:true,followRedirects:true});
    Logger.log('warmup ping '+res.getResponseCode());
  }catch(e){ Logger.log('warmup ping skipped: '+e.message); }
}

const TRAVEL_KM_TABLE_=[
  {re:/bad\s*homburg|kur-?\s*und\s*kongress|바트\s*홈부르크/i, city:'바트홈부르크', km:8},
  {re:/steinbach|슈타인바흐/i,                  city:'슈타인바흐',   km:6},
  {re:/kronberg|k[öo]nigstein|oberursel|크론베르크|쾨니히슈타인|오버우어젤/i, city:'크론베르크·쾨니히슈타인', km:7},
  {re:/flughafen|fraport|airport|공항/i,        city:'프랑크푸르트 공항', km:25},
  {re:/messe|메세/i,                            city:'프랑크푸르트 메세',  km:20},
  {re:/frankfurt|프랑크푸르트/i,                city:'프랑크푸르트',      km:17},
  {re:/hanau|하나우/i,       city:'하나우',        km:40},
  {re:/wiesbaden|비스바덴/i, city:'비스바덴',      km:46},
  {re:/darmstadt|다름슈타트/i, city:'다름슈타트',  km:45},
  {re:/gie[sß]en|기센/i,     city:'기센',          km:45},
  {re:/mainz|마인츠/i,       city:'마인츠',        km:50},
  {re:/aschaffenburg|아샤펜부르크/i, city:'아샤펜부르크', km:75},
  {re:/marburg|마르부르크/i, city:'마르부르크',    km:80},
  {re:/heidelberg|하이델베르크/i, city:'하이델베르크', km:100},
  {re:/fulda|풀다/i,         city:'풀다',          km:105},
  {re:/koblenz|코블렌츠/i,   city:'코블렌츠',      km:125},
  {re:/k[öo]ln|cologne|쾰른/i, city:'쾰른',        km:170},
];

function travelKmLookup_(text){
  const t=String(text||'');
  for(let i=0;i<TRAVEL_KM_TABLE_.length;i++){
    if(TRAVEL_KM_TABLE_[i].re.test(t)) return TRAVEL_KM_TABLE_[i];
  }
  return null;
}

const SELECT_PHOTO_LIST_DEFAULT_LIMIT=300;

const SELECT_PHOTO_LIST_MAX_LIMIT=300;

const SELECT_PHOTO_LIST_TIME_BUDGET_MS=45000;

const SELECT_PHOTO_EXT_RE=/\.(jpe?g|png|webp|gif|heic|heif|tiff?|bmp|avif|dng|cr2|cr3|nef|nrw|arw|srf|sr2|raf|rw2|orf|srw|pef|x3f)$/i;

function listSelectPhotosPublic_(sessionId,options){
  const opts=options||{};
  const limit=Math.max(1,Math.min(parseInt(opts.limit,10)||SELECT_PHOTO_LIST_DEFAULT_LIMIT,SELECT_PHOTO_LIST_MAX_LIMIT));
  const recursive=opts.recursive!==false;
  const cache=CacheService.getScriptCache();
  const hasCursor=String(opts.cursor||'').trim()!=='';
  const key='selphotos:v5:'+sessionId+':'+limit+':'+(recursive?'r1':'r0')+':first';
  const cached=cache.get(key);
  if(!hasCursor&&cached){try{return JSON.parse(cached);}catch(e){}}
  const ss=ensureSheets_().ss;
  const sh=ss.getSheetByName(SELECT_SHEET_NAME);
  if(!sh) return{ok:false,message:'Session store unavailable'};
  const rows=sh.getDataRange().getValues();
  const row=rows.slice(1).find(r=>String(r[0])===String(sessionId));
  if(!row) return{ok:false,message:'Invalid session'};
  const driveLink=String(row[SELECT_COL['드라이브링크']]||'');
  const out=listDriveFolderPhotosPublic_(driveLink,{
    limit:limit,
    recursive:recursive,
    timeBudgetMs:opts.timeBudgetMs,
    cursor:opts.cursor,
    allowShare:true // 유효한 셀렉 세션의 폴더만 공개 열람 허용
  });
  if(!out||out.ok===false) return out||{ok:false,message:'Drive folder not linked'};
  if(!hasCursor){
    try{cache.put(key,JSON.stringify(out),900);}catch(e){} // 15min
  }
  return out;
}

function listDriveFolderPhotosPublic_(folderRef,options){
  const folderId=_extractDriveFolderId_(folderRef);
  if(!folderId) return{ok:false,message:'Drive folder not linked'};
  const opts=options||{};
  const recursive=opts.recursive!==false;
  const limit=Math.max(1,Math.min(parseInt(opts.limit,10)||SELECT_PHOTO_LIST_DEFAULT_LIMIT,SELECT_PHOTO_LIST_MAX_LIMIT));
  const timeBudgetMs=Math.max(3000,Math.min(parseInt(opts.timeBudgetMs,10)||SELECT_PHOTO_LIST_TIME_BUDGET_MS,SELECT_PHOTO_LIST_TIME_BUDGET_MS));
  const startedAt=Date.now();
  const cache=CacheService.getScriptCache();
  const rawCursor=String(opts.cursor||'').trim();
  const hasCursor=rawCursor!=='';
  const cacheKey='selphotos_folder:v5:'+folderId+':'+(recursive?'r1':'r0')+':'+limit+':first';
  const cached=cache.get(cacheKey);
  if(!hasCursor&&cached){try{return JSON.parse(cached);}catch(e){}}
  let folder;
  try{folder=DriveApp.getFolderById(folderId);}catch(e){return{ok:false,message:'Drive folder inaccessible'};}
  // 🔒 ACL 강제확장은 신뢰된 세션 경로(select-photos, allowShare:true)에서만 허용.
  // 임의 folder ID를 받는 공개 미리보기(select-photos-preview)는 폴더를 공개로 바꾸지 못하게 한다.
  if(opts.allowShare===true){
    try{
      // 이미 링크 공개면 쓰지 않는다(매 호출 setSharing 은 불필요한 쓰기). 셔틀(public-api, drive.readonly)은 넓히지 못하므로
      // 실패를 돌려 프런트가 메인(쓰기 가능)으로 폴백하게 한다 — 메인은 종전처럼 조용히 계속.
      if(folder.getSharingAccess()!==DriveApp.Access.ANYONE_WITH_LINK) folder.setSharing(DriveApp.Access.ANYONE_WITH_LINK,DriveApp.Permission.VIEW);
    }catch(e){
      if(typeof PUBLIC_API_READONLY_!=='undefined') return{ok:false,message:'Drive share pending'};
    }
  }
  const photos=[];
  const seenFiles=new Set();
  const state=_getSelectPhotoCursorState_(rawCursor,folderId,recursive);
  let partial=false;
  let scannedFolders=Number(state.scannedFolders||0)||0;
  try{
    while(photos.length<limit){
      if(Date.now()-startedAt>timeBudgetMs){partial=true;break;}
      if(!state.current){
        if(!state.queue||!state.queue.length)break;
        state.current=state.queue.shift();
        state.current.fileDone=!!state.current.fileDone;
        state.current.folderDone=recursive?!!state.current.folderDone:true;
        scannedFolders++;
      }
      const current=state.current;
      const currentFolder=DriveApp.getFolderById(current.id);
      const currentPath=current.path||[];

      if(!current.fileDone){
        const it=current.fileToken?DriveApp.continueFileIterator(current.fileToken):currentFolder.getFiles();
        while(it.hasNext()&&photos.length<limit){
          if(Date.now()-startedAt>timeBudgetMs){partial=true;break;}
          const f=it.next();
          const mime=String(f.getMimeType()||'');
          const fileName=String(f.getName()||'');
          if(!_isDrivePhotoFile_(mime,fileName)) continue;
          const fileId=f.getId();
          if(seenFiles.has(fileId)) continue;
          seenFiles.add(fileId);
          photos.push({
            id:fileId,
            name:fileName,
            folderName:currentFolder.getName(),
            folderPath:currentPath.join(' / '),
            mimeType:mime,
            thumb:_buildDriveThumbnailUrl_(fileId,480),
            thumbSet:[240,360,480,720,960].map(function(width){return _buildDriveThumbnailUrl_(fileId,width)+' '+width+'w';}).join(', '),
            full:_buildDriveThumbnailUrl_(fileId,1800),
            fallback:_buildDrivePublicImageUrl_(fileId),
            view:'https://drive.google.com/file/d/'+encodeURIComponent(fileId)+'/view'
          });
        }
        if(partial){
          if(it.hasNext()) current.fileToken=it.getContinuationToken();
          else{current.fileDone=true;delete current.fileToken;}
          break;
        }
        if(it.hasNext()){
          current.fileToken=it.getContinuationToken();
          break;
        }
        current.fileDone=true;
        delete current.fileToken;
        if(photos.length>=limit)break;
      }

      if(recursive&&!current.folderDone){
        const folders=current.folderToken?DriveApp.continueFolderIterator(current.folderToken):currentFolder.getFolders();
        while(folders.hasNext()){
          if(Date.now()-startedAt>timeBudgetMs){partial=true;break;}
          const child=folders.next();
          state.queue.push({
            id:child.getId(),
            path:currentPath.concat([child.getName()])
          });
        }
        if(partial){
          if(folders.hasNext()) current.folderToken=folders.getContinuationToken();
          else{current.folderDone=true;delete current.folderToken;}
          break;
        }
        current.folderDone=true;
        delete current.folderToken;
      }
      state.current=null;
    }
  }catch(e){return{ok:false,message:'Drive listing failed: '+e.message};}
  state.scannedFolders=scannedFolders;
  photos.sort((a,b)=>{
    const ap=String(a.folderPath||'');
    const bp=String(b.folderPath||'');
    if(ap!==bp)return ap.localeCompare(bp,undefined,{numeric:true,sensitivity:'base'});
    return String(a.name).localeCompare(String(b.name),undefined,{numeric:true,sensitivity:'base'});
  });
  const hasMore=!!(partial||state.current||(state.queue&&state.queue.length));
  const nextCursor=hasMore?_encodeSelectPhotoCursorState_(state):'';
  const out={
    ok:true,
    folderId,
    count:photos.length,
    recursive:recursive,
    partial:partial,
    truncated:hasMore,
    hasMore:hasMore,
    cursor:nextCursor,
    nextCursor:nextCursor,
    limit:limit,
    batchSize:limit,
    scannedFolders:scannedFolders,
    photos
  };
  if(!hasCursor){
    try{
      const raw=JSON.stringify(out);
      if(raw.length < 90000) cache.put(cacheKey,raw,900);
    }catch(e){}
  }
  return out;
}

function _getSelectPhotoCursorState_(rawCursor,rootFolderId,recursive){
  const fresh={
    v:1,
    rootFolderId:rootFolderId,
    recursive:!!recursive,
    queue:[{id:rootFolderId,path:[]}],
    current:null,
    scannedFolders:0
  };
  const decoded=_decodeSelectPhotoCursorState_(rawCursor);
  if(!decoded||decoded.v!==1)return fresh;
  if(String(decoded.rootFolderId||'')!==String(rootFolderId))return fresh;
  if(!!decoded.recursive!==!!recursive)return fresh;
  if(!Array.isArray(decoded.queue))decoded.queue=[];
  decoded.current=decoded.current||null;
  decoded.scannedFolders=Number(decoded.scannedFolders||0)||0;
  return decoded;
}

function _encodeSelectPhotoCursorState_(state){
  try{
    return Utilities.base64EncodeWebSafe(JSON.stringify(state));
  }catch(e){return'';}
}

function _decodeSelectPhotoCursorState_(rawCursor){
  if(!rawCursor)return null;
  try{
    const bytes=Utilities.base64DecodeWebSafe(String(rawCursor||''));
    return JSON.parse(Utilities.newBlob(bytes).getDataAsString());
  }catch(e){return null;}
}

function _isDrivePhotoFile_(mime,name){
  const m=String(mime||'').toLowerCase();
  if(m.indexOf('image/')===0) return true;
  return SELECT_PHOTO_EXT_RE.test(String(name||''));
}

function _buildDrivePublicImageUrl_(fileId){
  return 'https://drive.google.com/uc?export=view&id='+encodeURIComponent(String(fileId||'').trim());
}

function _buildDriveThumbnailUrl_(fileId,width){
  return 'https://drive.google.com/thumbnail?id='+encodeURIComponent(String(fileId||'').trim())+'&sz=w'+(parseInt(width,10)||480);
}

function _extractDriveFolderId_(url){
  if(!url)return'';
  const m1=String(url).match(/\/folders\/([A-Za-z0-9_-]{10,})/);
  if(m1)return m1[1];
  const m2=String(url).match(/[?&]id=([A-Za-z0-9_-]{10,})/);
  if(m2)return m2[1];
  const m3=String(url).match(/^([A-Za-z0-9_-]{15,})$/);
  if(m3)return m3[1];
  return'';
}
