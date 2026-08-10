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
      noManage: '이 예약은 현재 온라인 변경이 어렵습니다. 도움이 필요하시면 이메일로 연락 주세요.',
      resend: '📧 안내 메일 다시 받기', resendSending: '보내는 중…',
      resendSent: '안내 메일을 다시 보냈어요. 메일함(스팸함 포함)을 확인해 주세요.',
      resendCooldown: '방금 보냈어요. 잠시 후 다시 시도해 주세요.',
      resendNotConfirmed: '예약 확정 후에 계약금 안내 메일을 다시 받을 수 있어요.',
      resendNoEmail: '등록된 이메일이 없어 메일을 보낼 수 없어요.',
      resendError: '메일 발송에 실패했어요. 잠시 후 다시 시도해 주세요.',
      selectTitle: '📷 사진 선택', selectIntro: '촬영하신 사진 중 보정할 컷을 선택해 주세요.',
      selectIntroDone: '이미 사진을 선택하셨어요. 필요하면 선택 내용을 확인·수정할 수 있어요.',
      selectGo: '사진 선택하러 가기', selectEdit: '선택 확인·수정',
      progSteps: ['사진 선택', '보정 작업', '보정본 발송', '출력 준비', '수령'],
      progStepsDigital: ['사진 선택', '보정 작업', '보정본 발송'],
      progNoteSelecting: (dl) => dl ? '셀렉 마감일: ' + dl : '사진 선택을 기다리고 있어요.',
      progNoteRetouching: '보정 작업 중이에요. 통상 2~3주 정도 걸립니다.',
      progNoteRevision: '재수정 작업 중이에요. 완료되면 다시 안내드립니다.',
      progNoteRetouchSent: '보정본을 보내드렸어요. 메일에서 확인해 주세요.',
      progNotePrinting: '출력물을 준비하고 있어요.',
      progNotePickupBooked: (at) => '픽업 예약: ' + at,
      progNotePickupInvite: '출력이 끝나면 픽업 시간 예약 링크를 메일로 보내드려요.',
      progNoteReadyPickup: '출력이 완료됐어요. 픽업 시간을 예약해 주세요(안내 메일 참조).',
      progNoteMailed: '우편으로 발송되었습니다.',
      progNoteDone: '모든 작업이 완료되었습니다. 감사합니다!',
      prepTitle: '✅ 촬영 준비 체크리스트', prepIntro: '촬영 전에 아래 내용을 확인하시면 더 좋은 결과를 얻을 수 있어요.'
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
      noManage: 'Online changes aren’t available for this booking. Please email us if you need help.',
      resend: '📧 Resend booking email', resendSending: 'Sending…',
      resendSent: 'Sent! Please check your inbox (and spam folder).',
      resendCooldown: 'Just sent. Please try again in a moment.',
      resendNotConfirmed: 'You can resend the deposit email once your booking is confirmed.',
      resendNoEmail: 'No email is on file, so we can’t send it.',
      resendError: 'Could not send the email. Please try again shortly.',
      selectTitle: '📷 Photo selection', selectIntro: 'Choose the shots you’d like retouched from your session.',
      selectIntroDone: 'You’ve already selected your photos. You can review or adjust them if needed.',
      selectGo: 'Select photos', selectEdit: 'Review / edit selection',
      progSteps: ['Selection', 'Retouching', 'Retouch delivery', 'Printing', 'Handover'],
      progStepsDigital: ['Selection', 'Retouching', 'Retouch delivery'],
      progNoteSelecting: (dl) => dl ? 'Selection deadline: ' + dl : 'Waiting for your photo selection.',
      progNoteRetouching: 'Retouching in progress — usually 2–3 weeks.',
      progNoteRevision: 'Revision in progress. We will notify you when it is ready.',
      progNoteRetouchSent: 'Your retouched photos have been sent — please check your email.',
      progNotePrinting: 'Your prints are being prepared.',
      progNotePickupBooked: (at) => 'Pickup booked: ' + at,
      progNotePickupInvite: 'Once printing is done, we will email you a pickup booking link.',
      progNoteReadyPickup: 'Printing is done — please book your pickup time (see email).',
      progNoteMailed: 'Shipped by post.',
      progNoteDone: 'Everything is complete. Thank you!',
      prepTitle: '✅ Shoot preparation checklist', prepIntro: 'A quick check before your shoot helps us get the best results.'
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
      noManage: 'Online-Änderungen sind für diese Buchung nicht möglich. Bitte kontaktieren Sie uns per E-Mail.',
      resend: '📧 Buchungs-E-Mail erneut senden', resendSending: 'Wird gesendet…',
      resendSent: 'Gesendet! Bitte prüfen Sie Ihren Posteingang (auch den Spam-Ordner).',
      resendCooldown: 'Gerade gesendet. Bitte gleich noch einmal versuchen.',
      resendNotConfirmed: 'Sie können die Anzahlungs-E-Mail erneut erhalten, sobald Ihre Buchung bestätigt ist.',
      resendNoEmail: 'Keine E-Mail hinterlegt – Versand nicht möglich.',
      resendError: 'E-Mail konnte nicht gesendet werden. Bitte später erneut versuchen.',
      selectTitle: '📷 Fotoauswahl', selectIntro: 'Wählen Sie die Aufnahmen aus, die retuschiert werden sollen.',
      selectIntroDone: 'Sie haben Ihre Fotos bereits ausgewählt. Bei Bedarf können Sie die Auswahl prüfen oder ändern.',
      selectGo: 'Fotos auswählen', selectEdit: 'Auswahl prüfen / ändern',
      progSteps: ['Auswahl', 'Retusche', 'Retusche-Versand', 'Druck', 'Übergabe'],
      progStepsDigital: ['Auswahl', 'Retusche', 'Retusche-Versand'],
      progNoteSelecting: (dl) => dl ? 'Auswahlfrist: ' + dl : 'Wir warten auf Ihre Fotoauswahl.',
      progNoteRetouching: 'Retusche läuft — in der Regel 2–3 Wochen.',
      progNoteRevision: 'Korrektur in Arbeit. Wir melden uns, sobald sie fertig ist.',
      progNoteRetouchSent: 'Ihre retuschierten Fotos wurden gesendet — bitte prüfen Sie Ihre E-Mail.',
      progNotePrinting: 'Ihre Drucke werden vorbereitet.',
      progNotePickupBooked: (at) => 'Abholung gebucht: ' + at,
      progNotePickupInvite: 'Nach dem Druck senden wir Ihnen einen Link zur Abholbuchung.',
      progNoteReadyPickup: 'Druck abgeschlossen — bitte buchen Sie Ihre Abholzeit (siehe E-Mail).',
      progNoteMailed: 'Per Post versendet.',
      progNoteDone: 'Alles erledigt. Vielen Dank!',
      prepTitle: '✅ Checkliste zur Vorbereitung', prepIntro: 'Eine kurze Kontrolle vor dem Shooting sorgt für beste Ergebnisse.'
    }
  };

  // 촬영 종류별 준비 체크리스트 (클라이언트 현지화, 백엔드 불필요)
  var PREP = {
    pass: {
      ko: ['눈썹이 보이도록 앞머리를 정리해 주세요', '흰색·연한 파스텔 상의는 피하고 진한 색을 추천해요', '안경은 벗는 것을 권장해요 (투명 렌즈만 가능)', '입을 다문 무표정, 유분기는 매트하게 정리해 주세요'],
      en: ['Keep your eyebrows visible (no bangs over them)', 'Avoid white or pale pastel tops — darker colours work best', 'Glasses off is recommended (only clear lenses allowed)', 'Neutral expression, closed mouth, matte skin'],
      de: ['Augenbrauen sichtbar lassen (kein Pony darüber)', 'Keine weißen/hellen Pastelltöne — dunklere Farben sind besser', 'Brille möglichst abnehmen (nur klare Kontaktlinsen)', 'Neutraler Ausdruck, geschlossener Mund, matte Haut']
    },
    prof: {
      ko: ['사용 목적(링크드인/이력서/SNS)과 원하는 분위기를 알려주세요', '단색 상의 1~2벌 준비 (큰 로고·강한 패턴은 피해주세요)', '레퍼런스 1~3장이 있으면 미리 보내주세요', '5~10분 전 도착을 권장해요'],
      en: ['Tell us the purpose (LinkedIn/CV/SNS) and the mood you want', 'Bring 1–2 solid-colour tops (avoid big logos or busy patterns)', 'Send 1–3 reference images in advance if you have any', 'Please arrive 5–10 minutes early'],
      de: ['Zweck (LinkedIn/Lebenslauf/SNS) und gewünschte Stimmung mitteilen', '1–2 einfarbige Oberteile mitbringen (keine großen Logos/Muster)', 'Falls vorhanden, 1–3 Referenzbilder vorab senden', 'Bitte 5–10 Minuten früher da sein']
    },
    stud: {
      ko: ['원하는 분위기와 사용 목적을 알려주세요 (레퍼런스 환영)', '톤을 맞춘 의상(화이트/크림/베이지/네이비)을 준비해 주세요', '아이와 함께라면 기저귀·간식·장난감을 챙겨주세요', '10분 전 도착을 권장해요'],
      en: ['Share the mood and purpose (references welcome)', 'Bring tone-matched outfits (white/cream/beige/navy)', 'With children: bring diapers, snacks, and a small toy', 'Please arrive 10 minutes early'],
      de: ['Stimmung und Verwendungszweck mitteilen (Referenzen willkommen)', 'Farblich abgestimmte Outfits (Weiß/Creme/Beige/Navy)', 'Mit Kindern: Windeln, Snacks und ein kleines Spielzeug', 'Bitte 10 Minuten früher da sein']
    },
    snap: {
      ko: ['레퍼런스(1~5장)와 장소·동선을 미리 공유해 주세요 (골든아워 추천)', '톤을 맞춘 의상 2벌을 추천해요', '헤어 스프레이·수정 메이크업을 챙겨주세요', '10~15분 전 도착을 권장해요'],
      en: ['Share references (1–5) and locations in advance (golden hour is best)', 'Two tone-matched outfits are recommended', 'Bring hairspray and touch-up makeup', 'Please arrive 10–15 minutes early'],
      de: ['Referenzen (1–5) und Orte vorab teilen (goldene Stunde ideal)', 'Zwei farblich abgestimmte Outfits empfohlen', 'Haarspray und Korrektur-Make-up mitbringen', 'Bitte 10–15 Minuten früher da sein']
    },
    wed: {
      ko: ['무드·사용 목적과 레퍼런스 1~5장을 공유해 주세요', '일정·로케이션·우천 시 대체 장소를 확인해 주세요', '톤을 맞춘 의상 2벌(포멀+캐주얼)을 추천해요', '소품(부케·반지·청첩장)·편한 신발·수정 메이크업을 챙겨주세요'],
      en: ['Share the mood, purpose, and 1–5 reference images', 'Confirm the schedule, locations, and a rain backup plan', 'Two tone-matched outfits (formal + casual) recommended', 'Bring props (bouquet/rings/invitation), comfy shoes, touch-up makeup'],
      de: ['Stimmung, Zweck und 1–5 Referenzbilder teilen', 'Termin, Orte und eine Schlechtwetter-Alternative abklären', 'Zwei abgestimmte Outfits (formell + casual) empfohlen', 'Requisiten (Bouquet/Ringe/Einladung), bequeme Schuhe, Korrektur-Make-up']
    },
    biz: {
      ko: ['촬영 목적·구성·인원을 미리 공유해 주세요', '결과물 용도(홈페이지/홍보/기록)를 알려주세요', '일정·장소·동선을 사전에 확정해 주세요', '문의는 아래 1:1 문의 또는 이메일로 연락 주세요'],
      en: ['Share the purpose, format, and number of people', 'Tell us how the results will be used (website/PR/record)', 'Confirm the schedule, location, and flow in advance', 'Questions? Use the 1:1 messages below or email us'],
      de: ['Zweck, Format und Personenzahl vorab mitteilen', 'Verwendung der Ergebnisse angeben (Website/PR/Doku)', 'Termin, Ort und Ablauf vorab festlegen', 'Fragen? Nachrichten unten nutzen oder E-Mail schreiben']
    },
    _default: {
      ko: ['원하는 분위기나 레퍼런스를 미리 공유해 주세요', '촬영 시작 10분 전 도착을 권장해요', '궁금한 점은 아래 1:1 문의로 남겨주세요'],
      en: ['Share your preferred mood or references in advance', 'Please arrive about 10 minutes early', 'Any questions? Leave them in the 1:1 messages below'],
      de: ['Gewünschte Stimmung oder Referenzen vorab teilen', 'Bitte etwa 10 Minuten früher da sein', 'Fragen? Hinterlassen Sie sie in den Nachrichten unten']
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

    // 안내 메일 다시 받기 (확정 예약만)
    if (data.canResend) {
      $('resendBtn').textContent = t.resend;
      show('resendRow');
    } else { hide('resendRow'); }

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

    // 사진 선택(셀렉) 링크 + 작업 진행률 (2026-08-10)
    if (data.selectUrl) {
      $('selectTitle').textContent = t.selectTitle;
      $('selectIntro').textContent = data.selectSubmitted ? t.selectIntroDone : t.selectIntro;
      var selBtn = $('selectBtn');
      selBtn.textContent = data.selectSubmitted ? t.selectEdit : t.selectGo;
      selBtn.href = data.selectUrl;
      renderSelectProgress(data.selectProgress, t);
      show('selectCard');
    } else { hide('selectCard'); }

    // 촬영 준비 체크리스트
    renderPrep();

    /* 작업 진행률 스테퍼 — "내 사진 어디까지 왔나" (실제 문의가 오는 질문).
       단계 판정만 여기서 하고 원시 시각은 서버가 준다. 디지털 전용(수령방식 없음)은 3단계로 축약. */
    function renderSelectProgress(pg, t) {
      var box = $('selectProgress');
      if (!box) return;
      if (!pg || !pg.submittedAt) {
        // 미제출: 스테퍼 대신 마감일 한 줄만
        box.innerHTML = pg && pg.deadline
          ? '<p class="muted small" style="margin:10px 0 0;">' + esc(t.progNoteSelecting(pg.deadline)) + '</p>'
          : '';
        return;
      }
      var hasPhysical = !!(pg.deliveryMethod || pg.printDoneAt || pg.mailed);
      var steps = hasPhysical ? t.progSteps : t.progStepsDigital;
      // current 단계 index (0-based): 제출됨=1(보정 작업 중)부터 시작
      var done = pg.handoverAt || pg.status === '최종작업완료';
      var idx;
      var note;
      if (done) { idx = steps.length; note = t.progNoteDone; }
      else if (pg.mailed) { idx = steps.length - 1; note = t.progNoteMailed; }
      else if (hasPhysical && pg.printDoneAt) {
        idx = 4; // 수령 대기
        note = pg.deliveryMethod === 'pickup'
          ? (pg.pickupAt ? t.progNotePickupBooked(pg.pickupAt) : t.progNoteReadyPickup)
          : t.progNotePrinting;   // 우편: 출력 완료 후 발송 준비 중
      }
      else if (pg.retouchSentAt && pg.revisionRequested) { idx = 1; note = t.progNoteRevision; }
      else if (pg.retouchSentAt) { idx = hasPhysical ? 3 : 2; note = hasPhysical ? (pg.deliveryMethod === 'pickup' ? t.progNotePickupInvite : t.progNotePrinting) : t.progNoteRetouchSent; }
      else { idx = 1; note = t.progNoteRetouching; }
      if (idx > steps.length) idx = steps.length;
      var html = '<div class="prog-steps">';
      for (var i = 0; i < steps.length; i++) {
        var cls = i < idx ? 'done' : (i === idx ? 'active' : '');
        html += '<div class="prog-step ' + cls + '"><span class="prog-dot">' + (i < idx ? '✓' : (i + 1)) + '</span><span class="prog-label">' + esc(steps[i]) + '</span></div>';
      }
      html += '</div>';
      if (note) html += '<p class="muted small prog-note">' + esc(note) + '</p>';
      box.innerHTML = html;
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

  /* ── 촬영 준비 체크리스트 ── */
  function renderPrep() {
    var t = T[lang];
    var upcoming = ['대기중', '확정됨', '변경대기'].indexOf(String(data.status || '')) > -1;
    var group = String(data.itemGroup || '').trim();
    var set = PREP[group] || PREP._default;
    var items = set[lang] || set.ko || [];
    if (!upcoming || !items.length) { hide('prepCard'); return; }
    $('prepTitle').textContent = t.prepTitle;
    $('prepIntro').textContent = t.prepIntro;
    $('prepList').innerHTML = items.map(function (it) { return '<li>' + esc(it) + '</li>'; }).join('');
    show('prepCard');
  }

  /* ── 안내 메일 다시 받기 ── */
  function sendResend() {
    var t = T[lang];
    var btn = $('resendBtn');
    var hint = $('resendHint');
    btn.disabled = true;
    btn.textContent = t.resendSending;
    hint.textContent = '';
    fetch(API_BASE + '?api=booking-status-resend', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ requestId: requestId(), data: { ref: ref } })
    })
      .then(function (r) { return r.json(); })
      .then(function (res) {
        btn.disabled = false;
        btn.textContent = t.resend;
        var d = res && (res.data || res);
        if (d && d.ok) { hint.textContent = t.resendSent; return; }
        var reason = (d && d.reason) || '';
        hint.textContent =
          reason === 'cooldown' ? t.resendCooldown :
          reason === 'not_confirmed' ? t.resendNotConfirmed :
          reason === 'no_email' ? t.resendNoEmail : t.resendError;
      })
      .catch(function () {
        btn.disabled = false;
        btn.textContent = t.resend;
        hint.textContent = t.resendError;
      });
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
  (function wireResend() {
    var btn = $('resendBtn');
    if (btn) btn.addEventListener('click', sendResend);
  })();

  boot();
})();
