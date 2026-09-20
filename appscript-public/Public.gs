/* ⚠️ 생성 파일 — 직접 수정 금지.
 * 정본: appscript/Code.gs. 재생성: node scripts/build-public-api.mjs
 * 생성 시각: 2026-09-20T15:45:14.026Z
 * 포함 함수 110개 / 상수 18개. 라우팅·인증·시트 해석은 Shim.gs 에 있다. */
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
    try{ const j=JSON.stringify(events); if(j.length<95000) cache.put(key,j,120); }catch(e){}
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

function isMyRealTripProduct_(item){
  if(!item) return false;
  const hay=[item.id,item.g,item.nameKo,item.nameEn,item.nameDe,item.descKo,item.descEn,item.descDe]
    .map(function(v){return String(v||'');}).join(' ');
  return /myrealtrip|my real trip|마이리얼트립/i.test(hay);
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
