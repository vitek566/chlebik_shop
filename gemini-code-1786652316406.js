const SUPABASE_URL = 'TVOJE_SUPABASE_URL';
const SUPABASE_KEY = 'TVŮJ_SUPABASE_ANON_KEY';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const ADMIN_PASSWORD = "heslo"; // Změň podle potřeby

let isAdmin = false;
let currentProducts = [];
let activeCategory = 'all';
let searchQuery = '';

// === AUTH a ADMIN MÓD === (Stejné jako minule)
function openLoginModal() { document.getElementById('login-modal').classList.remove('hidden'); }
function closeLoginModal() { document.getElementById('login-modal').classList.add('hidden'); }
function verifyPassword() {
  if (document.getElementById('admin-password').value === ADMIN_PASSWORD) {
    isAdmin = true; closeLoginModal(); updateUIForAdmin(); renderProducts();
  } else { alert("Nesprávné heslo!"); }
}
function logoutAdmin() { isAdmin = false; updateUIForAdmin(); renderProducts(); }
function updateUIForAdmin() {
  document.getElementById('admin-panel').classList.toggle('hidden', !isAdmin);
  const btn = document.getElementById('admin-auth-btn');
  btn.innerText = isAdmin ? '🔓 Odhlásit prodejce' : '🔐 Prodejce';
  btn.onclick = isAdmin ? logoutAdmin : openLoginModal;
}

// === VYHLEDÁVÁNÍ A FILTRY ===
function setCategory(cat) {
  activeCategory = cat;
  // Aktualizace vzhledu tlačítek
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.cat === cat);
  });
  renderProducts(); // Znovu vykreslí produkty podle filtru
}

function handleSearch() {
  searchQuery = document.getElementById('search-input').value.toLowerCase();
  renderProducts(); // Filtruje v reálném čase podle textu
}

// === NAČÍTÁNÍ A VYKRESLOVÁNÍ ===
async function loadProducts() {
  const { data, error } = await supabase.from('products').select('*').order('created_at', { ascending: false });
  if (error) { console.error(error); return; }
  currentProducts = data;
  renderProducts();
}

function getCategoryLabel(cat) {
  if (cat === 'potraviny') return '🥖 Potraviny';
  if (cat === 'rybarske') return '🎣 Rybářské potřeby';
  return 'Ostatní';
}

function renderProducts() {
  const grid = document.getElementById('products-grid');
  
  // Aplikace filtrů a vyhledávání
  let filtered = currentProducts;
  if (activeCategory !== 'all') {
    filtered = filtered.filter(p => p.category === activeCategory);
  }
  if (searchQuery) {
    filtered = filtered.filter(p => 
      p.title.toLowerCase().includes(searchQuery) || 
      p.description.toLowerCase().includes(searchQuery)
    );
  }

  if (filtered.length === 0) {
    grid.innerHTML = '<p style="text-align:center; grid-column: 1/-1; padding: 40px; color: #6b7280;">Nebyly nalezeny žádné produkty.</p>';
    return;
  }

  grid.innerHTML = filtered.map(p => `
    <div class="card">
      <div style="position: relative;">
        <img src="${p.image_url}" alt="${escapeHtml(p.title)}">
        <span class="card-badge">${getCategoryLabel(p.category)}</span>
      </div>
      <div class="card-body">
        <div class="card-title">${escapeHtml(p.title)}</div>
        <div class="card-desc">${escapeHtml(p.description)}</div>
        <div class="card-price">${p.price ? escapeHtml(p.price) : ''}</div>
      </div>
      ${isAdmin ? `
        <div class="card-actions">
          <button class="btn-edit" onclick="openEditModal('${p.id}')">✏️ Upravit</button>
          <button class="btn-delete" onclick="deleteProduct('${p.id}', '${p.image_path}')">🗑️</button>
        </div>
      ` : ''}
    </div>
  `).join('');
}

// === PŘIDÁNÍ PRODUKTU ===
async function handleAddProduct(event) {
  event.preventDefault();
  const btn = document.getElementById('save-btn'); btn.innerText = "Ukládám..."; btn.disabled = true;

  try {
    const file = document.getElementById('prod-image').files[0];
    const fileExt = file.name.split('.').pop();
    const filePath = `products/${Date.now()}.${fileExt}`;

    await supabase.storage.from('product-images').upload(filePath, file);
    const { data: urlData } = supabase.storage.from('product-images').getPublicUrl(filePath);

    // Přidáno uložení kategorie
    await supabase.from('products').insert([{
      title: document.getElementById('prod-title').value,
      price: document.getElementById('prod-price').value,
      description: document.getElementById('prod-desc').value,
      category: document.getElementById('prod-category').value,
      image_url: urlData.publicUrl,
      image_path: filePath
    }]);

    document.getElementById('add-product-form').reset();
    await loadProducts(); // Načte znovu vše z DB
  } catch (err) { alert(err.message); } finally { btn.innerText = "Uložit produkt"; btn.disabled = false; }
}

// === EDITACE A MAZÁNÍ ===
function openEditModal(id) {
  const p = currentProducts.find(x => x.id === id);
  if(!p) return;
  document.getElementById('edit-prod-id').value = p.id;
  document.getElementById('edit-prod-image-path').value = p.image_path;
  document.getElementById('edit-prod-title').value = p.title;
  document.getElementById('edit-prod-price').value = p.price || '';
  document.getElementById('edit-prod-desc').value = p.description;
  document.getElementById('edit-prod-category').value = p.category || 'potraviny';
  document.getElementById('edit-modal').classList.remove('hidden');
}

function closeEditModal() { document.getElementById('edit-modal').classList.add('hidden'); }

async function handleUpdateProduct(event) {
  event.preventDefault();
  const btn = document.getElementById('update-btn'); btn.innerText = "Ukládám..."; btn.disabled = true;

  try {
    const id = document.getElementById('edit-prod-id').value;
    let imagePath = document.getElementById('edit-prod-image-path').value;
    const newFile = document.getElementById('edit-prod-image').files[0];
    let imageUrl = undefined;

    if (newFile) {
      if (imagePath) await supabase.storage.from('product-images').remove([imagePath]);
      imagePath = `products/${Date.now()}.${newFile.name.split('.').pop()}`;
      await supabase.storage.from('product-images').upload(imagePath, newFile);
      imageUrl = supabase.storage.from('product-images').getPublicUrl(imagePath).data.publicUrl;
    }

    const updates = {
      title: document.getElementById('edit-prod-title').value,
      price: document.getElementById('edit-prod-price').value,
      description: document.getElementById('edit-prod-desc').value,
      category: document.getElementById('edit-prod-category').value
    };
    if (imageUrl) { updates.image_url = imageUrl; updates.image_path = imagePath; }

    await supabase.from('products').update(updates).eq('id', id);
    closeEditModal();
    await loadProducts();
  } catch(err) { alert(err.message); } finally { btn.innerText = "Uložit změny"; btn.disabled = false; }
}

async function deleteProduct(id, imagePath) {
  if (!confirm("Smazat produkt?")) return;
  if (imagePath) await supabase.storage.from('product-images').remove([imagePath]);
  await supabase.from('products').delete().eq('id', id);
  await loadProducts();
}

function escapeHtml(str) { return str.replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m])); }

// START
loadProducts();