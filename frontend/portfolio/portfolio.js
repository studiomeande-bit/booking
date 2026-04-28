const DATA_URL = './portfolio-data.json';

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
      const categoryLabel = String(item.categoryLabel || item.folderName || 'Portfolio').trim();
      return {
        id,
        name,
        index,
        category,
        label: categoryLabel,
        folderName: String(item.folderName || '').trim(),
        timestamp: Number(item.timestamp || 0),
        thumb: buildThumb(id, 1800),
        thumbSet: `${buildThumb(id, 960)} 960w, ${buildThumb(id, 1440)} 1440w, ${buildThumb(id, 2200)} 2200w`,
        full: buildLightbox(id, 2600),
        fallback: buildThumb(id, 2200)
      };
    });
}

function matchesFilter(photo, filter) {
  return filter === 'all' ? true : photo.category === filter;
}

function renderGrid() {
  state.filtered = state.photos.filter((photo) => matchesFilter(photo, state.activeFilter));
  renderFeaturedStage();
  if (!state.filtered.length) {
    els.grid.innerHTML = '';
    els.status.textContent = 'Keine Bilder gefunden.';
    return;
  }
  els.status.textContent = `${state.filtered.length} Arbeiten · kuratiert aus dem Live-Portfolio`;
  els.grid.innerHTML = state.filtered.map((photo, index) => `
    <button type="button" class="portfolio-card" data-index="${index}" data-label="${escapeAttr(photo.label)}">
      <img
        src="${escapeAttr(photo.thumb)}"
        srcset="${escapeAttr(photo.thumbSet)}"
        sizes="(max-width: 640px) 100vw, (max-width: 980px) 50vw, (max-width: 1440px) 33vw, 25vw"
        data-full="${escapeAttr(photo.full)}"
        data-fallback="${escapeAttr(photo.fallback)}"
        alt="${escapeAttr(photo.name)}"
        loading="${index < 12 ? 'eager' : 'lazy'}"
        decoding="async"
      >
    </button>
  `).join('');
  wireGridEvents();
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
    button.addEventListener('mouseenter', () => prewarmPhoto(Number(button.dataset.index || 0)));
    button.addEventListener('focus', () => prewarmPhoto(Number(button.dataset.index || 0)));
  });
}

function pickFeaturedPhotos(photos = []) {
  const featured = [];
  const usedCategories = new Set();
  photos.forEach((photo, filteredIndex) => {
    photo.filteredIndex = filteredIndex;
  });
  for (const photo of photos) {
    if (!usedCategories.has(photo.category)) {
      featured.push(photo);
      usedCategories.add(photo.category);
    }
    if (featured.length >= 4) return featured;
  }
  for (const photo of photos) {
    if (featured.includes(photo)) continue;
    featured.push(photo);
    if (featured.length >= 4) break;
  }
  return featured;
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

function handleCardImageError(img) {
  if (!img) return;
  const fallback = String(img.dataset.fallback || '').trim();
  if (!img.dataset.retryDone && fallback) {
    img.dataset.retryDone = '1';
    img.removeAttribute('srcset');
    img.src = fallback;
    return;
  }
  img.closest('.portfolio-card')?.classList.add('is-broken');
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
  els.status.textContent = 'Bilder werden geladen…';
  try {
    const response = await fetch(DATA_URL, { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    state.photos = normalizePhotos(payload?.photos || []);
    if (!state.photos.length) {
      els.status.textContent = 'Im verknüpften Ordner wurden keine Bilder gefunden.';
      return;
    }
    renderGrid();
  } catch (error) {
    els.status.textContent = 'Das Portfolio konnte gerade nicht geladen werden.';
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

wireFilters();
wireLightbox();
loadPortfolio();
