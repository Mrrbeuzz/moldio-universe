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
        if(querySnapshot.empty) {
            // Fallback default products for demonstration
            products = [
                { id: 'demo1', name: 'Robe Élégante Bazin', price: 25000, category: 'Vêtements', imageUrl: 'https://images.unsplash.com/photo-1515347619362-e9326e033baf?auto=format&fit=crop&w=400&q=80', description: 'Superbe robe traditionnelle avec des finitions premium.' },
                { id: 'demo2', name: 'Ensemble Collier Doré', price: 15000, category: 'Bijoux', imageUrl: 'https://images.unsplash.com/photo-1599643478524-fb66f724128d?auto=format&fit=crop&w=400&q=80', description: 'Parure élégante pour toutes vos cérémonies.' },
                { id: 'demo3', name: 'Sac à Main Luxe', price: 30000, category: 'Sacs', imageUrl: 'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=400&q=80', description: 'Sac en cuir véritable avec grand espace de rangement.' },
                { id: 'demo4', name: 'Tissu Wax Premium', price: 12000, category: 'Tissus', imageUrl: 'https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?auto=format&fit=crop&w=400&q=80', description: 'Motifs colorés, 100% coton de haute qualité.' }
            ];
            renderProducts(products);
            return;
        }
        
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
    const badge = document.getElementById('cart-count');
    if (badge) {
        badge.classList.remove('bump');
        void badge.offsetWidth; // Force reflow
        badge.classList.add('bump');
    }
    
    showToast(`${product.name} ajouté au panier !`);
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

// Handle promo code toggle visually
promoToggleBtn.addEventListener('click', () => {
    promoInputGroup.style.display = promoInputGroup.style.display === 'flex' ? 'none' : 'flex';
});

// --- Toast Notification ---
window.showToast = (message) => {
    let container = document.getElementById('toast-container');
    if(!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }
    
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `<i class="fa-solid fa-check-circle" style="color: white;"></i> <span>${message}</span>`;
    
    container.appendChild(toast);
    
    // Clean up after CSS animation completes (3 seconds)
    setTimeout(() => {
        if(toast.parentElement) {
            toast.remove();
        }
    }, 3000);
};

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

// --- Checkout Modal Logic ---
const checkoutModal = document.getElementById('checkout-modal');
const closeCheckoutBtn = document.getElementById('close-checkout-btn');
const confirmCheckoutBtn = document.getElementById('confirm-checkout-btn');

checkoutBtn.addEventListener('click', () => {
    if(cart.length === 0) return showToast("Votre panier est vide.");
    cartModal.classList.remove('active');
    checkoutModal.classList.add('active');
});

closeCheckoutBtn.addEventListener('click', () => {
    checkoutModal.classList.remove('active');
});

checkoutModal.addEventListener('click', (e) => {
    if(e.target === checkoutModal) checkoutModal.classList.remove('active');
});

confirmCheckoutBtn.addEventListener('click', async () => {
    const clientFirstName = document.getElementById('client-firstname').value.trim();
    const clientLastName = document.getElementById('client-lastname').value.trim();
    const clientName = `${clientFirstName} ${clientLastName}`.trim();
    const clientPhone = document.getElementById('client-phone').value.trim();
    const clientAddress = document.getElementById('client-address').value.trim();
    
    // Le commentaire peut être absent si on suit strictement la maquette, mais on le garde au cas où
    const notesEl = document.getElementById('client-notes');
    const clientNotes = notesEl ? notesEl.value.trim() : '';
    
    if(!clientFirstName || !clientLastName || !clientPhone || !clientAddress) {
        return alert("Veuillez renseigner votre prénom, nom, numéro et adresse de livraison.");
    }
    
    confirmCheckoutBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Génération...';
    confirmCheckoutBtn.disabled = true;
    
    // Générer un ID unique court
    const orderId = 'MU-' + Math.random().toString(36).substr(2, 6).toUpperCase();
    const finalTotal = calculateTotal();
    
    const orderData = {
        orderId: orderId,
        clientName: clientName,
        clientPhone: clientPhone,
        clientAddress: clientAddress,
        clientNotes: clientNotes,
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
        checkoutModal.classList.remove('active');
        
        // Construire le message WhatsApp
        let msg = `*NOUVELLE COMMANDE MOLDIO UNIVERSE*\n\n`;
        msg += `*Client:* ${clientName}\n`;
        msg += `*Numéro:* ${clientPhone}\n`;
        msg += `*Adresse:* ${clientAddress}\n`;
        if (clientNotes) msg += `*Commentaire:* ${clientNotes}\n`;
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
    
    confirmCheckoutBtn.innerHTML = `<i class="fa-brands fa-whatsapp"></i> Confirmer et envoyer sur WhatsApp`;
    confirmCheckoutBtn.disabled = false;
});
