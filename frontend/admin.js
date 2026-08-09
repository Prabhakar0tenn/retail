/* ═══════════════════════════════════════════════════════════════════════════
   SHOPEASE — Admin Panel JavaScript
   ═══════════════════════════════════════════════════════════════════════════ */

// ─── CONFIG ──────────────────────────────────────────────────────────────────
// IMPORTANT: Replace with your deployed backend URL before deploying frontend
const API_BASE = 'https://retail-d6uo.onrender.com/api';

// ─── STATE ───────────────────────────────────────────────────────────────────
const state = {
  currentSection: 'dashboard',
  editProductId: null,
  tags: [],
  existingTags: [],
  allProducts: [],
  currentPage: 1,
  sort: 'newest',
  searchQuery: '',
  deleteTargetId: null,
  isSidebarOpen: false,
};

// ─── DOM ─────────────────────────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);

// ─── UTILS ───────────────────────────────────────────────────────────────────
const formatPrice = (price) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(price);

const escHtml = (str) =>
  String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

let debounceTimer;
const debounce = (fn, delay = 300) => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(fn, delay);
};

// ─── TOAST ───────────────────────────────────────────────────────────────────
function showToast(message, type = 'success') {
  const container = $('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span class="toast-dot"></span>${escHtml(message)}`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('removing');
    toast.addEventListener('animationend', () => toast.remove(), { once: true });
  }, 3500);
}

// ─── API ─────────────────────────────────────────────────────────────────────
async function apiFetch(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, options);
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || `HTTP ${res.status}`);
  return json;
}

// ─── NAVIGATION ──────────────────────────────────────────────────────────────
function navigateTo(section) {
  state.currentSection = section;

  // Update sidebar links
  document.querySelectorAll('.sidebar-link[data-section]').forEach((link) => {
    link.classList.toggle('active', link.dataset.section === section);
  });

  // Show/hide sections
  document.querySelectorAll('.admin-section').forEach((sec) => {
    sec.classList.toggle('active', sec.id === `section-${section}`);
  });

  // Update topbar title
  const titles = { dashboard: 'Dashboard', products: 'Products', add: 'Add Product' };
  $('topbar-title').textContent = titles[section] || section;

  // Close sidebar on mobile
  closeSidebar();

  // Load data for section
  if (section === 'dashboard') loadDashboard();
  if (section === 'products') loadAllProducts();
  if (section === 'add' && !state.editProductId) resetForm();
}

// ─── SIDEBAR ─────────────────────────────────────────────────────────────────
function openSidebar() {
  $('admin-sidebar').classList.add('open');
  state.isSidebarOpen = true;
}
function closeSidebar() {
  $('admin-sidebar').classList.remove('open');
  state.isSidebarOpen = false;
}

// ─── CLOCK ───────────────────────────────────────────────────────────────────
function updateClock() {
  const el = $('topbar-time');
  if (el) {
    el.textContent = new Date().toLocaleTimeString('en-IN', {
      hour: '2-digit', minute: '2-digit', hour12: true,
    });
  }
}

// ─── DASHBOARD ───────────────────────────────────────────────────────────────
async function loadDashboard() {
  try {
    // Load stats
    const statsData = await apiFetch('/admin/stats');
    const s = statsData.data;

    $('stat-total-val').textContent = s.totalProducts;
    $('stat-stock-val').textContent = s.inStock;
    $('stat-oos-val').textContent = s.outOfStock;
    $('stat-featured-val').textContent = s.featured;
    $('stat-tags-val').textContent = s.totalTags;
    $('stat-price-val').textContent = formatPrice(s.priceStats?.avg || 0);

    // Load recent products
    const prodData = await apiFetch('/admin/products?sort=newest&limit=5');
    renderRecentProducts(prodData.data || []);
  } catch (err) {
    console.error('Dashboard load error:', err);
    showToast('Failed to load dashboard data', 'error');
  }
}

function renderRecentProducts(products) {
  $('recent-loading').style.display = 'none';
  const tbody = $('recent-products-body');

  if (!products.length) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:24px;color:var(--text-3)">No products yet</td></tr>`;
    return;
  }

  tbody.innerHTML = products.map((p) => `
    <tr>
      <td>
        <div style="display:flex;align-items:center;gap:10px">
          ${p.image?.url
            ? `<img src="${escHtml(p.image.url)}" class="table-product-image" alt="${escHtml(p.name)}" loading="lazy" />`
            : `<div class="table-product-image-placeholder"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg></div>`
          }
          <span class="table-product-name" title="${escHtml(p.name)}">${escHtml(p.name)}</span>
        </div>
      </td>
      <td class="table-price">${formatPrice(p.price)}</td>
      <td>
        <div class="table-tags">
          ${(p.tags || []).slice(0, 3).map((t) => `<span class="table-tag">${escHtml(t)}</span>`).join('')}
        </div>
      </td>
      <td>
        <span class="badge ${p.inStock ? 'badge-green' : 'badge-red'}">
          ${p.inStock ? '● In Stock' : '● Out of Stock'}
        </span>
      </td>
      <td>
        <div class="table-actions">
          <button class="icon-btn edit" title="Edit" onclick="startEdit('${p._id}')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="icon-btn delete" title="Delete" onclick="confirmDelete('${p._id}', '${escHtml(p.name).replace(/'/g, "\\'")}')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

// ─── ALL PRODUCTS ────────────────────────────────────────────────────────────
async function loadAllProducts() {
  $('all-loading').style.display = 'flex';
  $('all-products-body').innerHTML = '';
  $('all-empty').style.display = 'none';
  $('admin-pagination').innerHTML = '';

  try {
    const params = new URLSearchParams({
      sort: state.sort,
      page: state.currentPage,
      limit: 15,
    });

    const data = await apiFetch(`/admin/products?${params}`);
    state.allProducts = data.data || [];

    $('all-loading').style.display = 'none';

    if (!state.allProducts.length) {
      $('all-empty').style.display = 'block';
    } else {
      renderAllProducts(state.allProducts);
      renderAdminPagination(data.pagination);
    }
  } catch (err) {
    $('all-loading').style.display = 'none';
    showToast('Failed to load products', 'error');
  }
}

function renderAllProducts(products) {
  const tbody = $('all-products-body');
  tbody.innerHTML = products.map((p) => `
    <tr id="product-row-${p._id}">
      <td>
        ${p.image?.url
          ? `<img src="${escHtml(p.image.url)}" class="table-product-image" alt="${escHtml(p.name)}" loading="lazy" />`
          : `<div class="table-product-image-placeholder"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg></div>`
        }
      </td>
      <td>
        <span class="table-product-name" title="${escHtml(p.name)}">${escHtml(p.name)}</span>
      </td>
      <td class="table-price">${formatPrice(p.price)}</td>
      <td>
        <div class="table-tags">
          ${(p.tags || []).slice(0, 4).map((t) => `<span class="table-tag">${escHtml(t)}</span>`).join('')}
          ${p.tags?.length > 4 ? `<span class="table-tag">+${p.tags.length - 4}</span>` : ''}
        </div>
      </td>
      <td>
        <button class="icon-btn ${p.inStock ? 'stock-on' : ''}" title="Toggle stock" onclick="toggleStock('${p._id}')">
          ${p.inStock
            ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`
            : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`
          }
        </button>
      </td>
      <td>
        <button class="icon-btn ${p.featured ? 'featured-on' : ''}" title="Toggle featured" onclick="toggleFeatured('${p._id}')">
          <svg viewBox="0 0 24 24" fill="${p.featured ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
        </button>
      </td>
      <td>
        <div class="table-actions">
          <button class="icon-btn edit" title="Edit product" onclick="startEdit('${p._id}')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="icon-btn delete" title="Delete product" onclick="confirmDelete('${p._id}', '${escHtml(p.name).replace(/'/g, "\\'")}')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

function renderAdminPagination(pagination) {
  if (!pagination || pagination.totalPages <= 1) return;
  const { page, totalPages } = pagination;
  const container = $('admin-pagination');

  const range = getPageRange(page, totalPages);
  const buttons = [];

  buttons.push(`<button class="page-btn" ${page <= 1 ? 'disabled' : ''} onclick="adminGoToPage(${page - 1})">← Prev</button>`);
  range.forEach((p) => {
    if (p === '...') {
      buttons.push(`<span class="page-btn" style="opacity:0.5;pointer-events:none">…</span>`);
    } else {
      buttons.push(`<button class="page-btn${p === page ? ' active' : ''}" onclick="adminGoToPage(${p})">${p}</button>`);
    }
  });
  buttons.push(`<button class="page-btn" ${page >= totalPages ? 'disabled' : ''} onclick="adminGoToPage(${page + 1})">Next →</button>`);

  container.innerHTML = buttons.join('');
}

function getPageRange(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  if (current <= 4) return [1, 2, 3, 4, 5, '...', total];
  if (current >= total - 3) return [1, '...', total - 4, total - 3, total - 2, total - 1, total];
  return [1, '...', current - 1, current, current + 1, '...', total];
}

function adminGoToPage(page) {
  state.currentPage = page;
  loadAllProducts();
}

// ─── TOGGLE STOCK / FEATURED ──────────────────────────────────────────────────
async function toggleStock(id) {
  try {
    const data = await apiFetch(`/admin/products/${id}/toggle-stock`, { method: 'PATCH' });
    showToast(`Stock updated: ${data.data.inStock ? 'In Stock' : 'Out of Stock'}`);
    loadAllProducts();
    if (state.currentSection === 'dashboard') loadDashboard();
  } catch (err) {
    showToast('Failed to update stock', 'error');
  }
}

async function toggleFeatured(id) {
  try {
    const data = await apiFetch(`/admin/products/${id}/toggle-featured`, { method: 'PATCH' });
    showToast(`Featured: ${data.data.featured ? 'Yes' : 'No'}`);
    loadAllProducts();
    if (state.currentSection === 'dashboard') loadDashboard();
  } catch (err) {
    showToast('Failed to update featured status', 'error');
  }
}

// ─── TAGS INPUT ───────────────────────────────────────────────────────────────
function initTagsInput() {
  const wrapper = $('tags-input-wrapper');
  const textInput = $('input-tag-text');
  const display = $('tags-display');
  const suggestions = $('tag-suggestions');

  function renderTags() {
    display.innerHTML = state.tags.map((tag) =>
      `<span class="admin-tag-chip" data-tag="${escHtml(tag)}">${escHtml(tag)}</span>`
    ).join('');

    display.querySelectorAll('.admin-tag-chip').forEach((chip) => {
      chip.addEventListener('click', () => removeTag(chip.dataset.tag));
    });
  }

  function addTag(raw) {
    const tag = raw.toLowerCase().trim().replace(/[,\s]+/g, '');
    if (!tag || state.tags.includes(tag)) return;
    state.tags.push(tag);
    renderTags();
    textInput.value = '';
    hideSuggestions();
  }

  function removeTag(tag) {
    state.tags = state.tags.filter((t) => t !== tag);
    renderTags();
  }

  function showSuggestions(query) {
    if (!query || !state.existingTags.length) { hideSuggestions(); return; }
    const matches = state.existingTags.filter(
      (t) => t.includes(query.toLowerCase()) && !state.tags.includes(t)
    ).slice(0, 6);

    if (!matches.length) { hideSuggestions(); return; }

    suggestions.innerHTML = matches.map((t) =>
      `<div class="tag-suggestion-item" data-tag="${escHtml(t)}">${escHtml(t)}</div>`
    ).join('');
    suggestions.style.display = 'block';

    suggestions.querySelectorAll('.tag-suggestion-item').forEach((item) => {
      item.addEventListener('mousedown', (e) => {
        e.preventDefault();
        addTag(item.dataset.tag);
      });
    });
  }

  function hideSuggestions() {
    suggestions.style.display = 'none';
    suggestions.innerHTML = '';
  }

  textInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(textInput.value);
    } else if (e.key === 'Backspace' && !textInput.value && state.tags.length) {
      removeTag(state.tags[state.tags.length - 1]);
    }
  });

  textInput.addEventListener('input', () => {
    showSuggestions(textInput.value.trim());
  });

  textInput.addEventListener('blur', () => {
    if (textInput.value.trim()) addTag(textInput.value);
    setTimeout(hideSuggestions, 150);
  });

  wrapper.addEventListener('click', () => textInput.focus());
}

// Load existing tags for suggestions
async function loadExistingTags() {
  try {
    const data = await fetch(`${API_BASE}/products/tags`).then((r) => r.json());
    state.existingTags = data.data || [];
  } catch (_) {}
}

// ─── PRODUCT FORM ─────────────────────────────────────────────────────────────
function resetForm() {
  state.tags = [];
  state.editProductId = null;
  $('product-form').reset();
  $('edit-product-id').value = '';
  $('tags-display').innerHTML = '';
  $('input-tag-text').value = '';
  $('image-preview-wrap').style.display = 'none';
  $('image-placeholder').style.display = 'block';
  $('current-image-wrap').style.display = 'none';
  $('cancel-edit-btn').style.display = 'none';
  $('form-section-title').textContent = 'Add New Product';
  $('form-section-sub').textContent = 'Fill in the details below';
  $('submit-btn-text').textContent = 'Add Product';
  $('topbar-title').textContent = 'Add Product';
  $('form-feedback').style.display = 'none';
  $('desc-char-count').textContent = '0';

  // Clear validation errors
  ['name', 'price'].forEach((f) => {
    $(`fg-${f}`)?.querySelector('.form-input')?.classList.remove('is-error');
    $(`err-${f}`).textContent = '';
  });
}

async function startEdit(id) {
  try {
    const data = await apiFetch(`/products/${id}`);
    const p = data.data;

    state.editProductId = id;
    state.tags = [...(p.tags || [])];

    $('edit-product-id').value = id;
    $('input-name').value = p.name;
    $('input-price').value = p.price;
    $('input-description').value = p.description || '';
    $('desc-char-count').textContent = (p.description || '').length;
    $('input-instock').checked = p.inStock;
    $('input-featured').checked = p.featured;

    // Render existing tags
    $('tags-display').innerHTML = state.tags.map((tag) =>
      `<span class="admin-tag-chip" data-tag="${escHtml(tag)}">${escHtml(tag)}</span>`
    ).join('');
    $('tags-display').querySelectorAll('.admin-tag-chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        state.tags = state.tags.filter((t) => t !== chip.dataset.tag);
        chip.remove();
      });
    });

    // Show current image
    if (p.image?.url) {
      $('current-image').src = p.image.url;
      $('current-image-wrap').style.display = 'block';
    } else {
      $('current-image-wrap').style.display = 'none';
    }

    // Reset new image preview
    $('image-preview-wrap').style.display = 'none';
    $('image-placeholder').style.display = 'block';
    $('image-input').value = '';

    $('form-section-title').textContent = 'Edit Product';
    $('form-section-sub').textContent = `Editing: ${p.name}`;
    $('submit-btn-text').textContent = 'Save Changes';
    $('cancel-edit-btn').style.display = 'inline-flex';
    $('form-feedback').style.display = 'none';

    navigateTo('add');
    $('section-add').scrollIntoView({ behavior: 'smooth' });
  } catch (err) {
    showToast('Failed to load product for editing', 'error');
  }
}

function validateForm() {
  let valid = true;

  const name = $('input-name').value.trim();
  const price = $('input-price').value;

  if (!name) {
    $('err-name').textContent = 'Product name is required';
    $('input-name').classList.add('is-error');
    valid = false;
  } else {
    $('err-name').textContent = '';
    $('input-name').classList.remove('is-error');
  }

  if (!price || isNaN(parseFloat(price)) || parseFloat(price) < 0) {
    $('err-price').textContent = 'Enter a valid price (≥ 0)';
    $('input-price').classList.add('is-error');
    valid = false;
  } else {
    $('err-price').textContent = '';
    $('input-price').classList.remove('is-error');
  }

  return valid;
}

async function handleFormSubmit(e) {
  e.preventDefault();
  if (!validateForm()) return;

  const submitBtn = $('submit-btn');
  const spinner = $('form-spinner');
  const btnText = $('submit-btn-text');

  // Disable button
  submitBtn.disabled = true;
  spinner.style.display = 'block';
  btnText.style.opacity = '0.6';
  $('form-feedback').style.display = 'none';

  try {
    const formData = new FormData();
    formData.append('name', $('input-name').value.trim());
    formData.append('price', $('input-price').value);
    formData.append('tags', JSON.stringify(state.tags));
    formData.append('description', $('input-description').value.trim());
    formData.append('inStock', $('input-instock').checked);
    formData.append('featured', $('input-featured').checked);

    const imageFile = $('image-input').files[0];
    if (imageFile) formData.append('image', imageFile);

    const isEdit = !!state.editProductId;
    const url = isEdit ? `/admin/products/${state.editProductId}` : '/admin/products';
    const method = isEdit ? 'PUT' : 'POST';

    const data = await apiFetch(url, { method, body: formData });

    // Success feedback
    const feedback = $('form-feedback');
    feedback.className = 'form-feedback success';
    feedback.textContent = `✓ Product ${isEdit ? 'updated' : 'created'} successfully!`;
    feedback.style.display = 'block';

    showToast(`Product ${isEdit ? 'updated' : 'added'} successfully!`);

    if (!isEdit) {
      resetForm();
    } else {
      // Update cancel button shows
      $('cancel-edit-btn').style.display = 'inline-flex';
    }
  } catch (err) {
    const feedback = $('form-feedback');
    feedback.className = 'form-feedback error';
    feedback.textContent = `✗ ${err.message}`;
    feedback.style.display = 'block';
    showToast(err.message, 'error');
  } finally {
    submitBtn.disabled = false;
    spinner.style.display = 'none';
    btnText.style.opacity = '1';
  }
}

// ─── IMAGE UPLOAD ─────────────────────────────────────────────────────────────
function initImageUpload() {
  const input = $('image-input');
  const area = $('image-upload-area');
  const placeholder = $('image-placeholder');
  const previewWrap = $('image-preview-wrap');
  const preview = $('image-preview');
  const removeBtn = $('image-remove-btn');

  function showPreview(file) {
    if (!file.type.startsWith('image/')) {
      showToast('Please select an image file', 'error');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast('Image must be smaller than 5MB', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      preview.src = e.target.result;
      previewWrap.style.display = 'block';
      placeholder.style.display = 'none';
    };
    reader.readAsDataURL(file);
  }

  input.addEventListener('change', () => {
    if (input.files[0]) showPreview(input.files[0]);
  });

  // Drag and drop
  area.addEventListener('dragover', (e) => {
    e.preventDefault();
    area.style.borderColor = 'var(--accent)';
  });
  area.addEventListener('dragleave', () => {
    area.style.borderColor = '';
  });
  area.addEventListener('drop', (e) => {
    e.preventDefault();
    area.style.borderColor = '';
    const file = e.dataTransfer.files[0];
    if (file) {
      input.files = e.dataTransfer.files;
      showPreview(file);
    }
  });

  removeBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    input.value = '';
    preview.src = '';
    previewWrap.style.display = 'none';
    placeholder.style.display = 'block';
  });
}

// ─── DELETE ───────────────────────────────────────────────────────────────────
function confirmDelete(id, name) {
  state.deleteTargetId = id;
  $('delete-product-name-label').textContent = `Delete "${name}"? This cannot be undone.`;
  $('delete-modal').style.display = 'flex';
}

async function executeDelete() {
  if (!state.deleteTargetId) return;

  const spinner = $('delete-spinner');
  const btn = $('confirm-delete-btn');
  spinner.style.display = 'block';
  btn.disabled = true;

  try {
    await apiFetch(`/admin/products/${state.deleteTargetId}`, { method: 'DELETE' });
    closeDeleteModal();
    showToast('Product deleted successfully');

    if (state.currentSection === 'products') loadAllProducts();
    if (state.currentSection === 'dashboard') loadDashboard();
  } catch (err) {
    showToast(`Delete failed: ${err.message}`, 'error');
  } finally {
    spinner.style.display = 'none';
    btn.disabled = false;
    state.deleteTargetId = null;
  }
}

function closeDeleteModal() {
  $('delete-modal').style.display = 'none';
  state.deleteTargetId = null;
}

// ─── SEARCH (admin products) ──────────────────────────────────────────────────
function initAdminSearch() {
  $('admin-search').addEventListener('input', () => {
    const query = $('admin-search').value.toLowerCase().trim();
    debounce(() => {
      if (!query) {
        renderAllProducts(state.allProducts);
        return;
      }
      const filtered = state.allProducts.filter((p) =>
        p.name.toLowerCase().includes(query) ||
        (p.tags || []).some((t) => t.includes(query)) ||
        String(p.price).includes(query)
      );
      renderAllProducts(filtered);
    });
  });

  $('admin-sort').addEventListener('change', () => {
    state.sort = $('admin-sort').value;
    state.currentPage = 1;
    loadAllProducts();
  });
}

// ─── CHAR COUNTER ─────────────────────────────────────────────────────────────
function initCharCounter() {
  $('input-description').addEventListener('input', () => {
    $('desc-char-count').textContent = $('input-description').value.length;
  });
}

// ─── INIT ─────────────────────────────────────────────────────────────────────
function init() {
  // Navigation
  document.querySelectorAll('.sidebar-link[data-section]').forEach((link) => {
    link.addEventListener('click', () => navigateTo(link.dataset.section));
  });
  $('dash-view-all-btn')?.addEventListener('click', () => navigateTo('products'));
  $('products-add-new-btn')?.addEventListener('click', () => {
    state.editProductId = null;
    resetForm();
    navigateTo('add');
  });
  $('empty-add-btn')?.addEventListener('click', () => {
    state.editProductId = null;
    resetForm();
    navigateTo('add');
  });
  $('cancel-edit-btn')?.addEventListener('click', () => {
    state.editProductId = null;
    resetForm();
  });
  $('cancel-delete-btn')?.addEventListener('click', closeDeleteModal);
  $('confirm-delete-btn')?.addEventListener('click', executeDelete);
  $('delete-modal')?.addEventListener('click', (e) => {
    if (e.target === $('delete-modal')) closeDeleteModal();
  });

  // Sidebar
  $('topbar-menu-btn')?.addEventListener('click', openSidebar);
  $('sidebar-close-btn')?.addEventListener('click', closeSidebar);

  // Form
  $('product-form')?.addEventListener('submit', handleFormSubmit);

  // Keyboard
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeDeleteModal();
  });

  // Image upload
  initImageUpload();

  // Tags input
  initTagsInput();

  // Admin search
  initAdminSearch();

  // Char counter
  initCharCounter();

  // Clock
  updateClock();
  setInterval(updateClock, 60000);

  // Load existing tags for suggestions
  loadExistingTags();

  // Load initial dashboard
  loadDashboard();
}

init();
