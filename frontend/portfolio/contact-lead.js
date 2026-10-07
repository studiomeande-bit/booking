/* Studio mean — 포트폴리오 문의폼을 Apps Script 리드 API로 전송.
 * 성공: 리드 저장 + 관리자 알림 + 고객 자동답장 후 언어별 success 페이지로 이동.
 * 실패/타임아웃: 기존 PHP(submit.php) 메일 경로로 자동 폴백 (동작 저하 없음). */
(function () {
  'use strict';

  /* 스팸 차단(2026-10-01): 실제 방문자는 이 스크립트가 제출 직전 client_check='js.<페이지 연 뒤 ms>' 를 채운다.
     폼을 읽지 않고 submit.php 에 바로 POST 하는 봇은 이 칸이 비어 있어 서버가 접수하지 않는다(9~10월 스팸 48건 전부 그 경로).
     fetch 가 없는 옛 브라우저도 PHP 로 제출하므로 이 부분은 fetch 확인보다 앞에 둔다. */
  var loadedAt = Date.now();
  var checkForm = document.querySelector('form[name="portfolio-contact"]');
  function stampClientCheck() {
    if (!checkForm) return;
    var el = checkForm.querySelector('input[name="client_check"]');
    if (!el) {
      el = document.createElement('input');
      el.type = 'hidden';
      el.name = 'client_check';
      checkForm.appendChild(el);
    }
    el.value = 'js.' + Math.max(0, Date.now() - loadedAt);
  }
  if (checkForm) checkForm.addEventListener('submit', stampClientCheck, true);

  /* 모델 지원(2026-10-05, 컬러 프로필 모델 모집): 스토리 링크의 utm_campaign 에 'model' 이 있으면
     SNS·마케팅 게시 동의 체크박스를 보이고 필수로 만든다. 동의는 리드 시트 '마케팅동의'(Y)와
     메시지 앞머리의 버전 표기로 남는다 — 접수일시·IP·UA 와 함께 DSGVO Art. 7(1) 증빙.
     동의서 문구를 고치면 MODEL_CONSENT_VERSION 과 ko/model-consent/ 페이지 버전을 같이 올릴 것.
     fetch 없는 옛 브라우저(PHP 경로)도 체크박스는 보이도록 fetch 확인보다 앞에 둔다. */
  var MODEL_CONSENT_VERSION = 'v1';
  var isModelApply = /model/i.test((window.location.search.match(/[?&]utm_campaign=([^&]*)/i) || [])[1] || '');
  if (checkForm && isModelApply) {
    var consentLine = document.getElementById('contact-model-consent-line');
    var consentBox = document.getElementById('contact-model-consent');
    if (consentLine && consentBox) {
      consentLine.hidden = false;
      consentBox.required = true;
    }
    var typeSelect = checkForm.querySelector('select[name="project_type"]');
    if (typeSelect && !typeSelect.value) typeSelect.value = '프로필';
    var messageBox = checkForm.querySelector('textarea[name="message"]');
    if (messageBox && !messageBox.value) messageBox.value = '인스타 계정: @\n가능한 요일: ';
  }

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
    var projectType = String(fd.get('project_type') || '').trim();
    var preferredDate = String(fd.get('preferred_date') || '').trim();
    var modelConsent = isModelApply && !!fd.get('model_consent');
    var message = String(fd.get('message') || '').trim();
    if (modelConsent) message = '[SNS·마케팅 게시 동의서 ' + MODEL_CONSENT_VERSION + ' 동의]\n' + message;
    return {
      name: String(fd.get('name') || '').trim(),
      email: String(fd.get('email') || '').trim(),
      phone: String(fd.get('phone') || '').trim(),
      project_type: projectType,
      preferred_date: preferredDate,
      location: String(fd.get('location') || '').trim(),
      message: message,
      privacy_consent: !!fd.get('privacy_consent'),
      marketingConsent: modelConsent, // 리드 시트 '마케팅동의' 칸 — 모델 지원 때만 Y
      site_language: String(fd.get('site_language') || '').trim(),
      'bot-field': String(fd.get('bot-field') || ''),
      source: 'portfolio-contact',
      sourceUrl: window.location.href,
      utm: collectUtm(),
      userAgent: navigator.userAgent || '',
      formCheck: Math.max(0, Date.now() - loadedAt),
      // 상담 라우트가 쓰는 필드(submit.php 와 같은 모양) — 리드 라우트는 모르는 키라 무시한다.
      // 상담 라우트는 snake_case preferred_date 를 안 읽으므로 preferredDate 로도 싣는다.
      consultationType: projectType,
      typeLabel: projectType,
      preferredDate: preferredDate,
      shootDate: preferredDate,
      budget: String(fd.get('budget') || '').trim(),
      company: String(fd.get('company') || '').trim(),
      answers: {
        scope: String(fd.get('scope') || '').trim(),
        deliverables: String(fd.get('deliverables') || '').trim()
      }
    };
  }

  /* 웨딩·기업·영상 상담 문항(contact-consult.js 가 펼침)이 채워졌으면 상담 시트로 — submit.php $isConsultation 과 같은 규칙.
     2026-10-01 까지 이 경로는 항상 리드 시트로만 보내 회사·예산·범위가 사라졌다. */
  var UNDECIDED = ['미정', 'Not decided', 'Noch offen'];
  function isConsultation(p) {
    return p.answers.scope !== '' || p.company !== ''
      || (p.budget !== '' && UNDECIDED.indexOf(p.budget) === -1)
      || (p.answers.deliverables !== '' && UNDECIDED.indexOf(p.answers.deliverables) === -1);
  }
  // 상담 라우트 응답엔 successPath 가 없다 — 언어별 성공 페이지는 여기서 고른다
  var SUCCESS_PATHS = { en: '/en/contact/success/', ko: '/ko/contact/success/' };

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

    var payload = buildPayload();
    fetch(API_BASE + (isConsultation(payload) ? '?api=consultation' : '?api=portfolio-lead'), {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ requestId: requestId(), data: payload }),
      signal: controller ? controller.signal : undefined
    })
      .then(function (response) { return response.json(); })
      .then(function (result) {
        clearTimeout(timer);
        var data = result && (result.data || result);
        if (result && result.ok && data && data.ok !== false) {
          window.location.href = (data.successPath || SUCCESS_PATHS[payload.site_language] || '/contact/success/');
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
