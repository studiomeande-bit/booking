/* init 선요청 — 번들(booking.min.js, 본문 끝)이 내려와 실행되기까지 ~1초를 기다리지 않고 <head> 에서 바로 셔틀에 띄운다.
   shared/api-booking.js fetchInitData 가 이 약속을 먼저 쓰고, 실패·지연이면 정상 경로. CSP 가 script-src 'self' 라 인라인 대신 파일.
   URL 은 shared/config.js readApiBaseUrl(셔틀 배포 ID, -i 재배포라 고정)과 같아야 한다. */
window.__smInitEarly = fetch('https://script.google.com/macros/s/AKfycbyb1y964F-MAO4-043gq3LdIg9fPqXb-My_1iV1qcjQwQIiZnfMl17i0wAnRBn6tAj6/exec?api=init&_ts=' + Date.now(), { cache: 'no-store' });
window.__smInitEarly.catch(function () {});
/* 달력 선워밍 — 누군가 예약한 직후엔 가용성 캐시가 비어 첫 달력이 7~12초 걸린다(2026-09-21 실측). 방문자가 상품을 고르는 동안
   셔틀이 월 이벤트를 미리 계산하게 쏘고 잊는다(응답을 쓰지 않는다). 이미 웜이면 셔틀은 캐시만 확인하고 끝낸다. */
fetch('https://script.google.com/macros/s/AKfycbyb1y964F-MAO4-043gq3LdIg9fPqXb-My_1iV1qcjQwQIiZnfMl17i0wAnRBn6tAj6/exec?api=warm-months&_ts=' + Date.now(), { cache: 'no-store', keepalive: true }).catch(function () {});
