/* Studio mean — 포트폴리오 문의폼을 Apps Script 리드 API로 전송.
 * 성공: 리드 저장 + 관리자 알림 + 고객 자동답장 후 언어별 success 페이지로 이동.
 * 실패/타임아웃: 기존 PHP(submit.php) 메일 경로로 자동 폴백 (동작 저하 없음). */
(function () {
  'use strict';

  var API_BASE = 'https://script.google.com/macros/s/AKfycbxnHuB2u4-pDD23JDdFDpHB0ZIzGxLWm15Xgc7_-qkyOTctNpGlYDMIcQyq4KB7QC6X8w/exec';
  var TIMEOUT_MS = 12000;

  var form = document.querySelector('form[name="portfolio-contact"]');
  if (!form || !window.fetch) return;

  var fallingBack = false;

  function requestId() {
    return 'lead_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10);
  }

  function collectUtm() {
    try {
      var params = new URLSearchParams(window.location.search);
      var parts = [];
      params.forEach(function (value, key) {
        if (/^utm_/i.test(key) && value) parts.push(key + '=' + value);
      });
      return parts.join('&');
    } catch (e) {
      return '';
    }
  }

  function buildPayload() {
    var fd = new FormData(form);
    return {
      name: String(fd.get('name') || '').trim(),
      email: String(fd.get('email') || '').trim(),
      phone: String(fd.get('phone') || '').trim(),
      project_type: String(fd.get('project_type') || '').trim(),
      preferred_date: String(fd.get('preferred_date') || '').trim(),
      location: String(fd.get('location') || '').trim(),
      message: String(fd.get('message') || '').trim(),
      privacy_consent: !!fd.get('privacy_consent'),
      site_language: String(fd.get('site_language') || '').trim(),
      'bot-field': String(fd.get('bot-field') || ''),
      source: 'portfolio-contact',
      sourceUrl: window.location.href,
      utm: collectUtm(),
      userAgent: navigator.userAgent || ''
    };
  }

  function nativeFallback() {
    if (fallingBack) return;
    fallingBack = true;
    // requestSubmit이 아닌 submit(): 우리 핸들러를 다시 타지 않고 PHP action으로 전송
    form.submit();
  }

  form.addEventListener('submit', function (event) {
    if (fallingBack) return; // 폴백 경로는 브라우저 기본 제출에 맡김
    event.preventDefault();

    var button = form.querySelector('button[type="submit"]');
    var originalText = button ? button.textContent : '';
    if (button) {
      button.disabled = true;
      button.setAttribute('aria-busy', 'true');
    }

    var controller = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = setTimeout(function () {
      if (controller) controller.abort();
    }, TIMEOUT_MS);

    fetch(API_BASE + '?api=portfolio-lead', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ requestId: requestId(), data: buildPayload() }),
      signal: controller ? controller.signal : undefined
    })
      .then(function (response) { return response.json(); })
      .then(function (result) {
        clearTimeout(timer);
        var data = result && (result.data || result);
        if (result && result.ok && data && data.ok !== false) {
          window.location.href = (data.successPath || '/contact/success/');
          return;
        }
        throw new Error((result && result.message) || 'lead api rejected');
      })
      .catch(function () {
        clearTimeout(timer);
        if (button) {
          button.disabled = false;
          button.removeAttribute('aria-busy');
          button.textContent = originalText;
        }
        nativeFallback();
      });
  });
})();
