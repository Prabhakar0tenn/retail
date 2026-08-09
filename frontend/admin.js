// ─── CONFIG ──────────────────────────────────────────────────────────────────
const API_BASE = 'https://retail-d6uo.onrender.com/api';

// ─── STATE ───────────────────────────────────────────────────────────────────
const state = {
  section: 'dashboard',
  editId: null,
  tags: [],
  existingTags: [],
  allProducts: [],
  page: 1,
  sort: 'newest',
  deleteId: null,
};

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const fmt = (n) => '₹' + Number(n).toLocaleString('en-IN');

let dTimer;
const debounce = (fn, ms=300) => { clearTimeout(dTimer); dTimer = setTimeout(fn, ms); };

// ─── TOAST ───────────────────────────────────────────────────────────────────
function toast(msg, type = 'success') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  $('toasts').appendChild(el);
  setTimeout(() => {
    el.classList.add('removing');
    el.addEventListener('animationend', () => el.remove(), { once: true });
  }, 3000);
}

// ─── API ─────────────────────────────────────────────────────────────────────
async function api(path, opts = {}) {
  const r = await fetch(`${API_BASE}${path}`, opts);
  const j = await r.json();
  if (!r.ok) throw new Error(j.message || `HTTP ${r.status}`);
  return j;
}

// ─── NAVIGATE ─────────────────────────────────────────────────────────────────
function nav(section) {
  state.section = section;
  document.querySelectorAll('.nav-btn[data-section]').forEach(b => b.classList.toggle('active', b.dataset.section === section));
  document.querySelectorAll('.admin-section').forEach(s => s.classList.toggle('active', s.id === `section-${section}`));
  const titles = { dashboard: 'Dashboard', products: 'Products', add: state.editId ? 'Edit Product' : 'Add Product' };
  $('topbar-title').textContent = titles[section] || section;
  closeSidebar();
  if (section === 'dashboard') loadDashboard();
  if (section === 'products') loadProducts();
  if (section === 'add' && !state.editId) resetForm();
}

// ─── SIDEBAR ─────────────────────────────────────────────────────────────────
function openSidebar() { $('sidebar').classList.add('open'); }
function closeSidebar() { $('sidebar').classList.remove('open'); }

// ─── CLOCK ───────────────────────────────────────────────────────────────────
function tick() {
  $('topbar-time').textContent = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

// ─── DASHBOARD ───────────────────────────────────────────────────────────────
async function loadDashboard() {
  try {
    const { data: s } = await api('/admin/stats');
    $('s-total').textContent = s.totalProducts;
    $('s-stock').textContent = s.inStock;
    $('s-oos').textContent = s.outOfStock;
    $('s-featured').textContent = s.featured;
    $('s-tags').textContent = s.totalTags;
    $('s-price').textContent = fmt(s.priceStats?.avg || 0);

    const { data: prods } = await api('/admin/products?sort=newest&limit=5');
    $('recent-loading').style.display = 'none';
    $('recent-body').innerHTML = prods.length ? prods.map(rowHtml).join('') : `<tr><td colspan="5" class="table-empty">No products yet</td></tr>`;
  } catch(e) {
    toast('Failed to load dashboard', 'error');
  }
}

function rowHtml(p) {
  return `<tr>
    <td>
      <div style="display:flex;align-items:center;gap:10px">
        ${p.image?.url ? `<img src="${esc(p.image.url)}" class="t-img" alt="" />` : `<div class="t-img-ph">?</div>`}
        <span class="t-name" title="${esc(p.name)}">${esc(p.name)}</span>
      </div>
    </td>
    <td class="t-price">${fmt(p.price)}</td>
    <td><div class="t-tags">${(p.tags||[]).slice(0,3).map(t=>`<span class="t-tag">${esc(t)}</span>`).join('')}</div></td>
    <td><span class="badge ${p.inStock?'badge-green':'badge-red'}">${p.inStock?'In Stock':'Out of Stock'}</span></td>
    <td>
      <div class="t-actions">
        <button class="icon-btn edit" title="Edit" onclick="startEdit('${p._id}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
        <button class="icon-btn delete" title="Delete" onclick="confirmDel('${p._id}','${esc(p.name).replace(/'/g,"\\'")}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg></button>
      </div>
    </td>
  </tr>`;
}

// ─── ALL PRODUCTS ────────────────────────────────────────────────────────────
async function loadProducts() {
  $('all-loading').style.display = 'flex';
  $('all-body').innerHTML = '';
  $('all-empty').style.display = 'none';
  $('admin-pages').innerHTML = '';
  try {
    const { data, pagination } = await api(`/admin/products?sort=${state.sort}&page=${state.page}&limit=15`);
    state.allProducts = data || [];
    $('all-loading').style.display = 'none';
    if (!state.allProducts.length) { $('all-empty').style.display = 'block'; return; }
    renderAllProducts(state.allProducts);
    renderAdminPages(pagination);
  } catch(e) {
    $('all-loading').style.display = 'none';
    toast('Failed to load products', 'error');
  }
}

function renderAllProducts(list) {
  $('all-body').innerHTML = list.map(p => `
    <tr>
      <td>${p.image?.url ? `<img src="${esc(p.image.url)}" class="t-img" alt="" />` : `<div class="t-img-ph">?</div>`}</td>
      <td><span class="t-name" title="${esc(p.name)}">${esc(p.name)}</span></td>
      <td class="t-price">${fmt(p.price)}</td>
      <td><div class="t-tags">${(p.tags||[]).slice(0,4).map(t=>`<span class="t-tag">${esc(t)}</span>`).join('')}${p.tags?.length>4?`<span class="t-tag">+${p.tags.length-4}</span>`:''}</div></td>
      <td>
        <button class="icon-btn ${p.inStock?'on-green':''}" title="${p.inStock?'In Stock':'Out of Stock'}" onclick="toggleStock('${p._id}')">
          ${p.inStock ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>` : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`}
        </button>
      </td>
      <td>
        <button class="icon-btn ${p.featured?'on-yellow':''}" title="${p.featured?'Featured':'Not featured'}" onclick="toggleFeatured('${p._id}')">
          <svg viewBox="0 0 24 24" fill="${p.featured?'currentColor':'none'}" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
        </button>
      </td>
      <td>
        <div class="t-actions">
          <button class="icon-btn edit" onclick="startEdit('${p._id}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
          <button class="icon-btn delete" onclick="confirmDel('${p._id}','${esc(p.name).replace(/'/g,"\\'")}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg></button>
        </div>
      </td>
    </tr>`).join('');
}

function renderAdminPages(pg) {
  if (!pg || pg.totalPages <= 1) return;
  const { page, totalPages } = pg;
  const range = pageRange(page, totalPages);
  let html = `<button class="page-btn" ${page<=1?'disabled':''} onclick="adminPage(${page-1})">← Prev</button>`;
  range.forEach(p => {
    html += p === '...' ? `<span class="page-btn" style="opacity:.4;pointer-events:none">…</span>`
      : `<button class="page-btn${p===page?' active':''}" onclick="adminPage(${p})">${p}</button>`;
  });
  html += `<button class="page-btn" ${page>=totalPages?'disabled':''} onclick="adminPage(${page+1})">Next →</button>`;
  $('admin-pages').innerHTML = html;
}

function pageRange(cur, total) {
  if (total <= 7) return Array.from({length:total},(_,i)=>i+1);
  if (cur <= 4) return [1,2,3,4,5,'...',total];
  if (cur >= total-3) return [1,'...',total-4,total-3,total-2,total-1,total];
  return [1,'...',cur-1,cur,cur+1,'...',total];
}

function adminPage(p) { state.page = p; loadProducts(); }

// ─── TOGGLES ──────────────────────────────────────────────────────────────────
async function toggleStock(id) {
  try {
    const { data } = await api(`/admin/products/${id}/toggle-stock`, { method: 'PATCH' });
    toast(`Stock: ${data.inStock ? 'In Stock' : 'Out of Stock'}`);
    if (state.section === 'products') loadProducts();
    if (state.section === 'dashboard') loadDashboard();
  } catch(e) { toast('Failed', 'error'); }
}
async function toggleFeatured(id) {
  try {
    const { data } = await api(`/admin/products/${id}/toggle-featured`, { method: 'PATCH' });
    toast(`Featured: ${data.featured ? 'Yes' : 'No'}`);
    if (state.section === 'products') loadProducts();
    if (state.section === 'dashboard') loadDashboard();
  } catch(e) { toast('Failed', 'error'); }
}

// ─── TAGS INPUT ───────────────────────────────────────────────────────────────
function initTagsInput() {
  const wrap = $('tags-wrap');
  const inp = $('tag-input');
  const disp = $('tags-display');
  const sug = $('tag-suggestions');

  function render() {
    disp.innerHTML = state.tags.map(t =>
      `<span class="tag-chip" data-tag="${esc(t)}">${esc(t)}</span>`
    ).join('');
    disp.querySelectorAll('.tag-chip').forEach(c => {
      c.addEventListener('click', () => { state.tags = state.tags.filter(t => t !== c.dataset.tag); render(); });
    });
  }

  function add(raw) {
    const t = raw.toLowerCase().trim().replace(/,/g,'');
    if (!t || state.tags.includes(t)) return;
    state.tags.push(t);
    render();
    inp.value = '';
    hideSug();
  }

  function showSug(q) {
    if (!q) { hideSug(); return; }
    const matches = state.existingTags.filter(t => t.includes(q.toLowerCase()) && !state.tags.includes(t)).slice(0, 6);
    if (!matches.length) { hideSug(); return; }
    sug.innerHTML = matches.map(t => `<div class="tag-sug-item" data-t="${esc(t)}">${esc(t)}</div>`).join('');
    sug.style.display = 'block';
    sug.querySelectorAll('.tag-sug-item').forEach(el => {
      el.addEventListener('mousedown', e => { e.preventDefault(); add(el.dataset.t); });
    });
  }
  function hideSug() { sug.style.display = 'none'; }

  inp.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(inp.value); }
    else if (e.key === 'Backspace' && !inp.value && state.tags.length) { state.tags.pop(); render(); }
  });
  inp.addEventListener('input', () => showSug(inp.value.trim()));
  inp.addEventListener('blur', () => { if (inp.value.trim()) add(inp.value); setTimeout(hideSug, 150); });
  wrap.addEventListener('click', () => inp.focus());
}

// ─── FORM ─────────────────────────────────────────────────────────────────────
function resetForm() {
  state.tags = []; state.editId = null;
  $('product-form').reset();
  $('edit-id').value = '';
  $('tags-display').innerHTML = '';
  $('tag-input').value = '';
  $('img-preview-wrap').style.display = 'none';
  $('img-placeholder').style.display = 'block';
  $('current-img-wrap').style.display = 'none';
  $('cancel-edit').style.display = 'none';
  $('form-title').textContent = 'Add New Product';
  $('form-sub').textContent = 'Fill in the details below';
  $('submit-text').textContent = 'Add Product';
  $('form-feedback').style.display = 'none';
  $('desc-count').textContent = '0';
  ['f-name','f-price'].forEach(id => $(`${id}`)?.classList.remove('error'));
  ['e-name','e-price'].forEach(id => { if ($(id)) $(id).textContent = ''; });
}

async function startEdit(id) {
  try {
    const { data: p } = await api(`/products/${id}`);
    state.editId = id; state.tags = [...(p.tags || [])];
    $('edit-id').value = id;
    $('f-name').value = p.name;
    $('f-price').value = p.price;
    $('f-desc').value = p.description || '';
    $('desc-count').textContent = (p.description||'').length;
    $('f-instock').checked = p.inStock;
    $('f-featured').checked = p.featured;
    $('tags-display').innerHTML = state.tags.map(t =>`<span class="tag-chip" data-tag="${esc(t)}">${esc(t)}</span>`).join('');
    $('tags-display').querySelectorAll('.tag-chip').forEach(c => {
      c.addEventListener('click', () => { state.tags = state.tags.filter(t => t !== c.dataset.tag); c.remove(); });
    });
    if (p.image?.url) { $('current-img').src = p.image.url; $('current-img-wrap').style.display = 'block'; }
    $('img-preview-wrap').style.display = 'none';
    $('img-placeholder').style.display = 'block';
    $('img-input').value = '';
    $('form-title').textContent = 'Edit Product';
    $('form-sub').textContent = p.name;
    $('submit-text').textContent = 'Save Changes';
    $('cancel-edit').style.display = 'inline-flex';
    $('form-feedback').style.display = 'none';
    nav('add');
  } catch(e) { toast('Failed to load product', 'error'); }
}

function validate() {
  let ok = true;
  const name = $('f-name').value.trim();
  const price = $('f-price').value;
  if (!name) { $('e-name').textContent = 'Required'; $('f-name').classList.add('error'); ok = false; }
  else { $('e-name').textContent = ''; $('f-name').classList.remove('error'); }
  if (!price || isNaN(+price) || +price < 0) { $('e-price').textContent = 'Enter valid price'; $('f-price').classList.add('error'); ok = false; }
  else { $('e-price').textContent = ''; $('f-price').classList.remove('error'); }
  return ok;
}

async function submitForm(e) {
  e.preventDefault();
  if (!validate()) return;

  const btn = $('submit-btn');
  const spinner = $('form-spinner');
  btn.disabled = true;
  spinner.style.display = 'inline-block';
  $('form-feedback').style.display = 'none';

  try {
    const fd = new FormData();
    fd.append('name', $('f-name').value.trim());
    fd.append('price', $('f-price').value);
    fd.append('tags', JSON.stringify(state.tags));
    fd.append('description', $('f-desc').value.trim());
    fd.append('inStock', $('f-instock').checked);
    fd.append('featured', $('f-featured').checked);
    const img = $('img-input').files[0];
    if (img) fd.append('image', img);

    const isEdit = !!state.editId;
    await api(isEdit ? `/admin/products/${state.editId}` : '/admin/products', { method: isEdit ? 'PUT' : 'POST', body: fd });

    const fb = $('form-feedback');
    fb.className = 'form-feedback success';
    fb.textContent = `✓ Product ${isEdit ? 'updated' : 'added'} successfully`;
    fb.style.display = 'block';
    toast(`Product ${isEdit ? 'updated' : 'added'}!`);
    if (!isEdit) resetForm();
  } catch(e) {
    const fb = $('form-feedback');
    fb.className = 'form-feedback error';
    fb.textContent = `✗ ${e.message}`;
    fb.style.display = 'block';
    toast(e.message, 'error');
  } finally {
    btn.disabled = false;
    spinner.style.display = 'none';
  }
}

// ─── IMAGE UPLOAD ─────────────────────────────────────────────────────────────
function initImgUpload() {
  const inp = $('img-input');
  const area = $('img-upload');
  const ph = $('img-placeholder');
  const pw = $('img-preview-wrap');
  const prev = $('img-preview');

  function show(file) {
    if (!file.type.startsWith('image/')) { toast('Select an image file', 'error'); return; }
    if (file.size > 5*1024*1024) { toast('Max 5MB', 'error'); return; }
    const r = new FileReader();
    r.onload = e => { prev.src = e.target.result; pw.style.display = 'block'; ph.style.display = 'none'; };
    r.readAsDataURL(file);
  }

  inp.addEventListener('change', () => { if (inp.files[0]) show(inp.files[0]); });
  area.addEventListener('dragover', e => { e.preventDefault(); area.style.borderColor = '#888'; });
  area.addEventListener('dragleave', () => { area.style.borderColor = ''; });
  area.addEventListener('drop', e => {
    e.preventDefault(); area.style.borderColor = '';
    const f = e.dataTransfer.files[0];
    if (f) { inp.files = e.dataTransfer.files; show(f); }
  });
  $('img-remove').addEventListener('click', e => {
    e.preventDefault(); e.stopPropagation();
    inp.value = ''; prev.src = ''; pw.style.display = 'none'; ph.style.display = 'block';
  });
}

// ─── DELETE ───────────────────────────────────────────────────────────────────
function confirmDel(id, name) {
  state.deleteId = id;
  $('del-name').textContent = `Delete "${name}"? This cannot be undone.`;
  $('delete-modal').style.display = 'flex';
}

async function execDelete() {
  if (!state.deleteId) return;
  const btn = $('confirm-del');
  const sp = $('del-spinner');
  btn.disabled = true; sp.style.display = 'inline-block';
  try {
    await api(`/admin/products/${state.deleteId}`, { method: 'DELETE' });
    closeDel();
    toast('Product deleted');
    if (state.section === 'products') loadProducts();
    if (state.section === 'dashboard') loadDashboard();
  } catch(e) {
    toast(`Delete failed: ${e.message}`, 'error');
  } finally {
    btn.disabled = false; sp.style.display = 'none'; state.deleteId = null;
  }
}

function closeDel() { $('delete-modal').style.display = 'none'; state.deleteId = null; }

// ─── INIT ─────────────────────────────────────────────────────────────────────
function init() {
  // Nav
  document.querySelectorAll('.nav-btn[data-section]').forEach(b => b.addEventListener('click', () => nav(b.dataset.section)));
  $('dash-all-btn').addEventListener('click', () => nav('products'));
  $('products-add-btn').addEventListener('click', () => { state.editId = null; resetForm(); nav('add'); });
  $('empty-add-btn')?.addEventListener('click', () => { state.editId = null; resetForm(); nav('add'); });
  $('cancel-edit').addEventListener('click', () => { state.editId = null; resetForm(); });

  // Sidebar
  $('topbar-menu').addEventListener('click', openSidebar);
  $('sidebar-close').addEventListener('click', closeSidebar);

  // Sort
  $('admin-sort').addEventListener('change', () => { state.sort = $('admin-sort').value; state.page = 1; loadProducts(); });

  // Search (client-side filter on loaded products)
  $('admin-search-input').addEventListener('input', () => {
    const q = $('admin-search-input').value.toLowerCase().trim();
    debounce(() => {
      if (!q) { renderAllProducts(state.allProducts); return; }
      renderAllProducts(state.allProducts.filter(p =>
        p.name.toLowerCase().includes(q) || (p.tags||[]).some(t => t.includes(q)) || String(p.price).includes(q)
      ));
    });
  });

  // Form
  $('product-form').addEventListener('submit', submitForm);
  $('f-desc').addEventListener('input', () => $('desc-count').textContent = $('f-desc').value.length);

  // Delete modal
  $('cancel-del').addEventListener('click', closeDel);
  $('confirm-del').addEventListener('click', execDelete);
  $('delete-modal').addEventListener('click', e => { if (e.target === $('delete-modal')) closeDel(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeDel(); });

  // Image + Tags
  initImgUpload();
  initTagsInput();

  // Load existing tags for autocomplete
  fetch(`${API_BASE}/products/tags`).then(r=>r.json()).then(d => { state.existingTags = d.data || []; }).catch(()=>{});

  // Clock
  tick(); setInterval(tick, 60000);

  // Load dashboard
  loadDashboard();
}

init();
