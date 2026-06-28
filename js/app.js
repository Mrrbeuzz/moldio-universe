import { db, collection, getDocs, addDoc, serverTimestamp, query, where, doc, getDoc } from './firebase-config.js';

// --- Global State ---
let products = [];
let cart = JSON.parse(localStorage.getItem('moldio_cart')) || [];
let currentDiscount = 0;

// --- DOM Elements ---
const productGrid = document.getElementById('product-grid');
const categoryGrid = document.getElementById('category-grid');
const cartCount = document.getElementById('cart-count');
const cartItemsContainer = document.getElementById('cart-items');
const cartTotalPrice = document.getElementById('cart-total-price');

const cartModal = document.getElementById('cart-modal');
const openCartBtn = document.getElementById('open-cart-btn');
const closeCartBtn = document.getElementById('close-cart-btn');

const productModal = document.getElementById('product-detail-modal');
const closeProductBtn = document.getElementById('close-product-btn');

const applyPromoBtn = document.getElementById('apply-promo-btn');
const promoInput = document.getElementById('promo-code');
const checkoutBtn = document.getElementById('checkout-btn');

// --- Initialization ---
document.addEventListener('DOMContentLoaded', async () => {
    document.getElementById('year').textContent = new Date().getFullYear();
    updateCartUI();
    await loadCategories();
    await loadProducts();
    await loadSiteContent();
});

// --- Fetch Data from Firebase ---
async function loadSiteContent() {
    try {
        const docSnap = await getDoc(doc(db, "site", "content"));
        if(docSnap.exists()) {
            const data = docSnap.data();
            if(data.about) {
                document.getElementById('about-content').innerHTML = data.about.replace(/\n/g, '<br>');
            } else {
                document.getElementById('about-content').innerHTML = "Bienvenue chez Moldio Universe !";
            }
            
            if(data.contact) {
                document.getElementById('contact-content').innerHTML = data.contact.replace(/\n/g, '<br>');
            } else {
                document.getElementById('contact-content').innerHTML = "Contactez-nous pour toute information.";
            }
        } else {
            document.getElementById('about-content').innerHTML = "Bienvenue chez Moldio Universe !";
            document.getElementById('contact-content').innerHTML = "Contactez-nous pour toute information.";
        }
    } catch (error) {
        console.error("Erreur chargement contenu:", error);
    }
}
async function loadCategories() {
    try {
        const querySnapshot = await getDocs(collection(db, "categories"));
        if(querySnapshot.empty) {
            // Fallback default categories if empty
            const defaults = [
                { name: 'Vêtements', icon: 'fa-shirt' },
                { name: 'Chaussures', icon: 'fa-shoe-prints' },
                { name: 'Bijoux', icon: 'fa-gem' },
                { name: 'Sacs', icon: 'fa-bag-shopping' },
                { name: 'Tissus', icon: 'fa-scroll' },
                { name: 'Alimentation', icon: 'fa-utensils' }
            ];
            renderCategories(defaults);
            return;
        }
        const categories = [];
        querySnapshot.forEach((doc) => {
            categories.push({ id: doc.id, ...doc.data() });
        });
        renderCategories(categories);
    } catch (error) {
        console.error("Erreur chargement catégories:", error);
    }
}

async function loadProducts() {
    try {
        const querySnapshot = await getDocs(collection(db, "products"));
        products = [];
        querySnapshot.forEach((doc) => {
            products.push({ id: doc.id, ...doc.data() });
        });
        renderProducts(products);
    } catch (error) {
        console.error("Erreur chargement produits:", error);
        productGrid.innerHTML = '<p style="text-align:center; grid-column: 1/-1;">Aucun produit disponible pour le moment.</p>';
    }
}

// --- Render Functions ---
function renderCategories(categories) {
    categoryGrid.innerHTML = categories.map(cat => `
        <div class="category-card" onclick="filterByCategory('${cat.name}')">
            <i class="fa-solid ${cat.icon || 'fa-tag'} category-icon"></i>
            <h3>${cat.name}</h3>
        </div>
    `).join('');
}

function renderProducts(productsToRender) {
    if(productsToRender.length === 0) {
        productGrid.innerHTML = '<p style="text-align:center; grid-column: 1/-1;">Aucun produit trouvé.</p>';
        return;
    }
    productGrid.innerHTML = productsToRender.map(prod => `
        <div class="product-card">
            <div class="product-img-wrapper" onclick="openProductDetail('${prod.id}')" style="cursor:pointer;">
                <img src="${prod.imageUrl || 'https://via.placeholder.com/300x400?text=Image'}" alt="${prod.name}" class="product-img">
            </div>
            <div class="product-info">
                <div class="product-category">${prod.category}</div>
                <h3 class="product-name">${prod.name}</h3>
                <div class="product-price">${prod.price} FCFA</div>
                <button class="btn-outline" onclick="addToCart('${prod.id}')">Ajouter au panier</button>
            </div>
        </div>
    `).join('');
}

window.filterByCategory = (categoryName) => {
    const filtered = products.filter(p => p.category === categoryName);
    renderProducts(filtered);
    document.getElementById('shop').scrollIntoView({ behavior: 'smooth' });
};

// --- Cart Logic ---
window.addToCart = (productId) => {
    const product = products.find(p => p.id === productId);
    if(!product) return;

    const existing = cart.find(item => item.id === productId);
    if(existing) {
        existing.quantity += 1;
    } else {
        cart.push({ ...product, quantity: 1 });
    }
    
    saveCart();
    updateCartUI();
    
    // Feedback visual
    openCartBtn.classList.add('bounce');
    setTimeout(() => openCartBtn.classList.remove('bounce'), 300);
};

window.updateQty = (productId, change) => {
    const item = cart.find(i => i.id === productId);
    if(!item) return;
    
    item.quantity += change;
    if(item.quantity <= 0) {
        cart = cart.filter(i => i.id !== productId);
    }
    saveCart();
    updateCartUI();
};

function saveCart() {
    localStorage.setItem('moldio_cart', JSON.stringify(cart));
}

function updateCartUI() {
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    cartCount.textContent = totalItems;
    
    if(cart.length === 0) {
        cartItemsContainer.innerHTML = '<p style="text-align:center; color: var(--text-muted); margin-top: 20px;">Votre panier est vide.</p>';
        cartTotalPrice.textContent = '0 FCFA';
        return;
    }

    cartItemsContainer.innerHTML = cart.map(item => `
        <div class="cart-item">
            <img src="${item.imageUrl || 'https://via.placeholder.com/70'}" alt="${item.name}">
            <div class="cart-item-info">
                <div class="cart-item-title">${item.name}</div>
                <div class="cart-item-price">${item.price} FCFA</div>
                <div class="cart-item-qty">
                    <button class="qty-btn" onclick="updateQty('${item.id}', -1)"><i class="fa-solid fa-minus"></i></button>
                    <span>${item.quantity}</span>
                    <button class="qty-btn" onclick="updateQty('${item.id}', 1)"><i class="fa-solid fa-plus"></i></button>
                </div>
            </div>
        </div>
    `).join('');

    calculateTotal();
}

function calculateTotal() {
    let subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    let total = subtotal;
    
    if(currentDiscount > 0) {
        total = subtotal - (subtotal * (currentDiscount / 100));
    }
    
    cartTotalPrice.textContent = Math.round(total) + ' FCFA' + (currentDiscount > 0 ? ` (-${currentDiscount}%)` : '');
    return Math.round(total);
}

// --- Modals ---
openCartBtn.addEventListener('click', () => cartModal.classList.add('active'));
closeCartBtn.addEventListener('click', () => cartModal.classList.remove('active'));

closeProductBtn.addEventListener('click', () => {
    productModal.classList.remove('active');
});

cartModal.addEventListener('click', (e) => {
    if(e.target === cartModal) cartModal.classList.remove('active');
});
productModal.addEventListener('click', (e) => {
    if(e.target === productModal) productModal.classList.remove('active');
});

// --- Product Details & Comments ---
let currentProductId = null;

window.openProductDetail = async (productId) => {
    const product = products.find(p => p.id === productId);
    if(!product) return;
    
    currentProductId = productId;
    document.getElementById('pm-img').src = product.imageUrl || 'https://via.placeholder.com/400x500';
    document.getElementById('pm-category').textContent = product.category;
    document.getElementById('pm-title').textContent = product.name;
    document.getElementById('pm-price').textContent = product.price + ' FCFA';
    document.getElementById('pm-desc').textContent = product.description || 'Aucune description disponible.';
    
    document.getElementById('pm-add-to-cart').onclick = () => addToCart(product.id);
    
    await loadComments(productId);
    productModal.classList.add('active');
};

async function loadComments(productId) {
    const list = document.getElementById('comment-list');
    list.innerHTML = 'Chargement...';
    try {
        const q = query(collection(db, "comments"), where("productId", "==", productId));
        const querySnapshot = await getDocs(q);
        const comments = [];
        querySnapshot.forEach(doc => comments.push(doc.data()));
        
        document.getElementById('pm-comments-count').textContent = comments.length;
        
        if(comments.length === 0) {
            list.innerHTML = '<p>Aucun commentaire. Soyez le premier !</p>';
            return;
        }
        
        list.innerHTML = comments.map(c => `
            <div class="comment-card">
                <div class="comment-author">${c.author}</div>
                <div class="comment-text">${c.text}</div>
            </div>
        `).join('');
    } catch (error) {
        console.error("Erreur commentaires:", error);
        list.innerHTML = '<p>Erreur lors du chargement des commentaires.</p>';
    }
}

document.getElementById('submit-comment-btn').addEventListener('click', async () => {
    const author = document.getElementById('comment-author').value.trim() || 'Anonyme';
    const text = document.getElementById('comment-text').value.trim();
    
    if(!text) return alert("Veuillez écrire un commentaire.");
    if(!currentProductId) return;
    
    const btn = document.getElementById('submit-comment-btn');
    btn.textContent = "Envoi...";
    btn.disabled = true;
    
    try {
        await addDoc(collection(db, "comments"), {
            productId: currentProductId,
            author: author,
            text: text,
            createdAt: serverTimestamp()
        });
        document.getElementById('comment-text').value = '';
        await loadComments(currentProductId);
    } catch (e) {
        console.error("Erreur ajout commentaire", e);
        alert("Erreur lors de l'envoi.");
    }
    
    btn.textContent = "Envoyer";
    btn.disabled = false;
});

// --- Promo Code ---
applyPromoBtn.addEventListener('click', async () => {
    const code = promoInput.value.trim().toUpperCase();
    if(!code) return;
    
    applyPromoBtn.textContent = "...";
    try {
        const q = query(collection(db, "promo_codes"), where("code", "==", code), where("active", "==", true));
        const snap = await getDocs(q);
        if(snap.empty) {
            alert("Code invalide ou expiré.");
            currentDiscount = 0;
        } else {
            const promo = snap.docs[0].data();
            currentDiscount = promo.discount;
            alert(`Code appliqué ! -${currentDiscount}%`);
        }
        calculateTotal();
    } catch (e) {
        console.error("Erreur promo:", e);
    }
    applyPromoBtn.textContent = "Appliquer";
});

// --- Checkout (WhatsApp Hybrid System) ---
checkoutBtn.addEventListener('click', async () => {
    if(cart.length === 0) return alert("Votre panier est vide.");
    
    checkoutBtn.textContent = "Génération...";
    checkoutBtn.disabled = true;
    
    // Générer un ID unique court
    const orderId = 'MU-' + Math.random().toString(36).substr(2, 6).toUpperCase();
    const finalTotal = calculateTotal();
    
    const orderData = {
        orderId: orderId,
        items: cart,
        total: finalTotal,
        discount: currentDiscount,
        status: 'pending', // 'pending', 'validated', 'cancelled'
        createdAt: serverTimestamp()
    };
    
    try {
        // Sauvegarder la commande en base pour le back-office
        await addDoc(collection(db, "orders"), orderData);
        
        // Vider le panier
        cart = [];
        saveCart();
        updateCartUI();
        cartModal.classList.remove('active');
        
        // Construire le message WhatsApp
        let msg = `*NOUVELLE COMMANDE MOLDIO UNIVERSE*\n\n`;
        msg += `*Référence:* ${orderId}\n`;
        msg += `*Montant Total:* ${finalTotal} FCFA\n\n`;
        msg += `*Détails :*\n`;
        orderData.items.forEach(item => {
            msg += `- ${item.quantity}x ${item.name} (${item.price} FCFA)\n`;
        });
        msg += `\nBonjour, je souhaite valider cette commande !`;
        
        const waNumber = "221777528463";
        const waUrl = `https://wa.me/${waNumber}?text=${encodeURIComponent(msg)}`;
        
        // Rediriger vers WhatsApp
        window.open(waUrl, '_blank');
        
    } catch (e) {
        console.error("Erreur création commande:", e);
        alert("Une erreur est survenue lors de la création de votre commande.");
    }
    
    checkoutBtn.innerHTML = `Commander via WhatsApp <i class="fa-brands fa-whatsapp"></i>`;
    checkoutBtn.disabled = false;
});
