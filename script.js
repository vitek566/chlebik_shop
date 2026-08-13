import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, doc, updateDoc, deleteDoc, query, orderBy } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyA2yXEzcYQYsHOoIhARz7uqo3LJSrLVNUs",
  authDomain: "clebikshop.firebaseapp.com",
  projectId: "clebikshop",
  storageBucket: "clebikshop.firebasestorage.app",
  messagingSenderId: "129581121422",
  appId: "1:129581121422:web:a362d35549d02b5a11eedf",
  measurementId: "G-S5J1YKJ28J"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);

const ADMIN_PASSWORD = "chlebakk";
let isAdmin = false;
let currentProducts = [];
let activeCategory = 'all';
let searchQuery = '';

window.openLoginModal = () => document.getElementById('login-modal').classList.remove('hidden');
window.closeLoginModal = () => { document.getElementById('login-modal').classList.add('hidden'); document.getElementById('admin-password').value = ''; }
window.logoutAdmin = () => { isAdmin = false; updateUIForAdmin(); renderProducts(); }
window.closeEditModal = () => document.getElementById('edit-modal').classList.add('hidden');
window.setCategory = (cat) => {
  activeCategory = cat;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.toggle('active', b.dataset.cat === cat));
  renderProducts();
}
window.handleSearch = () => { searchQuery = document.getElementById('search-input').value.toLowerCase(); renderProducts(); }

window.verifyPassword = () => {
  if (document.getElementById('admin-password').value === ADMIN_PASSWORD) {
    isAdmin = true; window.closeLoginModal(); updateUIForAdmin(); renderProducts();
  } else { alert("Nesprávné heslo!"); document.getElementById('admin-password').value = ''; }
}

function updateUIForAdmin() {
  document.getElementById('admin-panel').classList.toggle('hidden', !isAdmin);
  const btn = document.getElementById('admin-auth-btn');
  btn.innerHTML = isAdmin ? `<span>🔓 Odhlásit se</span>` : `<span>🔐 Prodejce</span>`;
  btn.onclick = isAdmin ? window.logoutAdmin : window.openLoginModal;
}

async function loadProducts() {
  const grid = document.getElementById('products-grid');
  grid.innerHTML = '<p style="text-align:center; width: 100%;">Načítám data...</p>';

  try {
    const q = query(collection(db, "products"), orderBy("created_at", "desc"));
    const querySnapshot = await getDocs(q);
    currentProducts = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    renderProducts();
  } catch (error) {
    console.error("Chyba načítání:", error);
    grid.innerHTML = '<p style="color:red; text-align:center; width:100%;">Chyba při načítání dat.</p>';
  }
}

function renderProducts() {
  const grid = document.getElementById('products-grid');
  let filtered = currentProducts;
  if (activeCategory !== 'all') filtered = filtered.filter(p => p.category === activeCategory);
  if (searchQuery) filtered = filtered.filter(p => p.title.toLowerCase().includes(searchQuery) || p.description.toLowerCase().includes(searchQuery));

  if (filtered.length === 0) {
    grid.innerHTML = '<p style="text-align:center; width: 100%;">Žádné produkty k zobrazení.</p>';
    return;
  }

  grid.innerHTML = filtered.map(p => `
    <div class="card">
      <div class="card-img-wrapper">
        <img src="${p.image_url}" alt="Foto">
        <span class="card-badge">${p.category === 'potraviny' ? 'Potraviny' : 'Rybářské potřeby'}</span>
      </div>
      <div class="card-body">
        <h3 class="card-title">${p.title}</h3>
        <p class="card-desc">${p.description}</p>
        <div class="card-price">${p.price || 'Cena na dotaz'}</div>
      </div>
      ${isAdmin ? `
        <div class="card-actions">
          <button class="btn-edit" onclick="openEditModal('${p.id}')">Upravit</button>
          <button class="btn-delete" onclick="deleteProduct('${p.id}', '${p.image_path}')">Smazat</button>
        </div>
      ` : ''}
    </div>
  `).join('');
}

window.handleAddProduct = async (event) => {
  event.preventDefault();
  const btn = document.getElementById('save-btn'); btn.innerText = "Ukládám..."; btn.disabled = true;

  try {
    const file = document.getElementById('prod-image').files[0];
    const filePath = `products/${Date.now()}_${file.name}`;
    const fileRef = ref(storage, filePath);
    
    await uploadBytes(fileRef, file);
    const imageUrl = await getDownloadURL(fileRef);

    await addDoc(collection(db, "products"), {
      title: document.getElementById('prod-title').value,
      price: document.getElementById('prod-price').value,
      description: document.getElementById('prod-desc').value,
      category: document.getElementById('prod-category').value,
      image_url: imageUrl,
      image_path: filePath,
      created_at: Date.now()
    });

    document.getElementById('add-product-form').reset();
    await loadProducts();
  } catch (err) { alert("Chyba: " + err.message); } 
  finally { btn.innerText = "Přidat do katalogu"; btn.disabled = false; }
}

window.openEditModal = (id) => {
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

window.handleUpdateProduct = async (event) => {
  event.preventDefault();
  const btn = document.getElementById('update-btn'); btn.innerText = "Ukládám..."; btn.disabled = true;

  try {
    const id = document.getElementById('edit-prod-id').value;
    let imagePath = document.getElementById('edit-prod-image-path').value;
    const newFile = document.getElementById('edit-prod-image').files[0];
    const updates = {
      title: document.getElementById('edit-prod-title').value,
      price: document.getElementById('edit-prod-price').value,
      description: document.getElementById('edit-prod-desc').value,
      category: document.getElementById('edit-prod-category').value
    };

    if (newFile) {
      if (imagePath) await deleteObject(ref(storage, imagePath)).catch(e => console.log(e));
      imagePath = `products/${Date.now()}_${newFile.name}`;
      const fileRef = ref(storage, imagePath);
      await uploadBytes(fileRef, newFile);
      updates.image_url = await getDownloadURL(fileRef);
      updates.image_path = imagePath;
    }

    await updateDoc(doc(db, "products", id), updates);
    window.closeEditModal();
    await loadProducts();
  } catch(err) { alert("Chyba: " + err.message); } 
  finally { btn.innerText = "Uložit"; btn.disabled = false; }
}

window.deleteProduct = async (id, imagePath) => {
  if (!confirm("Smazat tento produkt?")) return;
  try {
    if (imagePath) await deleteObject(ref(storage, imagePath)).catch(e => console.log(e));
    await deleteDoc(doc(db, "products", id));
    await loadProducts();
  } catch (err) { alert("Chyba mazání: " + err.message); }
}

loadProducts();
