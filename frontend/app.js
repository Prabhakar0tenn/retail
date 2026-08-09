/* ═══════════════════════════════════════════════════════════════════════════
   SHOPEASE — User Frontend JavaScript
   ═══════════════════════════════════════════════════════════════════════════ */

// ─── CONFIG ──────────────────────────────────────────────────────────────────
// IMPORTANT: Replace with your deployed backend URL before deploying frontend
const API_BASE = 'https://retail-d6uo.onrender.com/api';

// ─── STATE ───────────────────────────────────────────────────────────────────
const state = {
  products: [],
  pagination: null,
  currentPage: 1,
  searchQuery: '',
  activeTag: '',
  sort: 'newest',
  view: 'grid',
  isLoading: false,
  allTags: [],
};

// ─── DOM REFS ─────────────────────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);
const els = {
  heroSearchInput: $('hero-search-input'),
  searchClearBtn: $('search-clear-btn'),
  tagPills: $('tag-pills'),
  sectionTitle: $('section-title'),
  productCount: $('product-count'),
  sortSelect: $('sort-select'),
  viewGridBtn: $('view-grid-btn'),
  viewListBtn: $('view-list-btn'),
  productsGrid: $('products-grid'),
  loadingGrid: $('loading-grid'),
  emptyState: $('empty-state'),
  errorState: $('error-state'),
  errorMessage: $('error-message'),
  pagination: $('pagination'),
  activeFilter: $('active-filter'),
  activeTagLabel: $('active-tag-label'),
  clearTagBtn: $('clear-tag-btn'),
  clearSearchBtn: $('clear-search-btn'),
  retryBtn: $('retry-btn'),
  productModal: $('product-modal'),
  modalClose: $('modal-close-btn'),
  modalImage: $('modal-image'),
  modalImagePlaceholder: $('modal-image-placeholder'),
  modalTags: $('modal-tags'),
  modalProductName: $('modal-product-name'),
  modalDescription: $('modal-description'),
  modalPrice: $('modal-price'),
  modalStock: $('modal-stock'),
};

// ─── UTILS ───────────────────────────────────────────────────────────────────
const formatPrice = (price) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(price);

let debounceTimer;
const debounce = (fn, delay = 350) => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(fn, delay);
};

// ─── API ─────────────────────────────────────────────────────────────────────
async function fetchProducts(opts = {}) {
  const params = new URLSearchParams();
  if (opts.search) params.set('search', opts.search);
  if (opts.tag) params.set('tag', opts.tag);
  if (opts.page) params.set('page', opts.page);
  if (opts.limit) params.set('limit', opts.limit || 20);
  if (opts.sort) params.set('sort', opts.sort);

  const res = await fetch(`${API_BASE}/products?${params}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function fetchTags() {
  const res = await fetch(`${API_BASE}/products/tags`);
  if (!res.ok) return { data: [] };
  return res.json();
}

// ─── LOAD PRODUCTS ────────────────────────────────────────────────────────────
async function loadProducts() {
  if (state.isLoading) return;
  state.isLoading = true;

  showLoading(true);
  hideError();
  hideEmpty();
  els.productsGrid.innerHTML = '';
  els.pagination.innerHTML = '';

  try {
    const data = await fetchProducts({
      search: state.searchQuery,
      tag: state.activeTag,
      page: state.currentPage,
      sort: state.sort,
    });

    state.products = data.data || [];
    state.pagination = data.pagination;

    showLoading(false);

    if (state.products.length === 0) {
      showEmpty();
    } else {
      renderProducts(state.products);
      renderPagination(state.pagination);
    }

    // Update count label
    const total = data.pagination?.total ?? state.products.length;
    els.productCount.textContent = `(${total} ${total === 1 ? 'product' : 'products'})`;

    // Update section title
    if (state.searchQuery) {
      els.sectionTitle.textContent = `Results for "${state.searchQuery}"`;
    } else if (state.activeTag) {
      els.sectionTitle.textContent = `Tag: ${state.activeTag}`;
    } else {
      els.sectionTitle.textContent = 'All Products';
    }
  } catch (err) {
    console.error('loadProducts error:', err);
    showLoading(false);
    showError('Failed to load products. Please check your connection and try again.');
  } finally {
    state.isLoading = false;
  }
}

// ─── LOAD TAGS ────────────────────────────────────────────────────────────────
async function loadTags() {
  try {
    const data = await fetchTags();
    state.allTags = data.data || [];
    renderTagCloud(state.allTags.slice(0, 10));
  } catch (err) {
    console.warn('Could not load tags:', err);
  }
}

// ─── RENDER ───────────────────────────────────────────────────────────────────
function renderProducts(products) {
  els.productsGrid.className = `products-grid${state.view === 'list' ? ' list-view' : ''}`;
  els.productsGrid.innerHTML = products.map((p, i) => createProductCard(p, i)).join('');

  // Attach click listeners
  els.productsGrid.querySelectorAll('.product-card').forEach((card) => {
    card.addEventListener('click', (e) => {
      // If clicking on a tag, filter by it instead
      if (e.target.classList.contains('card-tag')) {
        e.stopPropagation();
        filterByTag(e.target.dataset.tag);
        return;
      }
      const id = card.dataset.id;
      const product = state.products.find((p) => p._id === id);
      if (product) openModal(product);
    });
  });
}

function createProductCard(p, index) {
  const hasImage = p.image && p.image.url;
  const tagHtml = p.tags && p.tags.length > 0
    ? p.tags.slice(0, 3).map((t) => `<span class="card-tag" data-tag="${t}">${t}</span>`).join('')
    : '';

  const delay = `animation-delay:${index * 0.04}s`;

  return `
  <article class="product-card" data-id="${p._id}" style="${delay}" aria-label="${escHtml(p.name)}">
    <div class="card-image-wrap">
      ${hasImage
        ? `<img class="card-image" src="${p.image.url}" alt="${escHtml(p.name)}" loading="lazy" />`
        : `<div class="card-image-placeholder"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg></div>`
      }
      ${p.featured ? '<div class="card-featured-badge">✦ Featured</div>' : ''}
      ${!p.inStock ? '<div class="card-oos-overlay">Out of Stock</div>' : ''}
    </div>
    <div class="card-body">
      ${tagHtml ? `<div class="card-tags">${tagHtml}</div>` : ''}
      <h3 class="card-name">${escHtml(p.name)}</h3>
      <div class="card-price">${formatPrice(p.price)}</div>
    </div>
  </article>`;
}

function renderTagCloud(tags) {
  if (!tags.length) {
    $('tag-cloud').style.display = 'none';
    return;
  }
  els.tagPills.innerHTML = tags
    .map((tag) => `<button class="tag-pill" data-tag="${tag}" id="tag-pill-${encodeURIComponent(tag)}">${tag}</button>`)
    .join('');

  els.tagPills.querySelectorAll('.tag-pill').forEach((pill) => {
    pill.addEventListener('click', () => {
      const tag = pill.dataset.tag;
      if (state.activeTag === tag) {
        filterByTag('');
      } else {
        filterByTag(tag);
      }
    });
  });
}

function renderPagination(pagination) {
  if (!pagination || pagination.totalPages <= 1) {
    els.pagination.innerHTML = '';
    return;
  }

  const { page, totalPages } = pagination;
  const buttons = [];

  // Prev
  buttons.push(`<button class="page-btn" id="page-prev" ${page <= 1 ? 'disabled' : ''} aria-label="Previous page">← Prev</button>`);

  // Pages
  const range = getPageRange(page, totalPages);
  range.forEach((p) => {
    if (p === '...') {
      buttons.push(`<span class="page-btn" style="pointer-events:none;opacity:0.5">…</span>`);
    } else {
      buttons.push(`<button class="page-btn${p === page ? ' active' : ''}" data-page="${p}" id="page-${p}" aria-label="Page ${p}" aria-current="${p === page ? 'page' : 'false'}">${p}</button>`);
    }
  });

  // Next
  buttons.push(`<button class="page-btn" id="page-next" ${page >= totalPages ? 'disabled' : ''} aria-label="Next page">Next →</button>`);

  els.pagination.innerHTML = buttons.join('');

  // Listeners
  $('page-prev')?.addEventListener('click', () => goToPage(page - 1));
  $('page-next')?.addEventListener('click', () => goToPage(page + 1));
  els.pagination.querySelectorAll('[data-page]').forEach((btn) => {
    btn.addEventListener('click', () => goToPage(parseInt(btn.dataset.page)));
  });
}

function getPageRange(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  if (current <= 4) return [1, 2, 3, 4, 5, '...', total];
  if (current >= total - 3) return [1, '...', total - 4, total - 3, total - 2, total - 1, total];
  return [1, '...', current - 1, current, current + 1, '...', total];
}

// ─── MODAL ────────────────────────────────────────────────────────────────────
function openModal(product) {
  const hasImage = product.image && product.image.url;

  if (hasImage) {
    els.modalImage.src = product.image.url;
    els.modalImage.alt = product.name;
    els.modalImage.style.display = 'block';
    els.modalImagePlaceholder.style.display = 'none';
  } else {
    els.modalImage.style.display = 'none';
    els.modalImagePlaceholder.style.display = 'flex';
  }

  els.modalTags.innerHTML = (product.tags || [])
    .map((t) => `<span class="modal-tag">${t}</span>`)
    .join('');

  els.modalProductName.textContent = product.name;
  els.modalDescription.textContent = product.description || 'No description available.';
  els.modalPrice.textContent = formatPrice(product.price);

  els.modalStock.textContent = product.inStock ? 'In Stock' : 'Out of Stock';
  els.modalStock.className = `modal-stock ${product.inStock ? 'in-stock' : 'out-of-stock'}`;

  els.productModal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  els.productModal.style.display = 'none';
  document.body.style.overflow = '';
}

// ─── FILTER ACTIONS ───────────────────────────────────────────────────────────
function filterByTag(tag) {
  state.activeTag = tag;
  state.currentPage = 1;

  // Update active filter banner
  if (tag) {
    els.activeFilter.style.display = 'flex';
    els.activeTagLabel.textContent = tag;
    // Scroll to products
    $('products').scrollIntoView({ behavior: 'smooth' });
  } else {
    els.activeFilter.style.display = 'none';
  }

  // Update tag pill visual
  els.tagPills.querySelectorAll('.tag-pill').forEach((pill) => {
    pill.classList.toggle('active', pill.dataset.tag === tag);
  });

  loadProducts();
}

function goToPage(page) {
  state.currentPage = page;
  loadProducts();
  $('products').scrollIntoView({ behavior: 'smooth' });
}

// ─── UI HELPERS ───────────────────────────────────────────────────────────────
function showLoading(show) {
  els.loadingGrid.style.display = show ? 'grid' : 'none';
}
function showEmpty() { els.emptyState.style.display = 'block'; }
function hideEmpty() { els.emptyState.style.display = 'none'; }
function showError(msg) {
  els.errorMessage.textContent = msg;
  els.errorState.style.display = 'block';
}
function hideError() { els.errorState.style.display = 'none'; }

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ─── HEADER SCROLL ────────────────────────────────────────────────────────────
window.addEventListener('scroll', () => {
  const header = $('header');
  if (window.scrollY > 40) {
    header?.classList.add('scrolled');
  } else {
    header?.classList.remove('scrolled');
  }
}, { passive: true });

// ─── EVENTS ───────────────────────────────────────────────────────────────────
function initEvents() {
  // Search input
  els.heroSearchInput.addEventListener('input', () => {
    const val = els.heroSearchInput.value;
    els.searchClearBtn.style.display = val ? 'flex' : 'none';
    debounce(() => {
      state.searchQuery = val.trim();
      state.currentPage = 1;
      loadProducts();
    });
  });

  // Search clear
  els.searchClearBtn.addEventListener('click', () => {
    els.heroSearchInput.value = '';
    els.searchClearBtn.style.display = 'none';
    state.searchQuery = '';
    state.currentPage = 1;
    loadProducts();
  });

  // Sort
  els.sortSelect.addEventListener('change', () => {
    state.sort = els.sortSelect.value;
    state.currentPage = 1;
    loadProducts();
  });

  // View toggle
  els.viewGridBtn.addEventListener('click', () => {
    state.view = 'grid';
    els.viewGridBtn.classList.add('active');
    els.viewListBtn.classList.remove('active');
    if (state.products.length) renderProducts(state.products);
  });
  els.viewListBtn.addEventListener('click', () => {
    state.view = 'list';
    els.viewListBtn.classList.add('active');
    els.viewGridBtn.classList.remove('active');
    if (state.products.length) renderProducts(state.products);
  });

  // Clear tag filter
  els.clearTagBtn.addEventListener('click', () => filterByTag(''));

  // Clear search (from empty state)
  els.clearSearchBtn.addEventListener('click', () => {
    els.heroSearchInput.value = '';
    els.searchClearBtn.style.display = 'none';
    state.searchQuery = '';
    state.activeTag = '';
    state.currentPage = 1;
    filterByTag('');
    loadProducts();
  });

  // Retry
  els.retryBtn.addEventListener('click', loadProducts);

  // Modal close
  els.modalClose.addEventListener('click', closeModal);
  els.productModal.addEventListener('click', (e) => {
    if (e.target === els.productModal) closeModal();
  });

  // Keyboard
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
    if (e.key === '/' && document.activeElement.tagName !== 'INPUT') {
      e.preventDefault();
      els.heroSearchInput.focus();
    }
  });
}

// ─── INIT ─────────────────────────────────────────────────────────────────────
async function init() {
  initEvents();
  await Promise.all([loadProducts(), loadTags()]);
}

init();
