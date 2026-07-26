// 인화 등급(시그니처/파인아트) 설명 카피 — 예약·셀렉 공용 단일 소스.
//
// ⚠ PRINT_OPTIONS 가 이미 3벌(select/select.js · select/v2/select.js · shared/print-catalog.js)
//    복제돼 있다. 카피를 각 파일에 넣으면 4벌째가 되므로 카피는 여기 한 곳에만 둔다.
//
// 🔴 아래 문장은 UWG 법률 검수를 통과한 원문이다. 임의로 다듬지 말 것.
//    금지: ① 크롭 없음 주장("원본 비율 그대로"/"The whole frame") — 실제로 규격 크롭이 발생하므로 §5 오인유발
//          ② 결과 보장("인물이 잘리지 않게 맞춥니다") — §5 + §434 BGB로 재인화·환불 청구 근거
//          ③ 제3자 장비·경쟁사 서술(키오스크/"자동 기계와 달리") — §6 비교광고
//          ④ OBA 스펙 단정("형광증백제를 쓰지 않아") — 데이터시트 문구 없이는 입증책임
//          ⑤ "모든 패키지 포함" — op/oprm 은 포함 인화가 없다(포함 여부는 쿼터 UI가 말한다)
//          ⑥ Archivpapier / archival stock / Feinstpapier / by eye / von Hand
//
// ⚠ id → tier 는 명시 매핑이다. 'basic_'/'premium_' 접두어로 판정하지 말 것 — 리네이밍 후 깨진다.

export const PRINT_ID_TIER = {
  basic_10x15: 'signature',
  basic_a4: 'signature',
  premium_10x15: 'fineart',
  premium_a4: 'fineart',
  premium_a3: 'fineart',
  premium_a3plus: 'fineart',
  photocard_single: 'photocard',
  photocard_double: 'photocard'
};

// 등급별 카피. paper=용지 캡션(드롭다운 아래 한 줄), texture=옵션 보조설명.
export const PRINT_TIERS = {
  signature: {
    name: { ko: '시그니처 인화', en: 'Signature Print', de: 'Signature-Abzug' },
    oneLine: {
      ko: '프로 사진용 인화지에 그대로 출력하는 기본 등급.',
      en: 'The standard grade, printed on professional photo paper.',
      de: 'Die Standardqualität, gedruckt auf professionellem Fotopapier.'
    },
    paperSpec: {
      ko: '은은한 반광의 프로 사진용지 (10×15 · A4 동일 용지)',
      en: 'Professional semi-gloss photo paper (same paper in 10×15 and A4)',
      de: 'Professionelles Fotopapier mit feinem Seidenglanz (gleiches Papier in 10×15 und A4)'
    },
    character: {
      ko: '은은한 반광. 윤곽이 또렷하고 색이 생생하게 올라옵니다.',
      en: 'A soft semi-gloss. Edges stay crisp, colours come up bright and alive.',
      de: 'Feiner Seidenglanz. Klare Zeichnung, lebendige, frische Farben.'
    },
    bestFor: {
      ko: '앨범, 책상 위 액자, 가족과 나눠 갖는 사진.',
      en: 'Albums, a frame on the desk, prints to share with family.',
      de: 'Album, Rahmen auf dem Schreibtisch, Abzüge für die Familie.'
    },
    // 셀렉 드롭다운 아래 한 줄
    paper: {
      ko: '발색과 선예도가 좋은 프로 사진용지 · 은은한 반광',
      en: 'Professional photo paper · soft semi-gloss',
      de: 'Professionelles Fotopapier · feiner Seidenglanz'
    },
    texture: {
      ko: '선명하고 생생한 기본 인화지',
      en: 'Clear and vivid, the standard paper',
      de: 'Klar und lebendig — das Standardpapier'
    }
  },
  fineart: {
    name: { ko: '파인아트 인화', en: 'Fine Art Print', de: 'FineArt-Druck' },
    oneLine: {
      ko: '벽에 걸어 두고 오래 보는 인화.',
      en: 'The print made for the wall.',
      de: 'Der Druck für die Wand.'
    },
    paperSpec: {
      ko: '매트한 파이버 질감의 파인아트지 (10×15 내추럴 화이트 · A4/A3/A3+ 웜 화이트)',
      en: 'Matte fibre art paper (10×15 natural white · A4/A3/A3+ warm white)',
      de: 'Mattes FineArt-Papier (10×15 naturweiß · A4/A3/A3+ warmweiß)'
    },
    character: {
      ko: '매트한 파이버 질감. 빛 반사가 적고, 색이 종이 안쪽으로 가라앉듯 깊어집니다. 표백한 흰색이 아니라 종이 본래의 내추럴 화이트·웜 화이트 톤이라, 색이 차분하게 앉습니다.',
      en: 'A matte fibre surface. Very little reflection; colours settle deep into the paper. Not a bleached white but the paper’s own natural and warm white, so the tone stays calm.',
      de: 'Matte Faserstruktur. Kaum Reflexionen — die Farben sinken ruhig ins Papier. Kein gebleichtes Weiß, sondern das natürliche Naturweiß bzw. Warmweiß des Papiers — der Ton bleibt zurückhaltend.'
    },
    bestFor: {
      ko: '벽에 거는 사진, 인물 대형 출력, 선물. 오래 남기려는 한 장.',
      en: 'Wall pieces, larger portraits, gifts. The one you want to keep for a long time.',
      de: 'Wandbilder, große Porträts, Geschenke. Das eine Bild, das lange an der Wand bleibt.'
    },
    paper: {
      ko: '매트 파이버 질감의 파인아트지 · 빛 반사가 적음',
      en: 'Matte fibre art paper · very little reflection',
      de: 'Mattes FineArt-Papier · kaum Reflexionen'
    },
    texture: {
      ko: '매트한 파이버 질감, 오래 두고 보는 종이',
      en: 'Matte fibre surface, made for the wall',
      de: 'Matte Faserstruktur — für die Wand gemacht'
    }
  },
  photocard: {
    // 포토카드는 등급 비교 대상이 아니다(별도 상품 형태). 캡션만 제공한다.
    name: { ko: '포토카드', en: 'Photocard', de: 'Fotokarte' },
    paper: {
      ko: '지갑에 넣는 카드 크기로 재단해 드립니다',
      en: 'Trimmed to wallet-card size',
      de: 'Auf Scheckkartenformat zugeschnitten'
    },
    texture: {
      ko: '지갑 카드 크기',
      en: 'Wallet-card size',
      de: 'Scheckkartenformat'
    }
  }
};

// ② "저희가 인화하는 방식" — 예약 아코디언 하단 블록.
// 크롭 수치는 실측(A4·A3 = 긴 변 5.71%, A3+ = 2.13%)이며 §5a(중요정보 은폐) 회피용으로 반드시 유지한다.
export const PRINT_METHOD_POINTS = {
  ko: {
    title: '저희가 인화하는 방식',
    points: [
      {
        head: '보정한 색 그대로',
        body: '인화 전에 보정 파일의 색 프로파일을 확인하고, 저희 프린터 프로파일에 맞춰 출력합니다.'
      },
      {
        head: '잘리는 부분을 미리 확인합니다',
        body: '인화지 규격과 사진 비율이 늘 같지는 않아, 규격에 따라 가장자리가 조금 잘립니다. 10×15는 저희 카메라 원본(3:2)과 비율이 같아 거의 그대로 나가고, A4·A3는 긴 변에서 약 6%가 잘려 세로 사진은 위아래 여백이 조금 좁아집니다(A3+는 그보다 적습니다). 휴대폰 사진처럼 비율이 다른 원본은 조금 더 잘릴 수 있습니다.<br>저희는 인화 전에 한 장씩 보고 크롭을 직접 맞춥니다. 인물이 화면 끝에 걸려 잘라내기 어렵거나 원하시는 크롭이 따로 있으시면, 여백을 두고 인화하거나 미리 여쭙습니다.'
      },
      {
        head: '종이',
        body: '시그니처는 프로 사진용 세미글로스 인화지(10×15와 A4 모두 같은 용지), 파인아트는 매트 파이버 계열 파인아트지를 씁니다. 두 등급 모두 보존을 염두에 두고 고른 종이입니다.'
      },
      {
        head: '한 장씩 확인하고 보냅니다',
        body: '출력된 사진은 한 장씩 눈으로 확인하고, 크기에 맞춰 정리해 보내드립니다. A3와 A3+는 각각 전용 용지 규격으로 인화합니다.'
      }
    ]
  },
  en: {
    title: 'How we print',
    points: [
      {
        head: 'The colours we edited',
        body: 'Before printing, we check the colour profile of the edited file and match it to our printer profile.'
      },
      {
        head: 'We check the crop before we print',
        body: 'Paper formats and photo ratios don’t always match, so a little of the edge is trimmed depending on the format. 10×15 matches our camera’s 3:2 ratio, so almost nothing is lost; A4 and A3 lose about 6% of the long edge, which leaves vertical photos a little tighter above and below (A3+ slightly less). Files with a different ratio — phone photos, for example — lose a bit more.<br>We check each photo before printing and set the crop ourselves. If someone sits right at the edge, or if you’d like a particular crop, we print with a border or ask you first.'
      },
      {
        head: 'The paper',
        body: 'Signature uses professional semi-gloss photo paper — the same paper in both 10×15 and A4. Fine Art uses a matte fibre art paper. Both grades were chosen with longevity in mind.'
      },
      {
        head: 'Checked by hand, one print at a time',
        body: 'Every print is looked at individually and finished to size before it leaves the studio. A3 and A3+ each have their own sheet size.'
      }
    ]
  },
  de: {
    title: 'Wie wir drucken',
    points: [
      {
        head: 'Die Farben, die wir bearbeitet haben',
        body: 'Vor dem Druck prüfen wir das Farbprofil der bearbeiteten Datei und stimmen es auf unser Druckerprofil ab.'
      },
      {
        head: 'Wir prüfen den Zuschnitt vor dem Druck',
        body: 'Papierformat und Bildseitenverhältnis stimmen nicht immer überein — je nach Format wird der Rand etwas beschnitten. 10×15 entspricht dem Originalverhältnis unserer Kameras (3:2), hier geht fast nichts verloren; bei A4 und A3 sind es rund 6 % der langen Seite, wodurch Hochformate oben und unten etwas knapper werden (bei A3+ weniger). Bei Dateien mit anderem Seitenverhältnis, etwa Handyfotos, ist es etwas mehr.<br>Wir sehen uns jedes Bild vor dem Druck einzeln an und legen den Ausschnitt selbst fest. Steht jemand ganz am Bildrand oder wünschen Sie einen bestimmten Ausschnitt, drucken wir mit Rand oder melden uns vorher bei Ihnen.'
      },
      {
        head: 'Das Papier',
        body: 'Signature drucken wir auf professionellem Semigloss-Fotopapier — dasselbe Papier in 10×15 und A4. FineArt drucken wir auf mattem FineArt-Papier. Beide Qualitäten haben wir mit Blick auf Haltbarkeit ausgewählt.'
      },
      {
        head: 'Jedes Bild geht durch unsere Hände',
        body: 'Jedes Bild wird einzeln angesehen und passgenau fertiggestellt, bevor es das Studio verlässt. A3 und A3+ haben jeweils ihr eigenes Papierformat.'
      }
    ]
  }
};

// ③ 마이크로카피 — 포함/추가 단정은 여기(쿼터 UI)와 상품별 조건부 렌더만 담당한다.
export const PRINT_MICROCOPY = {
  // 예약: 포함 인화가 전부 시그니처인 상품
  bookingGradeNote: {
    ko: '인화가 포함된 패키지는 시그니처 인화로 나갑니다.',
    en: 'Where a package includes prints, they are Signature prints.',
    de: 'Wenn ein Paket Abzüge enthält, sind es Signature-Abzüge.'
  },
  // 예약: 파인아트가 섞인 상품(프리웨딩 wp/wprm — premium_a3 1장)
  bookingGradeNoteMixed: {
    ko: '포함 인화는 시그니처 인화지로, A3 1장은 파인아트 인화지로 출력합니다.',
    en: 'Included prints are Signature; the single A3 is a Fine Art print.',
    de: 'Die enthaltenen Abzüge sind Signature; das eine A3 ist ein FineArt-Druck.'
  },
  // 셀렉: 출력 선택 상단 한 줄
  selectIntro: {
    ko: '보정한 색 그대로, 스튜디오에서 인화합니다.',
    en: 'Printed in the studio, in the colours we edited.',
    de: 'Im Studio gedruckt, in den bearbeiteten Farben.'
  },
  // 셀렉 Step 3 안내 문장
  selectStepNote: {
    ko: '인화는 시그니처와 파인아트 두 등급 중에서 고를 수 있습니다.',
    en: 'Prints are available in two grades: Signature and Fine Art.',
    de: 'Abzüge gibt es in zwei Qualitäten: Signature und FineArt.'
  },
  /* 셀렉: 쿼터 배너 뒤 차액 안내.
     ⚠ 이 문장은 **차액 과금이 실제로 구현된 뒤에만** 사실이다(2026-07-26 구현 완료).
     근거: 서버 computeSelectDecoupledPrints_ + 클라이언트 computePrintAnnotations(v2) /
     getPrintQuotaCredit(v1) 이 "정확일치 쿼터 우선 → 없으면 가장 비싼 쿼터를 소진해 차액만 청구"로 동작한다.
     쿼터 규칙을 되돌리면 이 문장도 함께 내려야 한다(UWG §5 오인유발). */
  quotaUpgradeNote: {
    ko: '포함된 인화를 다른 사이즈·등급으로 바꾸시면 차액만 청구돼요.',
    en: 'Swapping an included print for another size or grade costs only the difference.',
    de: 'Tauschen Sie einen enthaltenen Abzug gegen eine andere Größe oder Qualität, wird nur die Differenz berechnet.'
  },
  // 셀렉 Step 4: 되돌아가기 안내
  reviewBackNote: {
    ko: '파인아트로 바꾸고 싶은 사진이 있으면 ‘← 출력 선택’에서 언제든 변경할 수 있어요.',
    en: 'If you’d like any photo as a Fine Art print, you can change it any time under ‘← Print selection’.',
    de: 'Möchten Sie ein Bild als FineArt-Druck, können Sie es jederzeit unter ‘← Druckauswahl’ ändern.'
  }
};

export function getPrintTier(printId) {
  return PRINT_ID_TIER[String(printId || '')] || '';
}

// 셀렉은 KO 전용이라 lang 기본값이 'ko'.
export function getPrintTierCopy(printId, lang = 'ko') {
  const tier = getPrintTier(printId);
  const spec = PRINT_TIERS[tier];
  if (!spec) return null;
  const pick = (field) => (field && (field[lang] || field.ko)) || '';
  return {
    tier,
    tierName: pick(spec.name),
    paper: pick(spec.paper),
    texture: pick(spec.texture),
    oneLine: pick(spec.oneLine),
    paperSpec: pick(spec.paperSpec),
    character: pick(spec.character),
    bestFor: pick(spec.bestFor)
  };
}

export function getPrintTierName(tier, lang = 'ko') {
  const spec = PRINT_TIERS[tier];
  return (spec && (spec.name[lang] || spec.name.ko)) || '';
}

export function getPrintMicrocopy(key, lang = 'ko') {
  const entry = PRINT_MICROCOPY[key];
  return (entry && (entry[lang] || entry.ko)) || '';
}
