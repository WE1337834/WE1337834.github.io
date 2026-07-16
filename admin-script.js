// admin-script.js
let editingId = null;
let markdownEditor = null;

// ============================================
//  АВТОРИЗАЦИЯ
// ============================================

function checkAuth() {
    const isLoggedIn = localStorage.getItem('isAdmin') === 'true';
    const loginOverlay = document.getElementById('login-overlay');
    const adminPanel = document.getElementById('admin-panel');
    const logoutBtn = document.getElementById('logout-btn');

    if (isLoggedIn) {
        if (loginOverlay) loginOverlay.style.display = 'none';
        if (adminPanel) adminPanel.style.display = 'block';
        if (logoutBtn) logoutBtn.style.display = 'inline-flex';
        loadProjects();
        loadContacts();
        loadSettings();
        loadTranslations();
        initMarkdownEditor();
    } else {
        if (loginOverlay) loginOverlay.style.display = 'flex';
        if (adminPanel) adminPanel.style.display = 'none';
        if (logoutBtn) logoutBtn.style.display = 'none';
    }
}

async function login(event) {
    event.preventDefault();
    const password = document.getElementById('admin-password').value;
    const errorEl = document.getElementById('login-error');
    
    if (password === 'admin123') {
        localStorage.setItem('isAdmin', 'true');
        errorEl.style.display = 'none';
        checkAuth();
    } else {
        errorEl.style.display = 'block';
        errorEl.textContent = '❌ Неверный пароль. Попробуйте снова.';
    }
}

function logout() {
    localStorage.removeItem('isAdmin');
    checkAuth();
}

// ============================================
//  ВКЛАДКИ
// ============================================

function initTabs() {
    const tabs = document.querySelectorAll('.tab-btn');
    const contents = {
        projects: document.getElementById('tab-projects'),
        contacts: document.getElementById('tab-contacts'),
        settings: document.getElementById('tab-settings'),
        translations: document.getElementById('tab-translations')
    };

    tabs.forEach(tab => {
        tab.addEventListener('click', function() {
            tabs.forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            Object.values(contents).forEach(c => c.classList.remove('active'));
            const tabName = this.dataset.tab;
            if (contents[tabName]) {
                contents[tabName].classList.add('active');
            }
        });
    });
}

// ============================================
//  MARKDOWN РЕДАКТОР
// ============================================

function initMarkdownEditor() {
    const textarea = document.getElementById('description_md');
    if (!textarea) return;
    
    if (markdownEditor) {
        markdownEditor.toTextArea();
        markdownEditor = null;
    }

    markdownEditor = new EasyMDE({
        element: textarea,
        spellChecker: false,
        placeholder: '**Жирный** текст, *курсив*, `код`\n\n- Список 1\n- Список 2',
        toolbar: [
            'bold', 'italic', 'heading', '|',
            'code', 'quote', 'unordered-list', 'ordered-list', '|',
            'link', 'preview', 'side-by-side', 'fullscreen'
        ],
        renderingConfig: {
            singleLineBreaks: false,
            codeSyntaxHighlighting: true,
        },
        previewRender: function(plainText) {
            return renderMarkdownPreview(plainText);
        }
    });
}

function renderMarkdownPreview(text) {
    if (!text) return '';
    return text
        .replace(/^### (.*$)/gim, '<h3>$1</h3>')
        .replace(/^## (.*$)/gim, '<h2>$1</h2>')
        .replace(/^# (.*$)/gim, '<h1>$1</h1>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/`(.*?)`/g, '<code>$1</code>')
        .replace(/^\s*-\s(.*$)/gim, '<li>$1</li>')
        .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
        .replace(/\n/g, '<br>');
}

// ============================================
//  CRUD ПРОЕКТОВ
// ============================================

async function loadProjects() {
    const container = document.getElementById('projects-list');
    const countBadge = document.getElementById('projects-count');
    
    if (!container) return;

    try {
        const { data: projects, error } = await supabaseClient
            .from('projects')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (countBadge) {
            countBadge.textContent = projects ? projects.length : 0;
        }

        if (!projects || projects.length === 0) {
            container.innerHTML = `<div class="empty-state"><p>😕 Нет проектов</p></div>`;
            return;
        }

        container.innerHTML = projects.map(project => `
            <div class="project-item" data-id="${project.id}">
                <div class="project-info">
                    <div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
                        <h4>${escapeHtml(project.title)}</h4>
                        <span class="project-status-badge ${project.status || 'published'}">
                            ${project.status || 'published'}
                        </span>
                        ${project.category ? `<span style="font-size:0.8rem; color:var(--text-muted);">📁 ${escapeHtml(project.category)}</span>` : ''}
                    </div>
                    <p>${escapeHtml(project.description || 'Без описания')}</p>
                    <div class="project-tech">
                        ${project.tags ? project.tags.map(tag => 
                            `<span>${escapeHtml(tag)}</span>`
                        ).join('') : '<span>Нет тегов</span>'}
                    </div>
                    <div style="font-size:0.8rem; color:var(--text-muted); margin-top:4px;">
                        👁️ ${project.views || 0} · ❤️ ${project.likes || 0}
                    </div>
                </div>
                <div class="project-actions">
                    <button class="btn-edit" onclick="editProject(${project.id})">✏️</button>
                    <button class="btn-delete" onclick="deleteProject(${project.id})">🗑️</button>
                </div>
            </div>
        `).join('');

    } catch (error) {
        console.error('Ошибка загрузки:', error);
        container.innerHTML = `<div class="empty-state"><p>⚠️ Ошибка: ${error.message}</p></div>`;
    }
}

async function saveProject(event) {
    event.preventDefault();
    
    const form = document.getElementById('project-form');
    const statusEl = document.getElementById('form-status');
    const submitBtn = form.querySelector('button[type="submit"]');
    
    // Получаем теги
    const tagsInput = document.getElementById('tags').value;
    const tags = tagsInput ? tagsInput.split(',').map(t => t.trim()).filter(t => t) : [];

    const projectData = {
        title: document.getElementById('title').value.trim(),
        category: document.getElementById('category').value.trim(),
        description_md: markdownEditor ? markdownEditor.value() : document.getElementById('description_md').value,
        tags: tags,
        status: document.getElementById('status').value,
        github_link: document.getElementById('github_link').value.trim(),
        demo_link: document.getElementById('demo_link').value.trim(),
        image_url: document.getElementById('image_url').value.trim()
    };

    if (!projectData.title) {
        showStatus('Пожалуйста, заполните название проекта', 'error');
        return;
    }

    try {
        submitBtn.disabled = true;
        submitBtn.textContent = editingId ? '⏳ Обновление...' : '⏳ Сохранение...';

        // Загрузка изображения, если выбрано
        const fileInput = document.getElementById('image_file');
        if (fileInput && fileInput.files.length > 0) {
            const file = fileInput.files[0];
            const fileExt = file.name.split('.').pop();
            const fileName = `${Date.now()}.${fileExt}`;
            
            const { data: uploadData, error: uploadError } = await supabaseClient.storage
                .from('project-images')
                .upload(fileName, file);

            if (uploadError) throw uploadError;

            const { data: urlData } = supabaseClient.storage
                .from('project-images')
                .getPublicUrl(fileName);

            projectData.image_url = urlData.publicUrl;
        }

        let result;
        if (editingId) {
            result = await supabaseClient
                .from('projects')
                .update(projectData)
                .eq('id', editingId);
        } else {
            result = await supabaseClient
                .from('projects')
                .insert([projectData]);
        }

        if (result.error) throw result.error;

        showStatus(
            editingId ? '✅ Проект обновлён!' : '✅ Проект добавлен!',
            'success'
        );

        // Отправляем уведомление в Telegram
        await sendTelegramNotification(projectData, editingId ? 'update' : 'create');

        resetForm();
        loadProjects();

    } catch (error) {
        console.error('Ошибка сохранения:', error);
        showStatus('❌ Ошибка: ' + error.message, 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = editingId ? '💾 Обновить' : '💾 Сохранить';
    }
}

async function editProject(id) {
    try {
        const { data: project, error } = await supabaseClient
            .from('projects')
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;

        editingId = id;
        document.getElementById('title').value = project.title || '';
        document.getElementById('category').value = project.category || '';
        document.getElementById('tags').value = project.tags ? project.tags.join(', ') : '';
        document.getElementById('status').value = project.status || 'published';
        document.getElementById('github_link').value = project.github_link || '';
        document.getElementById('demo_link').value = project.demo_link || '';
        document.getElementById('image_url').value = project.image_url || '';
        
        if (markdownEditor) {
            markdownEditor.value(project.description_md || project.description || '');
        } else {
            document.getElementById('description_md').value = project.description_md || project.description || '';
        }
        
        document.getElementById('form-action-title').textContent = '✏️ Редактирование проекта';
        document.querySelector('#project-form button[type="submit"]').textContent = '💾 Обновить';

        document.querySelector('.admin-card').scrollIntoView({ behavior: 'smooth', block: 'center' });

    } catch (error) {
        console.error('Ошибка загрузки:', error);
        alert('Ошибка загрузки проекта: ' + error.message);
    }
}

async function deleteProject(id) {
    if (!confirm('⚠️ Вы уверены, что хотите удалить этот проект?')) return;

    try {
        const { error } = await supabaseClient
            .from('projects')
            .delete()
            .eq('id', id);

        if (error) throw error;

        showStatus('🗑️ Проект удалён', 'success');
        loadProjects();

    } catch (error) {
        console.error('Ошибка удаления:', error);
        alert('Ошибка удаления: ' + error.message);
    }
}

function resetForm() {
    editingId = null;
    document.getElementById('project-form').reset();
    document.getElementById('form-action-title').textContent = '➕ Добавить проект';
    document.querySelector('#project-form button[type="submit"]').textContent = '💾 Сохранить';
    document.getElementById('form-status').style.display = 'none';
    document.getElementById('image_file').value = '';
    if (markdownEditor) {
        markdownEditor.value('');
    }
}

// ============================================
//  КОНТАКТЫ
// ============================================

async function loadContacts() {
    try {
        const { data: contacts, error } = await supabaseClient
            .from('contacts')
            .select('*')
            .limit(1)
            .single();

        if (error && error.code !== 'PGRST116') throw error;

        if (contacts) {
            document.getElementById('contact-email').value = contacts.email || '';
            document.getElementById('contact-telegram').value = contacts.telegram || '';
            document.getElementById('contact-github').value = contacts.github || '';
            document.getElementById('contact-linkedin').value = contacts.linkedin || '';
            document.getElementById('contact-phone').value = contacts.phone || '';
            document.getElementById('contact-whatsapp').value = contacts.whatsapp || '';
        }

    } catch (error) {
        console.error('Ошибка загрузки контактов:', error);
    }
}

async function saveContacts(event) {
    event.preventDefault();
    
    const statusEl = document.getElementById('contacts-status');
    const submitBtn = document.querySelector('#contacts-form button[type="submit"]');

    const contactsData = {
        email: document.getElementById('contact-email').value.trim(),
        telegram: document.getElementById('contact-telegram').value.trim(),
        github: document.getElementById('contact-github').value.trim(),
        linkedin: document.getElementById('contact-linkedin').value.trim(),
        phone: document.getElementById('contact-phone').value.trim(),
        whatsapp: document.getElementById('contact-whatsapp').value.trim(),
        updated_at: new Date().toISOString()
    };

    try {
        submitBtn.disabled = true;
        submitBtn.textContent = '⏳ Сохранение...';

        const { data: existing } = await supabaseClient
            .from('contacts')
            .select('id')
            .limit(1)
            .single();

        let result;
        if (existing) {
            result = await supabaseClient
                .from('contacts')
                .update(contactsData)
                .eq('id', existing.id);
        } else {
            result = await supabaseClient
                .from('contacts')
                .insert([contactsData]);
        }

        if (result.error) throw result.error;

        showStatus('✅ Контакты сохранены!', 'success', 'contacts-status');

    } catch (error) {
        console.error('Ошибка:', error);
        showStatus('❌ Ошибка: ' + error.message, 'error', 'contacts-status');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = '💾 Сохранить контакты';
    }
}

// ============================================
//  НАСТРОЙКИ
// ============================================

async function loadSettings() {
    try {
        const { data: settings, error } = await supabaseClient
            .from('settings')
            .select('*');

        if (error) throw error;

        settings.forEach(setting => {
            const el = document.getElementById(`settings-${setting.key.replace('_', '-')}`);
            if (el) {
                el.value = setting.value || '';
            }
        });

    } catch (error) {
        console.error('Ошибка загрузки настроек:', error);
    }
}

async function saveSettings(event) {
    event.preventDefault();
    
    const statusEl = document.getElementById('settings-status');
    const submitBtn = document.querySelector('#settings-form button[type="submit"]');

    const settingsData = {
        telegram_bot_token: document.getElementById('settings-telegram-bot').value.trim(),
        telegram_chat_id: document.getElementById('settings-telegram-chat').value.trim(),
        site_url: document.getElementById('settings-site-url').value.trim()
    };

    try {
        submitBtn.disabled = true;
        submitBtn.textContent = '⏳ Сохранение...';

        for (const [key, value] of Object.entries(settingsData)) {
            const { error } = await supabaseClient
                .from('settings')
                .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });

            if (error) throw error;
        }

        showStatus('✅ Настройки сохранены!', 'success', 'settings-status');

    } catch (error) {
        console.error('Ошибка:', error);
        showStatus('❌ Ошибка: ' + error.message, 'error', 'settings-status');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = '💾 Сохранить настройки';
    }
}

// ============================================
//  TELEGRAM УВЕДОМЛЕНИЯ
// ============================================

async function getSetting(key) {
    try {
        const { data, error } = await supabaseClient
            .from('settings')
            .select('value')
            .eq('key', key)
            .single();

        if (error) return null;
        return data ? data.value : null;
    } catch {
        return null;
    }
}

async function sendTelegramNotification(projectData, action = 'create') {
    try {
        const botToken = await getSetting('telegram_bot_token');
        const chatId = await getSetting('telegram_chat_id');
        const siteUrl = await getSetting('site_url') || window.location.origin;

        if (!botToken || !chatId) return;

        const actionText = action === 'create' ? '🆕 Добавлен новый проект' : '✏️ Обновлён проект';
        const statusEmoji = projectData.status === 'published' ? '✅' : projectData.status === 'draft' ? '🔄' : '📦';
        const tagsText = projectData.tags && projectData.tags.length > 0 
            ? projectData.tags.map(t => `#${t}`).join(' ') 
            : '';

        const message = `
${actionText}!

📁 ${projectData.title}
${projectData.category ? `📂 Категория: ${projectData.category}` : ''}
${statusEmoji} Статус: ${projectData.status}

📝 ${projectData.description_md ? projectData.description_md.substring(0, 100) + '...' : 'Без описания'}

${tagsText}

🔗 ${siteUrl}
        `.trim();

        const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text: message,
                parse_mode: 'Markdown',
                disable_web_page_preview: false
            })
        });

        const result = await response.json();
        if (!result.ok) {
            console.error('Telegram API error:', result);
        }

    } catch (error) {
        console.error('Ошибка отправки уведомления:', error);
    }
}

async function sendTestNotification() {
    const statusEl = document.getElementById('notification-status');
    statusEl.style.display = 'block';
    statusEl.textContent = '⏳ Отправка...';
    statusEl.className = 'form-status';

    try {
        const botToken = await getSetting('telegram_bot_token');
        const chatId = await getSetting('telegram_chat_id');

        if (!botToken || !chatId) {
            statusEl.textContent = '❌ Настройте Telegram Bot Token и Chat ID в разделе "Настройки"';
            statusEl.className = 'form-status error';
            return;
        }

        const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text: '✅ Тестовое уведомление работает! 🎉\n\nВаше портфолио настроено правильно.',
                parse_mode: 'Markdown'
            })
        });

        const result = await response.json();
        if (result.ok) {
            statusEl.textContent = '✅ Уведомление успешно отправлено! Проверьте Telegram.';
            statusEl.className = 'form-status success';
        } else {
            statusEl.textContent = `❌ Ошибка: ${result.description}`;
            statusEl.className = 'form-status error';
        }

    } catch (error) {
        statusEl.textContent = `❌ Ошибка: ${error.message}`;
        statusEl.className = 'form-status error';
    }
}

// ============================================
//  ПЕРЕВОДЫ (i18n)
// ============================================

async function loadTranslations() {
    const container = document.getElementById('translations-list');
    if (!container) return;

    try {
        const { data: translations, error } = await supabaseClient
            .from('translations')
            .select('*')
            .order('key');

        if (error) throw error;

        if (!translations || translations.length === 0) {
            container.innerHTML = `<div class="empty-state"><p>🌍 Нет переводов</p></div>`;
            return;
        }

        container.innerHTML = translations.map(t => `
            <div class="translation-item" data-id="${t.id}">
                <span class="trans-key">${escapeHtml(t.key)}</span>
                <input type="text" class="trans-ru" value="${escapeHtml(t.ru || '')}" placeholder="Русский">
                <input type="text" class="trans-en" value="${escapeHtml(t.en || '')}" placeholder="English">
                <div class="trans-actions">
                    <button class="btn-save" onclick="saveTranslation(${t.id}, this)">💾</button>
                    <button class="btn-delete" onclick="deleteTranslation(${t.id})">🗑️</button>
                </div>
            </div>
        `).join('');

    } catch (error) {
        console.error('Ошибка загрузки переводов:', error);
        container.innerHTML = `<div class="empty-state"><p>⚠️ ${error.message}</p></div>`;
    }
}

async function saveTranslation(id, btn) {
    const item = btn.closest('.translation-item');
    const ru = item.querySelector('.trans-ru').value.trim();
    const en = item.querySelector('.trans-en').value.trim();

    try {
        btn.textContent = '⏳';
        const { error } = await supabaseClient
            .from('translations')
            .update({ ru, en, updated_at: new Date().toISOString() })
            .eq('id', id);

        if (error) throw error;

        btn.textContent = '✅';
        setTimeout(() => { btn.textContent = '💾'; }, 1500);

    } catch (error) {
        console.error('Ошибка сохранения:', error);
        btn.textContent = '❌';
        setTimeout(() => { btn.textContent = '💾'; }, 1500);
    }
}

async function deleteTranslation(id) {
    if (!confirm('Удалить этот перевод?')) return;

    try {
        const { error } = await supabaseClient
            .from('translations')
            .delete()
            .eq('id', id);

        if (error) throw error;
        loadTranslations();

    } catch (error) {
        console.error('Ошибка удаления:', error);
        alert('Ошибка: ' + error.message);
    }
}

async function addTranslationRow() {
    try {
        const key = prompt('Введите ключ перевода (например: hello_world):');
        if (!key || !key.trim()) return;

        const { error } = await supabaseClient
            .from('translations')
            .insert([{ key: key.trim(), ru: '', en: '' }]);

        if (error) throw error;
        loadTranslations();

    } catch (error) {
        console.error('Ошибка добавления:', error);
        alert('Ошибка: ' + error.message);
    }
}

// ============================================
//  ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================

function showStatus(message, type = 'success', statusId = 'form-status') {
    const statusEl = document.getElementById(statusId);
    if (!statusEl) return;
    statusEl.textContent = message;
    statusEl.className = 'form-status ' + type;
    statusEl.style.display = 'block';
    
    if (type === 'success') {
        setTimeout(() => {
            statusEl.style.display = 'none';
        }, 5000);
    }
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Lightbox для админки
function openLightbox(imageUrl) {
    const lightbox = document.getElementById('lightbox');
    const img = document.getElementById('lightbox-img');
    if (lightbox && img) {
        img.src = imageUrl;
        lightbox.classList.add('active');
    }
}

function closeLightbox() {
    const lightbox = document.getElementById('lightbox');
    if (lightbox) {
        lightbox.classList.remove('active');
    }
}

// ============================================
//  ИНИЦИАЛИЗАЦИЯ
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    // Логин
    document.getElementById('login-form')?.addEventListener('submit', login);
    document.getElementById('logout-btn')?.addEventListener('click', logout);
    
    // Проекты
    document.getElementById('project-form')?.addEventListener('submit', saveProject);
    
    // Контакты
    document.getElementById('contacts-form')?.addEventListener('submit', saveContacts);
    
    // Настройки
    document.getElementById('settings-form')?.addEventListener('submit', saveSettings);
    
    // Вкладки
    initTabs();
    
    // Проверка авторизации
    checkAuth();

    // Закрытие лайтбокса
    document.getElementById('lightbox')?.addEventListener('click', closeLightbox);
});