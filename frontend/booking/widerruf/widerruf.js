/* Studio mean — 온라인 철회 (§ 356a BGB). docs/widerruf-function-plan.md
 * 입구 「Vertrag widerrufen」(예약 사이트 하단·고객 포털) → 이 페이지: 이름·계약·이메일 → 「Widerruf bestätigen」
 * → 서버 booking-withdraw 가 접수 시각을 찍고 수신확인 메일을 보낸다. 로그인 없음(법문 "ohne Weiteres").
 * ?ref=<포털 서명 ref> 로 오면 예약을 불러와 미리 채운다(고객이 확인·수정). 순수 JS, 빌드 없음. */
(function () {
  'use strict';

  var API_BASE = 'https://script.google.com/macros/s/AKfycbxnHuB2u4-pDD23JDdFDpHB0ZIzGxLWm15Xgc7_-qkyOTctNpGlYDMIcQyq4KB7QC6X8w/exec';
  var LANG_KEY = 'studio-mean-lang'; // 예약 페이지와 같은 키 — 고르던 언어로 열린다
  var W = window.SM_WIDERRUF_TEXT;
  var params = new URLSearchParams(location.search);
  var ref = (params.get('ref') || '').trim();
  var lang = normalizeLang(params.get('lang') || storedLang() || 'ko');
  var sending = false;

  var T = {
    ko: {
      intro: '예약 계약을 철회하시려면 아래 내용을 확인하고 「철회 확정」을 눌러 주세요. 접수되는 즉시 내용과 접수 시각이 담긴 확인 메일을 보내 드립니다.',
      name: '이름', contract: '철회할 계약', email: '수신 확인을 받을 이메일',
      contractHint: '예약한 상품과 촬영 일시(예: 스튜디오 Basic, 2026-10-10 11:00) 또는 계약 번호를 적어 주세요.',
      emailHint: '접수 확인은 이 주소로 보내 드립니다.',
      statement: '보내실 의사표시', sending: '보내는 중…',
      errName: '이름을 입력해 주세요.', errContract: '철회할 계약을 적어 주세요.', errEmail: '올바른 이메일 주소를 입력해 주세요.',
      errGeneric: '전송하지 못했습니다. 잠시 후 다시 시도하시거나 studio.mean.de@gmail.com 으로 철회 의사를 보내 주세요. 기간 안에 보내신 이메일도 똑같이 유효합니다.',
      doneTitle: '철회가 접수되었습니다',
      doneText: '아래 내용이 접수되었습니다. 같은 내용을 {email} 으로 보내 드렸습니다.',
      doneNoMail: '아래 내용이 접수되었습니다. 확인 메일을 보내지 못해 스튜디오가 따로 연락드립니다. 이 화면을 저장해 두세요.',
      received: '접수 일시',
      pass: '여권·비자 사진 예약은 무구속 예약이라 철회가 필요 없습니다. 예약 메일의 「예약 취소 요청」으로 취소만 해 주세요.'
    },
    en: {
      intro: 'To withdraw from your booking contract, check the details below and press “Confirm withdrawal”. We will immediately email you an acknowledgement with the content and the time of receipt.',
      name: 'Name', contract: 'Contract to withdraw from', email: 'Email for the acknowledgement',
      contractHint: 'The booked package and shoot date/time (e.g. Studio Basic, 2026-10-10 11:00) or the contract number.',
      emailHint: 'We will send the acknowledgement of receipt to this address.',
      statement: 'Your statement', sending: 'Sending…',
      errName: 'Please enter your name.', errContract: 'Please describe the contract.', errEmail: 'Please enter a valid email address.',
      errGeneric: 'Could not send. Please try again shortly, or email your withdrawal to studio.mean.de@gmail.com — an email sent within the period is equally valid.',
      doneTitle: 'Your withdrawal has been received',
      doneText: 'We have received the statement below and sent the same details to {email}.',
      doneNoMail: 'We have received the statement below. The acknowledgement email could not be sent — the studio will contact you. Please keep this page.',
      received: 'Received',
      pass: 'Passport/visa photo reservations are non-binding, so no withdrawal is needed — just cancel via “Request cancellation” in your booking email.'
    },
    de: {
      intro: 'Wenn Sie Ihren Vertrag widerrufen möchten, prüfen Sie bitte die Angaben unten und klicken Sie auf „Widerruf bestätigen“. Wir senden Ihnen sofort eine Eingangsbestätigung mit dem Inhalt und dem Zeitpunkt des Eingangs per E-Mail.',
      name: 'Name', contract: 'Vertrag, den Sie widerrufen', email: 'E-Mail für die Eingangsbestätigung',
      contractHint: 'Gebuchtes Paket und Termin (z. B. Studio Basic, 10.10.2026 11:00) oder Vertragsnummer.',
      emailHint: 'An diese Adresse senden wir die Eingangsbestätigung.',
      statement: 'Ihre Erklärung', sending: 'Wird gesendet…',
      errName: 'Bitte geben Sie Ihren Namen ein.', errContract: 'Bitte geben Sie den Vertrag an.', errEmail: 'Bitte geben Sie eine gültige E-Mail-Adresse ein.',
      errGeneric: 'Senden fehlgeschlagen. Bitte versuchen Sie es gleich noch einmal oder senden Sie Ihren Widerruf per E-Mail an studio.mean.de@gmail.com — eine innerhalb der Frist gesendete E-Mail ist ebenso wirksam.',
      doneTitle: 'Ihr Widerruf ist eingegangen',
      doneText: 'Wir haben die folgende Erklärung erhalten und dieselben Angaben an {email} gesendet.',
      doneNoMail: 'Wir haben die folgende Erklärung erhalten. Die Eingangsbestätigung per E-Mail ist fehlgeschlagen — das Studio meldet sich bei Ihnen. Bitte bewahren Sie diese Seite auf.',
      received: 'Eingegangen am',
      pass: 'Reservierungen für Pass- und Visafotos sind unverbindlich — ein Widerruf ist nicht nötig. Bitte sagen Sie den Termin einfach über „Stornierung anfragen“ in Ihrer Buchungs-E-Mail ab.'
    }
  };

  function normalizeLang(l) {
    l = String(l || '').toLowerCase().slice(0, 2);
    return (l === 'en' || l === 'de') ? l : 'ko';
  }
  function storedLang() { try { return localStorage.getItem(LANG_KEY) || ''; } catch (e) { return ''; } }
  function $(id) { return document.getElementById(id); }
  function el(tag, text, cls) { var n = document.createElement(tag); n.textContent = text; if (cls) n.className = cls; return n; }
  function form() { return $('wrForm'); }

  function renderLegal() {
    var box = $('legal');
    if (!W || !box) return;
    var block = function (t, langAttr, cls) {
      var wrap = document.createElement('div');
      wrap.lang = langAttr;
      if (cls) wrap.className = cls;
      wrap.appendChild(el('h2', t.title));
      t.sections.forEach(function (s) {
        wrap.appendChild(el('h3', s.h));
        s.ps.forEach(function (p) { wrap.appendChild(el('p', p)); });
      });
      wrap.appendChild(el('h3', t.noteTitle));
      wrap.appendChild(el('p', t.note));
      return wrap;
    };
    box.replaceChildren(el('p', W[lang].intro));
    if (lang !== 'de') box.appendChild(el('p', W[lang].bindingNote, 'wr-binding'));
    if (lang !== 'de') box.appendChild(block(W[lang], lang));
    var original = block(W.de, 'de', lang !== 'de' ? 'wr-original' : '');
    original.appendChild(el('h3', W.de.formTitle));
    if (lang !== 'de') original.appendChild(el('p', W[lang].formNote, 'wr-binding'));
    original.appendChild(el('p', W.de.formNote));
    W.de.form.forEach(function (line) { original.appendChild(el('p', line, 'wr-form-line')); });
    box.appendChild(original);
  }

  function render() {
    var t = T[lang];
    document.documentElement.lang = lang;
    Array.prototype.forEach.call(document.querySelectorAll('.lang-btn'), function (b) {
      b.classList.toggle('active', b.dataset.lang === lang);
    });
    if (W) {
      $('pageTitle').textContent = W[lang].withdrawLabel;
      $('confirmBtn').textContent = sending ? t.sending : W[lang].confirmLabel;
      $('statementText').textContent = W[lang].statement;
      $('statementDe').textContent = lang !== 'de' ? W.de.statement : '';
    }
    $('pageIntro').textContent = t.intro;
    $('lblName').textContent = t.name;
    $('lblContract').textContent = t.contract;
    $('hintContract').textContent = t.contractHint;
    $('lblEmail').textContent = t.email;
    $('hintEmail').textContent = t.emailHint;
    $('lblStatement').textContent = t.statement;
    $('passHint').textContent = t.pass;
    renderLegal();
  }

  function showError(msg) {
    var e = $('formError');
    e.textContent = msg;
    e.classList.toggle('hidden', !msg);
  }

  function requestId() { return 'wdr_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10); }

  /* 포털에서 온 경우 — 예약을 불러와 이름·계약·이메일을 미리 채운다. 이미 입력한 칸은 덮지 않는다. */
  function prefill() {
    if (!ref) return;
    fetch(API_BASE + '?api=booking-status&ref=' + encodeURIComponent(ref) + '&_ts=' + Date.now(), { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (res) {
        var d = res && (res.data || res);
        if (!res || res.ok === false || !d || d.ok === false) return;
        var f = form();
        if (!f.elements.name.value) f.elements.name.value = d.name || '';
        if (!f.elements.email.value) f.elements.email.value = d.email || '';
        if (!f.elements.contract.value) f.elements.contract.value = [d.product, [d.date, d.time].filter(Boolean).join(' ')].filter(Boolean).join(' · ');
        if (!params.get('lang') && !storedLang() && d.lang) { lang = normalizeLang(d.lang); render(); }
      })
      .catch(function () {});
  }

  function submit(ev) {
    ev.preventDefault();
    if (sending) return;
    var t = T[lang];
    var f = form();
    var name = f.elements.name.value.trim();
    var contract = f.elements.contract.value.trim();
    var email = f.elements.email.value.trim();
    if (name.length < 2) { showError(t.errName); f.elements.name.focus(); return; }
    if (!contract) { showError(t.errContract); f.elements.contract.focus(); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showError(t.errEmail); f.elements.email.focus(); return; }
    showError('');
    sending = true;
    $('confirmBtn').disabled = true;
    $('confirmBtn').textContent = t.sending;
    // requestId 는 누를 때마다 새로 — 같은 내용의 재전송은 서버가 내용 기준으로 첫 접수를 돌려준다
    fetch(API_BASE + '?api=booking-withdraw', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ requestId: requestId(), data: { ref: ref, name: name, contract: contract, email: email, lang: lang, website: f.elements.website.value } })
    })
      .then(function (r) { return r.json(); })
      .then(function (res) {
        var d = res && res.data;
        if (res && res.ok && d && d.ok) { done(name, contract, email, d); return; }
        var code = res && res.error && res.error.message;
        fail(code === 'NAME_REQUIRED' ? t.errName : code === 'CONTRACT_REQUIRED' ? t.errContract : code === 'EMAIL_INVALID' ? t.errEmail : t.errGeneric);
      })
      .catch(function () { fail(t.errGeneric); });
  }

  function fail(msg) {
    sending = false;
    $('confirmBtn').disabled = false;
    render();
    showError(msg);
  }

  function done(name, contract, email, d) {
    var t = T[lang];
    $('formCard').classList.add('hidden');
    $('doneTitle').textContent = t.doneTitle;
    $('doneText').textContent = d.receiptSent ? t.doneText.replace('{email}', email) : t.doneNoMail;
    var rows = [[t.statement, W ? W[lang].statement : ''], [t.name, name], [t.contract, contract], [t.email, email], [t.received, d.receivedAt + ' (Europe/Berlin)']];
    var list = $('doneList');
    list.replaceChildren();
    rows.forEach(function (row) {
      var wrap = document.createElement('div');
      wrap.append(el('dt', row[0]), el('dd', row[1]));
      list.appendChild(wrap);
    });
    $('doneCard').classList.remove('hidden');
    $('doneCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  Array.prototype.forEach.call(document.querySelectorAll('.lang-btn'), function (btn) {
    btn.addEventListener('click', function () {
      lang = normalizeLang(btn.dataset.lang);
      try { localStorage.setItem(LANG_KEY, lang); } catch (e) {}
      render();
    });
  });
  form().addEventListener('submit', submit);
  render();
  prefill();
  // 웹앱 콜드 스타트(최대 30초대) 완화 — 폼을 채우는 동안 컨테이너를 데운다
  try { fetch(API_BASE + '?api=warmup', { cache: 'no-store' }).catch(function () {}); } catch (e) {}
})();
