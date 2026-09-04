/* ⚠️ 생성 파일 — 직접 수정 금지.
 * 정본: appscript/Code.gs (보드 경로). 재생성: node scripts/build-board-api.mjs
 * 생성 시각: 2026-09-04T18:59:16.670Z
 * 포함 함수 48개 / 상수 16개. 라우팅·인증·시트 해석은 Shim.gs 에 있다. */
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
  LEXWARE_PUSH_BATCH_MAX: 40,
  LEXWARE_STATUS_BATCH_MAX: 60,
  LEXWARE_BATCH_TIME_BUDGET_MS: 240000,
  LEXWARE_SYNC_GUARD_SEC: 900,
  LEXWARE_REQUEST_DELAY_MS: 650,
  MIN_BOOKING_NOTICE_MIN: 180,
  BUFFER_OUTDOOR_MIN: 60,
  BUFFER_STUDIO_MIN: 15,
  BUFFER_PASSPORT_MIN: 0,
  OUTDOOR_TITLE_KEYWORDS: ['야외','스냅','웨딩','결혼식','암트','행사','이벤트','snap','Snap','wedding','Wedding','outdoor','Outdoor','event','Event','Standesamt','civil','Civil'],
  BOOKING_HEADERS: ['예약일시','상태','고객명','연락처','이메일','언어','촬영종류','상품','옵션','인원','총결제액','계약금','잔금','결제수단','분위기','요청사항','캘린더ID','계약금수단','추가항목','재방문','잔금입금일','GDPR동의','마케팅동의','동의시각','변경요청','AI동의','고객주소','촬영후감사메일발송일시','돌촬영추천메일발송일시','계약금입금여부','계약금입금일','계약금입금금액','잔금결제여부','잔금결제금액','Lexware결제상태','Lexware동기화일시','확정일시','입금경고일시','자동취소일시','입금자명','사업자송장필요','사업자명','사업자주소','사업자VAT번호','사업자송장이메일','사업자송장참조','굿샤인코드','굿샤인차감금액','적용전총액','적용후총액','굿샤인적용일시','굿샤인적용방식','추천시간상태','확정처리모드','빠른확정가능','인접예약거리분','추천기준예약','수동확인필요','contract_terms_version','contract_terms_accepted','privacy_terms_accepted','accepted_at','accepted_language','selected_service','shooting_date','shooting_time','shooting_location','total_price_brutto','deposit_price_brutto','balance_price_brutto','프로필나이','가족구성','결제연결유형','결제연결그룹','결제연결행','결제분할내역','결제메모','예약유형','기념일추천메일발송일시','환불내역JSON','환불누계금액','추가일정JSON','샘플링크','샘플발송일시','부가세모드'],
  WALKIN_HEADERS: ['접수일시','상태','고객명','연락처','이메일','언어','서비스분류','서비스표시명','고객주소','입금자명','아기이름','요청사항','GDPR동의','AI동의','마케팅동의','사업자송장필요','사업자명','사업자주소','사업자VAT번호','사업자송장이메일','사업자송장참조','접수경로','연결예약행','관리메모','예약내용','촬영장소','희망일정','보안검증'],
  PRINT_HEADERS: ['주문일시','고객명','연락처','인화항목','보정항목','총수량','금액','결제수단','메모','상태','매출날짜'],
  EXPENSE_HEADERS: ['지출일','거래처','카테고리','설명','총액(Brutto)','순액(Netto)','부가세(Vorsteuer)','결제수단','메모','증빙링크','상태','회계분류','LexwareVoucherId','LexwareSyncStatus','LexwareSyncedAt'],
  TARGET_CALENDAR_NAMES: ['사진촬영 일정'],
  // '스케쥴/스케줄' 두 표기 모두 — 이름 정확일치로 매칭하므로 한 글자 다르면 개인 일정이 슬롯을 못 막는다
  PERSONAL_CALENDAR_NAMES: ['여보랑나랑', '태웅 개인스케줄', '태웅 개인스케쥴']
};

const BOOKING_COL=CONFIG.BOOKING_HEADERS.reduce((acc,h,i)=>{acc[h]=i;return acc;},{});

const BOOKING_STATUS_CANCELLED = '취소됨';

const STUDIO_ADDRESS = 'Holzweg-passage 3, 61440 Oberursel';

function normalizeBookingStatus_(status){
  return String(status||'').trim();
}

function isBookingCancelledStatus_(status){
  const s=normalizeBookingStatus_(status);
  return s===BOOKING_STATUS_CANCELLED || s==='자동취소';
}

function getPrintSheetColMap_(sh) {
  const headers = sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), CONFIG.PRINT_HEADERS.length)).getValues()[0] || [];
  const map = {};
  headers.forEach((h, i) => { if (h) map[String(h).trim()] = i; });
  return map;
}

function isPrintRowUnpaid_(normalized){
  const pm=String((normalized&&normalized.payMethod)||'').trim();
  if(!pm) return false;
  return /미결제|unpaid|offen/i.test(pm);
}

function printRowPayRequestedAt_(memo){
  const s=String(memo||'');
  const re=/\[결제요청(해제)?\]\s*(\d{4}-\d{2}-\d{2})?/g;
  let m,last=null;
  while((m=re.exec(s))) last=m;
  if(!last||last[1]) return '';
  return last[2]||'';
}

function normalizePrintRow_(row, rowIdx, colMap) {
  const hasLegacyHeader =
    colMap['매출날짜'] === 1 &&
    row[colMap['매출날짜']] &&
    !String(row[colMap['매출날짜']]).match(/^\d{4}-\d{2}-\d{2}/);

  if (hasLegacyHeader) {
    const legacyItems = String(row[4] || '').trim();
    const legacyRetouch = String(row[5] || '').trim();
    const legacyMemo = String(row[9] || '').trim();
    return {
      rowIdx,
      dateStr: parseDateSafe_(row[0]).str,
      salesDate: parseDateSafe_(row[1]).str.slice(0,10),
      name: String(row[2] || ''),
      phone: String(row[3] || ''),
      items: legacyItems || (legacyMemo && !/셀렉:/i.test(legacyMemo) ? legacyMemo : ''),
      retouchItems: legacyRetouch,
      qty: Number(row[6] || 0) || 0,
      total: Number(row[7] || 0) || 0,
      payMethod: String(row[8] || ''),
      memo: String(row[9] || ''),
      status: String(row[10] || '완료')
    };
  }

  const itemText = String(row[colMap['인화항목']] || '').trim();
  const retouchText = String(row[colMap['보정항목']] || '').trim();
  const memoText = String(row[colMap['메모']] || '').trim();
  return {
    rowIdx,
    dateStr: parseDateSafe_(row[colMap['주문일시']] || '').str,
    salesDate: String(row[colMap['매출날짜']] || '').trim(),
    name: String(row[colMap['고객명']] || ''),
    phone: String(row[colMap['연락처']] || ''),
    items: itemText || (memoText && !/셀렉:/i.test(memoText) ? memoText : ''),
    retouchItems: retouchText,
    qty: Number(row[colMap['총수량']] || 0) || 0,
    total: Number(row[colMap['금액']] || 0) || 0,
    payMethod: String(row[colMap['결제수단']] || ''),
    memo: String(row[colMap['메모']] || ''),
    status: String(row[colMap['상태']] || '완료')
  };
}

function getDbSheet() { return ensureSheets_().bookingSheet; }

function _inqDigits_(v){ return String(v==null?'':v).replace(/[^0-9]/g,''); }

function _inqPhoneKey_(v){
  const d=_inqDigits_(v);
  return d.length>=8 ? d.slice(-9) : '';
}

function _inqEmailKey_(v){
  const e=String(v==null?'':v).trim().toLowerCase();
  return e.indexOf('@')>0 ? e : '';
}

function _dashboardPrepLines_(memo){
  const raw=String(memo||'').trim();
  if(!raw) return [];
  const out=[];
  const bg=[];
  const tokens=raw.match(/\[[^\]]+\]/g)||[];
  tokens.forEach(function(t){
    const inner=t.slice(1,-1).trim();
    const sep=inner.indexOf(':');
    if(sep<0){ out.push(inner); return; }
    const key=inner.slice(0,sep).trim(), val=inner.slice(sep+1).trim();
    if(/^배경\d*$/.test(key)){ bg.push(val); return; }
    out.push(key+' '+val);
  });
  if(bg.length) out.unshift('배경 '+bg.join('·'));
  // 토큰 밖의 자유 서술(예: 아이 이름)도 남긴다
  const freeText=raw.replace(/\[[^\]]+\]/g,' ').replace(/\s+/g,' ').trim();
  if(freeText) out.push(freeText);
  return out;
}

const DAY_OPS_PREFIX_='dayops_';

const DAY_OPS_SHEET_NAME_='당일운영';

function _dayOpsKey_(dateStr){ return DAY_OPS_PREFIX_+String(dateStr||'').slice(0,10); }

function _dayOpsSheet_(create){
  const ss=ensureSheets_().ss;
  let sh=ss.getSheetByName(DAY_OPS_SHEET_NAME_);
  if(!sh&&create){
    sh=ss.insertSheet(DAY_OPS_SHEET_NAME_);
    sh.appendRow(['날짜','JSON']);
    sh.setFrozenRows(1);
    try{ sh.hideSheet(); }catch(e){}
  }
  return sh||null;
}

function _dayOpsCellDate_(v){ return parseDateSafe_(v).str.slice(0,10); }

function readDayOps_(dateStr){
  const d=String(dateStr||'').slice(0,10);
  try{
    const sh=_dayOpsSheet_(false);
    if(sh&&sh.getLastRow()>1){
      const rows=sh.getRange(2,1,sh.getLastRow()-1,2).getValues();
      /* 같은 날짜 행이 여러 개면(비교 결함 시절의 append 잔재) 오래된 것부터 병합 —
         갈라져 저장된 시작/종료 기록이 여기서 다시 합쳐진다. 새 행이 이긴다. */
      let merged=null;
      for(let i=0;i<rows.length;i++){
        if(_dayOpsCellDate_(rows[i][0])!==d) continue;
        let o=null;
        try{ o=JSON.parse(String(rows[i][1]||'{}')); }catch(e){ continue; }
        if(!o||typeof o!=='object') continue;
        if(!merged) merged={};
        Object.keys(o).forEach(function(k){ merged[k]=Object.assign(merged[k]||{},o[k]); });
      }
      if(merged) return merged;
    }
  }catch(e){}
  // 레거시 폴백 — 이전 배포에서 속성에 남은 오늘치가 사라지면 안 된다
  try{
    const raw=PropertiesService.getScriptProperties().getProperty(_dayOpsKey_(d));
    if(!raw) return {};
    const o=JSON.parse(raw);
    return (o&&typeof o==='object')?o:{};
  }catch(e){ return {}; }
}

function _hmToMin_(hm){
  const m=String(hm||'').match(/^(\d{1,2}):(\d{2})$/);
  if(!m) return null;
  return parseInt(m[1],10)*60+parseInt(m[2],10);
}

function _minToHm_(v){
  if(v==null) return '';
  const x=((v%1440)+1440)%1440;
  return String(Math.floor(x/60)).padStart(2,'0')+':'+String(x%60).padStart(2,'0');
}

const TODAY_BOARD_CACHE_SEC_=15;

function _todayBoardCacheKey_(d){ return 'todayboard_'+String(d||'').slice(0,10); }

function buildTodayBoardCached_(dateStr){
  const today=String(dateStr||'').match(/^\d{4}-\d{2}-\d{2}$/)
    ? dateStr : Utilities.formatDate(new Date(),CONFIG.TIMEZONE,'yyyy-MM-dd');
  const cache=CacheService.getScriptCache();
  const key=_todayBoardCacheKey_(today);
  try{
    const hit=cache.get(key);
    if(hit){ const o=JSON.parse(hit); o._cached=true; return o; }
  }catch(e){}
  const out=buildTodayBoard_(today);
  try{ cache.put(key,JSON.stringify(out),TODAY_BOARD_CACHE_SEC_); }catch(e){}
  return out;
}

function readPrepByBookingRow_(rowIndexes){
  const want={};
  (rowIndexes||[]).forEach(function(r){ want[String(r)]=null; });
  try{
    const ss=ensureSheets_().ss;
    const sh=ss.getSheetByName(PREP_SHEET_NAME);
    if(!sh||sh.getLastRow()<2) return want;
    const rows=sh.getRange(2,1,sh.getLastRow()-1,PREP_HEADERS.length).getValues();
    // 같은 예약에 여러 번 제출될 수 있어 마지막 것이 이긴다
    rows.forEach(function(r){
      const key=String(parseInt(r[PREP_COL['예약장부행']],10)||0);
      if(!(key in want)) return;
      want[key]={
        submittedAt:String(parseDateSafe_(r[PREP_COL['제출일시']]).str||'').slice(0,16),
        updatedAt:String(parseDateSafe_(r[PREP_COL['수정일시']]).str||'').slice(0,16),
        summary:String(r[PREP_COL['요약']]||'').trim(),
        refLinks:String(r[PREP_COL['참고링크']]||'')
          .split(/[\s,]+/).map(function(x){return x.trim();})
          .filter(function(x){return /^https?:\/\//i.test(x);}).slice(0,8)
      };
    });
  }catch(e){ Logger.log('prep lookup skipped: '+e.message); }
  return want;
}

function readPickupsForDate_(dateStr){
  const out=[];
  try{
    const ss=ensureSheets_().ss;
    const sh=ss.getSheetByName(SELECT_SHEET_NAME);
    if(!sh||sh.getLastRow()<2) return out;
    const rows=sh.getRange(2,1,sh.getLastRow()-1,sh.getLastColumn()).getValues();
    rows.forEach(function(r,i){
      const at=String(parseDateSafe_(r[SELECT_COL['픽업일시']]).str||'');
      if(at.slice(0,10)!==dateStr) return;
      const doneAt=String(parseDateSafe_(r[SELECT_COL['수령완료일시']]).str||'').slice(0,16);
      out.push({
        selectRowIndex:i+2,
        bookingRowIndex:parseInt(r[SELECT_COL['예약장부행']],10)||0,
        sessionId:String(r[SELECT_COL['세션ID']]||''),   // 앱에서 수령완료(select-handover-done) 처리용
        time:at.slice(11,16),
        name:String(r[SELECT_COL['고객명']]||''),
        product:String(r[SELECT_COL['상품']]||''),
        method:String(r[SELECT_COL['수령방식']]||''),
        status:String(r[SELECT_COL['상태']]||''),
        doneAt:doneAt,
        done:!!doneAt
      });
    });
    if(out.length){ const enrich=_selectPayContextReader_(); out.forEach(enrich); }
    out.sort(function(a,b){return String(a.time).localeCompare(String(b.time));});
  }catch(e){ Logger.log('pickup lookup skipped: '+e.message); }
  return out;
}

function _selectPayContextReader_(){
  const ss=ensureSheets_().ss;
  const bkSh=getDbSheet();
  let printSh=null;
  try{ printSh=ensureSheets_().printSheet||ss.getSheetByName(CONFIG.PRINT_SHEET); }catch(e){}
  let printData=null,pMap=null;
  const loadPrint_=function(){
    if(printData!==null||!printSh) return;
    try{ pMap=getPrintSheetColMap_(printSh); printData=printSh.getDataRange().getValues(); }
    catch(e){ printData=[]; Logger.log('select pay ctx print read skipped: '+e.message); }
  };
  return function(p){
    p.balanceDue=0;p.balancePaid=false;p.payMethod='';p.mrt=false;
    p.extraDue=0;p.extraPayMethod='';p.payRequestedAt='';
    // 잔금 컨텍스트(예약행) — 실패해도 추가금 읽기는 계속한다(별도 try)
    try{
      if(p.bookingRowIndex>1){
        const row=bkSh.getRange(p.bookingRowIndex,1,1,CONFIG.BOOKING_HEADERS.length).getValues()[0];
        if(row&&row[BOOKING_COL['고객명']]&&!isBookingCancelledStatus_(String(row[BOOKING_COL['상태']]||''))){
          const pm=String(row[BOOKING_COL['결제수단']]||'').trim();
          p.payMethod=pm;
          p.mrt=pm==='마이리얼트립'||String(row[BOOKING_COL['촬영종류']]||'').trim()==='마이리얼트립';
          const pmUnpaid=(pm===''||/미결제|unpaid|offen/i.test(pm));
          p.balancePaid=String(row[BOOKING_COL['잔금결제여부']]||'').trim()==='Y'||!pmUnpaid;
          const bal=roundCurrency_(parseMoneyValue_(row[BOOKING_COL['잔금']]));
          if(!p.balancePaid&&!p.mrt&&bal>0.005) p.balanceDue=bal;
        }
      }
    }catch(e){ Logger.log('select balance ctx skipped(row '+p.bookingRowIndex+'): '+e.message); }
    // 추가금 컨텍스트(인화주문)
    try{
      if(p.sessionId){
        loadPrint_();
        if(printData&&printData.length>1&&pMap&&pMap['메모']!==undefined){
          const sid=p.sessionId;
          for(let i=1;i<printData.length;i++){
            const tag=selectPrintMemoTag_(printData[i][pMap['메모']]);
            if(!tag||(tag!==sid&&tag!==sid.slice(0,8))) continue;
            const n=normalizePrintRow_(printData[i],i+1,pMap);
            p.payRequestedAt=printRowPayRequestedAt_(n.memo);
            const amt=roundCurrency_(Number(n.total)||0);
            if(amt>0.005&&!/취소|환불|cancel/i.test(String(n.status||''))){
              if(isPrintRowUnpaid_(n)) p.extraDue=amt;
              else p.extraPayMethod=String(n.payMethod||'').trim();
            }
            break;
          }
        }
      }
    }catch(e){ Logger.log('select extra ctx skipped('+p.sessionId+'): '+e.message); }
  };
}

function readShipQueue_(){
  const out=[];
  try{
    const ss=ensureSheets_().ss;
    const sh=ss.getSheetByName(SELECT_SHEET_NAME);
    if(!sh||sh.getLastRow()<2) return out;
    const rows=sh.getRange(2,1,sh.getLastRow()-1,sh.getLastColumn()).getValues();
    let bookStatus=[];
    try{
      const bSh=getDbSheet(),bLast=bSh.getLastRow();
      if(bLast>1) bookStatus=bSh.getRange(2,BOOKING_COL['상태']+1,bLast-1,1).getValues();
    }catch(e){}
    rows.forEach(function(r,i){
      if(!r[0]) return;
      if(String(r[SELECT_COL['수령방식']]||'').trim()!=='mail') return;
      if(!String(r[SELECT_COL['제출일시']]||'').trim()) return;
      if(!isSelectHandoverOpen_(r)) return;
      const st=String(r[SELECT_COL['상태']]||'').trim();
      if(st==='우편발송'||isSelectFinalLockedStatus_(st)) return;
      const bri=parseInt(r[SELECT_COL['예약장부행']],10)||0;
      if(bri>=2&&bookStatus[bri-2]&&String(bookStatus[bri-2][0]||'').trim()==='취소됨') return;
      const printDoneAt=SELECT_COL['출력완료일시']!=null?String(parseDateSafe_(r[SELECT_COL['출력완료일시']]).str||'').slice(0,16):'';
      out.push({
        selectRowIndex:i+2,
        bookingRowIndex:bri,
        sessionId:String(r[SELECT_COL['세션ID']]||''),
        name:String(r[SELECT_COL['고객명']]||''),
        product:String(r[SELECT_COL['상품']]||''),
        status:st,
        printed:!!printDoneAt||st==='출력',
        printDoneAt:printDoneAt,
        submittedAt:String(parseDateSafe_(r[SELECT_COL['제출일시']]).str||'').slice(0,10),
        mailAddress:String(r[SELECT_COL['우편주소']]||'').trim()
      });
    });
    if(out.length){
      const enrich=_selectPayContextReader_();
      out.forEach(function(p){
        enrich(p);
        const due=roundCurrency_((p.balanceDue||0)+(p.extraDue||0));
        p.stage=!p.printed?'출력대기':(due>0?(p.payRequestedAt?'입금대기':'결제요청대기'):'발송가능');
      });
      const order={'발송가능':0,'입금대기':1,'결제요청대기':2,'출력대기':3};
      out.sort(function(a,b){
        return (order[a.stage]-order[b.stage])||String(a.submittedAt).localeCompare(String(b.submittedAt));
      });
    }
  }catch(e){ Logger.log('ship queue skipped: '+e.message); }
  return out;
}

const LEGACY_VISIT_SHEET_NAME_='과거방문';

const LEGACY_VISIT_HEADERS_=['방문일','고객명','상품메모','출처'];

function readLegacyVisitsByName_(){
  const out={};
  try{
    const sh=ensureSheets_().ss.getSheetByName(LEGACY_VISIT_SHEET_NAME_);
    if(!sh||sh.getLastRow()<2) return out;
    sh.getRange(2,1,sh.getLastRow()-1,LEGACY_VISIT_HEADERS_.length).getValues().forEach(function(r){
      const key=normalizeReturnName_(r[1]);
      const date=String(parseDateSafe_(r[0]).str||'').slice(0,10);
      if(!key||!date) return;
      (out[key]||(out[key]=[])).push({date:date,product:String(r[2]||'').trim()});
    });
  }catch(e){ Logger.log('legacy visits read skipped: '+e.message); }
  return out;
}

function _customerKeyForRow_(row){
  const p=_inqPhoneKey_(row[BOOKING_COL['연락처']]);
  if(p) return 'p:'+p;
  const e=_inqEmailKey_(row[BOOKING_COL['이메일']]);
  if(e) return 'e:'+e;
  const n=normalizeReturnName_(row[BOOKING_COL['고객명']]);
  return n?('n:'+n):'';
}

function buildTodayBoard_(dateStr){
  const _t0=Date.now(); const _t={};
  const tz=CONFIG.TIMEZONE;
  const now=new Date();
  const today=String(dateStr||'').match(/^\d{4}-\d{2}-\d{2}$/)
    ? dateStr : Utilities.formatDate(now,tz,'yyyy-MM-dd');
  const sh=getDbSheet();               _t.getDbSheet=Date.now()-_t0;
  const last=sh.getLastRow();          _t.getLastRow=Date.now()-_t0;
  const rows=last>1?sh.getRange(2,1,last-1,CONFIG.BOOKING_HEADERS.length).getValues():[];
  _t.readRows=Date.now()-_t0; _t.rowCount=rows.length;
  const dayOps=readDayOps_(today);     _t.dayOps=Date.now()-_t0;
  /* 방문 이력 인덱스 — 오늘 카드마다 "첫 방문인지, 몇 번째인지, 전엔 뭘 찍었는지"를 붙인다.
     같은 rows 배열을 한 번 더 접을 뿐이라 비용은 무시할 수준(수백 행). */
  const custHist={};
  rows.forEach(function(row,idx){
    if(isBookingCancelledStatus_(String(row[BOOKING_COL['상태']]||''))) return;
    const key=_customerKeyForRow_(row);
    if(!key) return;
    (custHist[key]||(custHist[key]=[])).push({
      date:String(parseDateSafe_(row[BOOKING_COL['예약일시']]).str||'').slice(0,10),
      product:String(row[BOOKING_COL['상품']]||'').trim(),
      rowIndex:idx+2});
  });
  // 과거방문(pre-ERP 백필) — 이름 매칭으로 오늘 고객의 재방문 횟수에 합산 (3회차 혜택 판정)
  const legacyByName=readLegacyVisitsByName_();
  /* 이름 합집합 인덱스 — 같은 고객이 예약마다 다른 전화/이메일을 써서 신원이 쪼개진 경우
     (실측: 김지훈 3분신) 혜택 판정이 어긋난다. 키 기반과 이름 기반을 rowIndex로 합쳐 센다. */
  const custHistByName={};
  rows.forEach(function(row,idx){
    if(isBookingCancelledStatus_(String(row[BOOKING_COL['상태']]||''))) return;
    const nm=normalizeReturnName_(row[BOOKING_COL['고객명']]);
    if(!nm) return;
    (custHistByName[nm]||(custHistByName[nm]=[])).push({
      date:String(parseDateSafe_(row[BOOKING_COL['예약일시']]).str||'').slice(0,10),
      product:String(row[BOOKING_COL['상품']]||'').trim(),
      rowIndex:idx+2});
  });
  _t.custIndex=Date.now()-_t0;
  const shoots=[];
  rows.forEach(function(row,idx){
    const status=String(row[BOOKING_COL['상태']]||'').trim();
    if(isBookingCancelledStatus_(status)) return;
    const dt=String(parseDateSafe_(row[BOOKING_COL['예약일시']]).str||'');
    if(dt.slice(0,10)!==today) return;
    const hhmm=dt.slice(11,16);
    const depositPaid=String(row[BOOKING_COL['계약금입금여부']]||'').trim()==='Y';
    const balance=roundCurrency_(parseMoneyValue_(row[BOOKING_COL['잔금']]));
    const payMethod=String(row[BOOKING_COL['결제수단']]||'').trim();
    const unpaid=/미결제|offen|unpaid/i.test(payMethod);
    shoots.push({
      rowIndex:idx+2,
      time:hhmm||'--:--',
      timeUnset:(!hhmm||hhmm==='00:00'),
      durationMin:getBookingDurationMinFromRow_(row,60),
      name:String(row[BOOKING_COL['고객명']]||''),
      phone:String(row[BOOKING_COL['연락처']]||''),
      product:String(row[BOOKING_COL['상품']]||''),
      itemGroup:String(row[BOOKING_COL['촬영종류']]||''),
      people:String(row[BOOKING_COL['인원']]||''),
      location:parseBookingLocationFromRow_(row)||'',
      status:status,
      total:roundCurrency_(parseMoneyValue_(row[BOOKING_COL['총결제액']])),
      deposit:roundCurrency_(parseMoneyValue_(row[BOOKING_COL['계약금']])),
      depositPaid:depositPaid,
      balance:balance,
      payMethod:payMethod,
      /* 현장 수령액 = 잔금 + (계약금 미입금이면 계약금). 김혜수 사례(2026-08-29):
         [계약금예외]로 계약금 50 미입금·잔금 260 → 현장 수령은 310 인데 260 만 표시됐다.
         종전 코드는 (조건)?balance:balance 로 양쪽이 같은 자기모순이었다. */
      dueOnSite:roundCurrency_(balance+(depositPaid?0:roundCurrency_(parseMoneyValue_(row[BOOKING_COL['계약금']])))),
      prep:_dashboardPrepLines_(row[BOOKING_COL['요청사항']]),
      /* 재방문 맥락 — prior = 오늘보다 앞선 비취소 예약 수. 0이면 첫 방문. */
      visitCount:(function(){
        const key=_customerKeyForRow_(row);
        const nm=normalizeReturnName_(row[BOOKING_COL['고객명']]);
        const seenRows={}; let n=0;
        ((key&&custHist[key])||[]).concat(custHistByName[nm]||[]).forEach(function(h){
          if(h.date>=today||seenRows[h.rowIndex]) return;
          seenRows[h.rowIndex]=true; n++;
        });
        n+=(legacyByName[nm]||[]).filter(function(v){return v.date<today;}).length;
        return n;
      })(),
      prevShoots:(function(){
        const key=_customerKeyForRow_(row);
        const nm=normalizeReturnName_(row[BOOKING_COL['고객명']]);
        const seenRows={}; const merged=[];
        ((key&&custHist[key])||[]).concat(custHistByName[nm]||[]).forEach(function(h){
          if(h.date>=today||seenRows[h.rowIndex]) return;
          seenRows[h.rowIndex]=true; merged.push(h);
        });
        (legacyByName[nm]||[]).forEach(function(v){ if(v.date<today) merged.push(v); });
        return merged
          .sort(function(a,b){return b.date<a.date?-1:1;})
          .slice(0,3)
          .map(function(h){return h.date.slice(2,7).replace('-','.')+' '+(h.product||'');});
      })(),
      // 당일 운영: 지연 분·실제 도착. 예약일시는 그대로 두고 표시만 밀린다
      delayMin:(function(){ const o=dayOps[String(idx+2)]; return o&&isFinite(o.delay)?Number(o.delay):0; })(),
      arrivedAt:(function(){ const o=dayOps[String(idx+2)]; return o&&o.arrived?String(o.arrived):''; })(),
      delayNote:(function(){ const o=dayOps[String(idx+2)]; return o&&o.note?String(o.note):''; })(),
      startedAt:(function(){ const o=dayOps[String(idx+2)]; return o&&o.started?String(o.started):''; })(),
      endedAt:(function(){ const o=dayOps[String(idx+2)]; return o&&o.ended?String(o.ended):''; })(),
      /* 이름을 누르면 뜨는 상세 보기용 (2026-08-26 사장님 요청).
         현장에서 확인하는 값이라 원문 메모까지 그대로 넘긴다 — 파싱된 칩만으론 놓치는 게 생긴다. */
      detail:{
        dateTime:dt,
        email:String(row[BOOKING_COL['이메일']]||''),
        bookingType:BOOKING_COL['예약유형']!=null?String(row[BOOKING_COL['예약유형']]||''):'',
        depositMethod:BOOKING_COL['계약금수단']!=null?String(row[BOOKING_COL['계약금수단']]||''):'',
        depositPaidAt:BOOKING_COL['계약금입금일']!=null?String(parseDateSafe_(row[BOOKING_COL['계약금입금일']]).str||'').slice(0,10):'',
        balancePaid:BOOKING_COL['잔금결제여부']!=null?String(row[BOOKING_COL['잔금결제여부']]||'').trim()==='Y':false,
        memoRaw:String(row[BOOKING_COL['요청사항']]||''),
        /* 예약 세부내역(추가항목)은 요청사항 원문과 내용이 겹쳐 중복이라 빼기로 했다(2026-08-27 사장님 지적).
           응답에서 가장 큰 덩어리이기도 해서 전송량도 함께 줄었다. 다시 필요하면 이 줄만 되살리면 된다. */
        confirmedAt:BOOKING_COL['확정일시']!=null?String(parseDateSafe_(row[BOOKING_COL['확정일시']]).str||'').slice(0,16):'',
        marketing:BOOKING_COL['마케팅동의']!=null?String(row[BOOKING_COL['마케팅동의']]||''):'',
        isReturn:BOOKING_COL['재방문']!=null?String(row[BOOKING_COL['재방문']]||'').trim()==='재방문':false
      }
    });
  });
  _t.scanRows=Date.now()-_t0;

  // 준비 설문 — 촬영 직전에 필요한 분위기·레퍼런스
  try{
    const prepMap=readPrepByBookingRow_(shoots.map(function(s){return s.rowIndex;}));
    shoots.forEach(function(s){ s.prepSurvey=prepMap[String(s.rowIndex)]||null; });
  }catch(e){ Logger.log('prep attach skipped: '+e.message); }
  _t.prep=Date.now()-_t0;

  shoots.sort(function(a,b){return String(a.time).localeCompare(String(b.time));});

  /* 지연을 반영한 '실제 시각'과 다음 촬영까지의 여유를 계산한다.
     여유가 음수면 겹친다 — 고객이 늦게 왔을 때 가장 먼저 알아야 하는 값이다. */
  shoots.forEach(function(s){
    const base=_hmToMin_(s.time);
    s.effStartMin=(base==null)?null:base+(s.delayMin||0);
    s.effTime=(s.effStartMin==null)?s.time:_minToHm_(s.effStartMin);
    s.effEndMin=(s.effStartMin==null)?null:s.effStartMin+(s.durationMin||60);
    s.effEndTime=(s.effEndMin==null)?'':_minToHm_(s.effEndMin);
    // 실제로 걸린 시간 — 시작·종료가 다 찍혔을 때만
    const a=_hmToMin_(s.startedAt), b=_hmToMin_(s.endedAt);
    s.actualMin=(a!=null&&b!=null&&b>=a)?(b-a):null;
  });
  for(let i=0;i<shoots.length;i++){
    const cur=shoots[i];
    let nxt=null;
    for(let j=i+1;j<shoots.length;j++){
      if(shoots[j].effStartMin!=null){ nxt=shoots[j]; break; }
    }
    // 키를 아예 빼면 안 된다 — 클라이언트(Swift)는 키 하나가 없어도 디코딩이 통째로 실패한다
    if(cur.effEndMin==null||!nxt){ cur.gapToNextMin=null; cur.overlapsNext=false; cur.nextName=''; continue; }
    cur.gapToNextMin=nxt.effStartMin-cur.effEndMin;
    cur.overlapsNext=cur.gapToNextMin<0;
    cur.nextName=nxt.name;
  }

  // 지금 시각 기준 다음 촬영
  const nowHm=Utilities.formatDate(now,tz,'HH:mm');
  let next=null;
  for(let i=0;i<shoots.length;i++){
    if(shoots[i].timeUnset) continue;
    // 지연이 반영된 실제 시각으로 판단한다 — 밀린 촬영을 '지났다'고 세면 안 된다
    if((shoots[i].effTime||shoots[i].time)>=nowHm){ next=shoots[i]; break; }
  }
  const warnings=[];
  shoots.forEach(function(s){
    if(s.timeUnset) warnings.push(`${s.name}님 촬영 시간이 미정입니다`);
    if(!s.depositPaid&&s.deposit>0) warnings.push(`${s.name}님 계약금 ${formatEuroAmount_(s.deposit)}€ 미입금`);
    if(s.delayMin>0) warnings.push(`${s.name}님 ${s.delayMin}분 지연 — 실제 ${s.effTime} 시작`);
    if(s.overlapsNext) warnings.push(`${s.name}님 촬영이 다음(${s.nextName}님)과 ${Math.abs(s.gapToNextMin)}분 겹칩니다`);
  });
  // 픽업은 한 번만 읽는다 — 결제 컨텍스트(인화주문 스캔 포함)를 경고문용으로 중복 계산하지 않게
  let pickupsToday=[];
  try{
    pickupsToday=readPickupsForDate_(today);
    const pk=pickupsToday.filter(function(p){return !p.done;});
    if(pk.length) warnings.push(`오늘 픽업 ${pk.length}건 — ${pk.map(function(p){return p.time+' '+p.name;}).join(', ')}`);
  }catch(e){ pickupsToday=[]; }
  // 우편발송 큐 — 날짜와 무관한 현재 백로그라 오늘 보드에만
  let shipQueue=[];
  if(today===Utilities.formatDate(now,tz,'yyyy-MM-dd')){
    try{
      shipQueue=readShipQueue_();
      const ready=shipQueue.filter(function(q){return q.stage==='발송가능';});
      if(ready.length) warnings.push(`발송 가능 ${ready.length}건 — ${ready.map(function(q){return q.name;}).join(', ')}`);
    }catch(e){ shipQueue=[]; }
  }
  return {
    ok:true,
    date:today,
    weekday:['일','월','화','수','목','금','토'][new Date(today+'T12:00:00').getDay()],
    serverTime:Utilities.formatDate(now,tz,'yyyy-MM-dd HH:mm:ss'),
    count:shoots.length,
    dueTotal:shoots.reduce(function(a,s){return a+(s.dueOnSite!=null?s.dueOnSite:(s.balance||0));},0),
    next:next?{time:next.effTime||next.time,scheduled:next.time,name:next.name,
               product:next.product,delayMin:next.delayMin||0}:null,
    delayedCount:shoots.filter(function(s){return (s.delayMin||0)!==0;}).length,
    overlapCount:shoots.filter(function(s){return !!s.overlapsNext;}).length,
    shoots:shoots,
    pickups:pickupsToday,
    shipQueue:shipQueue,
    warnings:warnings,
    _timing:(function(){ _t.total=Date.now()-_t0; return _t; })()
  };
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

function extractBookingLocationFromText_(value){
  const text=String(value||'').trim();
  if(!text) return '';
  const bracketMatch=text.match(/\[촬영장소:([^\]]+)\]/);
  if(bracketMatch&&bracketMatch[1]) return String(bracketMatch[1]).trim();
  const labelMatch=text.match(/(?:촬영장소|만나는\s*장소|장소|Location|Ort|Venue|Treffpunkt|Meeting\s*Point):\s*([^\n|]+)/i);
  if(labelMatch&&labelMatch[1]) return String(labelMatch[1]).trim();
  return '';
}

function parseBookingLocationFromRow_(row){
  const itemGroup=String(row[BOOKING_COL['촬영종류']]||'').trim();
  const storedLocation=BOOKING_COL['shooting_location']!=null ? String(row[BOOKING_COL['shooting_location']]||'').trim() : '';
  const storedLooksLikeStudioFallback=storedLocation&&_isExternalBookingItemGroup_(itemGroup)&&isStudioLocation_(storedLocation);
  if(storedLocation&&!storedLooksLikeStudioFallback) return storedLocation;
  const extraItem=String(row[BOOKING_COL['추가항목']]||'').trim();
  const memo=String(row[BOOKING_COL['요청사항']]||'').trim();
  const parsedLocation=extractBookingLocationFromText_(extraItem)||extractBookingLocationFromText_(memo);
  if(parsedLocation) return parsedLocation;
  if(_isExternalBookingItemGroup_(itemGroup)) return '';
  return STUDIO_ADDRESS;
}

function getBookingProductForRow_(row){
  const itemGroup=String(row[BOOKING_COL['촬영종류']]||'').trim();
  const productName=String(row[BOOKING_COL['상품']]||'').trim();
  if(!itemGroup||!productName) return null;
  return getCachedProducts_().find(function(p){
    return String(p.g||'').trim()===itemGroup && [p.nameKo,p.nameEn,p.nameDe,p.id].some(function(name){
      return String(name||'').trim()===productName;
    });
  })||null;
}

function getPassportComboDurationMin_(people){
  const n=Math.max(1,parseInt(people,10)||1);
  const table=[0,15,20,30,40];
  return table[Math.min(n,4)]||40;
}

function getBookingPassportComboDurationMinFromRow_(row){
  const text=[
    String(row[BOOKING_COL['추가항목']]||''),
    String(row[BOOKING_COL['요청사항']]||'')
  ].join(' | ');
  if(!/여권(?:콤보|추가촬영)/.test(text)) return 0;
  const explicit=text.match(/여권(?:콤보|추가촬영)[^|\n]*추가\s*(\d+)\s*분/);
  if(explicit&&explicit[1]) return Math.max(0,parseInt(explicit[1],10)||0);
  const people=text.match(/여권(?:콤보|추가촬영)[^|\n]*(\d+)\s*명/);
  return people&&people[1]?getPassportComboDurationMin_(people[1]):0;
}

function getBookingDurationMinFromRow_(row,fallbackMin){
  const product=getBookingProductForRow_(row);
  /* 캘린더 이벤트 길이 = **촬영시간만**(d + 여권콤보 실촬영분). prep(준비 15분)을 여기 더하면
     슬롯 계산의 타입 버퍼(B↔B 15분)와 **이중 가산**되어 30분 촬영이 45분 이벤트 + 15분 버퍼
     = 실효 60분 간격이 됐다(2026-08-16 사장님 지적). prep 은 슬롯/견적의 footprint 계산
     (booking.js·computeSlots_ 의 d+prep)에만 남긴다 — 그쪽은 새 예약이 차지할 창의 크기다. */
  if(product) return Math.max(15,(Number(product.d||0)+getBookingPassportComboDurationMinFromRow_(row))||60);
  return Math.max(15,Number(fallbackMin||0)||60);
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

function roundCurrency_(value){
  return Math.round((Number(value)||0)*100)/100;
}

function formatEuroAmount_(value){
  const rounded=roundCurrency_(value);
  return Number.isInteger(rounded)?String(rounded):rounded.toFixed(2);
}

function normalizeReturnName_(name){
  return String(name||'').replace(/\s+/g,'').trim().toLowerCase();
}

function isStudioLocation_(location){
  const safe=String(location||'').toLowerCase().replace(/[\s,.-]/g,'');
  if(!safe) return false;
  return safe.indexOf('holzwegpassage3')>=0
    || safe.indexOf('61440oberursel')>=0
    || safe.indexOf('holzwegpassgae3')>=0;
}

function _isExternalBookingItemGroup_(itemGroup){
  const group=String(itemGroup||'').trim();
  return group==='snap'||group==='wed'||group==='biz'||group==='마이리얼트립';
}

function parseMoneyValue_(value){
  if(value===null || value===undefined || value==='') return 0;
  if(typeof value==='number') return isFinite(value) ? value : 0;
  let raw=String(value).trim();
  if(!raw) return 0;
  if(/\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(raw)) return 0;
  const negative=/^\s*-/.test(raw) || /^\s*\(.*\)\s*$/.test(raw);
  let s=raw.replace(/[^0-9,.-]/g,'').replace(/-/g,'');
  if(!s) return 0;
  const lastComma=s.lastIndexOf(',');
  const lastDot=s.lastIndexOf('.');
  if(lastComma>-1 && lastDot>-1){
    s=lastComma>lastDot
      ? s.replace(/\./g,'').replace(',', '.')
      : s.replace(/,/g,'');
  }else if(lastComma>-1){
    const decimals=s.length-lastComma-1;
    s=(decimals>0 && decimals<=2)
      ? s.replace(/\./g,'').replace(',', '.')
      : s.replace(/,/g,'');
  }else if(lastDot>-1){
    const decimals=s.length-lastDot-1;
    const dotCount=(s.match(/\./g)||[]).length;
    if(dotCount>1 || decimals===3) s=s.replace(/\./g,'');
  }
  const parsed=Number(s);
  if(!isFinite(parsed)) return 0;
  return negative ? -parsed : parsed;
}

const PREP_SHEET_NAME='촬영준비설문';

const PREP_HEADERS=['예약장부행','제출일시','수정일시','언어','촬영종류','상품','고객명','촬영일시','답변JSON','요약','참고링크'];

const PREP_COL=PREP_HEADERS.reduce(function(m,h,i){m[h]=i;return m;},{});

const SELECT_SHEET_NAME='사진셀렉';

const SELECT_HEADERS=['세션ID','생성일시','고객명','이메일','연락처','촬영일','촬영종류','상품','기본보정수','리터칭단가','언어','드라이브링크','예약장부행','제출일시','선택사진','추가보정수','추가보정금액','추가인화','추가인화금액','마케팅동의','총추가금액','상태','재발송횟수','재발송일시','어드민알림','보정본발송일시','셀렉마감일','1차알림일','2차알림일','3차알림일','최종알림단계','재수정요청횟수','추가금인보이스번호','보정후안내메일발송일시','수령방식','픽업일시','우편주소','픽업캘린더ID','페이지버전','재수정요청메모','재수정요청이력JSON','포토카드선택','마케팅보너스수','서비스컷수','고객출력주문JSON','고객출력주문일시','고객출력주문상태','출력완료일시','출력완료매수','픽업안내메일발송일시','수령완료일시','수령방법','수령메모','픽업리마인드발송일시','픽업리마인드횟수','수령직전상태','별점JSON','압축본링크'];

const SELECT_COL=SELECT_HEADERS.reduce((acc,h,i)=>{acc[h]=i;return acc;},{});

function isSelectFinalLockedStatus_(status){
  const s=String(status||'').trim();
  return ['최종작업완료','작업완료'].indexOf(s)>-1;
}

function selectPrintMemoTag_(memo){
  const m=String(memo||'').match(/^\s*셀렉\s*:\s*([A-Za-z0-9_-]+)/);
  return m?m[1]:'';
}

function isSelectHandoverOpen_(row){
  if(SELECT_COL['수령완료일시']==null) return true;
  const handoverAt=parseDateSafe_(row[SELECT_COL['수령완료일시']]).str.slice(0,16);
  if(!handoverAt) return true;
  const printAt=SELECT_COL['출력완료일시']!=null?parseDateSafe_(row[SELECT_COL['출력완료일시']]).str.slice(0,16):'';
  return !!(printAt&&printAt>handoverAt);
}
