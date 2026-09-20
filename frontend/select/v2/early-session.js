/* 세션 선요청 — 번들(select.min.js, 본문 끝)이 실행되기 전에 <head> 에서 셔틀에 select-session 을 띄운다(?id= 가 있을 때만).
   shared/api-select.js fetchSelectSession 이 같은 id 면 이 약속을 먼저 쓰고, 실패·지연이면 정상 경로. CSP 가 script-src 'self' 라 인라인 대신 파일.
   URL 은 shared/config.js readApiBaseUrl(셔틀 배포 ID, -i 재배포라 고정)과 같아야 한다. */
(function () {
  var id = new URLSearchParams(location.search).get('id') || '';
  if (!id) return;
  window.__smSessionEarlyId = id;
  window.__smSessionEarly = fetch('https://script.google.com/macros/s/AKfycbyb1y964F-MAO4-043gq3LdIg9fPqXb-My_1iV1qcjQwQIiZnfMl17i0wAnRBn6tAj6/exec?api=select-session&id=' + encodeURIComponent(id) + '&_ts=' + Date.now(), { cache: 'no-store' });
  window.__smSessionEarly.catch(function () {});
})();
