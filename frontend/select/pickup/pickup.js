/* Studio mean — 출력 후 픽업 예약 페이지 (트라이링구얼, 자립형)
   세션ID(?id=)가 접근권한. 서버(select-pickup-schedule)가 인화완료·pickup 방식·슬롯을 재검증한다. */
(function () {
  'use strict';

  var API_BASE = 'https://script.google.com/macros/s/AKfycbxnHuB2u4-pDD23JDdFDpHB0ZIzGxLWm15Xgc7_-qkyOTctNpGlYDMIcQyq4KB7QC6X8w/exec';
  var STUDIO_ADDR = 'Studio mean · Holzweg-Passage 3, 61440 Oberursel (Taunus)';

  var $ = function (id) { return document.getElementById(id); };
  var qs = new URLSearchParams(location.search);
  var sessionId = String(qs.get('id') || '').trim();

  var LANG = 'ko';
  var session = null;
  var calYear = 0, calMonth = 0; // calMonth: 0-based (백엔드 getSelectPickupCalendarBatch_와 동일)
  var calCache = {};             // 'y-m' → {unavail:[], slotsByDate:{}}
  var selDate = '', selTime = '';
  var busy = false;

  var T = {
    title:      { ko: '픽업 시간 예약', en: 'Book Your Pickup Time', de: 'Abholtermin buchen' },
    lede:       { ko: '인화가 완료된 사진을 수령할 시간을 선택해 주세요.', en: 'Choose a time to collect your finished prints.', de: 'Wählen Sie eine Zeit, um Ihre fertigen Abzüge abzuholen.' },
    loading:    { ko: '불러오는 중입니다…', en: 'Loading…', de: 'Wird geladen…' },
    noSession:  { ko: '유효하지 않은 링크입니다. 안내 메일의 링크로 다시 접속해 주세요.', en: 'Invalid link. Please use the link from our email.', de: 'Ungültiger Link. Bitte nutzen Sie den Link aus unserer E-Mail.' },
    notPickup:  { ko: '이 세션은 픽업 수령으로 신청되어 있지 않습니다. 변경을 원하시면 스튜디오로 연락해 주세요.', en: 'This session is not set for studio pickup. Please contact us if you would like to change it.', de: 'Diese Sitzung ist nicht für Abholung vorgesehen. Bitte kontaktieren Sie uns für eine Änderung.' },
    notPrinted: { ko: '아직 인화 준비 중입니다. 인화가 완료되면 예약 안내 메일을 보내드립니다. 😊', en: 'Your prints are still in production. We will email you as soon as they are ready. 😊', de: 'Ihre Abzüge sind noch in Bearbeitung. Wir informieren Sie per E-Mail, sobald sie fertig sind. 😊' },
    ready:      { ko: '인화가 완료되었습니다! 아래에서 편하신 시간을 선택해 주세요.', en: 'Your prints are ready! Please pick a convenient time below.', de: 'Ihre Abzüge sind fertig! Bitte wählen Sie unten eine passende Zeit.' },
    calTitle:   { ko: '날짜 선택', en: 'Choose a date', de: 'Datum wählen' },
    calCopy:    { ko: '스튜디오 운영 일정이 있는 날에만 픽업이 가능합니다.', en: 'Pickup is available on days the studio is open on site.', de: 'Abholung ist nur an Tagen mit Studiobetrieb möglich.' },
    pickDay:    { ko: '날짜를 먼저 선택해 주세요.', en: 'Please select a date first.', de: 'Bitte wählen Sie zuerst ein Datum.' },
    slotsFor:   { ko: '픽업 가능 시간', en: 'Available times', de: 'Verfügbare Zeiten' },
    noSlots:    { ko: '선택한 날짜에 가능한 시간이 없습니다. 다른 날짜를 선택해 주세요.', en: 'No times available on this date. Please choose another day.', de: 'An diesem Tag sind keine Zeiten verfügbar. Bitte wählen Sie einen anderen Tag.' },
    confirm:    { ko: '픽업 예약 확정', en: 'Confirm Pickup', de: 'Abholung bestätigen' },
    confirming: { ko: '예약 중…', en: 'Booking…', de: 'Wird gebucht…' },
    booked:     { ko: '픽업이 예약되었습니다!', en: 'Your pickup is booked!', de: 'Ihre Abholung ist gebucht!' },
    successNote:{ ko: '확인 메일을 보내드렸습니다. 일정 변경이 필요하시면 이 페이지에서 다시 선택하시면 됩니다.', en: 'A confirmation email is on its way. Need to change it? Just pick a new slot on this page.', de: 'Eine Bestätigungs-E-Mail ist unterwegs. Terminänderung? Wählen Sie hier einfach einen neuen Slot.' },
    current:    { ko: '현재 예약된 픽업', en: 'Current pickup appointment', de: 'Aktueller Abholtermin' },
    change:     { ko: '다른 시간으로 변경하기', en: 'Choose a different time', de: 'Anderen Termin wählen' },
    loadFail:   { ko: '일정을 불러오지 못했습니다. 잠시 후 새로고침해 주세요.', en: 'Could not load the calendar. Please refresh shortly.', de: 'Kalender konnte nicht geladen werden. Bitte später aktualisieren.' },
    weekdays:   { ko: ['일','월','화','수','목','금','토'], en: ['Su','Mo','Tu','We','Th','Fr','Sa'], de: ['So','Mo','Di','Mi','Do','Fr','Sa'] },
    monthLabel: { ko: function (y, m) { return y + '년 ' + (m + 1) + '월'; },
                  en: function (y, m) { return ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][m] + ' ' + y; },
                  de: function (y, m) { return ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'][m] + ' ' + y; } }
  };
  function t(key) { var e = T[key]; return (e && (e[LANG] || e.ko)) || key; }

  function buildUrl(route, params) {
    var u = API_BASE + '?api=' + encodeURIComponent(route) + '&_ts=' + Date.now();
    Object.keys(params || {}).forEach(function (k) {
      var v = params[k];
      if (v === undefined || v === null || v === '') return;
      u += '&' + encodeURIComponent(k) + '=' + encodeURIComponent(v);
    });
    return u;
  }
  function fetchJson(url) {
    return fetch(url, { cache: 'no-store' }).then(function (r) { return r.text(); }).then(function (text) {
      var payload; try { payload = JSON.parse(text); } catch (e) { throw new Error('Invalid response'); }
      if (!payload.ok) throw new Error((payload.error && payload.error.message) || 'Request failed');
      return payload.data;
    });
  }
  function postData(route, data) {
    return fetch(buildUrl(route, {}), {
      method: 'POST', cache: 'no-store',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ data: data })
    }).then(function (r) { return r.text(); }).then(function (text) {
      var payload; try { payload = JSON.parse(text); } catch (e) { throw new Error('Invalid response'); }
      if (!payload.ok) throw new Error((payload.error && payload.error.message) || 'Request failed');
      return payload.data;
    });
  }

  function setBanner(msg, cls) {
    var el = $('statusBanner');
    el.textContent = msg;
    el.className = 'status-banner' + (cls ? ' ' + cls : '');
    el.classList.remove('hidden');
  }
  function applyStaticText() {
    $('pageTitle').textContent = t('title');
    $('pageLede').textContent = t('lede');
    $('calTitle').textContent = t('calTitle');
    $('calCopy').textContent = t('calCopy');
    $('confirmBtn').textContent = t('confirm');
    $('changeBtn').textContent = t('change');
    $('rebookBtn').textContent = t('change');
    var row = $('weekdayRow');
    row.innerHTML = '';
    t('weekdays').forEach(function (w) {
      var s = document.createElement('span'); s.textContent = w; row.appendChild(s);
    });
  }

  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  // '오늘'은 스튜디오 기준(Europe/Berlin) — 다른 시간대 고객의 하루 오차 방지
  function todayStr() {
    try {
      return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin' }).format(new Date());
    } catch (e) {
      var d = new Date();
      return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
    }
  }

  function loadMonth(y, m) {
    var key = y + '-' + m;
    if (calCache[key]) return Promise.resolve(calCache[key]);
    return fetchJson(buildUrl('select-pickup-calendar', { year: y, month: m })).then(function (data) {
      calCache[key] = data || { unavail: [], slotsByDate: {} };
      return calCache[key];
    });
  }

  function renderCalendar() {
    var label = T.monthLabel[LANG] || T.monthLabel.ko;
    $('monthLabel').textContent = label(calYear, calMonth);
    // 과거 달로는 이동 금지 (베를린 기준 오늘)
    var tp = todayStr().split('-');
    var nowY = parseInt(tp[0], 10), nowM = parseInt(tp[1], 10) - 1;
    $('prevMonthBtn').disabled = calYear < nowY || (calYear === nowY && calMonth <= nowM);
    var grid = $('calGrid');
    grid.innerHTML = '';
    loadMonth(calYear, calMonth).then(function (data) {
      var unavail = {};
      (data.unavail || []).forEach(function (d) { unavail[d] = true; });
      var slotsByDate = data.slotsByDate || {};
      var first = new Date(calYear, calMonth, 1);
      var days = new Date(calYear, calMonth + 1, 0).getDate();
      var today = todayStr();
      for (var i = 0; i < first.getDay(); i++) {
        var pad = document.createElement('button');
        pad.type = 'button'; pad.className = 'day-btn empty'; pad.disabled = true;
        grid.appendChild(pad);
      }
      for (var d = 1; d <= days; d++) {
        (function (d) {
          var dateStr = calYear + '-' + pad2(calMonth + 1) + '-' + pad2(d);
          var btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'day-btn' + (dateStr === selDate ? ' selected' : '');
          btn.textContent = String(d);
          var hasSlots = Array.isArray(slotsByDate[dateStr]) ? slotsByDate[dateStr].length > 0 : !unavail[dateStr];
          // 당일 픽업 허용(백엔드가 리드타임 반영해 슬롯 제공) — 과거 날짜만 차단
          btn.disabled = dateStr < today || unavail[dateStr] || !hasSlots;
          btn.addEventListener('click', function () { selectDate(dateStr); });
          grid.appendChild(btn);
        })(d);
      }
    }).catch(function () {
      setBanner(t('loadFail'), 'error');
    });
  }

  function selectDate(dateStr) {
    selDate = dateStr; selTime = '';
    $('confirmBtn').disabled = true;
    renderCalendar();
    $('slotHint').textContent = dateStr + ' · ' + t('slotsFor');
    var grid = $('slotGrid');
    grid.innerHTML = '<div class="empty-state">' + t('loading') + '</div>';
    // 신선도: 확정 직전 슬롯은 배치 캐시가 아닌 실시간 조회로 확인
    fetchJson(buildUrl('select-pickup-slots', { date: dateStr, ignoreEventId: (session && session.existingPickupEventId) || '' }))
      .then(function (data) {
        var slots = (data && (data.slots || data)) || [];
        if (!Array.isArray(slots)) slots = [];
        grid.innerHTML = '';
        if (!slots.length) {
          grid.innerHTML = '<div class="empty-state">' + t('noSlots') + '</div>';
          return;
        }
        slots.forEach(function (slot) {
          var time = typeof slot === 'string' ? slot : (slot && (slot.time || slot.value)) || '';
          if (!time) return;
          var btn = document.createElement('button');
          btn.type = 'button'; btn.className = 'slot-btn'; btn.textContent = time;
          btn.addEventListener('click', function () {
            selTime = time;
            Array.prototype.forEach.call(grid.querySelectorAll('.slot-btn'), function (b) { b.classList.remove('selected'); });
            btn.classList.add('selected');
            $('confirmBtn').disabled = false;
          });
          grid.appendChild(btn);
        });
      })
      .catch(function () { grid.innerHTML = '<div class="empty-state">' + t('loadFail') + '</div>'; });
  }

  function showSuccess(pickupAt) {
    $('schedulerCard').classList.add('hidden');
    $('currentBox').classList.add('hidden');
    $('statusBanner').classList.add('hidden');
    $('successCard').classList.remove('hidden');
    $('successWhen').textContent = pickupAt;
    $('successAddr').textContent = STUDIO_ADDR;
    $('successNote').textContent = t('successNote');
  }

  function onConfirm() {
    if (busy || !selDate || !selTime) return;
    busy = true;
    var btn = $('confirmBtn');
    btn.disabled = true; btn.textContent = t('confirming');
    postData('select-pickup-schedule', { sessionId: sessionId, pickupDate: selDate, pickupTime: selTime })
      .then(function (data) {
        showSuccess((data && data.pickupAt) || (selDate + ' ' + selTime));
        setBanner(t('booked'), 'ok');
        $('statusBanner').classList.remove('hidden');
      })
      .catch(function (err) {
        setBanner(err.message || t('loadFail'), 'error');
        btn.textContent = t('confirm');
        btn.disabled = false;
        // 슬롯 마감 등: 최신 상태로 다시 표시
        calCache = {};
        if (selDate) selectDate(selDate);
      })
      .then(function () { busy = false; });
  }

  function showScheduler() {
    $('schedulerCard').classList.remove('hidden');
    var now = new Date();
    calYear = now.getFullYear(); calMonth = now.getMonth();
    $('slotHint').textContent = '';
    $('slotGrid').innerHTML = '<div class="empty-state">' + t('pickDay') + '</div>';
    renderCalendar();
  }

  function init() {
    applyStaticText();
    if (!sessionId) { setBanner(t('noSession'), 'error'); return; }
    setBanner(t('loading'));
    fetchJson(buildUrl('select-session', { id: sessionId }))
      .then(function (data) {
        // 제출된 세션은 {ok:false, submitted:true, ...} 형태로 온다 — 픽업 안내를 받는 고객은
        // 전원 제출 완료 상태이므로 submitted면 정상 세션으로 취급한다.
        if (!data || (data.ok === false && !data.submitted)) { setBanner((data && data.message) || t('noSession'), 'error'); return; }
        session = data;
        var lang = String(session.lang || 'ko').toLowerCase();
        LANG = (lang === 'en' || lang === 'de') ? lang : 'ko';
        applyStaticText();

        var method = String(session.existingDeliveryMethod || '').trim();
        var pickupAt = String(session.existingPickupAt || '').trim();
        var printed = String(session.printDoneAt || '').trim();

        if (method !== 'pickup') { setBanner(t('notPickup'), 'error'); return; }

        if (pickupAt) {
          $('currentBox').classList.remove('hidden');
          $('currentLine').textContent = t('current') + ': ' + pickupAt;
          if (printed) {
            // 변경 가능 (버튼으로 스케줄러 오픈)
            $('statusBanner').classList.add('hidden');
            $('changeBtn').classList.remove('hidden');
          } else {
            // 구흐름(출력 전 예약) 세션: 예약은 유지 — 이 페이지에선 변경 불가, 예약 정보만 표시
            $('changeBtn').classList.add('hidden');
            $('statusBanner').classList.add('hidden');
          }
          return;
        }

        if (!printed) { setBanner(t('notPrinted')); return; }

        setBanner(t('ready'), 'ok');
        showScheduler();
      })
      .catch(function () { setBanner(t('loadFail'), 'error'); });
  }

  $('confirmBtn').addEventListener('click', onConfirm);
  $('changeBtn').addEventListener('click', function () {
    $('currentBox').classList.add('hidden');
    setBanner(t('ready'), 'ok');
    showScheduler();
  });
  $('prevMonthBtn').addEventListener('click', function () {
    if (calMonth === 0) { calMonth = 11; calYear -= 1; } else { calMonth -= 1; }
    renderCalendar();
  });
  $('nextMonthBtn').addEventListener('click', function () {
    if (calMonth === 11) { calMonth = 0; calYear += 1; } else { calMonth += 1; }
    renderCalendar();
  });
  $('rebookBtn').addEventListener('click', function () { location.reload(); });

  init();
})();
