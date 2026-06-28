import { auth, db, storage, signInWithEmailAndPassword, onAuthStateChanged, signOut, collection, getDocs, addDoc, serverTimestamp, query, where, doc, ref, uploadBytes, getDownloadURL, getDoc, deleteDoc, setDoc } from './firebase-config.js';
import { updateDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// --- DOM Elements ---
const loginScreen = document.getElementById('login-screen');
const adminApp = document.getElementById('admin-app');
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const emailInput = document.getElementById('admin-email');
const passInput = document.getElementById('admin-password');
const errorMsg = document.getElementById('login-error');

// Navigation
const navLinks = document.querySelectorAll('.nav-link');
const panels = document.querySelectorAll('.panel');

// --- Navigation Logic ---
navLinks.forEach(link => {
    link.addEventListener('click', () => {
        navLinks.forEach(l => l.classList.remove('active'));
        panels.forEach(p => p.classList.remove('active'));
        
        link.classList.add('active');
        document.getElementById(link.dataset.target).classList.add('active');
        
        if(link.dataset.target === 'orders') loadOrders();
        if(link.dataset.target === 'dashboard') loadDashboard();
        if(link.dataset.target === 'promo') loadPromos();
        if(link.dataset.target === 'products') { loadProductsAdmin(); loadCategoriesForSelect(); }
        if(link.dataset.target === 'categories') loadCategoriesAdmin();
        if(link.dataset.target === 'content') loadContentAdmin();
    });
});

// --- Auth Logic ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        loginScreen.style.display = 'none';
        adminApp.style.display = 'flex';
        loadDashboard();
    } else {
        loginScreen.style.display = 'flex';
        adminApp.style.display = 'none';
    }
});

loginBtn.addEventListener('click', () => {
    const email = emailInput.value;
    const pass = passInput.value;
    loginBtn.textContent = "Patientez...";
    
    signInWithEmailAndPassword(auth, email, pass)
        .catch(error => {
            errorMsg.style.display = 'block';
            loginBtn.textContent = "Se connecter";
        });
});

logoutBtn.addEventListener('click', () => {
    signOut(auth);
});

// --- Dashboard ---
async function loadDashboard() {
    try {
        const querySnapshot = await getDocs(collection(db, "orders"));
        let totalRevenue = 0;
        let pendingCount = 0;
        
        querySnapshot.forEach(doc => {
            const data = doc.data();
            if(data.status === 'validated') {
                totalRevenue += data.total;
            } else if (data.status === 'pending') {
                pendingCount++;
            }
        });
        
        document.getElementById('total-revenue').textContent = totalRevenue.toLocaleString() + ' FCFA';
        document.getElementById('pending-orders-count').textContent = pendingCount;
    } catch (e) {
        console.error(e);
    }
}

// --- Orders ---
async function loadOrders() {
    const tbody = document.getElementById('orders-tbody');
    tbody.innerHTML = '<tr><td colspan="5">Chargement...</td></tr>';
    
    try {
        const querySnapshot = await getDocs(collection(db, "orders"));
        const orders = [];
        querySnapshot.forEach(doc => orders.push({ id: doc.id, ...doc.data() }));
        
        // Trier par date la plus récente
        orders.sort((a,b) => b.createdAt - a.createdAt);
        
        tbody.innerHTML = orders.map(o => `
            <tr>
                <td><strong>${o.orderId}</strong></td>
                <td>${o.createdAt ? new Date(o.createdAt.toDate()).toLocaleDateString() : 'N/A'}</td>
                <td>${o.total} FCFA</td>
                <td><span class="status-badge ${o.status === 'pending' ? 'status-pending' : 'status-validated'}">${o.status === 'pending' ? 'En attente' : 'Validée'}</span></td>
                <td>
                    ${o.status === 'pending' ? `<button class="btn-primary" style="padding: 5px 10px; font-size: 0.8rem;" onclick="validateOrder('${o.id}')">Valider (Payé)</button>` : '-'}
                </td>
            </tr>
        `).join('');
    } catch (e) {
        console.error(e);
    }
}

window.validateOrder = async (docId) => {
    if(!confirm("Confirmez-vous que cette commande a été payée suite à l'échange WhatsApp ?")) return;
    try {
        const orderRef = doc(db, "orders", docId);
        await updateDoc(orderRef, {
            status: "validated"
        });
        loadOrders();
    } catch (e) {
        alert("Erreur lors de la validation.");
        console.error(e);
    }
};

// --- Products & WebP Conversion ---
const addProdBtn = document.getElementById('add-product-btn');

async function convertToWebP(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                // Redimensionnement optionnel si très grand
                const MAX_WIDTH = 1200;
                let width = img.width;
                let height = img.height;
                
                if (width > MAX_WIDTH) {
                    height = height * (MAX_WIDTH / width);
                    width = MAX_WIDTH;
                }
                
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                
                canvas.toBlob((blob) => {
                    resolve(blob);
                }, "image/webp", 0.85); // 85% de qualité
            };
            img.onerror = reject;
            img.src = e.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

addProdBtn.addEventListener('click', async () => {
    const name = document.getElementById('prod-name').value.trim();
    const category = document.getElementById('prod-category').value;
    const price = parseInt(document.getElementById('prod-price').value);
    const fileInput = document.getElementById('prod-image');
    
    if(!name || !price || !fileInput.files[0]) {
        return alert("Veuillez remplir tous les champs et ajouter une image.");
    }
    
    addProdBtn.textContent = "Conversion & Upload...";
    addProdBtn.disabled = true;
    
    try {
        const file = fileInput.files[0];
        // Conversion en WebP
        const webpBlob = await convertToWebP(file);
        
        // Upload vers Firebase Storage
        const filename = `products/${Date.now()}.webp`;
        const storageRef = ref(storage, filename);
        await uploadBytes(storageRef, webpBlob);
        const downloadURL = await getDownloadURL(storageRef);
        
        // Sauvegarde dans Firestore
        await addDoc(collection(db, "products"), {
            name: name,
            category: category,
            price: price,
            imageUrl: downloadURL,
            createdAt: serverTimestamp()
        });
        
        alert("Produit ajouté avec succès !");
        // Reset form
        document.getElementById('prod-name').value = '';
        document.getElementById('prod-price').value = '';
        fileInput.value = '';
        
    } catch (e) {
        console.error("Erreur ajout produit", e);
        alert("Une erreur est survenue.");
    }
    
    addProdBtn.textContent = "Ajouter au catalogue";
    addProdBtn.disabled = false;
    loadProductsAdmin();
});

// --- Admin Products List ---
async function loadProductsAdmin() {
    const tbody = document.getElementById('products-tbody');
    tbody.innerHTML = '<tr><td colspan="5">Chargement...</td></tr>';
    try {
        const snap = await getDocs(collection(db, "products"));
        const prods = [];
        snap.forEach(doc => prods.push({ id: doc.id, ...doc.data() }));
        
        tbody.innerHTML = prods.map(p => `
            <tr>
                <td><img src="${p.imageUrl}" width="50" style="border-radius:4px;"></td>
                <td>${p.name}</td>
                <td>${p.category}</td>
                <td>${p.price} FCFA</td>
                <td><button onclick="deleteProduct('${p.id}')" style="color:red;"><i class="fa-solid fa-trash"></i></button></td>
            </tr>
        `).join('');
    } catch(e) { console.error(e); }
}

window.deleteProduct = async (id) => {
    if(!confirm("Supprimer ce produit ?")) return;
    try {
        await deleteDoc(doc(db, "products", id));
        loadProductsAdmin();
    } catch(e) { console.error(e); }
};

// --- Categories ---
async function loadCategoriesForSelect() {
    const select = document.getElementById('prod-category');
    try {
        const snap = await getDocs(collection(db, "categories"));
        const cats = [];
        snap.forEach(doc => cats.push(doc.data().name));
        if(cats.length === 0) cats.push("Général");
        select.innerHTML = cats.map(c => `<option value="${c}">${c}</option>`).join('');
    } catch(e) { console.error(e); }
}

async function loadCategoriesAdmin() {
    const tbody = document.getElementById('categories-tbody');
    tbody.innerHTML = '<tr><td colspan="3">Chargement...</td></tr>';
    try {
        const snap = await getDocs(collection(db, "categories"));
        const cats = [];
        snap.forEach(doc => cats.push({ id: doc.id, ...doc.data() }));
        
        tbody.innerHTML = cats.map(c => `
            <tr>
                <td><i class="fa-solid ${c.icon}"></i></td>
                <td>${c.name}</td>
                <td><button onclick="deleteCategory('${c.id}')" style="color:red;"><i class="fa-solid fa-trash"></i></button></td>
            </tr>
        `).join('');
    } catch(e) { console.error(e); }
}

document.getElementById('add-category-btn').addEventListener('click', async () => {
    const name = document.getElementById('cat-name').value.trim();
    const icon = document.getElementById('cat-icon').value.trim() || 'fa-tag';
    if(!name) return;
    try {
        await addDoc(collection(db, "categories"), { name, icon });
        document.getElementById('cat-name').value = '';
        document.getElementById('cat-icon').value = '';
        loadCategoriesAdmin();
    } catch(e) { console.error(e); }
});

window.deleteCategory = async (id) => {
    if(!confirm("Supprimer cette catégorie ?")) return;
    try {
        await deleteDoc(doc(db, "categories", id));
        loadCategoriesAdmin();
    } catch(e) { console.error(e); }
};

// --- Content (About & Contact) ---
async function loadContentAdmin() {
    try {
        const docSnap = await getDoc(doc(db, "site", "content"));
        if(docSnap.exists()) {
            const data = docSnap.data();
            document.getElementById('about-text').value = data.about || '';
            document.getElementById('contact-text').value = data.contact || '';
        }
    } catch(e) { console.error(e); }
}

document.getElementById('save-content-btn').addEventListener('click', async () => {
    const about = document.getElementById('about-text').value;
    const contact = document.getElementById('contact-text').value;
    const btn = document.getElementById('save-content-btn');
    btn.textContent = "Sauvegarde...";
    try {
        await setDoc(doc(db, "site", "content"), { about, contact }, { merge: true });
        alert("Contenu sauvegardé !");
    } catch(e) { console.error(e); }
    btn.textContent = "Enregistrer le contenu";
});


// --- Promo Codes ---
async function loadPromos() {
    const tbody = document.getElementById('promo-tbody');
    tbody.innerHTML = '<tr><td colspan="3">Chargement...</td></tr>';
    try {
        const snap = await getDocs(collection(db, "promo_codes"));
        const promos = [];
        snap.forEach(doc => promos.push({ id: doc.id, ...doc.data() }));
        
        tbody.innerHTML = promos.map(p => `
            <tr>
                <td><strong>${p.code}</strong></td>
                <td>-${p.discount}%</td>
                <td><span class="status-badge ${p.active ? 'status-validated' : 'status-pending'}">${p.active ? 'Actif' : 'Inactif'}</span></td>
            </tr>
        `).join('');
    } catch(e) { console.error(e); }
}

document.getElementById('add-promo-btn').addEventListener('click', async () => {
    const code = document.getElementById('promo-code-input').value.trim().toUpperCase();
    const discount = parseInt(document.getElementById('promo-discount-input').value);
    
    if(!code || !discount) return;
    
    try {
        await addDoc(collection(db, "promo_codes"), {
            code: code,
            discount: discount,
            active: true
        });
        document.getElementById('promo-code-input').value = '';
        document.getElementById('promo-discount-input').value = '';
        loadPromos();
    } catch (e) { console.error(e); }
});
