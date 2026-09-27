/**
 * Studio_mean — Threads 자동 게시 (사장님 2026-09-01).
 *
 * 인스타 캐러셀이 게시되면 같은 소재를 Threads 에도 올린다.
 * Threads Graph API 는 인스타와 별개 토큰·별개 호스트(graph.threads.net)를 쓴다.
 *   컨테이너 생성 → (캐러셀이면 자식들 먼저) → threads_publish
 *
 * 캡션: 시트 '캡션스레드'(전용 캡션 — 광고성 대신 일상·촬영 경험, 사장님 2026-09-17)를 그대로 올린다.
 *       비어 있으면 인스타 캡션의 **첫 문단만** 쓴다(링크·가격·해시태그 없이). 500자 제한.
 *
 * 준비 (사장님 1회): 스크립트 속성에 THREADS_ACCESS_TOKEN, THREADS_USER_ID.
 *   토큰은 인스타 것과 다르다 — threads.net OAuth 로 별도 발급
 *   (scope: threads_basic, threads_content_publish).
 *   설정 전에는 조용히 건너뛴다(인스타 게시에는 영향 없음).
 */

var THREADS_HOST = 'https://graph.threads.net';
var THREADS_VERSION = 'v1.0';
var THREADS_MAX_CHARS = 480;      // 500 한도에서 여유

function threadsConfigured_() {
  var p = PropertiesService.getScriptProperties();
  return !!(p.getProperty('THREADS_ACCESS_TOKEN') && p.getProperty('THREADS_USER_ID'));
}

function threadsCall_(path, params, method) {
  params = params || {};
  params.access_token = PropertiesService.getScriptProperties().getProperty('THREADS_ACCESS_TOKEN');
  var url = THREADS_HOST + '/' + THREADS_VERSION + '/' + path;
  var opt = { muteHttpExceptions: true };
  if (method === 'POST') { opt.method = 'post'; opt.payload = params; }
  else { url += '?' + igQuery_(params); }
  var res = UrlFetchApp.fetch(url, opt);
  var body = res.getContentText();
  var json = {};
  try { json = JSON.parse(body); } catch (e) { throw new Error('Threads 응답 파싱 실패: ' + body.slice(0, 200)); }
  if (res.getResponseCode() >= 400 || json.error) {
    throw new Error('Threads API 오류: ' + (json.error ? json.error.message : body.slice(0, 200)));
  }
  return json;
}

/** 500자 한도 — 넘치면 문장 끝에서 자른다. */
function threadsClip_(text) {
  var t = String(text || '').trim();
  if (t.length <= THREADS_MAX_CHARS) return t;
  t = t.slice(0, THREADS_MAX_CHARS);
  var cut = Math.max(t.lastIndexOf('.'), t.lastIndexOf('!'), t.lastIndexOf('?'), t.lastIndexOf('\n'));
  return cut > THREADS_MAX_CHARS * 0.5 ? t.slice(0, cut + 1) : t;
}

/**
 * 인스타 캡션 → Threads 본문 (**대체용**). 전용 캡션(시트 '캡션스레드')이 없을 때만 쓴다.
 * 스레드는 광고성 대신 일상·촬영 경험 이야기(사장님 2026-09-17)라, 첫 문단만 쓰고
 * 예약 링크·가격·해시태그는 붙이지 않는다.
 */
function threadsCaption_(caption) {
  var head = String(caption || '').split('▪︎')[0].trim();
  if (!head) head = String(caption || '').trim();
  return threadsClip_(head);
}

/** 이미지 컨테이너 1개 — 메타 서버가 구글 호스팅 URL 을 가끔 못 가져온다(2207052). URL 후보를 돌며 2회까지 재시도. */
function threadsCreateImage_(user, url, extra) {
  var cands = igUrlCandidates_(url), lastErr = null;
  for (var pass = 0; pass < 2; pass++) {
    for (var c = 0; c < cands.length; c++) {
      try {
        var p = { media_type: 'IMAGE', image_url: cands[c] };
        for (var k in (extra || {})) p[k] = extra[k];
        var r = threadsCall_(user + '/threads', p, 'POST');
        if (r.id) return r.id;
      } catch (e) { lastErr = e; }
    }
    Utilities.sleep(3000);
  }
  throw new Error('Threads 이미지 컨테이너 실패: ' + (lastErr ? lastErr.message : url));
}

/** 컨테이너 처리 완료 대기 (FINISHED). ERROR/EXPIRED 면 즉시 실패. */
function threadsWaitFinished_(id, maxSec) {
  var waited = 0;
  maxSec = maxSec || 60;
  while (waited < maxSec) {
    var st = {};
    try { st = threadsCall_(id, { fields: 'status,error_message' }); } catch (e) { st = {}; }
    if (st.status === 'FINISHED') return;
    if (st.status === 'ERROR' || st.status === 'EXPIRED') {
      throw new Error('Threads 컨테이너 ' + st.status + ': ' + (st.error_message || ''));
    }
    Utilities.sleep(4000); waited += 4;
  }
}

/** 이미지 여러 장 → Threads 캐러셀. 1장이면 단일 이미지로 올린다. */
function threadsPublish_(imageUrls, text) {
  var user = PropertiesService.getScriptProperties().getProperty('THREADS_USER_ID');
  var urls = (imageUrls || []).filter(String).slice(0, 20);   // Threads 캐러셀 한도 20
  var creationId;

  if (!urls.length) {
    creationId = threadsCall_(user + '/threads', { media_type: 'TEXT', text: text }, 'POST').id;
  } else if (urls.length === 1) {
    creationId = threadsCreateImage_(user, urls[0], { text: text });
  } else {
    var children = [];
    for (var i = 0; i < urls.length; i++) {
      children.push(threadsCreateImage_(user, urls[i], { is_carousel_item: 'true' }));
    }
    creationId = threadsCall_(user + '/threads',
      { media_type: 'CAROUSEL', children: children.join(','), text: text }, 'POST').id;
  }
  if (!creationId) throw new Error('Threads 컨테이너 생성 실패');

  threadsWaitFinished_(creationId, 60);
  var pub = threadsCall_(user + '/threads_publish', { creation_id: creationId }, 'POST');
  if (!pub.id) throw new Error('Threads 게시 실패');
  var perma = '';
  try { perma = threadsCall_(pub.id, { fields: 'permalink' }).permalink || ''; } catch (e) {}
  return { id: pub.id, url: perma };
}

/**
 * 인스타 게시 성공 직후 호출. 실패해도 인스타 게시에는 영향을 주지 않는다.
 * threadsText = 시트 '캡션스레드'(전용 캡션). 비어 있으면 인스타 캡션 첫 문단으로 대체.
 */
function threadsMirror_(slideUrls, caption, threadsText) {
  if (!threadsConfigured_()) return { skipped: '미설정' };
  try {
    var text = String(threadsText || '').trim() ? threadsClip_(threadsText) : threadsCaption_(caption);
    var out = threadsPublish_(slideUrls, text);
    Logger.log('Threads 게시 완료: ' + out.url);
    return out;
  } catch (e) {
    Logger.log('Threads 게시 실패(인스타는 정상): ' + e.message);
    return { error: e.message };
  }
}

/** 연결 확인 — 토큰 값은 반환하지 않는다. */
function threadsStatusForAgent_(token) {
  assertAdmin_(token);
  var p = PropertiesService.getScriptProperties();
  var has = !!p.getProperty('THREADS_ACCESS_TOKEN');
  var hasUser = !!p.getProperty('THREADS_USER_ID');
  var account = '';
  if (has && hasUser) {
    try {
      account = '@' + threadsCall_(p.getProperty('THREADS_USER_ID'), { fields: 'username' }).username;
    } catch (e) { account = '연결 실패: ' + e.message.slice(0, 140); }
  }
  return { ok: true, hasToken: has, hasUserId: hasUser, account: account };
}

function threadsSetSecretsForAgent_(token, payload) {
  assertAdmin_(token);
  payload = payload || {};
  var props = PropertiesService.getScriptProperties();
  var out = {};
  ['THREADS_ACCESS_TOKEN', 'THREADS_USER_ID'].forEach(function (k) {
    var v = String(payload[k] || '').trim();
    if (!v) { out[k] = 'skipped'; return; }
    props.setProperty(k, v);
    out[k] = 'saved(' + v.length + ')';
  });
  return { ok: true, saved: out };
}
