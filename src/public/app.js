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
            // IMPORTANTE: Solo actualizar el estado del textarea si el campo isWithAdvisor está presente
            // Esto previene deshabilitar accidentalmente el textarea cuando se reciben mensajes multimedia
            if (data.hasOwnProperty('isWithAdvisor')) {
                updateTextareaState(data.isWithAdvisor);
            }
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
    attachBtn.disabled = !enabled;

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
        img.src = `/api/media/${message.mediaPath.split('/')[1]}`;
        img.alt = 'Imagen';
        img.onclick = () => window.open(img.src, '_blank');

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

        const docDiv = document.createElement('div');
        docDiv.className = 'message-document';
        docDiv.onclick = () => window.open(`/api/media/${message.mediaPath.split('/')[1]}`, '_blank');

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

        const iconDiv = document.createElement('div');
        iconDiv.className = 'message-audio-icon';
        iconDiv.textContent = '🎤';

        const audioPlayer = document.createElement('audio');
        audioPlayer.className = 'message-audio-player';
        audioPlayer.controls = true;
        audioPlayer.src = `/api/media/${message.mediaPath.split('/')[1]}`;

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

// Character counter for image caption
imageCaption.addEventListener('input', () => {
    captionCharCount.textContent = imageCaption.value.length;
});

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
        alert('Error al enviar la imagen. Intenta nuevamente.');
    } finally {
        attachBtn.disabled = false;
    }
};

// ============================================
// FILE UPLOAD LOADER
// ============================================

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
    progressFill.style.width = '0%';
    progressText.textContent = '0%';

    loader.style.display = 'flex';

    // Simular progreso (ya que fetch no da progreso real sin XMLHttpRequest)
    let progress = 0;
    const interval = setInterval(() => {
        progress += Math.random() * 15;
        if (progress > 90) progress = 90; // No llegar a 100% hasta que termine
        progressFill.style.width = `${progress}%`;
        progressText.textContent = `${Math.floor(progress)}%`;
    }, 300);

    return interval;
}

function updateLoaderStatus(title, description) {
    const loaderTitle = document.getElementById('loader-title');
    const loaderDescription = document.getElementById('loader-description');
    const progressFill = document.getElementById('loader-progress-fill');
    const progressText = document.getElementById('loader-progress-text');

    loaderTitle.textContent = title;
    loaderDescription.textContent = description;
    progressFill.style.width = '95%';
    progressText.textContent = '95%';
}

function completeLoader() {
    const progressFill = document.getElementById('loader-progress-fill');
    const progressText = document.getElementById('loader-progress-text');
    const loaderTitle = document.getElementById('loader-title');

    progressFill.style.width = '100%';
    progressText.textContent = '100%';
    loaderTitle.textContent = 'Archivo enviado';
}

function hideFileLoader(interval) {
    if (interval) clearInterval(interval);
    const loader = document.getElementById('file-upload-loader');
    setTimeout(() => {
        loader.style.display = 'none';
    }, 800);
}

// Función auxiliar para enviar archivos
async function sendFileImmediately(file, caption = '') {
    let progressInterval = null;

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
            const errorMsg = errorData.details || errorData.error || 'Error desconocido';
            throw new Error(`Error al enviar archivo: ${errorMsg}`);
        }

        console.log('✅ Archivo enviado correctamente');

        // Completar loader
        completeLoader();

        // Ocultar loader después de 800ms
        setTimeout(() => {
            hideFileLoader(progressInterval);
        }, 800);
    } catch (error) {
        console.error('❌ Error enviando archivo:', error);
        console.error('Detalles:', {
            file: file?.name,
            size: file?.size,
            type: file?.type,
            caption: caption
        });
        hideFileLoader(progressInterval);
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
