// Estado global
let socket = null;
let currentAuth = null;
let currentConversation = null;
let conversations = [];
let autoRefreshInterval = null;

// Elementos del DOM
const loginScreen = document.getElementById('login-screen');
const mainApp = document.getElementById('main-app');
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');
const conversationList = document.getElementById('conversation-list');
const chatContainer = document.getElementById('chat-container');
const noConversationSelected = document.getElementById('no-conversation-selected');
const messagesContainer = document.getElementById('messages-container');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const activeCount = document.getElementById('active-count');
const connectionStatus = document.getElementById('connection-status');
const connectionText = document.getElementById('connection-text');
const logoutBtn = document.getElementById('logout-btn');
const finalizeBtn = document.getElementById('finalize-btn');
const searchInput = document.getElementById('search-input');
const menuToggleBtn = document.getElementById('menu-toggle-btn');
const dropdownMenu = document.getElementById('dropdown-menu');
const promotionsModal = document.getElementById('promotions-modal');
const promoMessage = document.getElementById('promo-message');
const charCount = document.getElementById('char-count');
const themeToggleCheckbox = document.getElementById('theme-toggle-checkbox');
const backToListBtn = document.getElementById('back-to-list-btn');
const sidebar = document.querySelector('.sidebar');
const chatArea = document.querySelector('.chat-area');

// Login
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    try {
        const auth = btoa(`${username}:${password}`);
        const response = await fetch('/api/statistics', {
            headers: {
                'Authorization': `Basic ${auth}`
            }
        });

        if (response.ok) {
            currentAuth = auth;
            localStorage.setItem('panelAuth', auth);
            showMainApp();
            initializeApp();
            loginError.textContent = '';

            // Solicitar permisos de notificación
            if ('Notification' in window && Notification.permission === 'default') {
                Notification.requestPermission();
            }
        } else {
            loginError.textContent = 'Usuario o contraseña incorrectos';
        }
    } catch (error) {
        loginError.textContent = 'Error al conectar con el servidor';
        console.error('Error de login:', error);
    }
});

// Logout
function doLogout() {
    localStorage.removeItem('panelAuth');
    currentAuth = null;
    if (socket) {
        socket.disconnect();
    }
    clearInterval(autoRefreshInterval);
    showLoginScreen();
}

// Dropdown menu toggle
menuToggleBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdownMenu.classList.toggle('show');
});

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
    if (!menuToggleBtn.contains(e.target) && !dropdownMenu.contains(e.target)) {
        dropdownMenu.classList.remove('show');
    }
});

// ============================================
// THEME TOGGLE (Light/Dark Mode)
// ============================================
function initTheme() {
    // Cargar tema guardado o usar claro por defecto
    const savedTheme = localStorage.getItem('panelTheme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    themeToggleCheckbox.checked = savedTheme === 'dark';
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('panelTheme', newTheme);
    themeToggleCheckbox.checked = newTheme === 'dark';
}

// Event listener para el toggle
themeToggleCheckbox.addEventListener('change', toggleTheme);

// Inicializar tema al cargar
initTheme();

// Mostrar/ocultar pantallas
function showLoginScreen() {
    loginScreen.style.display = 'flex';
    mainApp.style.display = 'none';
}

function showMainApp() {
    loginScreen.style.display = 'none';
    mainApp.style.display = 'block';
}

// Inicializar aplicación
function initializeApp() {
    connectWebSocket();
    loadConversations();

    // Auto-refresh cada 10 segundos
    autoRefreshInterval = setInterval(() => {
        loadConversations();
    }, 10000);
}

// Función para reproducir sonido de notificación
function playNotificationSound() {
    // Crear un sonido usando Web Audio API
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = 800;
    oscillator.type = 'sine';

    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.5);
}

// WebSocket
function connectWebSocket() {
    socket = io();

    socket.on('connect', () => {
        console.log('✅ Conectado a WebSocket');
        connectionStatus.className = 'status-dot online';
        connectionText.textContent = 'Conectado';
    });

    socket.on('disconnect', () => {
        console.log('❌ Desconectado de WebSocket');
        connectionStatus.className = 'status-dot offline';
        connectionText.textContent = 'Desconectado';
    });

    socket.on('new_message', (data) => {
        console.log('📨 Nuevo mensaje recibido:', data);

        // NO notificar si es el botón "volver_menu" (después de finalizar conversación)
        const isVolverMenu = data.messageId === 'volver_menu';

        // Solo notificar si el mensaje es del cliente Y está en modo WITH_ADVISOR Y NO es volver_menu
        const shouldNotify = data.message.from === 'client' &&
                           (data.userState === 'WITH_ADVISOR' || data.userState === 'WAITING_ADVISOR_QUERY') &&
                           !isVolverMenu;

        if (shouldNotify) {
            // Reproducir sonido de notificación
            playNotificationSound();

            // Mostrar notificación del navegador si está permitido
            if ('Notification' in window && Notification.permission === 'granted') {
                new Notification('💬 Nuevo mensaje de cliente', {
                    body: `Consulta de ${data.phoneNumber}`,
                    icon: '/favicon.ico',
                    badge: '/favicon.ico'
                });
            }
        }

        // Actualizar estado del textarea si estamos viendo esta conversación
        if (currentConversation === data.phoneNumber) {
            updateTextareaState(data.isWithAdvisor);
            addMessageToChat(data.message);
        }

        loadConversations();
    });

    socket.on('message_sent', (data) => {
        console.log('✅ Mensaje enviado:', data);
        if (currentConversation === data.phoneNumber) {
            addMessageToChat(data.message);
        }
    });

    socket.on('conversation_archived', (data) => {
        console.log('🗄️ Conversación archivada:', data);
        loadConversations();
        if (currentConversation === data.phoneNumber) {
            currentConversation = null;
            showNoConversation();
        }
    });

    socket.on('advisor_mode_activated', (data) => {
        console.log('✅ Modo asesor activado:', data);
        // Habilitar textarea inmediatamente cuando se activa modo asesor
        if (currentConversation === data.phoneNumber && data.isWithAdvisor === true) {
            updateTextareaState(true);
        }
        loadConversations();
    });
}

// Cargar conversaciones
async function loadConversations() {
    try {
        const response = await fetch('/api/conversations', {
            headers: {
                'Authorization': `Basic ${currentAuth}`
            }
        });

        if (!response.ok) {
            throw new Error('Error al cargar conversaciones');
        }

        const data = await response.json();
        conversations = data.conversations || [];
        activeCount.textContent = conversations.length;

        renderConversations(conversations);
    } catch (error) {
        console.error('Error al cargar conversaciones:', error);
    }
}

// Renderizar lista de conversaciones
function renderConversations(convs) {
    if (convs.length === 0) {
        conversationList.innerHTML = '<div class="empty-state"><p>No hay conversaciones activas</p></div>';
        return;
    }

    conversationList.innerHTML = convs.map(conv => {
        const lastMsg = conv.lastMessage || {};
        const preview = lastMsg.text ? lastMsg.text.substring(0, 50) : 'Sin mensajes';
        const time = lastMsg.timestamp ? formatTime(new Date(lastMsg.timestamp)) : '';
        const isActive = currentConversation === conv.phoneNumber ? 'active' : '';
        const formattedPhone = formatPhoneNumber(conv.phoneNumber);

        return `
            <div class="conversation-item ${isActive}" onclick="selectConversation('${conv.phoneNumber}')">
                <div class="conversation-phone">${formattedPhone}</div>
                <div class="conversation-preview">${preview}${lastMsg.text && lastMsg.text.length > 50 ? '...' : ''}</div>
                <div class="conversation-meta">
                    <span>${conv.messageCount} mensajes</span>
                    <span>${time}</span>
                </div>
            </div>
        `;
    }).join('');
}

// Seleccionar conversación
window.selectConversation = function(phoneNumber) {
    currentConversation = phoneNumber;
    loadConversation(phoneNumber);
    renderConversations(conversations); // Re-render para actualizar clase active
};

// Cargar conversación completa
async function loadConversation(phoneNumber) {
    try {
        const response = await fetch(`/api/conversations/${phoneNumber}`, {
            headers: {
                'Authorization': `Basic ${currentAuth}`
            }
        });

        if (!response.ok) {
            throw new Error('Error al cargar conversación');
        }

        const data = await response.json();
        showConversation(data.conversation);
    } catch (error) {
        console.error('Error al cargar conversación:', error);
    }
}

// Actualizar estado del textarea (función separada para reutilizar)
function updateTextareaState(isWithAdvisor) {
    // Solo habilitar si explícitamente es true
    // undefined o false = disabled
    const enabled = isWithAdvisor === true;
    messageInput.disabled = !enabled;
    sendBtn.disabled = !enabled;

    if (!enabled) {
        messageInput.placeholder = '⚠️ El cliente no está en modo asesor. No puedes enviar mensajes.';
        messageInput.value = '';
    } else {
        messageInput.placeholder = 'Escribe un mensaje...';
    }
}

// Mostrar conversación
function showConversation(conversation) {
    noConversationSelected.style.display = 'none';
    chatContainer.style.display = 'flex';

    const formattedPhone = formatPhoneNumber(conversation.phoneNumber);
    document.getElementById('chat-phone-number').textContent = formattedPhone;

    messagesContainer.innerHTML = '';
    conversation.messages.forEach(msg => {
        addMessageToChat(msg);
    });

    // Habilitar/deshabilitar input según si el cliente está con asesor
    updateTextareaState(conversation.isWithAdvisor);

    // Responsive: En móvil, ocultar sidebar y mostrar chat
    if (window.innerWidth <= 768) {
        sidebar.classList.add('hidden-mobile');
        chatArea.classList.add('show-mobile');
    }

    scrollToBottom();
}

// Agregar mensaje al chat
function addMessageToChat(message) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${message.from}`;

    const textDiv = document.createElement('div');
    textDiv.className = 'message-text';
    textDiv.textContent = message.text || message.body || '(mensaje sin texto)';

    const timeDiv = document.createElement('div');
    timeDiv.className = 'message-time';
    timeDiv.textContent = formatTime(new Date(message.timestamp));

    messageDiv.appendChild(textDiv);
    messageDiv.appendChild(timeDiv);
    messagesContainer.appendChild(messageDiv);

    scrollToBottom();
}

// Mostrar sin conversación
function showNoConversation() {
    noConversationSelected.style.display = 'flex';
    chatContainer.style.display = 'none';
}

// Variable para prevenir envíos múltiples
let isSending = false;

// Enviar mensaje
sendBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

async function sendMessage() {
    const text = messageInput.value.trim();

    // Prevenir envíos múltiples
    if (!text || !currentConversation || isSending) {
        return;
    }

    // Marcar como enviando y deshabilitar controles
    isSending = true;
    sendBtn.disabled = true;
    messageInput.disabled = true;

    // Limpiar input ANTES de enviar para evitar re-envíos
    const messageToSend = text;
    messageInput.value = '';

    try {
        const response = await fetch('/api/send-message', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Basic ${currentAuth}`
            },
            body: JSON.stringify({
                phoneNumber: currentConversation,
                message: messageToSend
            })
        });

        if (!response.ok) {
            throw new Error('Error al enviar mensaje');
        }

        // NO agregar mensaje localmente - esperar evento WebSocket message_sent
        // para evitar duplicación

    } catch (error) {
        console.error('Error al enviar mensaje:', error);
        alert('Error al enviar mensaje');
        // Si hay error, restaurar el mensaje en el input
        messageInput.value = messageToSend;
    } finally {
        isSending = false;
        sendBtn.disabled = false;
        messageInput.disabled = false;
        messageInput.focus();
    }
}

// Finalizar conversación (sin archivar)
// Botón volver en móvil
backToListBtn.addEventListener('click', () => {
    // Ocultar chat y mostrar sidebar
    sidebar.classList.remove('hidden-mobile');
    chatArea.classList.remove('show-mobile');

    // Opcionalmente cerrar el chat
    chatContainer.style.display = 'none';
    noConversationSelected.style.display = 'flex';
    currentConversation = null;
});

finalizeBtn.addEventListener('click', async () => {
    if (!currentConversation) return;

    if (confirm(`¿Finalizar conversación con ${currentConversation}?\n\nEsto desconectará al cliente del modo asesor y le permitirá usar el bot nuevamente.`)) {
        try {
            const response = await fetch(`/api/conversations/${currentConversation}/finalize`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Basic ${currentAuth}`
                }
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Error al finalizar');
            }

            alert('Conversación finalizada correctamente.\n\nEl cliente puede usar el bot nuevamente.');

            // Deshabilitar input inmediatamente después de finalizar
            updateTextareaState(false);

            loadConversations();
        } catch (error) {
            console.error('Error al finalizar:', error);
            alert(error.message || 'Error al finalizar conversación');
        }
    }
});


// Promotions modal
window.openPromotionsModal = async function() {
    dropdownMenu.classList.remove('show');
    promotionsModal.classList.add('show');

    // Load current promotion
    try {
        const response = await fetch('/api/promotions', {
            headers: {
                'Authorization': `Basic ${currentAuth}`
            }
        });

        if (response.ok) {
            const data = await response.json();
            promoMessage.value = data.promotion.message || '';
            charCount.textContent = promoMessage.value.length;

            // Update info
            document.getElementById('promo-last-update').textContent =
                data.promotion.lastUpdated ? formatDate(new Date(data.promotion.lastUpdated)) : 'Nunca';
            document.getElementById('promo-updated-by').textContent =
                data.promotion.updatedBy || '-';
        }
    } catch (error) {
        console.error('Error al cargar promoción:', error);
    }
};

window.closePromotionsModal = function() {
    promotionsModal.classList.remove('show');
};

window.savePromotion = async function() {
    const message = promoMessage.value.trim();

    if (!message) {
        alert('Por favor ingresa un mensaje de promoción');
        return;
    }

    if (message.length > 4000) {
        alert(`Mensaje demasiado largo (${message.length} caracteres). Máximo 4000 caracteres.`);
        return;
    }

    try {
        const response = await fetch('/api/promotions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Basic ${currentAuth}`
            },
            body: JSON.stringify({ message })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Error al guardar');
        }

        alert('✅ Promoción actualizada correctamente');
        closePromotionsModal();
    } catch (error) {
        console.error('Error al guardar promoción:', error);
        alert('Error al guardar promoción: ' + error.message);
    }
};

// Character counter for promotion textarea
promoMessage.addEventListener('input', () => {
    charCount.textContent = promoMessage.value.length;
});


// Búsqueda
let searchTimeout = null;
searchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    const query = e.target.value.trim();

    if (!query) {
        renderConversations(conversations);
        return;
    }

    searchTimeout = setTimeout(() => {
        const filtered = conversations.filter(conv =>
            conv.phoneNumber.includes(query)
        );
        renderConversations(filtered);
    }, 300);
});


// Utilidades
function formatTime(date) {
    return date.toLocaleTimeString('es-CO', {
        hour: '2-digit',
        minute: '2-digit'
    });
}

function formatDate(date) {
    return date.toLocaleDateString('es-CO', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

/**
 * Formatea un número de teléfono con código de país
 * Detecta automáticamente el código de país y lo formatea con + y espacio
 * Ejemplos:
 *   573173745021 -> +57 317 374 5021
 *   15551234567  -> +1 555 123 4567
 */
function formatPhoneNumber(phoneNumber) {
    if (!phoneNumber) return phoneNumber;

    // Remover cualquier caracter que no sea número
    const cleaned = phoneNumber.toString().replace(/\D/g, '');

    // Detectar código de país y formatear
    // Colombia (+57) - 12 dígitos totales (57 + 10 dígitos)
    if (cleaned.startsWith('57') && cleaned.length === 12) {
        const countryCode = cleaned.substring(0, 2);
        const number = cleaned.substring(2);
        // Formato: +57 317 374 5021
        return `+${countryCode} ${number.substring(0, 3)} ${number.substring(3, 6)} ${number.substring(6)}`;
    }

    // Estados Unidos/Canadá (+1) - 11 dígitos totales (1 + 10 dígitos)
    if (cleaned.startsWith('1') && cleaned.length === 11) {
        const countryCode = cleaned.substring(0, 1);
        const number = cleaned.substring(1);
        // Formato: +1 555 123 4567
        return `+${countryCode} ${number.substring(0, 3)} ${number.substring(3, 6)} ${number.substring(6)}`;
    }

    // México (+52) - 12 dígitos totales (52 + 10 dígitos)
    if (cleaned.startsWith('52') && cleaned.length === 12) {
        const countryCode = cleaned.substring(0, 2);
        const number = cleaned.substring(2);
        // Formato: +52 55 1234 5678
        return `+${countryCode} ${number.substring(0, 2)} ${number.substring(2, 6)} ${number.substring(6)}`;
    }

    // Argentina (+54) - 12-13 dígitos
    if (cleaned.startsWith('54') && (cleaned.length === 12 || cleaned.length === 13)) {
        const countryCode = cleaned.substring(0, 2);
        const number = cleaned.substring(2);
        // Formato: +54 11 1234 5678
        return `+${countryCode} ${number.substring(0, 2)} ${number.substring(2, 6)} ${number.substring(6)}`;
    }

    // España (+34) - 11 dígitos totales (34 + 9 dígitos)
    if (cleaned.startsWith('34') && cleaned.length === 11) {
        const countryCode = cleaned.substring(0, 2);
        const number = cleaned.substring(2);
        // Formato: +34 612 345 678
        return `+${countryCode} ${number.substring(0, 3)} ${number.substring(3, 6)} ${number.substring(6)}`;
    }

    // Brasil (+55) - 12-13 dígitos
    if (cleaned.startsWith('55') && (cleaned.length === 12 || cleaned.length === 13)) {
        const countryCode = cleaned.substring(0, 2);
        const number = cleaned.substring(2);
        // Formato: +55 11 91234 5678
        return `+${countryCode} ${number.substring(0, 2)} ${number.substring(2, 7)} ${number.substring(7)}`;
    }

    // Chile (+56) - 11 dígitos totales (56 + 9 dígitos)
    if (cleaned.startsWith('56') && cleaned.length === 11) {
        const countryCode = cleaned.substring(0, 2);
        const number = cleaned.substring(2);
        // Formato: +56 9 1234 5678
        return `+${countryCode} ${number.substring(0, 1)} ${number.substring(1, 5)} ${number.substring(5)}`;
    }

    // Perú (+51) - 11 dígitos totales (51 + 9 dígitos)
    if (cleaned.startsWith('51') && cleaned.length === 11) {
        const countryCode = cleaned.substring(0, 2);
        const number = cleaned.substring(2);
        // Formato: +51 987 654 321
        return `+${countryCode} ${number.substring(0, 3)} ${number.substring(3, 6)} ${number.substring(6)}`;
    }

    // Formato genérico para otros países
    // Intentar detectar código de país (1-3 dígitos)
    if (cleaned.length > 10) {
        // Asumir código de país de 2 dígitos para números largos
        const countryCode = cleaned.substring(0, 2);
        const number = cleaned.substring(2);
        return `+${countryCode} ${number}`;
    }

    // Si no se detecta formato conocido, retornar con + al inicio
    return `+${cleaned}`;
}

function scrollToBottom() {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Auto-login si hay credenciales guardadas
window.addEventListener('load', () => {
    const savedAuth = localStorage.getItem('panelAuth');
    if (savedAuth) {
        currentAuth = savedAuth;
        fetch('/api/statistics', {
            headers: {
                'Authorization': `Basic ${savedAuth}`
            }
        }).then(response => {
            if (response.ok) {
                showMainApp();
                initializeApp();
            } else {
                localStorage.removeItem('panelAuth');
                showLoginScreen();
            }
        }).catch(() => {
            showLoginScreen();
        });
    } else {
        showLoginScreen();
    }
});
