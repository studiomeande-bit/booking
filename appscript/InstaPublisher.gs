/**
 * Studio_mean — 인스타 캐러셀 자동 게시 (구글 서버 실행, 맥 전원과 무관).
 *
 * 배경: 게시는 맥의 launchd(publish_due.py)가 담당했는데, 절전·오프라인이면 슬롯을 놓친다
 *       (2026-08-18 김세진 정장 DNS 실패). 검수 시트에는 이미 게시에 필요한 것이 다 있다 —
 *       슬라이드URL(드라이브 호스팅)·캡션·예정ISO. 그래서 GAS 트리거가 직접 올린다.
 *
 * 대상: 상태='승인' 이면서 예정ISO <= now 인 캐러셀 행. (릴스는 제외 — 영상은 로컬 resumable 업로드)
 * 결과: 게시 성공 → 상태 '게시완료', 승인일시 칸에 게시 URL 기록.
 *
 * 준비 (사장님이 직접 1회):
 *   프로젝트 설정 → 스크립트 속성에 IG_ACCESS_TOKEN, IG_USER_ID 추가.
 *   그 다음 installInstaPublishTrigger() 를 한 번 실행 → 15분마다 자동 실행.
 *
 * 토큰은 코드·시트·로그에 남기지 않는다.
 */

var IG_GRAPH_VERSION = 'v23.0';
var IG_PUBLISH_LOCK_MS = 30000;

function igProp_(name) {
  var v = PropertiesService.getScriptProperties().getProperty(name);
  if (!v) throw new Error('스크립트 속성 ' + name + ' 이(가) 없습니다. 프로젝트 설정에서 추가하세요.');
  return v;
}

function igCall_(path, params, method) {
  params = params || {};
  params.access_token = igProp_('IG_ACCESS_TOKEN');
  var url = 'https://graph.facebook.com/' + IG_GRAPH_VERSION + '/' + path;
  var opt = { muteHttpExceptions: true };
  if (method === 'POST') { opt.method = 'post'; opt.payload = params; }
  else { url += '?' + igQuery_(params); }
  var res = UrlFetchApp.fetch(url, opt);
  var body = res.getContentText();
  var json = {};
  try { json = JSON.parse(body); } catch (e) { throw new Error('Graph 응답 파싱 실패: ' + body.slice(0, 200)); }
  if (res.getResponseCode() >= 400 || json.error) {
    var msg = json.error ? (json.error.message + ' (code ' + json.error.code + ')') : body.slice(0, 200);
    throw new Error('Graph API 오류: ' + msg);
  }
  return json;
}

function igQuery_(params) {
  return Object.keys(params).map(function (k) {
    return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]);
  }).join('&');
}

/** 드라이브 URL 후보 — 인스타가 lh3 형식을 거부하는 경우가 있어 대체 형식으로 재시도한다
 *  (2026-08-13 code 9004 "Only photo or video…" 사례. 로컬 instagram.py 와 같은 순서). */
function igUrlCandidates_(url) {
  var out = [url];
  var i = url.indexOf('lh3.googleusercontent.com/d/');
  if (i > -1) {
    var fid = url.split('/d/')[1].split('=')[0].split('/')[0];
    out.push('https://drive.google.com/uc?export=download&id=' + fid);
    out.push('https://drive.google.com/uc?export=view&id=' + fid);
    out.push('https://lh3.googleusercontent.com/d/' + fid);
  }
  return out;
}

/** 컨테이너가 FINISHED 될 때까지 대기. GAS 실행시간(6분) 안에서만 기다린다. */
function igWaitFinished_(containerId, maxSec) {
  var waited = 0, step = 5;
  maxSec = maxSec || 120;
  while (waited < maxSec) {
    var st = igCall_(containerId, { fields: 'status_code,status' });
    if (st.status_code === 'FINISHED') return;
    if (st.status_code === 'ERROR') throw new Error('컨테이너 처리 실패: ' + (st.status || ''));
    Utilities.sleep(step * 1000);
    waited += step;
  }
  throw new Error('컨테이너 처리 대기 시간 초과(' + maxSec + '초)');
}

function igPublishCarousel_(imageUrls, caption) {
  if (!imageUrls.length) throw new Error('슬라이드 URL이 없습니다.');
  var igUser = igProp_('IG_USER_ID');
  var children = [];
  for (var i = 0; i < imageUrls.length; i++) {
    var cands = igUrlCandidates_(imageUrls[i]), made = null, lastErr = null;
    for (var c = 0; c < cands.length && !made; c++) {
      try {
        var r = igCall_(igUser + '/media', { image_url: cands[c], is_carousel_item: 'true' }, 'POST');
        if (r.id) made = r.id;
      } catch (e) { lastErr = e; }
    }
    if (!made) throw new Error('슬라이드 ' + (i + 1) + ' 컨테이너 생성 실패: ' + (lastErr && lastErr.message));
    children.push(made);
  }
  for (var j = 0; j < children.length; j++) igWaitFinished_(children[j], 90);
  var parent = igCall_(igUser + '/media',
    { media_type: 'CAROUSEL', children: children.join(','), caption: caption || '' }, 'POST');
  if (!parent.id) throw new Error('캐러셀 컨테이너 생성 실패');
  igWaitFinished_(parent.id, 120);
  var pub = igCall_(igUser + '/media_publish', { creation_id: parent.id }, 'POST');
  if (!pub.id) throw new Error('게시 실패');
  var perma = '';
  try { perma = igCall_(pub.id, { fields: 'permalink' }).permalink || ''; } catch (e) {}
  return { id: pub.id, url: perma };
}

/**
 * 메인 — 예정 시각이 지난 승인 캐러셀을 게시한다. 한 번 실행에 1건만(피드 도배 방지).
 * 시간 트리거로 15분마다 호출. 맥이 꺼져 있어도 동작한다.
 */
function publishDueInstaCarousels() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(IG_PUBLISH_LOCK_MS)) { Logger.log('다른 실행이 진행 중 — 건너뜀'); return; }
  try {
    var sh = ensureInstaReviewSheet_(ensureSheets_().ss);
    var vals = sh.getDataRange().getValues();
    var now = new Date();
    for (var i = 1; i < vals.length; i++) {
      var row = vals[i];
      if (String(row[INSTA_REVIEW_COL['상태']] || '') !== '승인') continue;

      var type = String(row[INSTA_REVIEW_COL['유형']] || '');
      if (type.indexOf('릴스') > -1) continue;             // 영상은 로컬 파이프라인 담당

      var schedRaw = INSTA_REVIEW_COL['예정ISO'] != null
        ? String(row[INSTA_REVIEW_COL['예정ISO']] || '').trim() : '';
      if (!schedRaw) continue;
      var sched = new Date(schedRaw);
      if (isNaN(sched.getTime()) || sched > now) continue;   // 아직 시간이 아님

      var slides = String(row[INSTA_REVIEW_COL['슬라이드URL']] || '')
        .split(',').map(function (s) { return s.trim(); }).filter(String);
      if (!slides.length) { Logger.log('슬라이드URL 없음 — 건너뜀: ' + row[INSTA_REVIEW_COL['큐키']]); continue; }

      var key = String(row[INSTA_REVIEW_COL['큐키']] || '');
      var caption = String(row[INSTA_REVIEW_COL['캡션']] || '');
      try {
        var out = igPublishCarousel_(slides, caption);
        sh.getRange(i + 1, INSTA_REVIEW_COL['상태'] + 1).setValue('게시완료');
        sh.getRange(i + 1, INSTA_REVIEW_COL['승인일시'] + 1)
          .setValue(Utilities.formatDate(now, CONFIG.TIMEZONE, 'yyyy-MM-dd HH:mm') + ' ' + out.url);
        Logger.log('게시 완료 [' + key + '] ' + out.url);
        igNotifyPublished_(key, String(row[INSTA_REVIEW_COL['이름']] || ''), out.url);
      } catch (e) {
        Logger.log('게시 실패 [' + key + ']: ' + e.message);
        // 상태는 '승인' 그대로 둔다 → 다음 트리거에서 자동 재시도.
      }
      return;                                              // 실행당 1건
    }
  } finally {
    lock.releaseLock();
  }
}

function igNotifyPublished_(key, name, url) {
  try {
    MailApp.sendEmail({
      to: CONFIG.ADMIN_EMAIL || Session.getEffectiveUser().getEmail(),
      subject: '[Studio mean] 인스타 게시 완료 — ' + (name || key),
      body: '구글 서버에서 자동 게시했습니다.\n\n' + (name || key) + '\n' + url + '\n'
    });
  } catch (e) { Logger.log('게시 알림 메일 실패: ' + e.message); }
}

/** 1회 실행 — 15분 주기 트리거 설치 (중복 설치 방지). */
function installInstaPublishTrigger() {
  var exists = ScriptApp.getProjectTriggers().filter(function (t) {
    return t.getHandlerFunction() === 'publishDueInstaCarousels';
  });
  exists.forEach(function (t) { ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('publishDueInstaCarousels').timeBased().everyMinutes(15).create();
  return '설치 완료 — 15분마다 publishDueInstaCarousels 실행';
}

/** 연결 확인용 — 토큰이 유효한지, 어느 계정인지만 본다(토큰은 출력하지 않는다). */
function checkInstaConnection() {
  var info = igCall_(igProp_('IG_USER_ID'), { fields: 'username,followers_count' });
  Logger.log('연결 OK: @' + info.username + ' (팔로워 ' + info.followers_count + ')');
  return info;
}
