const rootEl = document.documentElement;
const DATA_URL = rootEl.dataset.dataUrl || './portfolio-data.json';
const ASSET_BASE = rootEl.dataset.assetBase || (DATA_URL.startsWith('../') ? '../' : './');
const HERO_ASSETS = {
  portrait: `${ASSET_BASE}assets/hero/hero-portrait.jpg`,
  wedding: `${ASSET_BASE}assets/hero/hero-wedding.jpg`,
  kids: `${ASSET_BASE}assets/hero/hero-kids.jpg`
};
const CATEGORY_ORDER = ['portrait', 'wedding', 'family', 'kids', 'maternity', 'snap'];
const CATEGORY_LIMITS = {
  portrait: 12,
  wedding: 12,
  family: 8,
  kids: 8,
  maternity: 7,
  snap: 6
};
const SERIES_LIMIT = 2;
const PRIMARY_SERIES_LIMIT = 1;
const FEATURED_STAGE_LIMIT = 3;
const TILE_PATTERNS = {
  all: ['feature', 'tall', 'standard', 'wide', 'standard', 'tall', 'cinema', 'standard', 'wide', 'tall', 'standard', 'standard'],
  filtered: ['wide', 'tall', 'standard', 'feature', 'standard', 'tall', 'wide', 'standard']
};
const locale = String(rootEl.lang || 'de').toLowerCase().startsWith('ko')
  ? 'ko'
  : String(rootEl.lang || 'de').toLowerCase().startsWith('en')
    ? 'en'
    : 'de';

const copy = {
  de: {
    loading: 'Bilder werden geladen…',
    empty: 'Keine Bilder gefunden.',
    unavailable: 'Das Portfolio konnte gerade nicht geladen werden.',
    sourceLoaded: (count) => `${count} Arbeiten · sorgfältig kuratiert`,
    noFolder: 'Im verknüpften Ordner wurden keine Bilder gefunden.',
    broken: 'Bild nicht verfügbar',
    lightboxClose: 'Schließen',
    heroSelected: 'Ausgewählt',
    heroOpen: 'Ansehen',
    labels: {
      portrait: 'Portrait',
      family: 'Familie',
      kids: 'Kinder',
      maternity: 'Babybauch',
      wedding: 'Hochzeit',
      snap: 'Snap',
      all: 'Alle'
    }
  },
  en: {
    loading: 'Loading images…',
    empty: 'No images found.',
    unavailable: 'The portfolio could not be loaded right now.',
    sourceLoaded: (count) => `${count} selected works`,
    noFolder: 'No images were found in the connected folder.',
    broken: 'Image unavailable',
    lightboxClose: 'Close',
    heroSelected: 'Selected',
    heroOpen: 'View',
    labels: {
      portrait: 'Portrait',
      family: 'Family',
      kids: 'Kids',
      maternity: 'Maternity',
      wedding: 'Wedding',
      snap: 'Snap',
      all: 'All'
    }
  },
  ko: {
    loading: '이미지를 불러오는 중입니다…',
    empty: '표시할 이미지가 없습니다.',
    unavailable: '포트폴리오를 지금 불러올 수 없습니다.',
    sourceLoaded: (count) => `${count}개의 작업을 선별해 보여드립니다`,
    noFolder: '연결된 폴더에서 이미지를 찾지 못했습니다.',
    broken: '이미지를 불러올 수 없습니다',
    lightboxClose: '닫기',
    heroSelected: '선택',
    heroOpen: '보기',
    labels: {
      portrait: '프로필',
      family: '가족사진',
      kids: '키즈',
      maternity: '만삭',
      wedding: '웨딩',
      snap: '스냅',
      all: '전체'
    }
  }
}[locale];

const state = {
  photos: [],
  filtered: [],
  activeFilter: 'all',
  lightboxIndex: -1,
  warmCache: new Set()
};

const els = {
  status: document.getElementById('portfolioStatus'),
  grid: document.getElementById('portfolioGrid'),
  heroVisual: document.getElementById('heroVisual'),
  featuredStage: document.getElementById('featuredStage'),
  filterButtons: Array.from(document.querySelectorAll('[data-filter]')),
  lightbox: document.getElementById('lightbox'),
  lightboxImage: document.getElementById('lightboxImage'),
  lightboxCaption: document.getElementById('lightboxCaption'),
  lightboxClose: document.getElementById('lightboxClose'),
  lightboxPrev: document.getElementById('lightboxPrev'),
  lightboxNext: document.getElementById('lightboxNext')
};

function buildThumb(id, width = 1800) {
  return `https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=w${width}`;
}

function buildLightbox(id, width = 2600) {
  return `https://lh3.googleusercontent.com/d/${encodeURIComponent(id)}=w${width}`;
}

function normalizePhotos(items = []) {
  return items
    .filter((item) => String(item?.id || '').trim())
    .map((item, index) => {
      const id = String(item.id).trim();
      const name = String(item.name || '').trim();
      const category = String(item.category || 'portrait').trim();
      const categoryLabel = resolveCategoryLabel(String(item.category || 'portrait').trim(), item);
      return {
        id,
        name,
        index,
        category,
        label: categoryLabel,
        seriesKey: buildSeriesKey({ id, name, category, folderName: item.folderName }),
        folderName: String(item.folderName || '').trim(),
        timestamp: Number(item.timestamp || 0),
        thumb: buildThumb(id, 1800),
        thumbSet: `${buildThumb(id, 960)} 960w, ${buildThumb(id, 1440)} 1440w, ${buildThumb(id, 2200)} 2200w`,
        full: buildLightbox(id, 2600),
        fallback: buildThumb(id, 2200)
      };
    });
}

function curatePhotos(photos = []) {
  const byCategory = new Map();
  const bySeries = new Map();
  const selected = [];
  const selectedIds = new Set();

  addCuratedPhotos(photos, selected, selectedIds, byCategory, bySeries, PRIMARY_SERIES_LIMIT);
  addCuratedPhotos(photos, selected, selectedIds, byCategory, bySeries, SERIES_LIMIT);

  return interleaveByCategory(selected);
}

function addCuratedPhotos(photos, selected, selectedIds, byCategory, bySeries, seriesLimit) {
  photos.forEach((photo) => {
    if (selectedIds.has(photo.id)) return;
    const categoryLimit = CATEGORY_LIMITS[photo.category] || 8;
    const categoryCount = byCategory.get(photo.category) || 0;
    if (categoryCount >= categoryLimit) return;

    const seriesKey = photo.seriesKey || buildSeriesKey(photo);
    const seriesCount = bySeries.get(seriesKey) || 0;
    if (seriesCount >= seriesLimit) return;

    selected.push(photo);
    selectedIds.add(photo.id);
    byCategory.set(photo.category, categoryCount + 1);
    bySeries.set(seriesKey, seriesCount + 1);
  });
}

function buildSeriesKey(photo) {
  const base = String(photo.name || photo.id || '')
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/\s*\([^)]*\)/g, '')
    .replace(/\s+copy\d*(\s+\d+)?/g, '')
    .replace(/_\d+$/g, '')
    .replace(/\d+$/g, '')
    .replace(/[_\-\s]+$/g, '')
    .trim();
  return `${photo.category}:${base || photo.folderName || photo.id}`;
}

function interleaveByCategory(photos = []) {
  const buckets = new Map();
  CATEGORY_ORDER.forEach((category) => buckets.set(category, []));
  photos.forEach((photo) => {
    if (!buckets.has(photo.category)) buckets.set(photo.category, []);
    buckets.get(photo.category).push(photo);
  });

  const result = [];
  let added = true;
  while (added) {
    added = false;
    CATEGORY_ORDER.forEach((category) => {
      const bucket = buckets.get(category);
      if (bucket?.length) {
        result.push(bucket.shift());
        added = true;
      }
    });
  }
  return result;
}

function matchesFilter(photo, filter) {
  return filter === 'all' ? true : photo.category === filter;
}

function renderGrid() {
  state.filtered = arrangeGalleryPhotos(state.photos.filter((photo) => matchesFilter(photo, state.activeFilter)));
  assignFilteredIndexes(state.filtered);
  renderHeroVisual();
  renderFeaturedStage();
  ensureGridImageErrorHandler();
  if (!state.filtered.length) {
    els.grid.innerHTML = '';
    els.status.textContent = copy.empty;
    return;
  }
  els.status.textContent = copy.sourceLoaded(state.filtered.length);
  const displayPhotos = buildGridDisplayPhotos(state.filtered);
  assignGalleryLayout(displayPhotos);
  els.grid.innerHTML = displayPhotos.map((photo, index) => `
    <button type="button" class="portfolio-card ${escapeAttr(photo.tileClass)}" data-index="${photo.filteredIndex}" data-label="${escapeAttr(photo.label)}" style="--image-position: ${escapeAttr(photo.imagePosition)};">
      <img
        src="${escapeAttr(photo.thumb)}"
        srcset="${escapeAttr(photo.thumbSet)}"
        sizes="(max-width: 480px) 50vw, (max-width: 760px) 66vw, (max-width: 1100px) 50vw, (max-width: 1440px) 33vw, 28vw"
        data-full="${escapeAttr(photo.full)}"
        data-fallback="${escapeAttr(photo.fallback)}"
        alt="${escapeAttr(photo.name)}"
        loading="${index < 12 ? 'eager' : 'lazy'}"
        decoding="async"
      >
    </button>
  `).join('');
  wireGridEvents();
  scheduleGridImageCleanup();
}

function buildGridDisplayPhotos(photos = []) {
  if (state.activeFilter !== 'all' || photos.length < 10) return photos;
  const featuredIds = new Set(pickFeaturedPhotos(photos).map((photo) => photo.id));
  const fresh = [];
  const deferred = [];
  photos.forEach((photo) => {
    if (featuredIds.has(photo.id)) {
      deferred.push(photo);
    } else {
      fresh.push(photo);
    }
  });
  return [...fresh.slice(0, 18), ...deferred, ...fresh.slice(18)];
}

function arrangeGalleryPhotos(photos = []) {
  return state.activeFilter === 'all'
    ? interleaveByCategory(photos)
    : interleaveBySeries(photos);
}

function interleaveBySeries(photos = []) {
  const buckets = new Map();
  photos.forEach((photo) => {
    const key = photo.seriesKey || buildSeriesKey(photo);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(photo);
  });
  const result = [];
  let added = true;
  while (added) {
    added = false;
    Array.from(buckets.values()).forEach((bucket) => {
      if (bucket.length) {
        result.push(bucket.shift());
        added = true;
      }
    });
  }
  return result;
}

function assignGalleryLayout(photos = []) {
  const pattern = state.activeFilter === 'all' ? TILE_PATTERNS.all : TILE_PATTERNS.filtered;
  photos.forEach((photo, index) => {
    const variant = resolveTileVariant(photo, index, pattern, photos.length);
    photo.tileClass = `portfolio-card--${variant}`;
    photo.imagePosition = resolveImagePosition(photo, variant, index);
  });
}

function resolveTileVariant(photo, index, pattern, total) {
  if (total <= 3) return index === 0 ? 'feature' : 'wide';
  let variant = pattern[index % pattern.length] || 'standard';
  if ((photo.category === 'portrait' || photo.category === 'maternity' || photo.category === 'kids') && variant === 'cinema') {
    variant = index % 2 ? 'tall' : 'feature';
  }
  if ((photo.category === 'wedding' || photo.category === 'family' || photo.category === 'snap') && variant === 'tall') {
    variant = index % 3 === 0 ? 'feature' : 'wide';
  }
  return variant;
}

function resolveImagePosition(photo, variant, index) {
  if (photo.category === 'portrait') return variant === 'wide' ? '50% 36%' : '50% 42%';
  if (photo.category === 'kids') return '50% 38%';
  if (photo.category === 'maternity') return '50% 40%';
  if (photo.category === 'wedding') return index % 2 ? '50% 44%' : '50% 50%';
  if (photo.category === 'family') return '50% 43%';
  return '50% 50%';
}

function ensureGridImageErrorHandler() {
  if (!els.grid || els.grid.dataset.errorHandlerReady) return;
  els.grid.addEventListener('error', (event) => {
    if (event.target?.tagName === 'IMG') handleCardImageError(event.target);
  }, true);
  els.grid.dataset.errorHandlerReady = 'true';
}

function renderHeroVisual() {
  if (!els.heroVisual) return;
  const featured = pickHeroPhotos(state.filtered).slice(0, 3);
  if (!featured.length) {
    els.heroVisual.innerHTML = `<div class="hero-visual-placeholder">${escapeHtml(copy.loading)}</div>`;
    return;
  }
  const [lead, ...supporting] = featured;
  els.heroVisual.innerHTML = `
    <div class="hero-visual-grid">
      <button type="button" class="hero-photo hero-photo-lead" data-index="${lead.filteredIndex}" data-label="${escapeAttr(lead.label)}">
        <img
          src="${escapeAttr(resolveHeroSrc(lead))}"
          ${resolveHeroSrcset(lead)}
          sizes="(max-width: 760px) 100vw, 58vw"
          data-full="${escapeAttr(lead.full)}"
          data-fallback="${escapeAttr(lead.fallback)}"
          alt="${escapeAttr(lead.name)}"
          loading="eager"
          decoding="async"
        >
        <span class="hero-photo-label"><strong>${escapeHtml(lead.label)}</strong><span>${escapeHtml(copy.heroSelected)}</span></span>
      </button>
      <div class="hero-photo-stack">
        ${supporting.map((photo) => `
          <button type="button" class="hero-photo hero-photo-support" data-index="${photo.filteredIndex}" data-label="${escapeAttr(photo.label)}">
            <img
              src="${escapeAttr(resolveHeroSrc(photo))}"
              ${resolveHeroSrcset(photo)}
              sizes="(max-width: 760px) 50vw, 24vw"
              data-full="${escapeAttr(photo.full)}"
              data-fallback="${escapeAttr(photo.fallback)}"
              alt="${escapeAttr(photo.name)}"
              loading="eager"
              decoding="async"
            >
            <span class="hero-photo-label"><strong>${escapeHtml(photo.label)}</strong><span>${escapeHtml(copy.heroOpen)}</span></span>
          </button>
        `).join('')}
      </div>
    </div>
  `;
  els.heroVisual.querySelectorAll('.hero-photo').forEach((button) => {
    button.addEventListener('click', () => openLightbox(Number(button.dataset.index || 0)));
    const img = button.querySelector('img');
    img?.addEventListener('error', () => handleHeroImageError(img));
    button.addEventListener('mouseenter', () => prewarmPhoto(Number(button.dataset.index || 0)));
    button.addEventListener('focus', () => prewarmPhoto(Number(button.dataset.index || 0)));
  });
}

function resolveHeroSrc(photo) {
  return HERO_ASSETS[photo.category] || photo.thumb;
}

function resolveHeroSrcset(photo) {
  return HERO_ASSETS[photo.category] ? '' : `srcset="${escapeAttr(photo.thumbSet)}"`;
}

function handleHeroImageError(img) {
  if (!img) return;
  const fallback = String(img.dataset.fallback || '').trim();
  if (!img.dataset.retryDone && fallback) {
    img.dataset.retryDone = '1';
    img.removeAttribute('srcset');
    img.src = fallback;
    return;
  }
  img.closest('.hero-photo')?.classList.add('is-broken');
  img.alt = '';
}

function pickHeroPhotos(photos = []) {
  const featured = [];
  const preferredCategories = ['portrait', 'wedding', 'kids', 'family', 'maternity', 'snap'];
  preferredCategories.forEach((category) => {
    const match = photos.find((photo) => photo.category === category && !featured.includes(photo));
    if (match) featured.push(match);
  });
  for (const photo of photos) {
    if (featured.includes(photo)) continue;
    featured.push(photo);
    if (featured.length >= 3) break;
  }
  return featured;
}

function renderFeaturedStage() {
  if (!els.featuredStage) return;
  const featured = pickFeaturedPhotos(state.filtered);
  if (!featured.length) {
    els.featuredStage.innerHTML = '';
    els.featuredStage.hidden = true;
    return;
  }
  els.featuredStage.hidden = false;
  const [lead, ...supporting] = featured;
  els.featuredStage.innerHTML = `
    <button type="button" class="stage-card stage-card-lead" data-index="${lead.filteredIndex}">
      <img
        src="${escapeAttr(lead.thumb)}"
        srcset="${escapeAttr(lead.thumbSet)}"
        sizes="(max-width: 900px) 100vw, 64vw"
        data-full="${escapeAttr(lead.full)}"
        data-fallback="${escapeAttr(lead.fallback)}"
        alt="${escapeAttr(lead.name)}"
        loading="eager"
        decoding="async"
      >
      <span class="stage-copy">
        <span class="stage-kicker">${escapeHtml(lead.label)}</span>
      </span>
    </button>
    <div class="stage-stack">
      ${supporting.map((photo) => `
        <button type="button" class="stage-card stage-card-support" data-index="${photo.filteredIndex}">
          <img
            src="${escapeAttr(photo.thumb)}"
            srcset="${escapeAttr(photo.thumbSet)}"
            sizes="(max-width: 900px) 100vw, 28vw"
            data-full="${escapeAttr(photo.full)}"
            data-fallback="${escapeAttr(photo.fallback)}"
            alt="${escapeAttr(photo.name)}"
            loading="eager"
            decoding="async"
          >
          <span class="stage-copy">
            <span class="stage-kicker">${escapeHtml(photo.label)}</span>
          </span>
        </button>
      `).join('')}
    </div>
  `;
  els.featuredStage.querySelectorAll('.stage-card').forEach((button) => {
    button.addEventListener('click', () => openLightbox(Number(button.dataset.index || 0)));
    const img = button.querySelector('img');
    img?.addEventListener('error', () => handleCardImageError(img));
    if (img?.complete && img.naturalWidth === 0) handleCardImageError(img);
    button.addEventListener('mouseenter', () => prewarmPhoto(Number(button.dataset.index || 0)));
    button.addEventListener('focus', () => prewarmPhoto(Number(button.dataset.index || 0)));
  });
}

function pickFeaturedPhotos(photos = []) {
  const featured = [];
  const usedCategories = new Set();
  for (const photo of photos) {
    if (!usedCategories.has(photo.category)) {
      featured.push(photo);
      usedCategories.add(photo.category);
    }
    if (featured.length >= FEATURED_STAGE_LIMIT) return featured;
  }
  for (const photo of photos) {
    if (featured.includes(photo)) continue;
    featured.push(photo);
    if (featured.length >= FEATURED_STAGE_LIMIT) break;
  }
  return featured;
}

function assignFilteredIndexes(photos = []) {
  photos.forEach((photo, filteredIndex) => {
    photo.filteredIndex = filteredIndex;
  });
}

function wireGridEvents() {
  els.grid.querySelectorAll('.portfolio-card').forEach((button) => {
    button.addEventListener('click', () => openLightbox(Number(button.dataset.index || 0)));
    const img = button.querySelector('img');
    img?.addEventListener('error', () => handleCardImageError(img));
    button.addEventListener('mouseenter', () => prewarmPhoto(Number(button.dataset.index || 0)));
    button.addEventListener('focus', () => prewarmPhoto(Number(button.dataset.index || 0)));
  });
}

function scheduleGridImageCleanup() {
  [250, 1200, 3000, 6000].forEach((delay) => {
    window.setTimeout(cleanBrokenGridImages, delay);
  });
}

function cleanBrokenGridImages() {
  els.grid?.querySelectorAll('.portfolio-card:not([hidden]) img').forEach((img) => {
    if (img.complete && img.naturalWidth === 0) handleCardImageError(img);
  });
}

function handleCardImageError(img) {
  if (!img) return;
  const fallback = String(img.dataset.fallback || '').trim();
  if (!img.dataset.retryDone && fallback) {
    img.dataset.retryDone = '1';
    img.removeAttribute('srcset');
    img.src = fallback;
    return;
  }
  const portfolioCard = img.closest('.portfolio-card');
  if (portfolioCard) {
    portfolioCard.hidden = true;
    portfolioCard.setAttribute('aria-hidden', 'true');
    return;
  }
  img.closest('.stage-card')?.classList.add('is-broken');
}

function wireFilters() {
  els.filterButtons.forEach((button) => {
    button.addEventListener('click', () => {
      state.activeFilter = button.dataset.filter || 'all';
      els.filterButtons.forEach((b) => b.classList.toggle('active', b === button));
      renderGrid();
    });
  });
}

function openLightbox(index) {
  const photo = state.filtered[index];
  if (!photo) return;
  state.lightboxIndex = index;
  els.lightbox.classList.add('open');
  els.lightbox.setAttribute('aria-hidden', 'false');
  renderLightbox();
  prewarmNeighbors(index);
}

function closeLightbox() {
  els.lightbox.classList.remove('open');
  els.lightbox.setAttribute('aria-hidden', 'true');
  state.lightboxIndex = -1;
}

function stepLightbox(delta) {
  const next = state.lightboxIndex + delta;
  if (next < 0 || next >= state.filtered.length) return;
  state.lightboxIndex = next;
  renderLightbox();
  prewarmNeighbors(next);
}

function renderLightbox() {
  const photo = state.filtered[state.lightboxIndex];
  if (!photo) return;
  els.lightboxImage.src = photo.full;
  els.lightboxImage.alt = photo.name;
  els.lightboxImage.onerror = () => {
    els.lightboxImage.src = photo.fallback;
  };
  els.lightboxCaption.textContent = photo.label;
}

function prewarmNeighbors(index) {
  [index - 2, index - 1, index + 1, index + 2].forEach((candidate) => prewarmPhoto(candidate));
}

function prewarmPhoto(index) {
  const photo = state.filtered[index];
  if (!photo || state.warmCache.has(photo.id)) return;
  state.warmCache.add(photo.id);
  const img = new Image();
  img.src = photo.full;
}

function wireLightbox() {
  els.lightboxClose?.addEventListener('click', closeLightbox);
  els.lightbox?.addEventListener('click', (event) => {
    if (event.target === els.lightbox) closeLightbox();
  });
  els.lightboxPrev?.addEventListener('click', () => stepLightbox(-1));
  els.lightboxNext?.addEventListener('click', () => stepLightbox(1));
  document.addEventListener('keydown', (event) => {
    if (!els.lightbox.classList.contains('open')) return;
    if (event.key === 'Escape') closeLightbox();
    if (event.key === 'ArrowLeft') stepLightbox(-1);
    if (event.key === 'ArrowRight') stepLightbox(1);
  });
}

async function loadPortfolio() {
  els.status.textContent = copy.loading;
  try {
    const response = await fetch(DATA_URL, { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    state.photos = curatePhotos(normalizePhotos(payload?.photos || []));
    if (!state.photos.length) {
      els.status.textContent = copy.noFolder;
      return;
    }
    if (els.lightboxClose) {
      els.lightboxClose.textContent = copy.lightboxClose;
      els.lightboxClose.setAttribute('aria-label', copy.lightboxClose);
    }
    renderGrid();
  } catch (error) {
    els.status.textContent = copy.unavailable;
    els.grid.innerHTML = '';
    console.error(error);
  }
}

function escapeAttr(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeHtml(value) {
  return escapeAttr(value);
}

function resolveCategoryLabel(category, item = {}) {
  return copy.labels[category] || String(item.categoryLabel || item.folderName || 'Portfolio').trim();
}

wireFilters();
wireLightbox();
loadPortfolio();
