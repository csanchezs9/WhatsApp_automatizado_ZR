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
const dbCount = document.getElementById('db-count');
const connectionStatus = document.getElementById('connection-status');
const connectionText = document.getElementById('connection-text');
const logoutBtn = document.getElementById('logout-btn');
const archiveBtn = document.getElementById('archive-btn');
const finalizeBtn = document.getElementById('finalize-btn');
const viewHistoryBtn = document.getElementById('view-history-btn');
const searchInput = document.getElementById('search-input');
const menuToggleBtn = document.getElementById('menu-toggle-btn');
const dropdownMenu = document.getElementById('dropdown-menu');
const promotionsModal = document.getElementById('promotions-modal');
const promoMessage = document.getElementById('promo-message');
const charCount = document.getElementById('char-count');

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
    loadStatistics();

    // Auto-refresh cada 10 segundos
    autoRefreshInterval = setInterval(() => {
        loadConversations();
        loadStatistics();
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

        // Reproducir sonido de notificación
        playNotificationSound();

        // Mostrar notificación del navegador si está permitido
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('💬 Nuevo mensaje', {
                body: `Mensaje de ${data.phoneNumber}`,
                icon: '/favicon.ico',
                badge: '/favicon.ico'
            });
        }

        loadConversations();
        if (currentConversation === data.phoneNumber) {
            loadConversation(data.phoneNumber);
        }
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

        return `
            <div class="conversation-item ${isActive}" onclick="selectConversation('${conv.phoneNumber}')">
                <div class="conversation-phone">${conv.phoneNumber}</div>
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

// Mostrar conversación
function showConversation(conversation) {
    noConversationSelected.style.display = 'none';
    chatContainer.style.display = 'flex';

    document.getElementById('chat-phone-number').textContent = conversation.phoneNumber;

    messagesContainer.innerHTML = '';
    conversation.messages.forEach(msg => {
        addMessageToChat(msg);
    });

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
    if (!text || !currentConversation) {
        return;
    }

    sendBtn.disabled = true;

    try {
        const response = await fetch('/api/send-message', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Basic ${currentAuth}`
            },
            body: JSON.stringify({
                phoneNumber: currentConversation,
                message: text
            })
        });

        if (!response.ok) {
            throw new Error('Error al enviar mensaje');
        }

        messageInput.value = '';

        // Agregar mensaje localmente (se actualizará con WebSocket)
        addMessageToChat({
            from: 'advisor',
            text: text,
            timestamp: new Date()
        });

    } catch (error) {
        console.error('Error al enviar mensaje:', error);
        alert('Error al enviar mensaje');
    } finally {
        sendBtn.disabled = false;
        messageInput.focus();
    }
}

// Finalizar conversación (sin archivar)
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
            loadConversations();
        } catch (error) {
            console.error('Error al finalizar:', error);
            alert(error.message || 'Error al finalizar conversación');
        }
    }
});

// Archivar conversación
archiveBtn.addEventListener('click', async () => {
    if (!currentConversation) return;

    const notes = prompt('Notas del asesor (opcional):');

    if (confirm(`¿Archivar conversación con ${currentConversation}?\n\nEsto finalizará y archivará la conversación.`)) {
        try {
            const response = await fetch(`/api/conversations/${currentConversation}/archive`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Basic ${currentAuth}`
                },
                body: JSON.stringify({ advisorNotes: notes })
            });

            if (!response.ok) {
                throw new Error('Error al archivar');
            }

            alert('Conversación archivada y finalizada correctamente');
            currentConversation = null;
            showNoConversation();
            loadConversations();
        } catch (error) {
            console.error('Error al archivar:', error);
            alert('Error al archivar conversación');
        }
    }
});

// Ver historial
viewHistoryBtn.addEventListener('click', async () => {
    if (!currentConversation) return;

    const modal = document.getElementById('history-modal');
    const historyContent = document.getElementById('history-content');

    modal.classList.add('show');
    historyContent.innerHTML = '<p class="loading">Cargando historial...</p>';

    try {
        const response = await fetch(`/api/conversations/${currentConversation}/history`, {
            headers: {
                'Authorization': `Basic ${currentAuth}`
            }
        });

        if (!response.ok) {
            throw new Error('Error al cargar historial');
        }

        const data = await response.json();

        if (data.history.length === 0) {
            historyContent.innerHTML = '<p class="empty-state">📭 No hay historial previo</p>';
            return;
        }

        historyContent.innerHTML = data.history.map(conv => `
            <div class="history-item">
                <div class="history-header">
                    <span>📅 ${formatDate(new Date(conv.startedAt))}</span>
                    <span>${conv.messages.length} mensajes</span>
                </div>
                <div class="history-messages">
                    ${conv.messages.slice(0, 5).map(msg => `
                        <div class="history-message">
                            <strong>${msg.from === 'client' ? 'Cliente' : msg.from === 'advisor' ? 'Asesor' : 'Bot'}:</strong>
                            ${msg.text || msg.body || '(sin texto)'}
                        </div>
                    `).join('')}
                    ${conv.messages.length > 5 ? '<p><em>... y más mensajes</em></p>' : ''}
                </div>
                ${conv.advisorNotes ? `<p><strong>Notas:</strong> ${conv.advisorNotes}</p>` : ''}
            </div>
        `).join('');

    } catch (error) {
        console.error('Error al cargar historial:', error);
        historyContent.innerHTML = '<p class="error-message">Error al cargar historial</p>';
    }
});

window.closeHistoryModal = function() {
    document.getElementById('history-modal').classList.remove('show');
};

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

// Show all history (general history view)
window.showAllHistory = function() {
    dropdownMenu.classList.remove('show');
    alert('Función de historial general en desarrollo');
    // TODO: Implement general history view showing all conversations history
};

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

// Cargar estadísticas
async function loadStatistics() {
    try {
        const response = await fetch('/api/statistics', {
            headers: {
                'Authorization': `Basic ${currentAuth}`
            }
        });

        if (!response.ok) return;

        const data = await response.json();
        dbCount.textContent = data.statistics.totalConversations;
    } catch (error) {
        console.error('Error al cargar estadísticas:', error);
    }
}

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
