// ─── CONFIG ──────────────────────────────────────────────────────────────────
const API_BASE = 'https://retail-d6uo.onrender.com/api';

// ─── STATE ───────────────────────────────────────────────────────────────────
const state = {
  products: [], pagination: null,
  page: 1, search: '', tag: '', sort: 'newest',
  allTags: [], loading: false,
};

// ─── UTILS ───────────────────────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const fmt = (n) => '₹' + Number(n).toLocaleString('en-IN');

let dTimer;
const debounce = (fn, ms = 350) => { clearTimeout(dTimer); dTimer = setTimeout(fn, ms); };

// ─── API ─────────────────────────────────────────────────────────────────────
async function getProducts() {
  const p = new URLSearchParams({ sort: state.sort, page: state.page, limit: 24 });
  if (state.search) p.set('search', state.search);
  if (state.tag) p.set('tag', state.tag);
  const r = await fetch(`${API_BASE}/products?${p}`);
  if (!r.ok) throw new Error(`${r.status}`);
  return r.json();
}

async function getTags() {
  const r = await fetch(`${API_BASE}/products/tags`);
  return r.ok ? r.json() : { data: [] };
}

// ─── LOAD ─────────────────────────────────────────────────────────────────────
async function load() {
  if (state.loading) return;
  state.loading = true;

  $('grid').innerHTML = '';
  $('pagination').innerHTML = '';
  $('loading').style.display = 'flex';
  $('empty').style.display = 'none';
  $('error-state').style.display = 'none';
  $('status-line').textContent = '';

  try {
    const data = await getProducts();
    state.products = data.data || [];
    state.pagination = data.pagination;

    $('loading').style.display = 'none';

    if (!state.products.length) {
      $('empty').style.display = 'block';
    } else {
      renderGrid(state.products);
      renderPagination(state.pagination);
    }

    const total = data.pagination?.total ?? state.products.length;
    $('status-line').textContent = `${total} product${total !== 1 ? 's' : ''}${state.search ? ` for "${state.search}"` : ''}${state.tag ? ` tagged "${state.tag}"` : ''}`;

  } catch (e) {
    $('loading').style.display = 'none';
    $('error-msg').textContent = 'Failed to load products. Check your connection.';
    $('error-state').style.display = 'block';
  } finally {
    state.loading = false;
  }
}

// ─── RENDER ───────────────────────────────────────────────────────────────────
function renderGrid(products) {
  $('grid').innerHTML = products.map((p) => {
    const hasImg = p.image?.url;
    const tags = (p.tags || []).slice(0, 4).map(t => `<span class="card-tag" data-tag="${esc(t)}">${esc(t)}</span>`).join('');
    return `
    <div class="card" data-id="${p._id}">
      <div class="card-img">
        ${hasImg ? `<img src="${esc(p.image.url)}" alt="${esc(p.name)}" loading="lazy" />` : `<div class="card-no-img">No image</div>`}
        ${!p.inStock ? `<div class="card-oos">Out of stock</div>` : ''}
      </div>
      <div class="card-body">
        ${tags ? `<div class="card-tags">${tags}</div>` : ''}
        <div class="card-name">${esc(p.name)}</div>
        <div class="card-price">${fmt(p.price)}</div>
      </div>
    </div>`;
  }).join('');

  $('grid').querySelectorAll('.card').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.classList.contains('card-tag')) {
        setTag(e.target.dataset.tag);
        return;
      }
      const p = state.products.find(x => x._id === card.dataset.id);
      if (p) openModal(p);
    });
  });
}

function renderPagination(pg) {
  if (!pg || pg.totalPages <= 1) return;
  const { page, totalPages } = pg;
  const range = pageRange(page, totalPages);
  let html = `<button class="page-btn" ${page<=1?'disabled':''} onclick="goPage(${page-1})">← Prev</button>`;
  range.forEach(p => {
    html += p === '...'
      ? `<span class="page-btn" style="opacity:.4;pointer-events:none">…</span>`
      : `<button class="page-btn${p===page?' active':''}" onclick="goPage(${p})">${p}</button>`;
  });
  html += `<button class="page-btn" ${page>=totalPages?'disabled':''} onclick="goPage(${page+1})">Next →</button>`;
  $('pagination').innerHTML = html;
}

function pageRange(cur, total) {
  if (total <= 7) return Array.from({length:total},(_,i)=>i+1);
  if (cur <= 4) return [1,2,3,4,5,'...',total];
  if (cur >= total-3) return [1,'...',total-4,total-3,total-2,total-1,total];
  return [1,'...',cur-1,cur,cur+1,'...',total];
}

// ─── MODAL ────────────────────────────────────────────────────────────────────
function openModal(p) {
  const hasImg = p.image?.url;
  $('modal-img').style.display = hasImg ? 'block' : 'none';
  $('modal-no-img').style.display = hasImg ? 'none' : 'flex';
  if (hasImg) { $('modal-img').src = p.image.url; $('modal-img').alt = p.name; }
  $('modal-tags').innerHTML = (p.tags||[]).map(t=>`<span class="modal-tag">${esc(t)}</span>`).join('');
  $('modal-name').textContent = p.name;
  $('modal-desc').textContent = p.description || '';
  $('modal-price').textContent = fmt(p.price);
  $('modal-stock').textContent = p.inStock ? 'In Stock' : 'Out of Stock';
  $('modal-stock').className = `modal-stock ${p.inStock ? 'in-stock' : 'out'}`;
  $('modal').style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  $('modal').style.display = 'none';
  document.body.style.overflow = '';
}

// ─── FILTERS ──────────────────────────────────────────────────────────────────
function setTag(tag) {
  state.tag = tag;
  state.page = 1;
  updateTagUI();
  load();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function updateTagUI() {
  document.querySelectorAll('.tag-pill').forEach(p => p.classList.toggle('active', p.dataset.tag === state.tag));
  if (state.tag) {
    $('active-tag').style.display = 'flex';
    $('active-tag-name').textContent = state.tag;
  } else {
    $('active-tag').style.display = 'none';
  }
}

function goPage(p) {
  state.page = p;
  load();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ─── INIT ─────────────────────────────────────────────────────────────────────
async function init() {
  // Search
  $('search-input').addEventListener('input', () => {
    const v = $('search-input').value;
    $('search-clear').style.display = v ? 'block' : 'none';
    debounce(() => { state.search = v.trim(); state.page = 1; load(); });
  });
  $('search-clear').addEventListener('click', () => {
    $('search-input').value = '';
    $('search-clear').style.display = 'none';
    state.search = ''; state.page = 1; load();
  });

  // Sort
  $('sort-select').addEventListener('change', () => {
    state.sort = $('sort-select').value; state.page = 1; load();
  });

  // Clear tag
  $('clear-tag').addEventListener('click', () => { state.tag = ''; state.page = 1; updateTagUI(); load(); });

  // Clear search (empty state)
  $('clear-search').addEventListener('click', () => {
    $('search-input').value = '';
    $('search-clear').style.display = 'none';
    state.search = ''; state.tag = ''; state.page = 1; updateTagUI(); load();
  });

  // Retry
  $('retry-btn').addEventListener('click', load);

  // Modal
  $('modal-close').addEventListener('click', closeModal);
  $('modal').addEventListener('click', e => { if (e.target === $('modal')) closeModal(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

  // Keyboard shortcut: / to focus search
  document.addEventListener('keydown', e => {
    if (e.key === '/' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
      e.preventDefault(); $('search-input').focus();
    }
  });

  // Load tags for pills
  try {
    const tagData = await getTags();
    state.allTags = tagData.data || [];
    if (state.allTags.length) {
      $('tag-row').innerHTML = state.allTags.slice(0, 12).map(t =>
        `<button class="tag-pill" data-tag="${esc(t)}">${esc(t)}</button>`
      ).join('');
      $('tag-row').querySelectorAll('.tag-pill').forEach(pill => {
        pill.addEventListener('click', () => {
          setTag(state.tag === pill.dataset.tag ? '' : pill.dataset.tag);
        });
      });
    }
  } catch(_) {}

  load();
}

init();
