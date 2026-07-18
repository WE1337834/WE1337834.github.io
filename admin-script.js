// admin-script.js
let editingId = null;
let markdownEditor = null;
let avatarFile = null;
let currentAvatarUrl = '';

// ============================================
//  ЗАЯВКИ (ПЕРЕМЕННЫЕ)
// ============================================

let messagesData = [];
let currentMessageStatus = 'all';

// ============================================
//  БОТ-ЗАЯВКИ (ПЕРЕМЕННЫЕ)
// ============================================

let botMessagesData = [];
let currentBotMessageStatus = 'all';

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
        loadAbout();
        loadMessages();
        initMessageFilters();
        loadBotMessages();
        initBotMessageFilters();
        initMarkdownEditor();
        initAvatarUpload();
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
        about: document.getElementById('tab-about'),
        messages: document.getElementById('tab-messages'),
        contacts: document.getElementById('tab-contacts'),
        settings: document.getElementById('tab-settings'),
        analytics: document.getElementById('tab-analytics'),
        botMessages: document.getElementById('tab-bot-messages')
    };

    tabs.forEach(tab => {
        tab.addEventListener('click', function() {
            tabs.forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            Object.values(contents).forEach(c => {
                if (c) c.classList.remove('active');
            });
            const tabName = this.dataset.tab;
            if (contents[tabName]) {
                contents[tabName].classList.add('active');
                if (tabName === 'analytics') {
                    loadAnalytics();
                }
                if (tabName === 'about') {
                    loadAbout();
                }
                if (tabName === 'messages') {
                    loadMessages();
                }
                if (tabName === 'botMessages') {
                    loadBotMessages();
                }
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
        }
    });
}

// ============================================
//  РАБОТА С АВАТАРКОЙ
// ============================================

function initAvatarUpload() {
    const fileInput = document.getElementById('about-avatar');
    if (!fileInput) return;

    fileInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (!file) return;

        if (file.size > 5 * 1024 * 1024) {
            alert('⚠️ Файл слишком большой! Максимальный размер 5MB.');
            this.value = '';
            return;
        }

        if (!file.type.startsWith('image/')) {
            alert('⚠️ Пожалуйста, загрузите изображение.');
            this.value = '';
            return;
        }

        avatarFile = file;

        const reader = new FileReader();
        reader.onload = function(e) {
            const preview = document.getElementById('about-avatar-preview');
            const img = document.getElementById('about-avatar-preview-img');
            img.src = e.target.result;
            preview.style.display = 'block';
        };
        reader.readAsDataURL(file);
    });
}

function removeAvatar() {
    avatarFile = null;
    currentAvatarUrl = '';
    document.getElementById('about-avatar').value = '';
    document.getElementById('about-avatar-preview').style.display = 'none';
    document.getElementById('about-avatar-preview-img').src = '';
}

async function uploadAvatar() {
    if (!avatarFile) return currentAvatarUrl;

    try {
        const fileExt = avatarFile.name.split('.').pop();
        const fileName = `avatar_${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabaseClient.storage
            .from('avatars')
            .upload(fileName, avatarFile, {
                cacheControl: '3600',
                upsert: true
            });

        if (uploadError) {
            console.error('Ошибка загрузки аватарки:', uploadError);
            throw uploadError;
        }

        const { data: urlData } = supabaseClient.storage
            .from('avatars')
            .getPublicUrl(fileName);

        currentAvatarUrl = urlData.publicUrl;
        return currentAvatarUrl;

    } catch (error) {
        console.error('Ошибка загрузки аватарки:', error);
        throw error;
    }
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
                    <div style="display:flex; gap:16px; margin-top:8px; font-size:0.85rem; color:var(--text-muted);">
                        <span>👁️ Просмотров: <strong style="color:var(--text-main);">${project.views || 0}</strong></span>
                        <span>📅 Создан: ${new Date(project.created_at).toLocaleDateString('ru-RU')}</span>
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
    const submitBtn = form.querySelector('button[type="submit"]');
    
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

        const fileInput = document.getElementById('image_file');
        if (fileInput && fileInput.files.length > 0) {
            const file = fileInput.files[0];
            const fileExt = file.name.split('.').pop();
            const fileName = `${Date.now()}.${fileExt}`;
            
            const { error: uploadError } = await supabaseClient.storage
                .from('project-images')
                .upload(fileName, file);

            if (uploadError) {
                console.error('Ошибка загрузки изображения:', uploadError);
                showStatus('⚠️ Ошибка загрузки изображения: ' + uploadError.message, 'error');
                submitBtn.disabled = false;
                submitBtn.textContent = editingId ? '💾 Обновить' : '💾 Сохранить';
                return;
            }

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

        showStatus(editingId ? '✅ Проект обновлён!' : '✅ Проект добавлен!', 'success');
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
//  ОБО МНЕ (CRUD)
// ============================================

async function loadAbout() {
    try {
        console.log('📥 Загрузка информации "Обо мне"...');
        
        const { data: about, error } = await supabaseClient
            .from('about')
            .select('*')
            .limit(1)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                console.log('📝 Таблица пуста, создаём запись...');
                const { error: insertError } = await supabaseClient
                    .from('about')
                    .insert([{
                        name: 'Иван Петров',
                        title: 'Full-Stack Developer',
                        location: 'Москва, Россия',
                        experience: 'Более 3 лет коммерческой разработки',
                        education: 'Высшее образование — Программная инженерия',
                        bio_md: '## Обо мне\n\nЯ Full-Stack Developer с опытом работы более 3 лет.'
                    }]);

                if (insertError) {
                    console.error('❌ Ошибка создания:', insertError);
                    return;
                }
                return loadAbout();
            }
            throw error;
        }

        if (about) {
            console.log('✅ Информация загружена');
            document.getElementById('about-name').value = about.name || '';
            document.getElementById('about-title').value = about.title || '';
            document.getElementById('about-location').value = about.location || '';
            document.getElementById('about-experience').value = about.experience || '';
            document.getElementById('about-education').value = about.education || '';
            document.getElementById('about-bio_md').value = about.bio_md || '';

            currentAvatarUrl = about.avatar_url || '';
            if (currentAvatarUrl) {
                const preview = document.getElementById('about-avatar-preview');
                const img = document.getElementById('about-avatar-preview-img');
                img.src = currentAvatarUrl;
                preview.style.display = 'block';
            }

            updateAboutPreview(about);
        }

    } catch (error) {
        console.error('❌ Ошибка загрузки "Обо мне":', error);
    }
}

async function saveAbout(event) {
    event.preventDefault();
    
    const statusEl = document.getElementById('about-status');
    const submitBtn = document.querySelector('#about-form button[type="submit"]');

    try {
        submitBtn.disabled = true;
        submitBtn.textContent = '⏳ Сохранение...';

        let avatarUrl = currentAvatarUrl;
        if (avatarFile) {
            avatarUrl = await uploadAvatar();
            avatarFile = null;
        }

        const aboutData = {
            name: document.getElementById('about-name').value.trim(),
            title: document.getElementById('about-title').value.trim(),
            location: document.getElementById('about-location').value.trim(),
            experience: document.getElementById('about-experience').value.trim(),
            education: document.getElementById('about-education').value.trim(),
            bio_md: document.getElementById('about-bio_md').value.trim(),
            avatar_url: avatarUrl,
            updated_at: new Date().toISOString()
        };

        const { data: existing } = await supabaseClient
            .from('about')
            .select('id')
            .limit(1)
            .single();

        let result;
        if (existing) {
            result = await supabaseClient
                .from('about')
                .update(aboutData)
                .eq('id', existing.id);
        } else {
            result = await supabaseClient
                .from('about')
                .insert([aboutData]);
        }

        if (result.error) throw result.error;

        showStatus('✅ Информация сохранена!', 'success', 'about-status');
        updateAboutPreview(aboutData);
        console.log('✅ Информация сохранена!');

    } catch (error) {
        console.error('❌ Ошибка сохранения:', error);
        
        if (error.code === '42501') {
            showStatus('⚠️ Ошибка RLS! Отключите RLS для таблицы "about" в Supabase.', 'error', 'about-status');
        } else {
            showStatus('❌ Ошибка: ' + error.message, 'error', 'about-status');
        }
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = '💾 Сохранить';
    }
}

function updateAboutPreview(about) {
    const container = document.getElementById('about-preview');
    if (!container) return;

    const name = about.name || 'Имя не указано';
    const title = about.title || 'Должность не указана';
    const location = about.location || '📍 Местоположение не указано';
    const experience = about.experience || 'Опыт не указан';
    const education = about.education || 'Образование не указано';
    const bio = about.bio_md || 'Биография не заполнена';
    const avatar = about.avatar_url || '';

    container.innerHTML = `
        <div style="display: flex; align-items: center; gap: 24px; flex-wrap: wrap; margin-bottom: 16px;">
            <div style="width: 80px; height: 80px; border-radius: 50%; overflow: hidden; background: linear-gradient(135deg, #0066CC, #00C6FF); flex-shrink: 0; border: 2px solid var(--border-color);">
                ${avatar ? `<img src="${escapeHtml(avatar)}" alt="Аватар" style="width: 100%; height: 100%; object-fit: cover;">` : 
                `<div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; color: white; font-size: 32px; font-weight: 700;">${name.charAt(0)}</div>`}
            </div>
            <div>
                <h3 style="font-size: 1.4rem; font-weight: 700; margin-bottom: 4px; color: var(--text-primary);">${escapeHtml(name)}</h3>
                <p style="color: var(--text-muted); font-weight: 500;">${escapeHtml(title)}</p>
                <p style="color: var(--text-muted); font-size: 0.9rem;">${escapeHtml(location)}</p>
            </div>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px; padding-top: 16px; border-top: 1px solid var(--border-color);">
            <div style="background: var(--bg-primary); padding: 12px 16px; border-radius: 10px;">
                <span style="font-size: 0.7rem; font-weight: 600; color: var(--text-muted); text-transform: uppercase; display: block;">💼 Опыт</span>
                <p style="font-size: 0.95rem; margin-top: 2px;">${escapeHtml(experience)}</p>
            </div>
            <div style="background: var(--bg-primary); padding: 12px 16px; border-radius: 10px;">
                <span style="font-size: 0.7rem; font-weight: 600; color: var(--text-muted); text-transform: uppercase; display: block;">🎓 Образование</span>
                <p style="font-size: 0.95rem; margin-top: 2px;">${escapeHtml(education)}</p>
            </div>
        </div>
        <div style="padding-top: 12px; border-top: 1px solid var(--border-color);">
            <span style="font-size: 0.7rem; font-weight: 600; color: var(--text-muted); text-transform: uppercase; display: block; margin-bottom: 8px;">📝 Биография</span>
            <div style="font-size: 0.95rem; color: var(--text-secondary); line-height: 1.7; max-height: 200px; overflow-y: auto; padding: 8px 12px; background: var(--bg-primary); border-radius: 10px;">
                ${renderMarkdownPreview(bio)}
            </div>
        </div>
    `;
}

function renderMarkdownPreview(text) {
    if (!text) return 'Биография не заполнена';
    return text
        .replace(/^### (.*$)/gim, '<h3 style="font-size:1.1rem; margin:8px 0 4px; color:var(--text-primary);">$1</h3>')
        .replace(/^## (.*$)/gim, '<h2 style="font-size:1.3rem; margin:8px 0 4px; color:var(--text-primary);">$1</h2>')
        .replace(/^# (.*$)/gim, '<h1 style="font-size:1.6rem; margin:8px 0 4px; color:var(--text-primary);">$1</h1>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/`(.*?)`/g, '<code style="background:#e8e8ed; padding:2px 8px; border-radius:4px; font-size:0.9rem;">$1</code>')
        .replace(/^\s*-\s(.*$)/gim, '<li>$1</li>')
        .replace(/(<li>.*<\/li>)/s, '<ul style="padding-left:20px; margin:4px 0 8px;">$1</ul>')
        .replace(/\n/g, '<br>');
}

// ============================================
//  ЗАЯВКИ (CRUD) — С ФИЛЬТРАМИ
// ============================================

function initMessageFilters() {
    const filters = document.querySelectorAll('.filter-btn');
    filters.forEach(btn => {
        btn.addEventListener('click', function() {
            filters.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            currentMessageStatus = this.dataset.status;
            loadMessages();
        });
    });
}

async function loadMessages() {
    const container = document.getElementById('messages-list');
    const countBadge = document.getElementById('messages-count');
    
    if (!container) return;

    try {
        let query = supabaseClient
            .from('messages')
            .select('*')
            .order('created_at', { ascending: false });

        if (currentMessageStatus !== 'all') {
            query = query.eq('status', currentMessageStatus);
        }

        const { data: messages, error } = await query;

        if (error) throw error;

        messagesData = messages || [];

        if (countBadge) {
            const unread = messagesData.filter(m => m.status === 'new').length;
            const total = messagesData.length;
            countBadge.textContent = unread > 0 ? `${total} (${unread} новых)` : total;
        }

        if (!messagesData || messagesData.length === 0) {
            const statusLabels = {
                all: 'заявок',
                new: 'новых заявок',
                read: 'прочитанных заявок',
                replied: 'отвеченных заявок',
                archived: 'заявок в архиве'
            };
            const label = statusLabels[currentMessageStatus] || 'заявок';
            container.innerHTML = `<div class="empty-state"><p>📭 Нет ${label}</p></div>`;
            return;
        }

        const statusLabelsMap = {
            new: '🆕 Новый',
            read: '📖 Прочитан',
            replied: '✉️ Ответил',
            archived: '📦 В архиве'
        };

        container.innerHTML = messagesData.map(msg => `
            <div class="message-item" onclick="openMessageModal(${msg.id})">
                <div class="message-info">
                    <div class="message-header">
                        <h4>${escapeHtml(msg.name)}</h4>
                        <span class="message-email">${escapeHtml(msg.email)}</span>
                        ${msg.subject && msg.subject !== 'Без темы' ? `<span class="message-subject">${escapeHtml(msg.subject)}</span>` : ''}
                    </div>
                    <div class="message-body">${escapeHtml(msg.message)}</div>
                    <div class="message-meta">
                        <span>${new Date(msg.created_at).toLocaleString('ru-RU')}</span>
                    </div>
                </div>
                <div class="message-actions">
                    <span class="message-status ${msg.status}">${statusLabelsMap[msg.status] || msg.status}</span>
                    <span class="message-date">${new Date(msg.created_at).toLocaleDateString('ru-RU')}</span>
                    <div class="message-buttons" onclick="event.stopPropagation();">
                        ${msg.status === 'new' ? `<button class="btn-mark-read" onclick="updateMessageStatus(${msg.id}, 'read')">📖 Прочитать</button>` : ''}
                        ${msg.status !== 'replied' ? `<button class="btn-mark-replied" onclick="updateMessageStatus(${msg.id}, 'replied')">✉️ Ответил</button>` : ''}
                        ${msg.status !== 'archived' ? `<button class="btn-archive" onclick="updateMessageStatus(${msg.id}, 'archived')">📦 В архив</button>` : ''}
                        <button class="btn-delete" onclick="deleteMessage(${msg.id})">🗑️</button>
                    </div>
                </div>
            </div>
        `).join('');

    } catch (error) {
        console.error('Ошибка загрузки заявок:', error);
        container.innerHTML = `<div class="empty-state"><p>⚠️ Ошибка: ${error.message}</p></div>`;
    }
}

async function updateMessageStatus(id, status) {
    try {
        const { error } = await supabaseClient
            .from('messages')
            .update({ 
                status: status,
                updated_at: new Date().toISOString()
            })
            .eq('id', id);

        if (error) throw error;
        loadMessages();

    } catch (error) {
        console.error('Ошибка обновления статуса:', error);
        alert('Ошибка: ' + error.message);
    }
}

async function deleteMessage(id) {
    if (!confirm('⚠️ Вы уверены, что хотите удалить эту заявку?')) return;

    try {
        const { error } = await supabaseClient
            .from('messages')
            .delete()
            .eq('id', id);

        if (error) throw error;
        loadMessages();

    } catch (error) {
        console.error('Ошибка удаления:', error);
        alert('Ошибка: ' + error.message);
    }
}

// ============================================
//  МОДАЛЬНОЕ ОКНО ПРОСМОТРА ЗАЯВКИ
// ============================================

function openMessageModal(id) {
    const msg = messagesData.find(m => m.id === id);
    if (!msg) return;

    const overlay = document.getElementById('message-modal');
    if (!overlay) return;

    const statusLabels = {
        new: '🆕 Новый',
        read: '📖 Прочитан',
        replied: '✉️ Ответил',
        archived: '📦 В архиве'
    };

    overlay.innerHTML = `
        <div class="message-modal">
            <div class="message-modal-header">
                <h3>📩 Заявка от ${escapeHtml(msg.name)}</h3>
                <button class="modal-close" onclick="closeMessageModal()">✕</button>
            </div>
            <div class="message-modal-body">
                <div class="modal-field">
                    <span class="field-label">👤 Имя</span>
                    <span class="field-value">${escapeHtml(msg.name)}</span>
                </div>
                <div class="modal-field">
                    <span class="field-label">📧 Email</span>
                    <span class="field-value">${escapeHtml(msg.email)}</span>
                </div>
                ${msg.subject ? `
                <div class="modal-field">
                    <span class="field-label">📌 Тема</span>
                    <span class="field-value">${escapeHtml(msg.subject)}</span>
                </div>
                ` : ''}
                <div class="modal-field">
                    <span class="field-label">💬 Сообщение</span>
                    <div class="field-value message-text">${escapeHtml(msg.message)}</div>
                </div>
                <div class="modal-field">
                    <span class="field-label">📅 Дата</span>
                    <span class="field-value">${new Date(msg.created_at).toLocaleString('ru-RU')}</span>
                </div>
                <div class="modal-field">
                    <span class="field-label">📊 Статус</span>
                    <span class="field-value"><span class="message-status ${msg.status}">${statusLabels[msg.status] || msg.status}</span></span>
                </div>
            </div>
            <div class="message-modal-footer">
                ${msg.status === 'new' ? `<button class="btn-mark-read" onclick="updateMessageStatus(${msg.id}, 'read'); closeMessageModal();">📖 Отметить прочитанным</button>` : ''}
                ${msg.status !== 'replied' ? `<button class="btn-mark-replied" onclick="updateMessageStatus(${msg.id}, 'replied'); closeMessageModal();">✉️ Отметить отвеченным</button>` : ''}
                ${msg.status !== 'archived' ? `<button class="btn-archive" onclick="updateMessageStatus(${msg.id}, 'archived'); closeMessageModal();">📦 В архив</button>` : ''}
                <button class="btn-delete" onclick="deleteMessage(${msg.id}); closeMessageModal();">🗑️ Удалить</button>
                <button onclick="closeMessageModal()" style="background: var(--bg-primary); color: var(--text-primary); margin-left: auto;">Закрыть</button>
            </div>
        </div>
    `;

    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeMessageModal() {
    const overlay = document.getElementById('message-modal');
    if (overlay) {
        overlay.classList.remove('active');
        overlay.innerHTML = '';
    }
    document.body.style.overflow = '';
}

// ============================================
//  ЭКСПОРТ ЗАЯВОК В CSV
// ============================================

function exportMessages() {
    if (!messagesData || messagesData.length === 0) {
        alert('📭 Нет заявок для экспорта');
        return;
    }

    const headers = ['ID', 'Имя', 'Email', 'Тема', 'Сообщение', 'Статус', 'Дата'];
    const rows = messagesData.map(msg => [
        msg.id,
        `"${msg.name}"`,
        `"${msg.email}"`,
        `"${msg.subject || 'Без темы'}"`,
        `"${msg.message.replace(/"/g, '""')}"`,
        msg.status,
        new Date(msg.created_at).toLocaleString('ru-RU')
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `заявки_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
    
    const submitBtn = document.querySelector('#settings-form button[type="submit"]');

    const settingsData = {
        telegram_bot_token: document.getElementById('settings-telegram-bot').value.trim(),
        telegram_chat_id: document.getElementById('settings-telegram-chat').value.trim(),
        telegram_proxy: document.getElementById('settings-telegram-proxy')?.value.trim() || 'https://api.telegram.org',
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
        const proxyUrl = await getSetting('telegram_proxy') || 'https://api.telegram.org';

        if (!botToken || !chatId) {
            console.log('🤖 Telegram не настроен');
            return;
        }

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

        const response = await fetch(`${proxyUrl}/bot${botToken}/sendMessage`, {
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
        if (result.ok) {
            console.log('✅ Уведомление отправлено');
        } else {
            console.error('❌ Ошибка отправки:', result);
        }

    } catch (error) {
        console.error('❌ Ошибка отправки уведомления:', error);
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
        const proxyUrl = await getSetting('telegram_proxy') || 'https://api.telegram.org';

        if (!botToken || !chatId) {
            statusEl.textContent = '❌ Настройте Telegram Bot Token и Chat ID в разделе "Настройки"';
            statusEl.className = 'form-status error';
            return;
        }

        const message = '✅ Тестовое уведомление работает! 🎉\n\nВаше портфолио настроено правильно.';

        const response = await fetch(`${proxyUrl}/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text: message,
                parse_mode: 'Markdown'
            })
        });

        const result = await response.json();
        if (result.ok) {
            statusEl.textContent = '✅ Уведомление успешно отправлено! Проверьте Telegram.';
            statusEl.className = 'form-status success';
        } else {
            statusEl.textContent = `❌ Ошибка: ${result.description || 'Неизвестная ошибка'}`;
            statusEl.className = 'form-status error';
        }

    } catch (error) {
        console.error('❌ Ошибка:', error);
        statusEl.textContent = `❌ Ошибка: ${error.message}`;
        statusEl.className = 'form-status error';
    }
}

// ============================================
//  АНАЛИТИКА
// ============================================

async function loadAnalytics() {
    const container = document.getElementById('analytics-container');
    if (!container) return;

    try {
        const { data: projects, error } = await supabaseClient
            .from('projects')
            .select('id, title, views, created_at, status')
            .order('views', { ascending: false });

        if (error) throw error;

        if (!projects || projects.length === 0) {
            container.innerHTML = `<div class="empty-state"><p>📊 Нет данных для аналитики</p></div>`;
            return;
        }

        const totalViews = projects.reduce((sum, p) => sum + (p.views || 0), 0);
        const totalProjects = projects.length;
        const publishedProjects = projects.filter(p => p.status === 'published').length;

        let html = `
            <div class="analytics-stats">
                <div class="analytics-stat-card">
                    <span class="stat-number">${totalViews}</span>
                    <span class="stat-label">👁️ Всего просмотров</span>
                </div>
                <div class="analytics-stat-card">
                    <span class="stat-number">${totalProjects}</span>
                    <span class="stat-label">📁 Всего проектов</span>
                </div>
                <div class="analytics-stat-card">
                    <span class="stat-number">${publishedProjects}</span>
                    <span class="stat-label">✅ Опубликовано</span>
                </div>
                <div class="analytics-stat-card">
                    <span class="stat-number">${totalProjects > 0 ? Math.round(totalViews / totalProjects) : 0}</span>
                    <span class="stat-label">📊 Среднее просмотров</span>
                </div>
            </div>
            <div class="analytics-table-wrapper">
                <table class="analytics-table">
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Название</th>
                            <th>Статус</th>
                            <th>👁️ Просмотры</th>
                            <th>📅 Дата</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        projects.forEach((project, index) => {
            const statusIcon = project.status === 'published' ? '✅' : 
                              project.status === 'draft' ? '🔄' : '📦';
            const statusLabel = project.status || 'published';
            
            html += `
                <tr>
                    <td>${index + 1}</td>
                    <td><strong>${escapeHtml(project.title)}</strong></td>
                    <td><span class="status-badge ${statusLabel}">${statusIcon} ${statusLabel}</span></td>
                    <td><span class="views-count">${project.views || 0}</span></td>
                    <td>${new Date(project.created_at).toLocaleDateString('ru-RU')}</td>
                </tr>
            `;
        });

        html += `
                    </tbody>
                </table>
            </div>
        `;

        container.innerHTML = html;

    } catch (error) {
        console.error('Ошибка загрузки аналитики:', error);
        container.innerHTML = `<div class="empty-state"><p>⚠️ Ошибка: ${error.message}</p></div>`;
    }
}

// ============================================
//  БОТ-ЗАЯВКИ (CRUD) + ОТВЕТЫ
// ============================================

function initBotMessageFilters() {
    const filters = document.querySelectorAll('[data-bot-status]');
    filters.forEach(btn => {
        btn.addEventListener('click', function() {
            filters.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            currentBotMessageStatus = this.dataset.botStatus;
            loadBotMessages();
        });
    });
}

async function loadBotMessages() {
    const container = document.getElementById('bot-messages-list');
    const countBadge = document.getElementById('bot-messages-count');
    
    if (!container) return;

    try {
        let query = supabaseClient
            .from('bot_messages')
            .select('*')
            .order('created_at', { ascending: false });

        if (currentBotMessageStatus !== 'all') {
            query = query.eq('status', currentBotMessageStatus);
        }

        const { data: messages, error } = await query;

        if (error) throw error;

        botMessagesData = messages || [];

        if (countBadge) {
            const unread = botMessagesData.filter(m => m.status === 'new').length;
            const total = botMessagesData.length;
            countBadge.textContent = unread > 0 ? `${total} (${unread} новых)` : total;
        }

        if (!botMessagesData || botMessagesData.length === 0) {
            const statusLabels = {
                all: 'заявок из бота',
                new: 'новых заявок из бота',
                read: 'прочитанных заявок из бота',
                replied: 'отвеченных заявок из бота',
                archived: 'заявок из бота в архиве'
            };
            const label = statusLabels[currentBotMessageStatus] || 'заявок из бота';
            container.innerHTML = `<div class="empty-state"><p>🤖 Нет ${label}</p></div>`;
            return;
        }

        const statusLabelsMap = {
            new: '🆕 Новый',
            read: '📖 Прочитан',
            replied: '✉️ Отвечен',
            archived: '📦 В архиве'
        };

        container.innerHTML = botMessagesData.map(msg => `
            <div class="message-item" onclick="openBotMessageModal(${msg.id})">
                <div class="message-info">
                    <div class="message-header">
                        <h4>${escapeHtml(msg.first_name || 'Пользователь')} ${escapeHtml(msg.last_name || '')}</h4>
                        ${msg.username ? `<span class="message-email">@${escapeHtml(msg.username)}</span>` : ''}
                        <span class="message-subject">🆔 ${escapeHtml(msg.user_id)}</span>
                    </div>
                    <div class="message-body">${escapeHtml(msg.message)}</div>
                    ${msg.admin_reply ? `<div style="background: rgba(52,199,89,0.08); padding: 8px 12px; border-radius: 8px; margin: 4px 0; font-size: 0.85rem; color: #34c759;"><strong>✉️ Ответ:</strong> ${escapeHtml(msg.admin_reply)}</div>` : ''}
                    <div class="message-meta">
                        <span>${new Date(msg.created_at).toLocaleString('ru-RU')}</span>
                    </div>
                </div>
                <div class="message-actions">
                    <span class="message-status ${msg.status}">${statusLabelsMap[msg.status] || msg.status}</span>
                    <span class="message-date">${new Date(msg.created_at).toLocaleDateString('ru-RU')}</span>
                    <div class="message-buttons" onclick="event.stopPropagation();">
                        ${msg.status === 'new' ? `<button class="btn-mark-read" onclick="updateBotMessageStatus(${msg.id}, 'read')">📖 Прочитать</button>` : ''}
                        ${msg.status !== 'replied' ? `<button class="btn-mark-replied" onclick="openReplyForm(${msg.id})">✉️ Ответить</button>` : ''}
                        ${msg.status !== 'archived' ? `<button class="btn-archive" onclick="updateBotMessageStatus(${msg.id}, 'archived')">📦 В архив</button>` : ''}
                        <button class="btn-delete" onclick="deleteBotMessage(${msg.id})">🗑️</button>
                    </div>
                </div>
            </div>
        `).join('');

    } catch (error) {
        console.error('Ошибка загрузки бот-заявок:', error);
        container.innerHTML = `<div class="empty-state"><p>⚠️ Ошибка: ${error.message}</p></div>`;
    }
}

async function updateBotMessageStatus(id, status) {
    try {
        const { error } = await supabaseClient
            .from('bot_messages')
            .update({ 
                status: status,
                updated_at: new Date().toISOString()
            })
            .eq('id', id);

        if (error) throw error;
        loadBotMessages();

    } catch (error) {
        console.error('Ошибка обновления статуса:', error);
        alert('Ошибка: ' + error.message);
    }
}

async function deleteBotMessage(id) {
    if (!confirm('⚠️ Вы уверены, что хотите удалить эту заявку из бота?')) return;

    try {
        const { error } = await supabaseClient
            .from('bot_messages')
            .delete()
            .eq('id', id);

        if (error) throw error;
        loadBotMessages();

    } catch (error) {
        console.error('Ошибка удаления:', error);
        alert('Ошибка: ' + error.message);
    }
}

// ============================================
//  МОДАЛЬНОЕ ОКНО ПРОСМОТРА БОТ-ЗАЯВКИ
// ============================================

function openBotMessageModal(id) {
    const msg = botMessagesData.find(m => m.id === id);
    if (!msg) return;

    const overlay = document.getElementById('bot-message-modal');
    if (!overlay) return;

    const statusLabels = {
        new: '🆕 Новый',
        read: '📖 Прочитан',
        replied: '✉️ Отвечен',
        archived: '📦 В архиве'
    };

    const userInfo = msg.username ? `@${msg.username}` : `${msg.first_name || 'Пользователь'} ${msg.last_name || ''}`.trim() || msg.user_id;

    overlay.innerHTML = `
        <div class="message-modal">
            <div class="message-modal-header">
                <h3>🤖 Заявка из бота</h3>
                <button class="modal-close" onclick="closeBotMessageModal()">✕</button>
            </div>
            <div class="message-modal-body">
                <div class="modal-field">
                    <span class="field-label">👤 Пользователь</span>
                    <span class="field-value">${escapeHtml(userInfo)}</span>
                </div>
                <div class="modal-field">
                    <span class="field-label">🆔 User ID</span>
                    <span class="field-value">${escapeHtml(msg.user_id)}</span>
                </div>
                ${msg.username ? `
                <div class="modal-field">
                    <span class="field-label">🔹 Username</span>
                    <span class="field-value">@${escapeHtml(msg.username)}</span>
                </div>
                ` : ''}
                <div class="modal-field">
                    <span class="field-label">💬 Сообщение</span>
                    <div class="field-value message-text">${escapeHtml(msg.message)}</div>
                </div>
                ${msg.admin_reply ? `
                <div class="modal-field">
                    <span class="field-label">✉️ Ответ администратора</span>
                    <div class="field-value message-text" style="background: rgba(52,199,89,0.05); border: 1px solid rgba(52,199,89,0.1);">${escapeHtml(msg.admin_reply)}</div>
                </div>
                ` : ''}
                <div class="modal-field">
                    <span class="field-label">📅 Дата</span>
                    <span class="field-value">${new Date(msg.created_at).toLocaleString('ru-RU')}</span>
                </div>
                <div class="modal-field">
                    <span class="field-label">📊 Статус</span>
                    <span class="field-value"><span class="message-status ${msg.status}">${statusLabels[msg.status] || msg.status}</span></span>
                </div>
            </div>
            <div class="message-modal-footer">
                ${msg.status === 'new' ? `<button class="btn-mark-read" onclick="updateBotMessageStatus(${msg.id}, 'read'); closeBotMessageModal();">📖 Отметить прочитанным</button>` : ''}
                ${msg.status !== 'replied' ? `<button class="btn-mark-replied" onclick="openReplyForm(${msg.id}); closeBotMessageModal();">✉️ Ответить</button>` : ''}
                ${msg.status !== 'archived' ? `<button class="btn-archive" onclick="updateBotMessageStatus(${msg.id}, 'archived'); closeBotMessageModal();">📦 В архив</button>` : ''}
                <button class="btn-delete" onclick="deleteBotMessage(${msg.id}); closeBotMessageModal();">🗑️ Удалить</button>
                <button onclick="closeBotMessageModal()" style="background: var(--bg-primary); color: var(--text-primary); margin-left: auto;">Закрыть</button>
            </div>
        </div>
    `;

    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeBotMessageModal() {
    const overlay = document.getElementById('bot-message-modal');
    if (overlay) {
        overlay.classList.remove('active');
        overlay.innerHTML = '';
    }
    document.body.style.overflow = '';
}

// ============================================
//  ОТВЕТ ПОЛЬЗОВАТЕЛЮ ИЗ БОТА
// ============================================

function openReplyForm(messageId) {
    const msg = botMessagesData.find(m => m.id === messageId);
    if (!msg) return;

    const card = document.getElementById('reply-card');
    const userInfo = document.getElementById('reply-user-info');
    const userMessage = document.getElementById('reply-user-message');
    const messageIdInput = document.getElementById('reply-message-id');
    const replyText = document.getElementById('reply-text');

    card.style.display = 'block';
    card.scrollIntoView({ behavior: 'smooth', block: 'center' });

    const userName = msg.first_name || 'Пользователь';
    const userIdent = msg.username ? `@${msg.username}` : `ID: ${msg.user_id}`;
    userInfo.textContent = `${userName} (${userIdent})`;
    userMessage.textContent = msg.message;
    messageIdInput.value = messageId;
    replyText.value = '';
    replyText.focus();

    document.getElementById('reply-status').style.display = 'none';
}

function closeReplyForm() {
    document.getElementById('reply-card').style.display = 'none';
    document.getElementById('reply-text').value = '';
    document.getElementById('reply-message-id').value = '';
    document.getElementById('reply-status').style.display = 'none';
}

async function sendReply(event) {
    event.preventDefault();
    
    const messageId = document.getElementById('reply-message-id').value;
    const replyText = document.getElementById('reply-text').value.trim();
    const statusEl = document.getElementById('reply-status');
    const submitBtn = document.querySelector('#reply-form button[type="submit"]');

    if (!replyText) {
        showStatus('Пожалуйста, напишите ответ', 'error', 'reply-status');
        return;
    }

    try {
        submitBtn.disabled = true;
        submitBtn.textContent = '⏳ Отправка...';

        const { data: msg, error: getError } = await supabaseClient
            .from('bot_messages')
            .select('*')
            .eq('id', messageId)
            .single();

        if (getError) throw getError;

        const botToken = await getSetting('telegram_bot_token');
        const proxyUrl = await getSetting('telegram_proxy') || 'https://api.telegram.org';

        if (!botToken) {
            showStatus('❌ Telegram Bot Token не настроен', 'error', 'reply-status');
            submitBtn.disabled = false;
            submitBtn.textContent = '📨 Отправить ответ';
            return;
        }

        const response = await fetch(`${proxyUrl}/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: msg.user_id,
                text: `📩 **Ответ от поддержки:**\n\n${replyText}`,
                parse_mode: 'Markdown'
            })
        });

        const result = await response.json();

        if (!result.ok) {
            throw new Error(result.description || 'Ошибка отправки');
        }

        await supabaseClient
            .from('bot_messages')
            .update({
                admin_reply: replyText,
                status: 'replied',
                replied_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .eq('id', messageId);

        showStatus('✅ Ответ успешно отправлен пользователю!', 'success', 'reply-status');
        loadBotMessages();

        setTimeout(() => {
            closeReplyForm();
        }, 2000);

    } catch (error) {
        console.error('❌ Ошибка отправки ответа:', error);
        showStatus(`❌ Ошибка: ${error.message}`, 'error', 'reply-status');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = '📨 Отправить ответ';
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
    document.getElementById('login-form')?.addEventListener('submit', login);
    document.getElementById('logout-btn')?.addEventListener('click', logout);
    document.getElementById('project-form')?.addEventListener('submit', saveProject);
    document.getElementById('contacts-form')?.addEventListener('submit', saveContacts);
    document.getElementById('settings-form')?.addEventListener('submit', saveSettings);
    document.getElementById('about-form')?.addEventListener('submit', saveAbout);
    document.getElementById('reply-form')?.addEventListener('submit', sendReply);
    initTabs();
    checkAuth();
});