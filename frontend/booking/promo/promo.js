import { fetchInitData } from '../shared/api.js';

const STRINGS = {
  ko: {
    loading: '프로모션 페이지를 준비하고 있습니다.',
    title: '가정의 달 이벤트',
    lead: '아이의 지금, 그리고 가족의 지금을 가볍지만 오래 남는 사진으로 기록해보세요.',
    statusReady: '프로모션 안내가 열려 있습니다.',
    statusClosed: '현재 프로모션이 비활성화되어 있습니다.',
    closedTitle: '프로모션이 현재 비활성화되어 있습니다.',
    closedBody: '운영 공지 후 다시 열릴 예정입니다.',
    periodLabel: '진행 기간',
    periodValue: '2026.04.20 - 2026.05.10',
    limitLabel: '모집 안내',
    limitValue: '각 이벤트 선착순 5팀',
    kidsBadge: 'Kids Profile Event',
    kidsTitle: '키즈 프로필 이벤트',
    kidsList: [
      '30분 촬영 / 보정본 2장 / 배경 1컬러 / 의상 1벌',
      '프리미엄 인화 10x15cm 인원수만큼 증정',
      '양면 포토카드 추가 증정',
      '1인 69€ / 2인 89€ / 3인 109€'
    ],
    kidsNoticeTitle: '안내',
    kidsNoticeBody: '단독 키즈 촬영은 만 3세 이하 진행이 어렵습니다.',
    familyBadge: 'Family Photo Event',
    familyTitle: '가족사진 이벤트',
    familyList: [
      '30분 촬영 / 보정본 3장 / 배경 1컬러 / 의상 1벌',
      '프리미엄 인화 A4 1장 + 10x15cm 2장 포함',
      '양면 포토카드 2장 포함',
      '2인 129€ / 3인 149€ / 4인 169€'
    ],
    familyNoticeTitle: '안내',
    familyNoticeBody: '5인 이상은 1인 추가당 +20€가 적용됩니다. 인원 추가 시 10x15cm 인화 1장이 함께 추가됩니다.',
    footerTitle: '프로모션 안내',
    footerBody: '선착순 마감 시 조기 종료될 수 있습니다.',
    tags: '#독일 #독일가족사진 #유럽한인사진관 #어린이날 #가정의달'
  },
  en: {
    loading: 'Preparing the promotion page.',
    title: 'Family Month Promotion',
    lead: 'Record your child and your family as they are now with a light but lasting photo session.',
    statusReady: 'The promotion page is currently active.',
    statusClosed: 'This promotion is currently unavailable.',
    closedTitle: 'This promotion is currently unavailable.',
    closedBody: 'It will reopen after the studio announces the campaign.',
    periodLabel: 'Promotion Period',
    periodValue: '2026.04.20 - 2026.05.10',
    limitLabel: 'Availability',
    limitValue: 'Limited to 5 teams per event',
    kidsBadge: 'Kids Profile Event',
    kidsTitle: 'Kids Profile Event',
    kidsList: [
      '30 min session / 2 retouched photos / 1 background color / 1 outfit',
      'One premium 10x15cm print per person included',
      'Extra double-sided photocard included',
      '1 person 69€ / 2 people 89€ / 3 people 109€'
    ],
    kidsNoticeTitle: 'Note',
    kidsNoticeBody: 'A kids-only session is difficult for children under 3 years old.',
    familyBadge: 'Family Photo Event',
    familyTitle: 'Family Photo Event',
    familyList: [
      '30 min session / 3 retouched photos / 1 background color / 1 outfit',
      'Includes 1 A4 premium print + 2 prints in 10x15cm',
      'Includes 2 double-sided photocards',
      '2 people 129€ / 3 people 149€ / 4 people 169€'
    ],
    familyNoticeTitle: 'Note',
    familyNoticeBody: 'For 5 or more people, +20€ per additional person applies and one extra 10x15cm print is included.',
    footerTitle: 'Promotion Note',
    footerBody: 'The promotion may close early once the limited slots are filled.',
    tags: '#Germany #FamilyPhotos #KoreanStudioInEurope #ChildrensDay #FamilyMonth'
  },
  de: {
    loading: 'Die Aktionsseite wird vorbereitet.',
    title: 'Familienmonat Aktion',
    lead: 'Halten Sie den jetzigen Moment Ihres Kindes und Ihrer Familie in leichten, aber langlebigen Bildern fest.',
    statusReady: 'Die Aktionsseite ist aktuell aktiv.',
    statusClosed: 'Diese Aktion ist derzeit nicht aktiv.',
    closedTitle: 'Diese Aktion ist derzeit nicht aktiv.',
    closedBody: 'Nach der nächsten Studio-Ankündigung wird sie wieder geöffnet.',
    periodLabel: 'Aktionszeitraum',
    periodValue: '20.04.2026 - 10.05.2026',
    limitLabel: 'Verfügbarkeit',
    limitValue: 'Jeweils 5 Teams pro Aktion',
    kidsBadge: 'Kids Profile Event',
    kidsTitle: 'Kinderprofil Aktion',
    kidsList: [
      '30 Min. Shooting / 2 bearbeitete Bilder / 1 Hintergrundfarbe / 1 Outfit',
      'Ein Premiumabzug 10x15cm pro Person inklusive',
      'Zusätzliche doppelseitige Fotokarte inklusive',
      '1 Person 69€ / 2 Personen 89€ / 3 Personen 109€'
    ],
    kidsNoticeTitle: 'Hinweis',
    kidsNoticeBody: 'Ein reines Kindershooting ist für Kinder unter 3 Jahren nur eingeschränkt möglich.',
    familyBadge: 'Family Photo Event',
    familyTitle: 'Familienfoto Aktion',
    familyList: [
      '30 Min. Shooting / 3 bearbeitete Bilder / 1 Hintergrundfarbe / 1 Outfit',
      'Enthält 1 Premiumabzug A4 + 2 Abzüge 10x15cm',
      'Enthält 2 doppelseitige Fotokarten',
      '2 Personen 129€ / 3 Personen 149€ / 4 Personen 169€'
    ],
    familyNoticeTitle: 'Hinweis',
    familyNoticeBody: 'Ab 5 Personen werden pro weiterer Person +20€ berechnet, zusätzlich mit einem weiteren 10x15cm Abzug.',
    footerTitle: 'Aktionshinweis',
    footerBody: 'Die Aktion kann bei Erreichen der limitierten Plätze vorzeitig enden.',
    tags: '#Deutschland #Familienfotos #KoreanischesStudioInEuropa #Kindertag #Familienmonat'
  }
};

const state = { lang: 'ko', promoEnabled: false };

const els = {
  loadingScreen: document.getElementById('loadingScreen'),
  loadingCopy: document.getElementById('loadingCopy'),
  statusBanner: document.getElementById('statusBanner'),
  promoClosed: document.getElementById('promoClosed'),
  promoContent: document.getElementById('promoContent'),
  langBtns: Array.from(document.querySelectorAll('.lang-btn'))
};

function t() {
  return STRINGS[state.lang] || STRINGS.ko;
}

function setList(id, items) {
  const list = document.getElementById(id);
  list.innerHTML = items.map((item) => `<li>${item}</li>`).join('');
}

function render() {
  const copy = t();
  document.documentElement.lang = state.lang;
  document.getElementById('loadingCopy').textContent = copy.loading;
  document.getElementById('heroTitle').textContent = copy.title;
  document.getElementById('heroLead').textContent = copy.lead;
  document.getElementById('closedTitle').textContent = copy.closedTitle;
  document.getElementById('closedBody').textContent = copy.closedBody;
  document.getElementById('periodLabel').textContent = copy.periodLabel;
  document.getElementById('periodValue').textContent = copy.periodValue;
  document.getElementById('limitLabel').textContent = copy.limitLabel;
  document.getElementById('limitValue').textContent = copy.limitValue;
  document.getElementById('kidsBadge').textContent = copy.kidsBadge;
  document.getElementById('kidsTitle').textContent = copy.kidsTitle;
  setList('kidsList', copy.kidsList);
  document.getElementById('kidsNoticeTitle').textContent = copy.kidsNoticeTitle;
  document.getElementById('kidsNoticeBody').textContent = copy.kidsNoticeBody;
  document.getElementById('familyBadge').textContent = copy.familyBadge;
  document.getElementById('familyTitle').textContent = copy.familyTitle;
  setList('familyList', copy.familyList);
  document.getElementById('familyNoticeTitle').textContent = copy.familyNoticeTitle;
  document.getElementById('familyNoticeBody').textContent = copy.familyNoticeBody;
  document.getElementById('footerTitle').textContent = copy.footerTitle;
  document.getElementById('footerBody').textContent = copy.footerBody;
  document.getElementById('hashTags').textContent = copy.tags;
  els.statusBanner.textContent = state.promoEnabled ? copy.statusReady : copy.statusClosed;
  els.statusBanner.style.background = state.promoEnabled ? '#eff8f4' : '#fdf1ef';
  els.statusBanner.style.borderColor = state.promoEnabled ? '#cfe2da' : '#f1c9c3';
  els.statusBanner.style.color = state.promoEnabled ? '#497062' : '#8c4d44';
  els.promoContent.classList.toggle('hidden', !state.promoEnabled);
  els.promoClosed.classList.toggle('hidden', state.promoEnabled);
  els.langBtns.forEach((btn) => btn.classList.toggle('active', btn.dataset.lang === state.lang));
}

async function init() {
  els.langBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      state.lang = btn.dataset.lang;
      render();
    });
  });
  render();
  try {
    const initData = await fetchInitData();
    state.promoEnabled = !!initData?.settings?.promoEnabled;
  } catch (error) {
    state.promoEnabled = false;
    els.statusBanner.textContent = error.message || '프로모션 정보를 불러오지 못했습니다.';
    els.statusBanner.style.background = '#fdf1ef';
    els.statusBanner.style.borderColor = '#f1c9c3';
    els.statusBanner.style.color = '#8c4d44';
  } finally {
    render();
    els.loadingScreen.classList.add('hidden');
  }
}

init();
