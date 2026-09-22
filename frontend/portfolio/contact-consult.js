/* 문의 폼 — 프로젝트 종류에 따라 상담 문항을 펼친다.
 *
 * 예전엔 페이지마다 인라인 <script> 였는데, 사이트 CSP(script-src 'self')가 인라인 실행을
 * 막아 세 언어 모두에서 상담 문항이 아예 펼쳐지지 않았다(2026-09-22 콘솔에서 확인).
 * 그래서 외부 파일로 빼고, 언어마다 다른 옵션 문구는 #consult-extra 의 data 속성에서 읽는다.
 * 값이 안 맞으면 조용히 숨겨 둔 채로 두므로 JS 차단 환경에서도 기본 문의는 그대로 제출된다.
 */
(function () {
  var sel = document.getElementById('contact-type');
  var box = document.getElementById('consult-extra');
  var comp = document.getElementById('consult-company-field');
  if (!sel || !box) return;

  function list(name) {
    return (box.getAttribute(name) || '').split('|')
      .map(function (s) { return s.trim(); }).filter(Boolean);
  }
  var TRIGGERS = list('data-consult-triggers');
  var CORPORATE = list('data-consult-company');

  function sync() {
    var v = String(sel.value || '').trim();
    box.hidden = TRIGGERS.indexOf(v) === -1;
    if (comp) comp.hidden = CORPORATE.indexOf(v) === -1;
  }
  sel.addEventListener('change', sync);
  sync();
})();
