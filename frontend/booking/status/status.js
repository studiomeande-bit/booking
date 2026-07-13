/* Studio mean — 고객 예약 상태 포털.
 * ?ref=<row:N:token> 로 예약을 조회해 상태/결제/변경·취소를 보여준다.
 * 순수 JS (빌드 불필요). 변경/취소는 서버가 준 서명 링크(기존 흐름)로 이동한다. */
(function () {
  'use strict';

  var API_BASE = 'https://script.google.com/macros/s/AKfycbxnHuB2u4-pDD23JDdFDpHB0ZIzGxLWm15Xgc7_-qkyOTctNpGlYDMIcQyq4KB7QC6X8w/exec';
  var params = new URLSearchParams(location.search);
  var ref = (params.get('ref') || '').trim();
  var lang = normalizeLang(params.get('lang') || document.documentElement.lang || 'ko');
  var data = null;

  var T = {
    ko: {
      loading: '예약 정보를 불러오는 중입니다…',
      errTitle: '링크를 확인할 수 없습니다',
      errText: '링크가 만료되었거나 올바르지 않습니다. 예약 확인 메일의 버튼을 다시 눌러 주세요. 문의는 아래 이메일로 부탁드립니다.',
      greet: '예약 확인',
      product: '상품', datetime: '일시', people: '인원', location: '장소',
      peopleUnit: '명', returnBadge: '재방문 고객',
      payment: '결제 안내', total: '총 금액', deposit: '계약금', balance: '잔금',
      paid: '입금 완료', unpaid: '입금 대기', payMethodLabel: '결제수단',
      payNote: '계약금 입금 후 예약이 확정됩니다. 입금 확인은 영업일 기준 1~2일 소요될 수 있습니다.',
      manage: '예약 변경·취소', manageIntro: '일정 변경 또는 취소가 필요하시면 아래에서 신청해 주세요. 요청 후 스튜디오 확인을 거쳐 처리됩니다.',
      reschedule: '📅 일정 변경 신청', cancel: '📩 예약 취소 요청',
      thread: '1:1 문의', threadIntro: '예약 관련 문의를 남겨주세요. 스튜디오 답장은 이곳과 이메일로 함께 전달됩니다.',
      threadEmpty: '아직 주고받은 메시지가 없습니다.', threadPlaceholder: '문의 내용을 입력해 주세요…',
      threadSend: '보내기', threadSending: '전송 중…', threadSent: '전송되었습니다. 답장은 보통 영업일 기준 하루 안에 드립니다.',
      threadError: '전송에 실패했습니다. 잠시 후 다시 시도해 주세요.', threadMe: '나', threadStudio: 'Studio mean',
      info: '오시는 길·문의', map: '지도에서 보기', mail: '이메일 문의',
      memoLabel: '요청사항',
      noManage: '이 예약은 현재 온라인 변경이 어렵습니다. 도움이 필요하시면 이메일로 연락 주세요.'
    },
    en: {
      loading: 'Loading your booking…',
      errTitle: 'We couldn’t open this link',
      errText: 'The link may have expired or is invalid. Please use the button in your confirmation email again, or contact us below.',
      greet: 'Booking overview',
      product: 'Package', datetime: 'Date & time', people: 'People', location: 'Location',
      peopleUnit: '', returnBadge: 'Returning client',
      payment: 'Payment', total: 'Total', deposit: 'Deposit', balance: 'Balance',
      paid: 'Paid', unpaid: 'Pending', payMethodLabel: 'Method',
      payNote: 'Your booking is confirmed once the deposit is received. Payment confirmation may take 1–2 business days.',
      manage: 'Change or cancel', manageIntro: 'Need to reschedule or cancel? Request below and the studio will process it after review.',
      reschedule: '📅 Request reschedule', cancel: '📩 Request cancellation',
      thread: 'Messages', threadIntro: 'Leave a message about your booking. Our replies appear here and are also emailed to you.',
      threadEmpty: 'No messages yet.', threadPlaceholder: 'Type your message…',
      threadSend: 'Send', threadSending: 'Sending…', threadSent: 'Sent! We usually reply within one business day.',
      threadError: 'Could not send. Please try again shortly.', threadMe: 'Me', threadStudio: 'Studio mean',
      info: 'Directions & contact', map: 'Open in Maps', mail: 'Email us',
      memoLabel: 'Your note',
      noManage: 'Online changes aren’t available for this booking. Please email us if you need help.'
    },
    de: {
      loading: 'Ihre Buchung wird geladen…',
      errTitle: 'Link konnte nicht geöffnet werden',
      errText: 'Der Link ist möglicherweise abgelaufen oder ungültig. Bitte nutzen Sie erneut die Schaltfläche in Ihrer Bestätigungs-E-Mail oder kontaktieren Sie uns unten.',
      greet: 'Buchungsübersicht',
      product: 'Paket', datetime: 'Datum & Zeit', people: 'Personen', location: 'Ort',
      peopleUnit: '', returnBadge: 'Stammkunde',
      payment: 'Zahlung', total: 'Gesamt', deposit: 'Anzahlung', balance: 'Restbetrag',
      paid: 'Bezahlt', unpaid: 'Offen', payMethodLabel: 'Methode',
      payNote: 'Ihre Buchung ist bestätigt, sobald die Anzahlung eingegangen ist. Die Bestätigung kann 1–2 Werktage dauern.',
      manage: 'Ändern oder stornieren', manageIntro: 'Termin ändern oder stornieren? Bitte unten anfragen – das Studio bearbeitet Ihre Anfrage nach Prüfung.',
      reschedule: '📅 Termin ändern', cancel: '📩 Stornierung anfragen',
      thread: 'Nachrichten', threadIntro: 'Hinterlassen Sie eine Nachricht zu Ihrer Buchung. Unsere Antworten erscheinen hier und per E-Mail.',
      threadEmpty: 'Noch keine Nachrichten.', threadPlaceholder: 'Ihre Nachricht…',
      threadSend: 'Senden', threadSending: 'Wird gesendet…', threadSent: 'Gesendet! Wir antworten in der Regel innerhalb eines Werktags.',
      threadError: 'Senden fehlgeschlagen. Bitte später erneut versuchen.', threadMe: 'Ich', threadStudio: 'Studio mean',
      info: 'Anfahrt & Kontakt', map: 'In Maps öffnen', mail: 'E-Mail schreiben',
      memoLabel: 'Ihre Notiz',
      noManage: 'Online-Änderungen sind für diese Buchung nicht möglich. Bitte kontaktieren Sie uns per E-Mail.'
    }
  };

  function normalizeLang(l) {
    l = String(l || '').toLowerCase().slice(0, 2);
    return (l === 'en' || l === 'de') ? l : 'ko';
  }
  function $(id) { return document.getElementById(id); }
  function show(id) { $(id).classList.remove('hidden'); }
  function hide(id) { $(id).classList.add('hidden'); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function euro(v) {
    var n = Number(v) || 0;
    return '€' + (Math.round(n * 100) / 100).toLocaleString('de-DE');
  }
  function statusTone(status) {
    if (['확정됨', '작업완료', '셀렉완료', '촬영완료'].indexOf(status) > -1) return 'ok';
    if (['대기중', '변경대기'].indexOf(status) > -1) return 'warn';
    return 'muted';
  }
  var STATUS_LABELS = {
    '대기중': { ko: '예약 접수 · 입금/확정 대기', en: 'Received · awaiting deposit', de: 'Eingegangen · Anzahlung offen' },
    '확정됨': { ko: '예약 확정', en: 'Confirmed', de: 'Bestätigt' },
    '변경대기': { ko: '일정 변경 검토 중', en: 'Reschedule under review', de: 'Änderung in Prüfung' },
    '촬영연기': { ko: '촬영 연기 · 재예약 필요', en: 'Postponed · rebooking needed', de: 'Verschoben · Neubuchung' },
    '촬영완료': { ko: '촬영 완료', en: 'Shoot completed', de: 'Shooting abgeschlossen' },
    '셀렉완료': { ko: '사진 선택 완료 · 보정 진행', en: 'Selection done · retouching', de: 'Auswahl fertig · Retusche' },
    '작업완료': { ko: '작업 완료', en: 'Completed', de: 'Abgeschlossen' },
    '취소됨': { ko: '취소됨', en: 'Cancelled', de: 'Storniert' },
    '자동취소': { ko: '자동 취소 · 미입금', en: 'Auto-cancelled', de: 'Automatisch storniert' }
  };
  function statusLabelFor(status) {
    var e = STATUS_LABELS[String(status || '').trim()];
    if (e) return e[lang] || e.ko;
    return data && data.statusLabel ? data.statusLabel : (status || '');
  }

  function boot() {
    wireLang();
    if (!ref) { showError(); return; }
    fetchStatus();
  }

  function wireLang() {
    Array.prototype.forEach.call(document.querySelectorAll('.lang-btn'), function (btn) {
      btn.addEventListener('click', function () {
        lang = normalizeLang(btn.dataset.lang);
        document.documentElement.lang = lang;
        Array.prototype.forEach.call(document.querySelectorAll('.lang-btn'), function (b) {
          b.classList.toggle('active', b.dataset.lang === lang);
        });
        if (data) render(); else applyStaticLabels();
      });
    });
    // 언어 버튼 초기 상태
    Array.prototype.forEach.call(document.querySelectorAll('.lang-btn'), function (b) {
      b.classList.toggle('active', b.dataset.lang === lang);
    });
    applyStaticLabels();
  }

  function applyStaticLabels() {
    var t = T[lang];
    $('loadingText').textContent = t.loading;
    $('errorTitle').textContent = t.errTitle;
    $('errorText').textContent = t.errText;
  }

  function showError(msg) {
    hide('loadingCard'); hide('statusApp'); show('errorCard');
    if (msg) $('errorText').textContent = msg;
  }

  function fetchStatus() {
    var url = API_BASE + '?api=booking-status&ref=' + encodeURIComponent(ref) + '&_ts=' + Date.now();
    fetch(url, { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (res) {
        var d = res && (res.data || res);
        if (!res || res.ok === false || !d || d.ok === false) { showError(); return; }
        data = d;
        if (d.lang) { /* keep user-chosen lang if they switched; else use booking lang */ }
        render();
      })
      .catch(function () { showError(); });
  }

  function summaryItem(label, value) {
    if (!value) return '';
    return '<div class="sum-item"><div class="sum-label">' + esc(label) + '</div><div class="sum-value">' + esc(value) + '</div></div>';
  }

  function render() {
    var t = T[lang];
    hide('loadingCard'); hide('errorCard'); show('statusApp');

    $('greetLabel').textContent = t.greet;
    $('customerName').textContent = data.name || '';
    var badge = $('statusBadge');
    badge.textContent = statusLabelFor(data.status);
    badge.className = 'badge tone-' + statusTone(data.status);

    var peopleTxt = data.people ? (data.people + (t.peopleUnit ? (' ' + t.peopleUnit) : '')) : '';
    $('summaryGrid').innerHTML =
      summaryItem(t.product, data.product) +
      summaryItem(t.datetime, [data.date, data.time].filter(Boolean).join(' ')) +
      summaryItem(t.people, peopleTxt) +
      summaryItem(t.location, data.location) +
      (data.isReturn ? '<div class="sum-item"><span class="ret-badge">✦ ' + esc(t.returnBadge) + '</span></div>' : '');

    if (data.requestMemo) {
      $('requestMemoLabel').textContent = t.memoLabel;
      $('requestMemoText').textContent = data.requestMemo;
      show('requestMemoBlock');
    } else { hide('requestMemoBlock'); }

    // 결제
    $('paymentTitle').textContent = t.payment;
    var rows = '';
    rows += payRow(t.total, euro(data.total), null);
    if (Number(data.deposit) > 0) rows += payRow(t.deposit, euro(data.deposit), data.depositPaid ? 'paid' : 'unpaid');
    if (Number(data.balance) > 0) rows += payRow(t.balance, euro(data.balance), data.balancePaid ? 'paid' : 'unpaid');
    $('payRows').innerHTML = rows;
    $('payNote').textContent = t.payNote;

    // 변경·취소
    $('manageTitle').textContent = t.manage;
    if (data.canManage && (data.rescheduleUrl || data.cancelUrl)) {
      $('manageIntro').textContent = t.manageIntro;
      var btns = '';
      if (data.rescheduleUrl) btns += '<a class="btn btn-primary" href="' + esc(data.rescheduleUrl) + '">' + esc(t.reschedule) + '</a>';
      if (data.cancelUrl) btns += '<a class="btn btn-ghost" href="' + esc(data.cancelUrl) + '">' + esc(t.cancel) + '</a>';
      $('manageBtns').innerHTML = btns;
    } else {
      $('manageIntro').textContent = t.noManage;
      $('manageBtns').innerHTML = '';
    }

    // 1:1 문의 스레드
    $('threadTitle').textContent = '💬 ' + t.thread;
    $('threadIntro').textContent = t.threadIntro;
    $('threadInput').placeholder = t.threadPlaceholder;
    $('threadSendBtn').textContent = t.threadSend;
    renderThread(threadMessages);
    if (!threadLoaded) loadThread();

    // 오시는 길 · 문의
    $('infoTitle').textContent = t.info;
    // directions는 우리 서버(booking-status API)가 메일과 동일한 템플릿으로 만든 신뢰 HTML
    var dir = (data.directions && (data.directions[lang] || data.directions.ko)) || '';
    $('directionsBox').innerHTML = dir;
    $('directionsBox').classList.toggle('hidden', !dir);
    var mapBtn = $('mapBtn');
    mapBtn.textContent = '📍 ' + t.map;
    mapBtn.href = data.mapUrl || '#';
    $('mailBtn').textContent = '✉ ' + t.mail;
    $('mailBtn').href = 'mailto:' + (data.adminEmail || 'studio.mean.de@gmail.com');
    $('igBtn').href = data.instagramUrl || 'https://instagram.com/studio_mean';
  }

  function payRow(label, value, paidState) {
    var t = T[lang];
    var chip = '';
    if (paidState === 'paid') chip = '<span class="pay-chip paid">✓ ' + esc(t.paid) + '</span>';
    else if (paidState === 'unpaid') chip = '<span class="pay-chip unpaid">' + esc(t.unpaid) + '</span>';
    return '<div class="pay-row"><span class="pay-label">' + esc(label) + '</span><span class="pay-right"><b>' + esc(value) + '</b>' + chip + '</span></div>';
  }

  /* ── 1:1 문의 스레드 ── */
  var threadMessages = [];
  var threadLoaded = false;
  var threadTimer = null;

  function requestId() {
    return 'thr_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10);
  }

  function renderThread(messages) {
    var t = T[lang];
    var list = $('threadList');
    if (!messages || !messages.length) {
      list.innerHTML = '<div class="thread-empty">' + esc(t.threadEmpty) + '</div>';
      return;
    }
    list.innerHTML = messages.map(function (m) {
      var mine = m.direction !== 'studio';
      return '<div class="thread-msg ' + (mine ? 'mine' : 'studio') + '">'
        + esc(m.message)
        + '<div class="thread-meta">' + esc(mine ? t.threadMe : t.threadStudio) + ' · ' + esc(m.at || '') + '</div></div>';
    }).join('');
    list.scrollTop = list.scrollHeight;
  }

  function loadThread() {
    var url = API_BASE + '?api=booking-messages&ref=' + encodeURIComponent(ref) + '&_ts=' + Date.now();
    fetch(url, { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (res) {
        var d = res && (res.data || res);
        if (!res || res.ok === false || !d || d.ok === false) return;
        threadLoaded = true;
        threadMessages = d.messages || [];
        renderThread(threadMessages);
      })
      .catch(function () {});
    if (!threadTimer) threadTimer = setInterval(function () {
      if (document.visibilityState === 'visible') loadThread();
    }, 45000);
  }

  function sendThreadMessage() {
    var t = T[lang];
    var input = $('threadInput');
    var btn = $('threadSendBtn');
    var text = String(input.value || '').trim();
    var hint = $('threadHint');
    if (!text) return;
    btn.disabled = true;
    btn.textContent = t.threadSending;
    hint.textContent = '';
    fetch(API_BASE + '?api=booking-message-send', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ requestId: requestId(), data: { ref: ref, message: text } })
    })
      .then(function (r) { return r.json(); })
      .then(function (res) {
        btn.disabled = false;
        btn.textContent = t.threadSend;
        var d = res && (res.data || res);
        if (!res || res.ok === false || !d || d.ok === false) {
          hint.textContent = (d && d.message) || (res && res.error && res.error.message) || t.threadError;
          return;
        }
        input.value = '';
        threadMessages = d.messages || threadMessages;
        renderThread(threadMessages);
        hint.textContent = t.threadSent;
      })
      .catch(function () {
        btn.disabled = false;
        btn.textContent = t.threadSend;
        hint.textContent = t.threadError;
      });
  }

  document.addEventListener('DOMContentLoaded', function () {});
  (function wireThread() {
    var btn = $('threadSendBtn');
    if (btn) btn.addEventListener('click', sendThreadMessage);
    var input = $('threadInput');
    if (input) input.addEventListener('keydown', function (ev) {
      if ((ev.metaKey || ev.ctrlKey) && ev.key === 'Enter') sendThreadMessage();
    });
  })();

  boot();
})();
