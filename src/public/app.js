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
const labelsBtn = document.getElementById('labels-btn');
const searchInput = document.getElementById('search-input');
const menuToggleBtn = document.getElementById('menu-toggle-btn');
const dropdownMenu = document.getElementById('dropdown-menu');
const promotionsModal = document.getElementById('promotions-modal');
const promoMessage = document.getElementById('promo-message');
const charCount = document.getElementById('char-count');
const themeToggleCheckbox = document.getElementById('theme-toggle-checkbox');
const themeLabel = document.getElementById('theme-label');
const backToListBtn = document.getElementById('back-to-list-btn');
const sidebar = document.querySelector('.sidebar');
const chatArea = document.querySelector('.chat-area');
const attachBtn = document.getElementById('attach-btn');
const fileInput = document.getElementById('file-input');
const imagePreviewModal = document.getElementById('image-preview-modal');
const previewImage = document.getElementById('preview-image');
const imageCaption = document.getElementById('image-caption');
const captionCharCount = document.getElementById('caption-char-count');

// Variable temporal para guardar el archivo seleccionado
let pendingFile = null;
let pendingFileData = null;

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
function updateThemeLabel() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    // Si está en modo claro, el botón dice "Dark" (para cambiar a oscuro)
    // Si está en modo oscuro, el botón dice "Light" (para cambiar a claro)
    themeLabel.textContent = currentTheme === 'light' ? 'Dark' : 'Light';
}

function initTheme() {
    // Cargar tema guardado o usar claro por defecto
    const savedTheme = localStorage.getItem('panelTheme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    themeToggleCheckbox.checked = savedTheme === 'dark';
    updateThemeLabel();
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('panelTheme', newTheme);
    themeToggleCheckbox.checked = newTheme === 'dark';
    updateThemeLabel();
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

    socket.on('new_message', async (data) => {
        console.log('📨 Nuevo mensaje recibido:', data);

        // NO notificar si es el botón "volver_menu" (después de finalizar conversación)
        const isVolverMenu = data.messageId === 'volver_menu';

        // Verificar si estamos viendo esta conversación activamente
        const isViewingThisConversation = currentConversation === data.phoneNumber;

        // Solo notificar si el mensaje es del cliente Y está en modo WITH_ADVISOR Y NO es volver_menu
        // Y NO estamos viendo activamente esta conversación
        const shouldNotify = data.message.from === 'client' &&
                           (data.userState === 'WITH_ADVISOR' || data.userState === 'WAITING_ADVISOR_QUERY') &&
                           !isVolverMenu &&
                           !isViewingThisConversation;

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
        if (isViewingThisConversation) {
            // IMPORTANTE: Solo actualizar el estado del textarea si el campo isWithAdvisor está presente
            // Esto previene deshabilitar accidentalmente el textarea cuando se reciben mensajes multimedia
            if (data.hasOwnProperty('isWithAdvisor')) {
                updateTextareaState(data.isWithAdvisor);
            }
            addMessageToChat(data.message);

            // Marcar como leído inmediatamente (llamando al endpoint que marca como leído)
            try {
                await fetch(`/api/conversations/${data.phoneNumber}`, {
                    headers: { 'Authorization': `Basic ${currentAuth}` }
                });
            } catch (error) {
                console.error('Error al marcar conversación como leída:', error);
            }
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

    socket.on('conversation_deleted', (data) => {
        console.log('🗑️ Conversación eliminada:', data);
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

        // Generar preview según tipo de mensaje
        let preview = 'Sin mensajes';
        let needsEllipsis = false;

        if (lastMsg.text) {
            preview = lastMsg.text.substring(0, 50);
            needsEllipsis = lastMsg.text.length > 50;
        } else if (lastMsg.type === 'audio') {
            preview = '🎤 Audio';
        } else if (lastMsg.type === 'image') {
            preview = '📷 Imagen';
        } else if (lastMsg.type === 'document') {
            preview = '📄 Documento';
        } else if (lastMsg.type === 'interactive_buttons') {
            preview = '🔘 Botones interactivos';
        } else if (lastMsg.type === 'interactive_list') {
            preview = '📋 Lista interactiva';
        }

        const time = lastMsg.timestamp ? formatTime(new Date(lastMsg.timestamp)) : '';
        const isActive = currentConversation === conv.phoneNumber ? 'active' : '';
        const formattedPhone = formatPhoneNumber(conv.phoneNumber);

        // Badge de no leídos
        const unreadCount = conv.unreadCount || 0;
        const hasUnread = unreadCount > 0;
        const unreadBadge = hasUnread ? `<div class="unread-badge">${unreadCount}</div>` : '';
        const timeClass = hasUnread ? 'unread-time' : '';

        // Renderizar etiquetas de la conversación
        const labelsHTML = (conv.labels && conv.labels.length > 0)
            ? `<div class="conversation-labels">
                ${conv.labels.map(label =>
                    `<span class="conversation-label-tag" style="background: ${label.color};" title="${label.name}">${label.name}</span>`
                ).join('')}
              </div>`
            : '';

        return `
            <div class="conversation-item ${isActive}" onclick="selectConversation('${conv.phoneNumber}')">
                <div class="conversation-phone">${formattedPhone}</div>
                <div class="conversation-preview">${preview}${needsEllipsis ? '...' : ''}</div>
                <div class="conversation-meta">
                    <span>${conv.messageCount} mensajes</span>
                    <span class="${timeClass}">${time}</span>
                </div>
                ${labelsHTML}
                ${unreadBadge}
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

        // Recargar lista de conversaciones para actualizar badge de no leídos
        // (el backend marca como leído al abrir la conversación)
        loadConversations();
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
    attachBtn.disabled = !enabled;

    // Deshabilitar también el botón de voz
    const voiceBtn = document.getElementById('voice-btn');
    if (voiceBtn) {
        voiceBtn.disabled = !enabled;
        voiceBtn.style.opacity = enabled ? '1' : '0.5';
        voiceBtn.style.cursor = enabled ? 'pointer' : 'not-allowed';
    }

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

    // Manejar mensajes multimedia
    if (message.type === 'image') {
        const mediaDiv = document.createElement('div');
        mediaDiv.className = 'message-media';

        const img = document.createElement('img');
        img.className = 'message-image';

        // Extraer nombre de archivo de forma robusta
        const filename = message.mediaPath.includes('/')
            ? message.mediaPath.split('/').pop()
            : message.mediaPath;

        img.src = `/api/media/${filename}`;
        img.alt = 'Imagen';
        img.onclick = () => window.open(img.src, '_blank');

        // Debug: mostrar en consola si hay problema
        img.onerror = () => {
            console.error('❌ Error cargando imagen:', message.mediaPath, '-> URL:', img.src);
        };

        mediaDiv.appendChild(img);
        messageDiv.appendChild(mediaDiv);

        if (message.caption) {
            const captionDiv = document.createElement('div');
            captionDiv.className = 'message-caption';
            captionDiv.textContent = message.caption;
            messageDiv.appendChild(captionDiv);
        }
    } else if (message.type === 'document') {
        const mediaDiv = document.createElement('div');
        mediaDiv.className = 'message-media';

        // Extraer nombre de archivo de forma robusta
        const filename = message.mediaPath.includes('/')
            ? message.mediaPath.split('/').pop()
            : message.mediaPath;

        const docDiv = document.createElement('div');
        docDiv.className = 'message-document';
        docDiv.onclick = () => window.open(`/api/media/${filename}`, '_blank');

        const iconDiv = document.createElement('div');
        iconDiv.className = 'message-document-icon';
        iconDiv.textContent = '📄';

        const infoDiv = document.createElement('div');
        infoDiv.className = 'message-document-info';

        const nameDiv = document.createElement('div');
        nameDiv.className = 'message-document-name';
        nameDiv.textContent = message.filename || 'Documento';

        const sizeDiv = document.createElement('div');
        sizeDiv.className = 'message-document-size';
        sizeDiv.textContent = message.size ? formatFileSize(message.size) : '';

        infoDiv.appendChild(nameDiv);
        if (sizeDiv.textContent) {
            infoDiv.appendChild(sizeDiv);
        }

        docDiv.appendChild(iconDiv);
        docDiv.appendChild(infoDiv);
        mediaDiv.appendChild(docDiv);
        messageDiv.appendChild(mediaDiv);

        if (message.caption) {
            const captionDiv = document.createElement('div');
            captionDiv.className = 'message-caption';
            captionDiv.textContent = message.caption;
            messageDiv.appendChild(captionDiv);
        }
    } else if (message.type === 'audio') {
        const mediaDiv = document.createElement('div');
        mediaDiv.className = 'message-media';

        const audioDiv = document.createElement('div');
        audioDiv.className = 'message-audio';

        // Ícono de bot para audio
        const iconDiv = document.createElement('div');
        iconDiv.className = 'message-audio-icon';
        iconDiv.innerHTML = `<img src="/audiobot.jpg" alt="Audio" class="audio-bot-icon">`;

        // Extraer nombre de archivo de forma robusta
        const filename = message.mediaPath.includes('/')
            ? message.mediaPath.split('/').pop()
            : message.mediaPath;

        const audioPlayer = document.createElement('audio');
        audioPlayer.className = 'message-audio-player';
        audioPlayer.controls = true;
        audioPlayer.controlsList = 'nodownload';
        audioPlayer.src = `/api/media/${filename}`;

        // Debug: mostrar en consola si hay problema
        audioPlayer.onerror = () => {
            console.error('❌ Error cargando audio:', message.mediaPath, '-> URL:', audioPlayer.src);
        };

        audioDiv.appendChild(iconDiv);
        audioDiv.appendChild(audioPlayer);
        mediaDiv.appendChild(audioDiv);
        messageDiv.appendChild(mediaDiv);

        if (message.caption) {
            const captionDiv = document.createElement('div');
            captionDiv.className = 'message-caption';
            captionDiv.textContent = message.caption;
            messageDiv.appendChild(captionDiv);
        }
    } else {
        // Mensaje de texto normal
        const textDiv = document.createElement('div');
        textDiv.className = 'message-text';
        textDiv.textContent = message.text || message.body || '(mensaje sin texto)';
        messageDiv.appendChild(textDiv);
    }

    const timeDiv = document.createElement('div');
    timeDiv.className = 'message-time';
    timeDiv.textContent = formatTime(new Date(message.timestamp));

    messageDiv.appendChild(timeDiv);
    messagesContainer.appendChild(messageDiv);

    scrollToBottom();
}

// Formatear tamaño de archivo
function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
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

// Manejar adjuntar archivos
attachBtn.addEventListener('click', () => {
    if (!currentConversation) return;
    fileInput.click();
});

fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file || !currentConversation) return;

    // Validar tamaño (16MB max)
    if (file.size > 16 * 1024 * 1024) {
        alert('El archivo es demasiado grande. Máximo 16MB.');
        fileInput.value = '';
        return;
    }

    // Guardar archivo temporalmente
    pendingFile = file;

    // Si es imagen, mostrar preview con imagen
    if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
            previewImage.src = e.target.result;
            previewImage.style.display = 'block';
            document.querySelector('.file-preview-info').style.display = 'none';
            imageCaption.value = '';
            captionCharCount.textContent = '0';
            imagePreviewModal.classList.add('show');
        };
        reader.readAsDataURL(file);
    } else {
        // Si es documento, mostrar preview con información del archivo
        previewImage.style.display = 'none';
        const fileInfoDiv = document.querySelector('.file-preview-info');
        fileInfoDiv.style.display = 'block';

        // Mostrar icono según tipo de archivo
        let fileIcon = '📄';
        if (file.type.includes('pdf')) fileIcon = '📕';
        else if (file.type.includes('word')) fileIcon = '📘';
        else if (file.type.includes('excel') || file.type.includes('spreadsheet')) fileIcon = '📊';
        else if (file.type.includes('text')) fileIcon = '📝';

        document.getElementById('file-preview-icon').textContent = fileIcon;
        document.getElementById('file-preview-name').textContent = file.name;
        document.getElementById('file-preview-size').textContent = formatFileSize(file.size);

        imageCaption.value = '';
        captionCharCount.textContent = '0';
        imagePreviewModal.classList.add('show');
    }

    // Limpiar input para permitir seleccionar el mismo archivo de nuevo
    fileInput.value = '';
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
            const errorData = await response.json().catch(() => ({}));

            // Mensajes de error específicos
            if (response.status === 403) {
                alert('⚠️ No se puede enviar mensaje.\n\nEl cliente no está en modo asesor. Debe seleccionar "Hablar con asesor" primero desde el menú de WhatsApp.');
            } else {
                alert(`❌ Error al enviar mensaje: ${errorData.error || 'Error desconocido'}`);
            }

            // Restaurar el mensaje en el input
            messageInput.value = messageToSend;
            return; // Salir sin continuar
        }

        // NO agregar mensaje localmente - esperar evento WebSocket message_sent
        // para evitar duplicación

    } catch (error) {
        console.error('Error al enviar mensaje:', error);
        alert(`❌ Error al enviar mensaje:\n\n${error.message}`);
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

// Botón de etiquetas en header del chat
labelsBtn.addEventListener('click', async () => {
    if (!currentConversation) {
        await showCustomAlert('Sin conversación', 'Por favor selecciona una conversación primero', '', 'warning');
        return;
    }
    openConversationLabelsModal(currentConversation);
});

finalizeBtn.addEventListener('click', async () => {
    if (!currentConversation) return;

    const formattedPhone = formatPhoneNumber(currentConversation);

    const confirmed = await showCustomConfirm(
        'Finalizar Conversación',
        `¿Deseas finalizar la conversación con ${formattedPhone}?`,
        'El cliente será desconectado del modo asesor y podrá usar el bot automático nuevamente. La conversación permanecerá visible en el panel.',
        'Finalizar',
        'Cancelar'
    );

    if (!confirmed) return;

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

        await showCustomAlert(
            'Conversación Finalizada',
            `La conversación con ${formattedPhone} ha sido finalizada exitosamente.`,
            'El cliente puede usar el bot nuevamente.',
            'success'
        );

        // Deshabilitar input inmediatamente después de finalizar
        updateTextareaState(false);

        loadConversations();
    } catch (error) {
        console.error('Error al finalizar:', error);
        await showCustomAlert(
            'Error',
            'No se pudo finalizar la conversación',
            error.message || 'Ocurrió un error inesperado. Intenta nuevamente.',
            'error'
        );
    }
});

// Delete conversation
const deleteBtn = document.getElementById('delete-btn');
deleteBtn.addEventListener('click', async () => {
    if (!currentConversation) return;

    const formattedPhone = formatPhoneNumber(currentConversation);

    const confirmed = await showCustomConfirm(
        'Eliminar Conversación',
        `¿Estás seguro de eliminar PERMANENTEMENTE la conversación con ${formattedPhone}?`,
        'Esta acción NO se puede deshacer. Se eliminará toda la conversación de la base de datos y todos los archivos multimedia asociados. El cliente NO recibirá ninguna notificación.',
        'Eliminar',
        'Cancelar',
        true, // isDangerous
        'ELIMINAR' // requireText - debe escribir "ELIMINAR" para confirmar
    );

    if (!confirmed) return;

    try {
        const response = await fetch(`/api/conversations/${currentConversation}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Basic ${currentAuth}`
            }
        });

        if (!response.ok) {
            let errorMessage = 'Error al eliminar';
            try {
                const error = await response.json();
                errorMessage = error.error || errorMessage;
            } catch (parseError) {
                // Si no es JSON, obtener el texto plano
                const errorText = await response.text();
                console.error('Error response (not JSON):', errorText);
                errorMessage = `Error ${response.status}: ${response.statusText}`;
            }
            throw new Error(errorMessage);
        }

        let result;
        try {
            result = await response.json();
        } catch (parseError) {
            console.error('Error parsing success response:', parseError);
            throw new Error('Error al procesar la respuesta del servidor');
        }

        await showCustomAlert(
            'Conversación Eliminada',
            `La conversación con ${formattedPhone} ha sido eliminada permanentemente.`,
            `Se eliminaron ${result.messageCount || 0} mensajes y ${result.deletedFiles || 0} archivos multimedia.`,
            'success'
        );

        // Cerrar chat y volver a la lista
        currentConversation = null;
        chatContainer.style.display = 'none';
        noConversationSelected.style.display = 'flex';

        loadConversations();
    } catch (error) {
        console.error('Error al eliminar:', error);
        await showCustomAlert(
            'Error',
            'No se pudo eliminar la conversación',
            error.message || 'Ocurrió un error inesperado. Intenta nuevamente.',
            'error'
        );
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
        await showCustomAlert(
            'Campo vacío',
            'Por favor ingresa un mensaje de promoción',
            'El mensaje promocional no puede estar vacío.',
            'warning'
        );
        return;
    }

    if (message.length > 4000) {
        await showCustomAlert(
            'Mensaje muy largo',
            `El mensaje tiene ${message.length} caracteres`,
            'El máximo permitido es 4000 caracteres. Por favor, acorta el mensaje.',
            'warning'
        );
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

        await showCustomAlert(
            '¡Éxito!',
            'Promoción actualizada correctamente',
            'El mensaje promocional ha sido guardado y estará disponible en el menú de WhatsApp.',
            'success'
        );
        closePromotionsModal();
    } catch (error) {
        console.error('Error al guardar promoción:', error);
        await showCustomAlert(
            'Error al guardar',
            'No se pudo actualizar la promoción',
            `Detalles: ${error.message}`,
            'error'
        );
    }
};

// Character counter for promotion textarea
promoMessage.addEventListener('input', () => {
    charCount.textContent = promoMessage.value.length;
});

// Character counter for image caption
imageCaption.addEventListener('input', () => {
    captionCharCount.textContent = imageCaption.value.length;
});

// ============================================
// SYSTEM INFO MODAL
// ============================================

window.openSystemInfoModal = async function() {
    dropdownMenu.classList.remove('show');
    const modal = document.getElementById('system-info-modal');
    modal.classList.add('show');
    await loadSystemInfo();
};

window.closeSystemInfoModal = function() {
    const modal = document.getElementById('system-info-modal');
    modal.classList.remove('show');
};

window.refreshSystemInfo = async function() {
    await loadSystemInfo();
};

async function loadSystemInfo() {
    const diskUsageInfo = document.getElementById('disk-usage-info');
    const generalStatsInfo = document.getElementById('general-stats-info');
    const heavyConversationsInfo = document.getElementById('heavy-conversations-info');

    // Mostrar loading
    diskUsageInfo.innerHTML = '<p class="loading">Cargando...</p>';
    generalStatsInfo.innerHTML = '<p class="loading">Cargando...</p>';
    heavyConversationsInfo.innerHTML = '<p class="loading">Cargando...</p>';

    try {
        const response = await fetch('/api/system-info', {
            headers: {
                'Authorization': `Basic ${currentAuth}`
            }
        });

        if (!response.ok) {
            throw new Error('Error al cargar información del sistema');
        }

        const data = await response.json();
        const info = data.systemInfo;

        // 1. DISK USAGE
        const diskPercentage = parseFloat(info.diskUsage.usagePercentage || 0);
        const totalSizeMB = parseFloat(info.diskUsage.totalSizeMB);
        const dbSizeMB = parseFloat(info.diskUsage.dbSizeMB);
        const mediaSizeMB = parseFloat(info.diskUsage.mediaSizeMB);

        let barClass = '';
        let alertHtml = '';

        if (diskPercentage > 90) {
            barClass = 'danger';
            alertHtml = '<div class="alert-box"><p>⚠️ <strong>Advertencia:</strong> El disco está casi lleno. Considera eliminar conversaciones pesadas.</p></div>';
        } else if (diskPercentage > 75) {
            barClass = 'warning';
            alertHtml = '<div class="alert-box warning"><p>⚠️ Espacio en disco por encima del 75%. Revisa las conversaciones pesadas.</p></div>';
        } else {
            alertHtml = '<div class="alert-box info"><p>✅ Espacio en disco en niveles normales.</p></div>';
        }

        diskUsageInfo.innerHTML = `
            ${alertHtml}
            <div class="disk-stats-grid">
                <div class="disk-stat-item">
                    <div class="disk-stat-label">Total Usado</div>
                    <div class="disk-stat-value">${totalSizeMB} MB</div>
                </div>
                <div class="disk-stat-item">
                    <div class="disk-stat-label">Base de Datos</div>
                    <div class="disk-stat-value">${dbSizeMB} MB</div>
                </div>
                <div class="disk-stat-item">
                    <div class="disk-stat-label">Archivos Multimedia</div>
                    <div class="disk-stat-value">${mediaSizeMB} MB</div>
                </div>
                <div class="disk-stat-item">
                    <div class="disk-stat-label">Total de Archivos</div>
                    <div class="disk-stat-value">${info.diskUsage.mediaFileCount}</div>
                </div>
            </div>
        `;

        // 2. GENERAL STATS
        generalStatsInfo.innerHTML = `
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-card-label">Total Conversaciones</div>
                    <div class="stat-card-value">${info.statistics.totalConversations}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-card-label">Últimos 7 días</div>
                    <div class="stat-card-value">${info.statistics.last7Days}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-card-label">Activas en Memoria</div>
                    <div class="stat-card-value">${info.statistics.activeInMemory}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-card-label">Archivos Multimedia</div>
                    <div class="stat-card-value">${info.statistics.totalMediaFiles}</div>
                </div>
            </div>
        `;

        // 3. HEAVY CONVERSATIONS
        if (info.heavyConversations.length === 0) {
            heavyConversationsInfo.innerHTML = '<p class="modal-description">No hay conversaciones pesadas en este momento.</p>';
        } else {
            const conversationsHtml = info.heavyConversations.map(conv => `
                <div class="heavy-conversation-item">
                    <div class="heavy-conversation-info">
                        <div class="heavy-conversation-phone">${conv.phoneNumber}</div>
                        <div class="heavy-conversation-details">
                            ${conv.messageCount} mensajes • ${conv.mediaCount} archivos multimedia
                        </div>
                    </div>
                    <div class="heavy-conversation-size">${conv.totalSizeMB} MB</div>
                </div>
            `).join('');

            // Envolver en contenedor con scroll
            heavyConversationsInfo.innerHTML = `<div class="heavy-conversations-container">${conversationsHtml}</div>`;
        }

    } catch (error) {
        console.error('Error al cargar información del sistema:', error);
        diskUsageInfo.innerHTML = '<p class="modal-description" style="color: #ef4444;">Error al cargar información del disco</p>';
        generalStatsInfo.innerHTML = '<p class="modal-description" style="color: #ef4444;">Error al cargar estadísticas</p>';
        heavyConversationsInfo.innerHTML = '<p class="modal-description" style="color: #ef4444;">Error al cargar conversaciones</p>';
    }
}

// Funciones para el modal de preview de imagen
window.closeImagePreviewModal = function() {
    imagePreviewModal.classList.remove('show');
    pendingFile = null;
    pendingFileData = null;
    previewImage.src = '';
    imageCaption.value = '';
};

window.confirmSendImage = async function() {
    if (!pendingFile || !currentConversation) {
        closeImagePreviewModal();
        return;
    }

    // IMPORTANTE: Guardar referencia al archivo ANTES de cerrar el modal
    // porque closeImagePreviewModal() limpia pendingFile
    const fileToSend = pendingFile;
    const caption = imageCaption.value.trim();

    // Cerrar modal y deshabilitar botón
    closeImagePreviewModal();
    attachBtn.disabled = true;

    try {
        await sendFileImmediately(fileToSend, caption);
    } catch (error) {
        console.error('Error al enviar imagen:', error);
        // El error ya se mostró en sendFileImmediately, no mostrar alert duplicado
    } finally {
        attachBtn.disabled = false;
    }
};

// ============================================
// FILE UPLOAD LOADER
// ============================================

// Variable global para controlar el progreso
let currentProgress = 0;
let progressInterval = null;

function showFileLoader(filename, filesize) {
    const loader = document.getElementById('file-upload-loader');
    const loaderTitle = document.getElementById('loader-title');
    const loaderDescription = document.getElementById('loader-description');
    const loaderFileInfo = document.getElementById('loader-file-info');
    const progressFill = document.getElementById('loader-progress-fill');
    const progressText = document.getElementById('loader-progress-text');

    // Formatear tamaño del archivo
    const sizeMB = (filesize / (1024 * 1024)).toFixed(2);

    loaderTitle.textContent = 'Subiendo archivo...';
    loaderDescription.textContent = 'Por favor espera, esto puede tomar unos segundos';
    loaderFileInfo.textContent = `${filename} (${sizeMB} MB)`;

    // Resetear progreso
    currentProgress = 0;
    progressFill.style.width = '0%';
    progressText.textContent = '0%';

    loader.style.display = 'flex';

    // Limpiar intervalo anterior si existe
    if (progressInterval) clearInterval(progressInterval);

    // Simular progreso lineal y suave - FASE 1: Subida (0% -> 70%)
    progressInterval = setInterval(() => {
        if (currentProgress < 70) {
            // Incremento constante hasta 70%
            currentProgress += 2;
            if (currentProgress > 70) currentProgress = 70;

            progressFill.style.width = `${currentProgress}%`;
            progressText.textContent = `${Math.floor(currentProgress)}%`;
        }
    }, 150);

    return progressInterval;
}

function updateLoaderStatus(title, description) {
    const loaderTitle = document.getElementById('loader-title');
    const loaderDescription = document.getElementById('loader-description');
    const progressFill = document.getElementById('loader-progress-fill');
    const progressText = document.getElementById('loader-progress-text');

    loaderTitle.textContent = title;
    loaderDescription.textContent = description;

    // Limpiar intervalo anterior
    if (progressInterval) clearInterval(progressInterval);

    // FASE 2: Enviando a WhatsApp (70% -> 95%) - MÁS LENTO
    progressInterval = setInterval(() => {
        if (currentProgress < 95) {
            currentProgress += 0.5; // Muy lento
            if (currentProgress > 95) currentProgress = 95;

            progressFill.style.width = `${currentProgress}%`;
            progressText.textContent = `${Math.floor(currentProgress)}%`;
        } else {
            clearInterval(progressInterval);
        }
    }, 150);
}

function completeLoader() {
    const progressFill = document.getElementById('loader-progress-fill');
    const progressText = document.getElementById('loader-progress-text');
    const loaderTitle = document.getElementById('loader-title');

    loaderTitle.textContent = 'Archivo enviado';

    // Limpiar intervalo anterior
    if (progressInterval) clearInterval(progressInterval);

    // FASE 3: Completar (95% -> 100%) - RÁPIDO
    progressInterval = setInterval(() => {
        if (currentProgress < 100) {
            currentProgress += 2;
            if (currentProgress > 100) currentProgress = 100;

            progressFill.style.width = `${currentProgress}%`;
            progressText.textContent = `${Math.floor(currentProgress)}%`;
        } else {
            clearInterval(progressInterval);
        }
    }, 50);
}

function hideFileLoader() {
    // Limpiar intervalo
    if (progressInterval) {
        clearInterval(progressInterval);
        progressInterval = null;
    }

    const loader = document.getElementById('file-upload-loader');
    setTimeout(() => {
        loader.style.display = 'none';
        currentProgress = 0; // Reset para la próxima vez
    }, 800);
}

// Función auxiliar para enviar archivos
async function sendFileImmediately(file, caption = '') {
    // Usar la variable global progressInterval

    try {
        attachBtn.disabled = true;

        console.log('📤 Iniciando upload:', { name: file.name, size: file.size, type: file.type });

        // Mostrar loader
        progressInterval = showFileLoader(file.name, file.size);

        const formData = new FormData();
        formData.append('file', file);
        formData.append('phoneNumber', currentConversation);

        // Upload file
        const uploadResponse = await fetch('/api/upload-media', {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${currentAuth}`
            },
            body: formData
        });

        if (!uploadResponse.ok) {
            const uploadError = await uploadResponse.json().catch(() => ({}));
            const uploadMsg = uploadError.error || 'Error desconocido al subir';
            throw new Error(`Error al subir archivo: ${uploadMsg}`);
        }

        const uploadData = await uploadResponse.json();
        console.log('✅ Upload exitoso:', uploadData);

        // Actualizar loader: enviando a WhatsApp
        updateLoaderStatus('Enviando a WhatsApp...', 'El archivo se está enviando al cliente');

        // Send file to WhatsApp
        const sendResponse = await fetch('/api/send-media', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Basic ${currentAuth}`
            },
            body: JSON.stringify({
                phoneNumber: currentConversation,
                mediaPath: uploadData.mediaPath,
                mimeType: uploadData.mimeType,
                filename: file.name,
                caption: caption || undefined
            })
        });

        if (!sendResponse.ok) {
            const errorData = await sendResponse.json().catch(() => ({}));

            // Cerrar loader antes de mostrar error
            hideFileLoader();

            // Mensajes de error específicos
            if (sendResponse.status === 403) {
                alert('⚠️ No se puede enviar archivo.\n\nEl cliente no está en modo asesor. Debe seleccionar "Hablar con asesor" primero desde el menú de WhatsApp.');
            } else {
                const errorMsg = errorData.details || errorData.error || 'Error desconocido';
                alert(`❌ Error al enviar archivo:\n\n${errorMsg}`);
            }

            throw new Error(`Error al enviar archivo: ${errorData.error || 'Error desconocido'}`);
        }

        console.log('✅ Archivo enviado correctamente');

        // Completar loader
        completeLoader();

        // Ocultar loader después de 800ms
        setTimeout(() => {
            hideFileLoader();
        }, 800);
    } catch (error) {
        console.error('❌ Error enviando archivo:', error);
        console.error('Detalles:', {
            file: file?.name,
            size: file?.size,
            type: file?.type,
            caption: caption
        });

        // Asegurarse de cerrar el loader
        if (progressInterval) {
            hideFileLoader();
        }

        // No volver a mostrar alert aquí si ya se mostró arriba
        if (!error.message.includes('Error al enviar archivo')) {
            alert(`❌ Error:\n\n${error.message}`);
        }

        throw error;
    } finally {
        attachBtn.disabled = false;
    }
}


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

// ============================================
// CUSTOM MODALS (Alertas y confirmaciones profesionales)
// ============================================

/**
 * Muestra un modal de confirmación personalizado
 * @param {string} title - Título del modal
 * @param {string} message - Mensaje principal
 * @param {string} description - Descripción adicional
 * @param {string} confirmText - Texto del botón confirmar
 * @param {string} cancelText - Texto del botón cancelar
 * @param {boolean} isDangerous - Si es una acción peligrosa (rojo)
 * @param {string} requireText - Texto que debe escribir el usuario para confirmar (opcional)
 * @returns {boolean} true si confirma, false si cancela
 */
function showCustomConfirm(title, message, description, confirmText, cancelText, isDangerous = false, requireText = null) {
    return new Promise((resolve) => {
        // Crear overlay
        const overlay = document.createElement('div');
        overlay.className = 'custom-modal-overlay';

        // Crear modal
        const modal = document.createElement('div');
        modal.className = 'custom-modal';

        // Si se requiere texto de confirmación, agregar input
        const confirmInputHtml = requireText ? `
            <div class="custom-modal-confirm-input-container">
                <label class="custom-modal-confirm-label">
                    Para confirmar, escribe <strong>${requireText}</strong> a continuación:
                </label>
                <input
                    type="text"
                    id="custom-confirm-input"
                    class="custom-modal-confirm-input"
                    placeholder="Escribe ${requireText} aquí"
                    autocomplete="off"
                >
                <p class="custom-modal-confirm-hint" id="confirm-hint" style="display: none;">
                    Debes escribir exactamente "${requireText}"
                </p>
            </div>
        ` : '';

        modal.innerHTML = `
            <div class="custom-modal-header">
                <h3>${title}</h3>
            </div>
            <div class="custom-modal-body">
                <p class="custom-modal-message">${message}</p>
                <p class="custom-modal-description">${description}</p>
                ${confirmInputHtml}
            </div>
            <div class="custom-modal-footer">
                <button class="custom-modal-btn custom-modal-btn-secondary" id="custom-cancel">${cancelText}</button>
                <button class="custom-modal-btn custom-modal-btn-${isDangerous ? 'danger' : 'primary'}" id="custom-confirm" ${requireText ? 'disabled' : ''}>${confirmText}</button>
            </div>
        `;

        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        // Animar entrada
        setTimeout(() => {
            overlay.classList.add('show');
            if (requireText) {
                // Enfocar el input después de la animación
                setTimeout(() => {
                    document.getElementById('custom-confirm-input')?.focus();
                }, 100);
            }
        }, 10);

        // Si se requiere texto, validar input
        if (requireText) {
            const input = document.getElementById('custom-confirm-input');
            const confirmBtn = document.getElementById('custom-confirm');
            const hint = document.getElementById('confirm-hint');

            input.addEventListener('input', (e) => {
                const value = e.target.value.trim().toUpperCase(); // Convertir a mayúsculas para comparar

                if (value === requireText) {
                    confirmBtn.disabled = false;
                    input.classList.remove('invalid');
                    input.classList.add('valid');
                    hint.style.display = 'none';
                } else {
                    confirmBtn.disabled = true;
                    input.classList.remove('valid');
                    if (value.length > 0) {
                        input.classList.add('invalid');
                        hint.style.display = 'block';
                    } else {
                        input.classList.remove('invalid');
                        hint.style.display = 'none';
                    }
                }
            });

            // Permitir confirmar con Enter si el texto es correcto
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !confirmBtn.disabled) {
                    confirmBtn.click();
                }
            });
        }

        // Event listeners
        const handleConfirm = () => {
            overlay.classList.remove('show');
            setTimeout(() => overlay.remove(), 200);
            resolve(true);
        };

        const handleCancel = () => {
            overlay.classList.remove('show');
            setTimeout(() => overlay.remove(), 200);
            resolve(false);
        };

        document.getElementById('custom-confirm').addEventListener('click', handleConfirm);
        document.getElementById('custom-cancel').addEventListener('click', handleCancel);
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) handleCancel();
        });
    });
}

/**
 * Muestra un modal de alerta personalizado
 * @param {string} title - Título del modal
 * @param {string} message - Mensaje principal
 * @param {string} description - Descripción adicional
 * @param {string} type - Tipo de alerta: 'success', 'error', 'warning', 'info'
 */
function showCustomAlert(title, message, description, type = 'info') {
    return new Promise((resolve) => {
        // Iconos según tipo
        const icons = {
            success: '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>',
            error: '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>',
            warning: '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>',
            info: '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>'
        };

        // Crear overlay
        const overlay = document.createElement('div');
        overlay.className = 'custom-modal-overlay';

        // Crear modal
        const modal = document.createElement('div');
        modal.className = 'custom-modal custom-modal-alert';
        modal.innerHTML = `
            <div class="custom-modal-icon">${icons[type] || icons.info}</div>
            <div class="custom-modal-header">
                <h3>${title}</h3>
            </div>
            <div class="custom-modal-body">
                <p class="custom-modal-message">${message}</p>
                <p class="custom-modal-description">${description}</p>
            </div>
            <div class="custom-modal-footer">
                <button class="custom-modal-btn custom-modal-btn-primary" id="custom-ok">Entendido</button>
            </div>
        `;

        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        // Animar entrada
        setTimeout(() => {
            overlay.classList.add('show');
        }, 10);

        // Event listeners
        const handleClose = () => {
            overlay.classList.remove('show');
            setTimeout(() => overlay.remove(), 200);
            resolve();
        };

        document.getElementById('custom-ok').addEventListener('click', handleClose);
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) handleClose();
        });
    });
}

// ============================================
// VOICE RECORDING
// ============================================

let mediaRecorder = null;
let audioChunks = [];
let recordingTimer = null;
let recordingStartTime = 0;
let recordedAudioBlob = null;

const voiceBtn = document.getElementById('voice-btn');
const voiceModal = document.getElementById('voice-modal');
const voiceStopBtn = document.getElementById('voice-stop-btn');
const voiceSendBtn = document.getElementById('voice-send-btn');
const voiceTimer = document.getElementById('voice-timer');
const voiceRecordingView = document.getElementById('voice-recording-view');
const voicePreviewView = document.getElementById('voice-preview-view');
const voicePreviewPlayer = document.getElementById('voice-preview-player');
const voicePreviewDuration = document.getElementById('voice-preview-duration');

voiceBtn.addEventListener('click', async () => {
    if (!currentConversation) {
        alert('Selecciona una conversación primero');
        return;
    }

    // Validar que esté habilitado (modo asesor)
    if (voiceBtn.disabled) {
        alert('⚠️ No se puede grabar audio.\n\nEl cliente no está en modo asesor. Debe seleccionar "Hablar con asesor" primero desde el menú de WhatsApp.');
        return;
    }

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        startRecording(stream);
        voiceModal.classList.add('show');
    } catch (error) {
        console.error('Error al acceder al micrófono:', error);
        alert('No se pudo acceder al micrófono. Verifica los permisos del navegador.');
    }
});

function startRecording(stream) {
    audioChunks = [];
    recordedAudioBlob = null;

    // Configurar MediaRecorder
    // Usar codecs soportados por WhatsApp Business API
    let mimeType;
    if (MediaRecorder.isTypeSupported('audio/ogg; codecs=opus')) {
        mimeType = 'audio/ogg; codecs=opus';
    } else if (MediaRecorder.isTypeSupported('audio/webm; codecs=opus')) {
        mimeType = 'audio/webm; codecs=opus';
    } else if (MediaRecorder.isTypeSupported('audio/webm')) {
        mimeType = 'audio/webm';
    } else {
        mimeType = 'audio/ogg';
    }

    console.log('🎤 Grabando con formato:', mimeType);
    mediaRecorder = new MediaRecorder(stream, { mimeType });

    mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
            audioChunks.push(event.data);
        }
    };

    mediaRecorder.onstop = () => {
        const mimeType = mediaRecorder.mimeType;
        recordedAudioBlob = new Blob(audioChunks, { type: mimeType });

        // Detener el stream
        stream.getTracks().forEach(track => track.stop());

        // Mostrar preview
        showVoicePreview(recordedAudioBlob);
    };

    // Iniciar grabación
    mediaRecorder.start();
    recordingStartTime = Date.now();

    // Mostrar vista de grabación
    voiceRecordingView.style.display = 'block';
    voicePreviewView.style.display = 'none';
    voiceStopBtn.style.display = 'inline-block';
    voiceSendBtn.style.display = 'none';

    // Iniciar timer
    recordingTimer = setInterval(() => {
        const elapsed = Math.floor((Date.now() - recordingStartTime) / 1000);
        const minutes = Math.floor(elapsed / 60);
        const seconds = elapsed % 60;
        voiceTimer.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

        // Límite de 2 minutos
        if (elapsed >= 120) {
            stopRecording();
        }
    }, 100);
}

window.stopRecording = function() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
        clearInterval(recordingTimer);
    }
};

function showVoicePreview(blob) {
    const url = URL.createObjectURL(blob);
    voicePreviewPlayer.src = url;

    // Calcular duración
    const elapsed = Math.floor((Date.now() - recordingStartTime) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    voicePreviewDuration.textContent = `Duración: ${minutes}:${String(seconds).padStart(2, '0')}`;

    // Cambiar vista
    voiceRecordingView.style.display = 'none';
    voicePreviewView.style.display = 'block';
    voiceStopBtn.style.display = 'none';
    voiceSendBtn.style.display = 'inline-block';
}

window.sendVoiceMessage = async function() {
    if (!recordedAudioBlob || !currentConversation) {
        console.error('❌ No hay audio grabado o conversación seleccionada');
        return;
    }

    // IMPORTANTE: Guardar referencias ANTES de cerrar el modal
    const audioToSend = recordedAudioBlob;
    const audioSize = recordedAudioBlob.size;

    // Determinar extensión correcta basada en el mimeType del blob
    // WhatsApp acepta: .ogg (opus), .mp3, .m4a, .aac
    // Forzar .ogg para compatibilidad
    const extension = 'ogg';
    const filename = `audio_${Date.now()}.${extension}`;

    // Usar la variable global progressInterval

    try {
        voiceSendBtn.disabled = true;
        voiceSendBtn.textContent = 'Enviando...';

        // Crear FormData
        const formData = new FormData();
        formData.append('file', audioToSend, filename);
        formData.append('phoneNumber', currentConversation);

        // Cerrar modal DESPUÉS de guardar referencias
        closeVoiceModal();

        // Mostrar loader
        progressInterval = showFileLoader(filename, audioSize);

        // Upload audio
        const uploadResponse = await fetch('/api/upload-media', {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${currentAuth}`
            },
            body: formData
        });

        if (!uploadResponse.ok) {
            const errorData = await uploadResponse.json().catch(() => ({}));
            throw new Error(errorData.error || 'Error al subir audio');
        }

        const uploadData = await uploadResponse.json();

        // Actualizar loader
        updateLoaderStatus('Enviando audio...', 'El audio se está enviando al cliente');

        // Enviar audio a WhatsApp
        const sendResponse = await fetch('/api/send-media', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Basic ${currentAuth}`
            },
            body: JSON.stringify({
                phoneNumber: currentConversation,
                mediaPath: uploadData.mediaPath,
                mimeType: uploadData.mimeType,
                filename: filename
            })
        });

        if (!sendResponse.ok) {
            const errorData = await sendResponse.json().catch(() => ({}));

            // Cerrar loader antes de mostrar error
            hideFileLoader();

            // Mensajes de error específicos
            if (sendResponse.status === 403) {
                alert('⚠️ No se puede enviar audio.\n\nEl cliente no está en modo asesor. Debe seleccionar "Hablar con asesor" primero desde el menú de WhatsApp.');
            } else {
                alert(`❌ Error al enviar audio: ${errorData.error || 'Error desconocido'}`);
            }

            // Resetear botón
            voiceSendBtn.disabled = false;
            voiceSendBtn.textContent = 'Enviar Audio';
            return; // Salir sin continuar
        }

        // Completar loader
        completeLoader();
        setTimeout(() => {
            hideFileLoader();
        }, 800);

        console.log('✅ Audio enviado correctamente');
    } catch (error) {
        console.error('Error al enviar audio:', error);

        // Cerrar loader solo si se creó
        if (progressInterval) {
            hideFileLoader();
        }

        alert(`❌ Error al enviar el audio:\n\n${error.message}`);
    } finally {
        voiceSendBtn.disabled = false;
        voiceSendBtn.textContent = 'Enviar Audio';
    }
};

window.closeVoiceModal = function() {
    // Detener grabación si está activa
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
        clearInterval(recordingTimer);
    }

    // Limpiar
    audioChunks = [];
    recordedAudioBlob = null;
    voiceTimer.textContent = '00:00';

    // Ocultar modal
    voiceModal.classList.remove('show');

    // Resetear vistas
    setTimeout(() => {
        voiceRecordingView.style.display = 'block';
        voicePreviewView.style.display = 'none';
        voiceStopBtn.style.display = 'none';
        voiceSendBtn.style.display = 'none';
    }, 300);
};

// ============================================
// SISTEMA DE ETIQUETAS (LABELS)
// ============================================

// Estado global de etiquetas
let allLabels = [];
let currentConversationForLabels = null;

// Paleta de colores tipo post-it para generar random
const LABEL_COLORS = [
    '#FFD700', '#FF6B6B', '#4ECDC4', '#95E1D3', '#F38181',
    '#AA96DA', '#FCBAD3', '#A8E6CF', '#FFD3B6', '#FFAAA5',
    '#FFB6D9', '#D4A5A5', '#9EC1CF', '#E8A0BF', '#C9A0DC',
    '#FFE66D', '#FF6F61', '#6A0572', '#AB83A1', '#E0BBE4',
    '#FEC8D8', '#D291BC', '#957DAD', '#FFDFD3', '#B4E7CE',
    '#A8D8EA', '#FFE5F7', '#FFCCBC', '#B2DFDB', '#C5E1A5'
];

/**
 * Generar color random único (no repetir colores de etiquetas existentes)
 */
function generateUniqueRandomColor() {
    const usedColors = allLabels.map(label => label.color.toUpperCase());
    const availableColors = LABEL_COLORS.filter(color => !usedColors.includes(color.toUpperCase()));

    if (availableColors.length === 0) {
        // Si todos los colores están usados, generar uno completamente aleatorio
        return '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0').toUpperCase();
    }

    return availableColors[Math.floor(Math.random() * availableColors.length)];
}

/**
 * Cargar etiquetas desde el backend
 */
async function loadLabels() {
    try {
        const response = await fetch('/api/labels', {
            headers: {
                'Authorization': `Basic ${currentAuth}`
            }
        });

        if (response.ok) {
            const data = await response.json();
            allLabels = data.labels || [];
            return allLabels;
        }
    } catch (error) {
        console.error('Error al cargar etiquetas:', error);
    }
    return [];
}

/**
 * Abrir modal de gestión de etiquetas
 */
window.openLabelsModal = async function() {
    dropdownMenu.classList.remove('show');

    await loadLabels();
    renderLabelsList();
    updateLabelsCounter();

    // Generar color random para preview
    const randomColor = generateUniqueRandomColor();
    document.getElementById('label-color').value = randomColor;
    document.getElementById('color-preview').style.background = randomColor;

    document.getElementById('labels-modal').classList.add('show');
};

/**
 * Cerrar modal de gestión de etiquetas
 */
window.closeLabelsModal = function() {
    document.getElementById('labels-modal').classList.remove('show');
    cancelLabelForm();
};

/**
 * Actualizar contador de etiquetas
 */
function updateLabelsCounter() {
    document.getElementById('labels-count').textContent = allLabels.length;
}

/**
 * Renderizar lista de etiquetas existentes
 */
function renderLabelsList() {
    const labelsList = document.getElementById('labels-list');

    if (allLabels.length === 0) {
        labelsList.innerHTML = '<p class="empty-message">No hay etiquetas creadas aún.</p>';
        return;
    }

    labelsList.innerHTML = allLabels.map(label => `
        <div class="label-item">
            <div class="label-item-info">
                <div class="label-color-badge" style="background: ${label.color};"></div>
                <div class="label-item-name">${label.name}</div>
            </div>
            <div class="label-item-actions">
                <button class="label-edit-btn" onclick="editLabel(${label.id}, '${label.name.replace(/'/g, "\\'")}', '${label.color}')">
                    Editar
                </button>
                <button class="label-delete-btn" onclick="deleteLabel(${label.id}, '${label.name.replace(/'/g, "\\'")}')">
                    Eliminar
                </button>
            </div>
        </div>
    `).join('');
}

// Contador de caracteres para nombre de etiqueta
document.getElementById('label-name')?.addEventListener('input', (e) => {
    const count = e.target.value.length;
    document.getElementById('label-name-count').textContent = count;
});

/**
 * Manejar envío del formulario de etiquetas
 */
document.getElementById('label-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = document.getElementById('label-name').value.trim();
    const color = document.getElementById('label-color').value;
    const editId = document.getElementById('label-edit-id').value;

    if (!name || !color) {
        await showCustomAlert('Campos incompletos', 'Por favor completa todos los campos', 'Debes seleccionar un nombre y un color para la etiqueta.', 'warning');
        return;
    }

    try {
        let response;

        if (editId) {
            // Editar etiqueta existente
            response = await fetch(`/api/labels/${editId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Basic ${currentAuth}`
                },
                body: JSON.stringify({ name, color })
            });
        } else {
            // Crear nueva etiqueta
            response = await fetch('/api/labels', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Basic ${currentAuth}`
                },
                body: JSON.stringify({ name, color })
            });
        }

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Error al guardar etiqueta');
        }

        await showCustomAlert('¡Éxito!', editId ? 'Etiqueta actualizada' : 'Etiqueta creada', 'Los cambios se han guardado correctamente.', 'success');

        // Recargar lista
        await loadLabels();
        renderLabelsList();
        updateLabelsCounter();
        cancelLabelForm();

        // Recargar conversaciones para actualizar etiquetas
        loadConversations();
    } catch (error) {
        console.error('Error al guardar etiqueta:', error);
        await showCustomAlert('Error', 'No se pudo guardar la etiqueta', error.message, 'error');
    }
});

/**
 * Cancelar formulario de etiqueta
 */
window.cancelLabelForm = function() {
    document.getElementById('label-form').reset();
    document.getElementById('label-edit-id').value = '';
    document.getElementById('label-form-title').textContent = 'Crear Nueva Etiqueta';
    document.getElementById('label-submit-btn').textContent = 'Crear Etiqueta';

    // Generar nuevo color random
    const randomColor = generateUniqueRandomColor();
    document.getElementById('label-color').value = randomColor;
    document.getElementById('color-preview').style.background = randomColor;

    // Resetear contador
    document.getElementById('label-name-count').textContent = '0';
};

/**
 * Editar etiqueta existente
 */
window.editLabel = function(id, name, color) {
    document.getElementById('label-edit-id').value = id;
    document.getElementById('label-name').value = name;
    document.getElementById('label-color').value = color;
    document.getElementById('label-form-title').textContent = 'Editar Etiqueta';
    document.getElementById('label-submit-btn').textContent = 'Guardar Cambios';

    // Mostrar color actual en preview
    document.getElementById('color-preview').style.background = color;

    // Actualizar contador
    document.getElementById('label-name-count').textContent = name.length;

    // Scroll al formulario
    document.querySelector('.label-form-container').scrollIntoView({ behavior: 'smooth' });
};

/**
 * Eliminar etiqueta
 */
window.deleteLabel = async function(id, name) {
    const confirmed = await showCustomConfirm(
        'Eliminar Etiqueta',
        `¿Estás seguro de eliminar la etiqueta "${name}"?`,
        'Esta etiqueta se eliminará de todas las conversaciones que la tengan asignada. Esta acción no se puede deshacer.',
        'Eliminar',
        'Cancelar',
        true
    );

    if (!confirmed) return;

    try {
        const response = await fetch(`/api/labels/${id}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Basic ${currentAuth}`
            }
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Error al eliminar etiqueta');
        }

        await showCustomAlert('Etiqueta eliminada', `La etiqueta "${name}" ha sido eliminada`, 'Se removió de todas las conversaciones.', 'success');

        // Recargar lista
        await loadLabels();
        renderLabelsList();
        updateLabelsCounter();

        // Recargar conversaciones para actualizar etiquetas
        loadConversations();
    } catch (error) {
        console.error('Error al eliminar etiqueta:', error);
        await showCustomAlert('Error', 'No se pudo eliminar la etiqueta', error.message, 'error');
    }
};

/**
 * Abrir modal para asignar etiquetas a una conversación
 */
window.openConversationLabelsModal = async function(phoneNumber) {
    currentConversationForLabels = phoneNumber;

    // Cargar etiquetas disponibles y las asignadas a esta conversación
    await loadLabels();

    try {
        const response = await fetch(`/api/conversations/${phoneNumber}/labels`, {
            headers: {
                'Authorization': `Basic ${currentAuth}`
            }
        });

        if (!response.ok) {
            throw new Error('Error al cargar etiquetas de conversación');
        }

        const data = await response.json();
        const assignedLabels = data.labels || [];
        const assignedLabelIds = assignedLabels.map(l => l.id);

        // Crear modal dinámicamente
        const overlay = document.createElement('div');
        overlay.className = 'custom-modal-overlay';
        overlay.id = 'conversation-labels-overlay';

        const modal = document.createElement('div');
        modal.className = 'custom-modal labels-selector-modal';

        const labelsListHTML = allLabels.length === 0
            ? '<p class="modal-description" style="text-align: center; padding: 40px 20px;">No hay etiquetas creadas. Ve a "Gestionar Etiquetas" para crear nuevas etiquetas.</p>'
            : `<div class="labels-selector-list">${allLabels.map(label => {
                const isAssigned = assignedLabelIds.includes(label.id);
                return `
                    <div class="label-selector-item ${isAssigned ? 'assigned' : ''}" onclick="toggleConversationLabel('${phoneNumber}', ${label.id}, this)">
                        <div class="label-selector-color" style="background: ${label.color};"></div>
                        <div class="label-selector-name">${label.name}</div>
                    </div>
                `;
            }).join('')}</div>`;

        modal.innerHTML = `
            <div class="custom-modal-header">
                <h3>Etiquetas de Conversación</h3>
            </div>
            <div class="custom-modal-body">
                <p class="modal-description">
                    Haz clic en una etiqueta para asignarla o removerla de esta conversación.
                </p>
                ${labelsListHTML}
            </div>
            <div class="custom-modal-footer">
                <button class="custom-modal-btn custom-modal-btn-primary" onclick="closeConversationLabelsModal()">Cerrar</button>
            </div>
        `;

        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        // Animar entrada
        setTimeout(() => {
            overlay.classList.add('show');
        }, 10);
    } catch (error) {
        console.error('Error al abrir modal de etiquetas:', error);
        await showCustomAlert('Error', 'No se pudieron cargar las etiquetas', error.message, 'error');
    }
};

/**
 * Cerrar modal de etiquetas de conversación
 */
window.closeConversationLabelsModal = function() {
    const overlay = document.getElementById('conversation-labels-overlay');
    if (overlay) {
        overlay.classList.remove('show');
        setTimeout(() => overlay.remove(), 200);
    }
    currentConversationForLabels = null;

    // Recargar conversaciones para actualizar etiquetas visibles
    loadConversations();
};

/**
 * Asignar/Remover etiqueta de conversación (toggle)
 */
window.toggleConversationLabel = async function(phoneNumber, labelId, element) {
    const isAssigned = element.classList.contains('assigned');

    try {
        let response;

        if (isAssigned) {
            // Remover etiqueta
            response = await fetch(`/api/conversations/${phoneNumber}/labels/${labelId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Basic ${currentAuth}`
                }
            });
        } else {
            // Asignar etiqueta
            response = await fetch(`/api/conversations/${phoneNumber}/labels/${labelId}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Basic ${currentAuth}`
                }
            });
        }

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Error al actualizar etiqueta');
        }

        // Toggle clase assigned
        element.classList.toggle('assigned');
    } catch (error) {
        console.error('Error al actualizar etiqueta:', error);
        await showCustomAlert('Error', 'No se pudo actualizar la etiqueta', error.message, 'error');
    }
};

// Escuchar eventos WebSocket de etiquetas
socket?.on('label_assigned', (data) => {
    console.log('Etiqueta asignada:', data);
    loadConversations();
});

socket?.on('label_removed', (data) => {
    console.log('Etiqueta removida:', data);
    loadConversations();
});

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
