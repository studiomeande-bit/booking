/* 촬영 준비 설문 (2026-08-26)
 *
 * 확정메일이 "레퍼런스 보내주세요"라고 부탁만 하던 것을 구조화된 한 페이지로 대체한다.
 * 답변은 예약행에 묶여 저장되고, 요약 한 줄이 캘린더 설명에 실려 촬영 당일 폰에서 바로 보인다.
 *
 * 문항 정의는 **여기에만** 둔다. 프런트가 id·라벨·요약문을 함께 서버로 보내므로 3개국어 문구가
 * 서버와 갈라질 일이 없다. 서버는 저장만 한다.
 *
 * ⭐ 이미지 문항: choice 에 `img` 가 없으면 그냥 텍스트 칩으로 렌더된다. 나중에 자체 포트폴리오
 * 사진을 골라 `img` 만 채우면 카드로 바뀐다 — 사진 선별을 기다리지 않고 먼저 열 수 있다.
 */
(function () {
  'use strict';

  var API_BASE = 'https://script.google.com/macros/s/AKfycbxnHuB2u4-pDD23JDdFDpHB0ZIzGxLWm15Xgc7_-qkyOTctNpGlYDMIcQyq4KB7QC6X8w/exec';

  /* ===== 문항 정의 ===== */
  // kind: 'single' | 'multi' | 'urls' | 'text'
  var Q = {
    prof: [
      { id: 'usage', kind: 'multi', t: { ko: '사진을 어디에 쓰시나요?', en: 'What will the photos be used for?', de: 'Wofür werden die Fotos verwendet?' }, c: [
        ['linkedin', '이력서 · Bewerbung', 'CV / job application', 'Bewerbung / Lebenslauf'],
        ['company', '회사 프로필 · 홈페이지', 'Company profile / website', 'Firmenprofil / Website'],
        ['sns', 'SNS · 프로필 사진', 'Social / profile picture', 'Social Media / Profilbild'],
        ['acting', '배우 · 모델 포트폴리오', 'Acting / model portfolio', 'Schauspiel / Model-Portfolio'],
        ['academic', '학술 · 연구 프로필', 'Academic profile', 'Akademisches Profil'],
        ['personal', '개인 소장 · 기념', 'Personal keepsake', 'Persönliche Erinnerung'],
        ['other', '기타', 'Other', 'Sonstiges']
      ] },
      { id: 'mood', kind: 'single', t: { ko: '원하는 분위기', en: 'Preferred mood', de: 'Gewünschte Stimmung' }, c: [
        ['classic', '클래식 포멀 — 정장, 정면, 단정한 조명', 'Classic formal — suit, front-facing, clean lighting', 'Klassisch formell — Anzug, frontal, klares Licht'],
        ['bizcasual', '비즈니스 캐주얼 — 셔츠·니트, 밝은 조명, 가벼운 미소', 'Business casual — shirt/knit, bright light, light smile', 'Business casual — Hemd/Strick, helles Licht, leichtes Lächeln'],
        ['natural', '내추럴 — 자연광 느낌, 부드러운 그림자', 'Natural — daylight feel, soft shadows', 'Natürlich — Tageslicht, weiche Schatten'],
        ['modern', '모던 시크 — 낮은 채도, 정돈된 실루엣', 'Modern chic — low saturation, clean silhouette', 'Modern schick — geringe Sättigung, klare Silhouette'],
        ['creative', '크리에이티브 — 강한 명암, 각도 있는 구도', 'Creative — strong contrast, angled framing', 'Kreativ — starker Kontrast, schräge Bildführung'],
        ['warm', '웜 & 프렌들리 — 따뜻한 색감, 눈웃음', 'Warm & friendly — warm tones, smiling eyes', 'Warm & freundlich — warme Töne, lachende Augen'],
        ['minimal', '미니멀 — 넓은 여백, 군더더기 없는 구도', 'Minimal — generous space, nothing extra', 'Minimal — viel Raum, ohne Beiwerk']
      ] },
      { id: 'background', kind: 'multi', t: { ko: '배경 색', en: 'Background colour', de: 'Hintergrundfarbe' }, c: [
        ['white', '화이트 — 밝고 깨끗한 인상', 'White — bright and clean', 'Weiß — hell und klar'],
        ['grey', '그레이 — 서류·이력서에 무난', 'Grey — safe for documents / CV', 'Grau — sicher für Dokumente / Lebenslauf'],
        ['black', '블랙 — 얼굴에 집중, 묵직함', 'Black — focus on the face, weighty', 'Schwarz — Fokus aufs Gesicht, gewichtig'],
        ['beige', '베이지 — 따뜻하고 부드러운 인상', 'Beige — warm and soft', 'Beige — warm und weich'],
        ['sky', '하늘색 — 산뜻하고 밝은 인상', 'Sky blue — fresh and light', 'Himmelblau — frisch und leicht'],
        ['pink', '핑크 — 화사하고 부드러운 인상', 'Pink — bright and gentle', 'Rosa — hell und sanft']
      ] },
      { id: 'expression', kind: 'single', t: { ko: '표정 방향', en: 'Expression', de: 'Gesichtsausdruck' }, c: [
        ['smile', '미소 — 치아가 보이게', 'Smile — showing teeth', 'Lächeln — mit Zähnen'],
        ['soft', '옅은 미소 — 입은 다문 채', 'Soft smile — closed lips', 'Leichtes Lächeln — geschlossene Lippen'],
        ['neutral', '진지 · 뉴트럴', 'Serious / neutral', 'Ernst / neutral'],
        ['mixed', '촬영하며 다양하게', 'A mix during the session', 'Gemischt während des Shootings']
      ] },
      { id: 'framing', kind: 'multi', t: { ko: '프레이밍', en: 'Framing', de: 'Bildausschnitt' }, c: [
        ['headshot', '헤드샷 — 어깨 위', 'Headshot — above shoulders', 'Headshot — ab Schulter'],
        ['upper', '상반신', 'Upper body', 'Oberkörper'],
        ['hands', '반신 — 손 포즈 포함', 'Half body — with hand poses', 'Halbkörper — mit Handposen'],
        ['full', '전신', 'Full body', 'Ganzkörper'],
        ['mixed', '다양하게', 'A mix', 'Gemischt']
      ] },
      { id: 'retouch', kind: 'multi', t: { ko: '보정에서 지켜줬으면 하는 것', en: 'Retouching preferences', de: 'Wünsche zur Retusche' }, c: [
        ['skin', '피부결은 자연스럽게 유지', 'Keep skin texture natural', 'Hauttextur natürlich lassen'],
        ['keepmarks', '점 · 흉터는 살려주세요', 'Keep moles / scars', 'Muttermale / Narben behalten'],
        ['glasses', '안경 착용 — 반사 주의', 'Wearing glasses — watch reflections', 'Brille — Reflexe beachten'],
        ['slim', '얼굴·체형은 과하지 않게만', 'Only subtle shaping', 'Nur dezente Formkorrektur'],
        ['none', '해당 없음', 'None', 'Keine']
      ] }
    ],

    stud: [
      { id: 'mood', kind: 'single', t: { ko: '원하는 분위기', en: 'Preferred mood', de: 'Gewünschte Stimmung' }, c: [
        ['bright', '밝고 화사 — 그림자 옅게', 'Bright and airy — light shadows', 'Hell und luftig — weiche Schatten'],
        ['warm', '따뜻한 톤 — 베이지 · 크림, 포근한 색', 'Warm tones — beige/cream, cosy', 'Warme Töne — Beige/Creme, gemütlich'],
        ['calm', '차분한 무드 — 딥톤, 부드러운 음영', 'Calm — deep tones, soft shading', 'Ruhig — dunkle Töne, weiche Schattierung'],
        ['minimal', '심플 미니멀 — 배경 비우고 인물 중심', 'Simple minimal — empty background, people first', 'Schlicht minimal — leerer Hintergrund, Menschen im Fokus'],
        ['daylight', '자연광 느낌 — 창가 빛, 부드러운 방향광', 'Daylight feel — window light', 'Tageslicht — Fensterlicht'],
        ['classic', '클래식 — 정돈된 포즈, 안정적인 구도', 'Classic — arranged poses, steady framing', 'Klassisch — geordnete Posen, ruhige Bildführung'],
        ['lively', '활기찬 — 움직임과 웃음, 아이 중심', 'Lively — movement and laughter', 'Lebendig — Bewegung und Lachen']
      ] },
      { id: 'background', kind: 'multi', t: { ko: '배경 색', en: 'Background colour', de: 'Hintergrundfarbe' }, c: [
        ['white', '화이트 — 밝고 깨끗한 인상', 'White — bright and clean', 'Weiß — hell und klar'],
        ['grey', '그레이 — 차분하고 무난', 'Grey — calm and safe', 'Grau — ruhig und sicher'],
        ['black', '블랙 — 묵직하고 집중되는', 'Black — weighty and focused', 'Schwarz — gewichtig und fokussiert'],
        ['beige', '베이지 — 따뜻하고 부드러운', 'Beige — warm and soft', 'Beige — warm und weich'],
        ['sky', '하늘색 — 산뜻하고 밝은', 'Sky blue — fresh and light', 'Himmelblau — frisch und leicht'],
        ['pink', '핑크 — 화사하고 부드러운', 'Pink — bright and gentle', 'Rosa — hell und sanft']
      ] },
      { id: 'combos', kind: 'multi', t: { ko: '꼭 남기고 싶은 조합', en: 'Combinations you want for sure', de: 'Wichtige Konstellationen' }, c: [
        ['childSolo', '아이 단독', 'Child alone', 'Kind allein'],
        ['whole', '가족 전체', 'Whole family', 'Ganze Familie'],
        ['parentsChild', '부모 + 아이', 'Parents + child', 'Eltern + Kind'],
        ['siblings', '형제 · 자매', 'Siblings', 'Geschwister'],
        ['grandparents', '조부모 포함', 'With grandparents', 'Mit Großeltern'],
        ['couple', '부부 단독', 'Couple alone', 'Paar allein'],
        ['detail', '손 · 발 같은 디테일 컷', 'Detail shots — hands, feet', 'Detailaufnahmen — Hände, Füße']
      ] },
      { id: 'kids', kind: 'multi', t: { ko: '아이 컨디션 참고 사항', en: 'About the children', de: 'Hinweise zu den Kindern' }, c: [
        ['nap', '낮잠 시간대는 피했습니다', 'Avoided nap time', 'Schlafenszeit vermieden'],
        ['snack', '간식을 챙겨 갑니다', 'Bringing snacks', 'Snacks werden mitgebracht'],
        ['shy', '낯가림이 있습니다', 'Shy with strangers', 'Fremdelt'],
        ['active', '가만히 있기 어려워합니다', 'Finds it hard to sit still', 'Kann schwer stillsitzen'],
        ['none', '해당 없음', 'None', 'Keine']
      ] },
      { id: 'props', kind: 'multi', t: { ko: '소품 · 의상 (백일 · 돌 촬영이면)', en: 'Props / outfits (100-day or 1st birthday)', de: 'Requisiten / Outfits (100 Tage / 1. Geburtstag)' }, c: [
        ['studioHanbok', '스튜디오 한복 사용', 'Use studio hanbok', 'Studio-Hanbok nutzen'],
        ['ownHanbok', '한복을 직접 가져갑니다', 'Bringing our own hanbok', 'Eigenen Hanbok mitbringen'],
        ['cake', '케이크 지참', 'Bringing a cake', 'Torte mitbringen'],
        ['balloon', '풍선 · 가랜드 지참', 'Bringing balloons / garland', 'Ballons / Girlande mitbringen'],
        ['ask', '상담이 필요합니다', 'Need to discuss', 'Beratung nötig'],
        ['none', '해당 없음', 'Not applicable', 'Nicht zutreffend']
      ] }
    ],

    wed: [
      { id: 'usage', kind: 'multi', t: { ko: '사진 사용 목적', en: 'How the photos will be used', de: 'Verwendung der Fotos' }, c: [
        ['invitation', '청첩장 · 모바일 청첩장', 'Invitation card', 'Einladungskarte'],
        ['album', '웨딩 앨범', 'Wedding album', 'Hochzeitsalbum'],
        ['sns', 'SNS', 'Social media', 'Social Media'],
        ['screen', '본식 스크린 상영', 'Screen at the ceremony', 'Leinwand bei der Feier'],
        ['parents', '부모님 액자', 'Framed print for parents', 'Bilderrahmen für die Eltern'],
        ['thanks', '감사 카드 · 답례품', 'Thank-you cards', 'Dankeskarten']
      ] },
      { id: 'mood', kind: 'single', t: { ko: '전체 무드', en: 'Overall mood', de: 'Gesamtstimmung' }, c: [
        ['romantic', '클래식 로맨틱 — 부드러운 빛, 정돈된 포즈', 'Classic romantic — soft light, arranged poses', 'Klassisch romantisch — weiches Licht, geordnete Posen'],
        ['film', '필름 감성 — 그레인, 웜톤, 자연스러운 색빠짐', 'Film look — grain, warm, faded colour', 'Filmlook — Korn, warm, sanft entsättigt'],
        ['cinematic', '시네마틱 — 강한 대비, 딥톤, 와이드 구도', 'Cinematic — contrast, deep tones, wide framing', 'Cinematic — Kontrast, dunkle Töne, weite Bildführung'],
        ['candid', '밝고 캔디드 — 순간 포착, 자연스러운 표정', 'Bright and candid — caught moments', 'Hell und ungestellt — eingefangene Momente'],
        ['documentary', '다큐멘터리 — 연출 최소, 흐름 중심', 'Documentary — minimal direction, follows the day', 'Dokumentarisch — wenig Regie, dem Tag folgend'],
        ['editorial', '모던 에디토리얼 — 화보풍, 과감한 구도', 'Modern editorial — magazine style, bold framing', 'Modern editorial — Magazinstil, mutige Bildführung'],
        ['serene', '잔잔한 내추럴 — 은은한 빛, 차분한 색', 'Serene natural — gentle light, calm colour', 'Ruhig natürlich — sanftes Licht, ruhige Farben'],
        ['vintage', '빈티지 — 낮은 채도, 따뜻한 노란기', 'Vintage — low saturation, warm yellow cast', 'Vintage — geringe Sättigung, warmer Gelbstich']
      ] },
      { id: 'colorTone', kind: 'single', t: { ko: '색감 방향', en: 'Colour direction', de: 'Farbrichtung' }, c: [
        ['warm', '웜톤 — 따뜻하고 포근하게', 'Warm — cosy and golden', 'Warm — gemütlich und golden'],
        ['neutral', '뉴트럴 — 실제 색에 충실하게', 'Neutral — true to life', 'Neutral — naturgetreu'],
        ['muted', '무디 · 저채도 — 차분하게', 'Muted — calm, desaturated', 'Gedämpft — ruhig, entsättigt'],
        ['cool', '쿨톤 — 청량하고 맑게', 'Cool — crisp and clear', 'Kühl — frisch und klar'],
        ['bw', '흑백 컷도 함께 원해요', 'Include black & white', 'Auch Schwarz-Weiß gewünscht']
      ] },
      { id: 'posed', kind: 'single', t: { ko: '연출 비율', en: 'Posed vs candid', de: 'Gestellt oder ungestellt' }, c: [
        ['posed', '포즈 연출 위주 — 디렉션을 많이 주세요', 'Mostly posed — please direct us', 'Überwiegend gestellt — bitte anleiten'],
        ['balanced', '반반', 'A balance of both', 'Ausgewogen'],
        ['candid', '자연스러운 스냅 위주 — 지켜봐 주세요', 'Mostly candid — just observe us', 'Überwiegend ungestellt — einfach begleiten']
      ] },
      { id: 'moments', kind: 'multi', t: { ko: '꼭 담을 순간', en: 'Moments to capture for sure', de: 'Momente, die nicht fehlen dürfen' }, c: [
        ['details', '드레스 · 부케 디테일', 'Dress / bouquet details', 'Kleid / Blumendetails'],
        ['prep', '준비 과정 · 메이크업', 'Getting ready', 'Vorbereitung / Make-up'],
        ['entrance', '입장', 'Entrance', 'Einzug'],
        ['vows', '서약 · 반지', 'Vows / rings', 'Trauversprechen / Ringe'],
        ['familyList', '가족사진 목록이 있습니다', 'We have a family photo list', 'Wir haben eine Familienfotoliste'],
        ['reception', '피로연', 'Reception', 'Empfang'],
        ['group', '단체사진', 'Group photo', 'Gruppenfoto'],
        ['night', '해질녘 · 야간 컷', 'Sunset / night shots', 'Sonnenuntergang / Nachtaufnahmen']
      ] },
      { id: 'concerns', kind: 'multi', t: { ko: '신경 쓰이는 부분', en: 'Anything you are concerned about', de: 'Worauf sollen wir achten' }, c: [
        ['angle', '피하고 싶은 각도가 있습니다', 'There is an angle to avoid', 'Es gibt einen Winkel zu vermeiden'],
        ['camerashy', '둘 중 한 명이 카메라를 어색해합니다', 'One of us is camera-shy', 'Eine·r von uns ist kamerascheu'],
        ['height', '키 차이 보정 팁을 원합니다', 'Tips for height difference', 'Tipps zum Größenunterschied'],
        ['guests', '꼭 챙겨야 할 하객이 있습니다', 'There are guests we must not miss', 'Bestimmte Gäste dürfen nicht fehlen'],
        ['none', '해당 없음', 'None', 'Keine']
      ] }
    ]
  };
  Q.snap = [Q.wed[1], Q.wed[2], Q.wed[3], Q.wed[5]]; // 무드·색감·연출비율·신경쓰이는 부분

  var T = {
    ko: {
      title: '촬영 준비 설문', lede: '촬영 전에 원하시는 방향을 알려주세요. 선택만 하시면 되고 5분이면 끝납니다.',
      loading: '예약 정보를 불러오는 중입니다.',
      errTitle: '설문을 열 수 없습니다',
      errText: '링크가 만료되었거나 올바르지 않습니다. 예약 확인 메일의 버튼을 다시 눌러 주세요.',
      unsupported: '이 상품은 준비 설문 대상이 아닙니다. 문의사항은 아래 이메일로 알려 주세요.',
      refs: '참고 이미지 링크 (선택)', refsHint: '핀터레스트·인스타 링크를 붙여넣으셔도 됩니다. 없으면 비워 두세요 — 위 선택만으로 충분합니다.',
      note: '그 밖에 알려주실 것 (선택)', notePh: '자유롭게 적어 주세요.',
      submit: '설문 보내기', submitting: '보내는 중입니다...', edited: '이미 작성하신 내용을 불러왔습니다. 수정 후 다시 보내시면 됩니다.',
      doneTitle: '잘 받았습니다', doneText: '촬영 당일 이 내용을 참고해 준비하겠습니다. 바꾸실 내용이 생기면 같은 링크로 다시 들어와 수정하시면 됩니다.',
      required: '한 가지 이상 선택해 주세요.', badUrl: '링크는 http:// 또는 https:// 로 시작해야 합니다.',
      shoot: '촬영', product: '상품', people: '인원', place: '장소', optional: '선택'
    },
    en: {
      title: 'Shoot preparation', lede: 'Tell us the direction you have in mind. It is mostly tapping — about five minutes.',
      loading: 'Loading your booking...',
      errTitle: 'We could not open this form',
      errText: 'The link may have expired or is invalid. Please use the button in your confirmation email again.',
      unsupported: 'This session does not use the preparation form. Please write to us instead.',
      refs: 'Reference image links (optional)', refsHint: 'Pinterest or Instagram links are fine. Leave blank if you have none — your choices above are enough.',
      note: 'Anything else (optional)', notePh: 'Feel free to write anything.',
      submit: 'Send', submitting: 'Sending...', edited: 'We loaded what you sent before. Edit and send again.',
      doneTitle: 'Got it, thank you', doneText: 'We will prepare with this in mind. If anything changes, open the same link and edit.',
      required: 'Please choose at least one.', badUrl: 'Links must start with http:// or https://',
      shoot: 'Shoot', product: 'Session', people: 'Guests', place: 'Location', optional: 'optional'
    },
    de: {
      title: 'Vorbereitung zum Shooting', lede: 'Sagen Sie uns, welche Richtung Ihnen vorschwebt. Meist nur Antippen — etwa fünf Minuten.',
      loading: 'Buchung wird geladen...',
      errTitle: 'Das Formular lässt sich nicht öffnen',
      errText: 'Der Link ist möglicherweise abgelaufen oder ungültig. Bitte nutzen Sie erneut die Schaltfläche in Ihrer Bestätigungs-E-Mail.',
      unsupported: 'Für dieses Shooting gibt es kein Vorbereitungsformular. Schreiben Sie uns gerne direkt.',
      refs: 'Links zu Referenzbildern (optional)', refsHint: 'Pinterest- oder Instagram-Links sind willkommen. Ohne Angabe reichen Ihre Auswahlen oben.',
      note: 'Sonstiges (optional)', notePh: 'Schreiben Sie gerne frei.',
      submit: 'Absenden', submitting: 'Wird gesendet...', edited: 'Ihre bisherigen Angaben wurden geladen. Bearbeiten und erneut senden.',
      doneTitle: 'Vielen Dank', doneText: 'Wir bereiten das Shooting mit diesen Angaben vor. Bei Änderungen einfach denselben Link erneut öffnen.',
      required: 'Bitte wählen Sie mindestens eine Option.', badUrl: 'Links müssen mit http:// oder https:// beginnen.',
      shoot: 'Termin', product: 'Leistung', people: 'Personen', place: 'Ort', optional: 'optional'
    }
  };

  var state = { id: '', lang: 'ko', ctx: null, questions: [], answers: {}, sending: false };
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (v) {
    return String(v == null ? '' : v).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  };
  var t = function (k) { return (T[state.lang] || T.ko)[k]; };
  var langIdx = function () { return state.lang === 'en' ? 2 : (state.lang === 'de' ? 3 : 1); };
  var choiceLabel = function (c) { return c[langIdx()] || c[1]; };

  /* ===== 렌더 ===== */
  function renderContext() {
    var c = state.ctx;
    var bits = [
      ['shoot', (c.date || '') + (c.time ? ' ' + c.time : '')],
      ['product', c.product],
      ['people', c.people ? c.people + (state.lang === 'ko' ? '명' : '') : ''],
      ['place', c.location]
    ].filter(function (b) { return b[1]; });
    $('ctxName').textContent = c.name || '';
    $('ctxGrid').innerHTML = bits.map(function (b) {
      return '<div class="ctx-item"><span>' + esc(t(b[0])) + '</span><b>' + esc(b[1]) + '</b></div>';
    }).join('');
  }

  function renderQuestions() {
    $('questions').innerHTML = state.questions.map(function (q, i) {
      var sel = state.answers[q.id] || [];
      var cards = q.c.map(function (c) {
        var on = sel.indexOf(c[0]) > -1;
        // img 가 있으면 이미지 카드, 없으면 텍스트 칩 — 사진은 나중에 채워도 된다
        if (c[4]) {
          return '<button type="button" class="q-card' + (on ? ' on' : '') + '" data-q="' + esc(q.id) + '" data-v="' + esc(c[0]) + '">'
            + '<img src="' + esc(c[4]) + '" alt="" loading="lazy"><span>' + esc(choiceLabel(c)) + '</span></button>';
        }
        return '<button type="button" class="q-chip' + (on ? ' on' : '') + '" data-q="' + esc(q.id) + '" data-v="' + esc(c[0]) + '">'
          + esc(choiceLabel(c)) + '</button>';
      }).join('');
      var hasImg = q.c.some(function (c) { return !!c[4]; });
      return '<section class="q" data-qid="' + esc(q.id) + '">'
        + '<h2><span class="q-num">' + (i + 1) + '</span>' + esc(q.t[state.lang] || q.t.ko)
        + (q.kind === 'multi' ? '<small>' + (state.lang === 'ko' ? '복수 선택 가능' : state.lang === 'de' ? 'Mehrfachauswahl' : 'multiple choice') + '</small>' : '')
        + '</h2>'
        + '<div class="' + (hasImg ? 'q-cards' : 'q-chips') + '">' + cards + '</div>'
        + '</section>';
    }).join('');

    $('questions').querySelectorAll('[data-q]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var qid = btn.dataset.q, val = btn.dataset.v;
        var q = state.questions.filter(function (x) { return x.id === qid; })[0];
        var cur = state.answers[qid] || [];
        if (q.kind === 'single') {
          state.answers[qid] = cur.indexOf(val) > -1 ? [] : [val];
        } else {
          state.answers[qid] = cur.indexOf(val) > -1
            ? cur.filter(function (v) { return v !== val; })
            : cur.concat([val]);
        }
        renderQuestions();
      });
    });
  }

  /* ===== 요약 — 캘린더에 실릴 한 줄 ===== */
  function buildSummary() {
    var parts = state.questions.map(function (q) {
      var sel = state.answers[q.id] || [];
      if (!sel.length) return '';
      var labels = q.c.filter(function (c) { return sel.indexOf(c[0]) > -1; }).map(function (c) { return c[1]; }); // 요약은 항상 한국어(사장님이 본다)
      return (q.t.ko || q.id) + ' ' + labels.join('·');
    }).filter(Boolean);
    var note = String($('noteInput').value || '').trim();
    if (note) parts.push('메모 ' + note.replace(/\s+/g, ' ').slice(0, 120));
    return parts.join(' / ');
  }

  function collectLinks() {
    return ['ref1', 'ref2', 'ref3'].map(function (id) { return String($(id).value || '').trim(); }).filter(Boolean);
  }

  /* ===== 제출 ===== */
  function submit() {
    if (state.sending) return;
    var missing = state.questions.filter(function (q) { return !(state.answers[q.id] || []).length; });
    if (missing.length) {
      var el = document.querySelector('.q[data-qid="' + missing[0].id + '"]');
      setBanner(t('required'), 'error');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('q-problem');
        setTimeout(function () { el.classList.remove('q-problem'); }, 2600);
      }
      return;
    }
    var links = collectLinks();
    var bad = links.filter(function (u) { return !/^https?:\/\//i.test(u); });
    if (bad.length) { setBanner(t('badUrl'), 'error'); return; }

    state.sending = true;
    $('submitBtn').disabled = true;
    $('submitBtn').textContent = t('submitting');

    var body = {
      requestId: 'prep-' + state.id.slice(-12) + '-' + Date.now(),
      data: {
        id: state.id, lang: state.lang,
        answers: state.answers, summary: buildSummary(),
        links: links, note: String($('noteInput').value || '').trim()
      }
    };
    fetch(API_BASE + '?api=prep-submit&_ts=' + Date.now(), {
      method: 'POST', cache: 'no-store',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body)
    })
      .then(function (r) { return r.text(); })
      .then(function (txt) {
        var res; try { res = JSON.parse(txt); } catch (e) { res = null; }
        if (!res || !res.ok) throw new Error((res && res.error && res.error.message) || 'failed');
        showDone();
      })
      .catch(function (e) {
        state.sending = false;
        $('submitBtn').disabled = false;
        $('submitBtn').textContent = t('submit');
        setBanner(String(e && e.message || e), 'error');
      });
  }

  function showDone() {
    $('app').classList.add('hidden');
    $('doneCard').classList.remove('hidden');
    $('doneTitle').textContent = t('doneTitle');
    $('doneText').textContent = t('doneText');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function setBanner(msg, kind) {
    var b = $('banner');
    b.textContent = msg || '';
    b.className = 'banner' + (msg ? ' ' + (kind || 'info') : ' hidden');
  }

  function showError(msg) {
    $('loadingCard').classList.add('hidden');
    $('app').classList.add('hidden');
    $('errorCard').classList.remove('hidden');
    $('errorTitle').textContent = t('errTitle');
    $('errorText').textContent = msg || t('errText');
  }

  function applyStaticCopy() {
    document.documentElement.lang = state.lang;
    $('pageTitle').textContent = t('title');
    $('pageLede').textContent = t('lede');
    $('refsLabel').textContent = t('refs');
    $('refsHint').textContent = t('refsHint');
    $('noteLabel').textContent = t('note');
    $('noteInput').placeholder = t('notePh');
    $('submitBtn').textContent = t('submit');
    document.querySelectorAll('.lang-btn').forEach(function (b) {
      b.classList.toggle('active', b.dataset.lang === state.lang);
    });
  }

  function boot(ctx) {
    state.ctx = ctx;
    state.lang = (['ko', 'en', 'de'].indexOf(ctx.lang) > -1) ? ctx.lang : 'ko';
    var group = ctx.itemGroup;
    state.questions = Q[group] || [];
    if (!ctx.supported || !state.questions.length) { applyStaticCopy(); showError(t('unsupported')); return; }
    if (ctx.answers && typeof ctx.answers === 'object') {
      state.answers = ctx.answers.choices || ctx.answers;
      if (ctx.answers.note) $('noteInput').value = ctx.answers.note;
      (ctx.answers.links || []).forEach(function (u, i) { if (i < 3) $('ref' + (i + 1)).value = u; });
    }
    /* 예약할 때 이미 고른 배경이 요청사항에 `[배경1:white]` 형태로 남아 있다 — 같은 걸 두 번 묻지
       않도록 미리 채워 둔다. 고객은 그대로 두거나 바꾸면 된다. */
    if (!(state.answers.background || []).length) {
      var picked = (String(ctx.memo || '').match(/\[배경[0-9]*:([a-z]+)\]/g) || [])
        .map(function (m) { return m.replace(/^.*:([a-z]+)\]$/, '$1'); });
      if (picked.length) state.answers.background = picked;
    }
    applyStaticCopy();
    renderContext();
    renderQuestions();
    $('loadingCard').classList.add('hidden');
    $('app').classList.remove('hidden');
    if (ctx.submittedAt) setBanner(t('edited'), 'info');
  }

  function load() {
    var params = new URLSearchParams(location.search);
    state.id = String(params.get('id') || '').trim();
    if (!state.id) { showError(); return; }
    $('loadingText').textContent = t('loading');
    fetch(API_BASE + '?api=prep-get&id=' + encodeURIComponent(state.id) + '&_ts=' + Date.now(), { cache: 'no-store' })
      .then(function (r) { return r.text(); })
      .then(function (txt) {
        var res; try { res = JSON.parse(txt); } catch (e) { res = null; }
        if (!res || !res.ok) { showError((res && res.error && res.error.message) || ''); return; }
        boot(res.data || res);
      })
      .catch(function () { showError(); });
  }

  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('.lang-btn').forEach(function (b) {
      b.addEventListener('click', function () {
        state.lang = b.dataset.lang;
        applyStaticCopy();
        if (state.ctx) { renderContext(); renderQuestions(); }
      });
    });
    $('submitBtn').addEventListener('click', submit);
    load();
  });
})();
