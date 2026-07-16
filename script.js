// script.js

let allProjects = [];
let currentFilter = 'all';
let currentSearch = '';
let currentSort = 'newest';
let currentCategory = 'all';
let currentLanguage = 'ru';

// ============================================
//  ЗАГРУЗКА ПРОЕКТОВ
// ============================================

async function loadProjects() {
    const container = document.getElementById('projects-container');
    const subtitle = document.getElementById('projects-subtitle');
    
    if (!container) return;

    try {
        let query = supabaseClient
            .from('projects')
            .select('*')
            .order('created_at', { ascending: false });

        // Показываем только опубликованные (если не админ)
        if (!isAdminMode()) {
            query = query.eq('status', 'published');
        }

        const { data: projects, error } = await query;

        if (error) throw error;

        allProjects = projects || [];
        
        // Обновляем статистику
        updateStats(allProjects);

        if (subtitle) {
            const count = allProjects.filter(p => p.status === 'published').length;
            subtitle.textContent = count > 0 
                ? `${count} ${t('projects_subtitle')}` 
                : t('no_projects');
        }

        // Применяем фильтры
        applyFilters();

    } catch (error) {
        console.error('Ошибка загрузки:', error);
        container.innerHTML = `
            <div class="empty-projects">
                <p>⚠️ Ошибка загрузки</p>
                <p style="font-size: 0.9rem; color: var(--text-muted);">${error.message}</p>
            </div>
        `;
        if (subtitle) subtitle.textContent = 'Ошибка загрузки проектов';
    }
}

// ============================================
//  ФИЛЬТРАЦИЯ, ПОИСК, СОРТИРОВКА
// ============================================

function applyFilters() {
    let filtered = [...allProjects];

    // Фильтр по статусу
    if (currentFilter !== 'all') {
        filtered = filtered.filter(p => p.status === currentFilter);
    }

    // Фильтр по категории
    if (currentCategory !== 'all') {
        filtered = filtered.filter(p => p.category === currentCategory);
    }

    // Поиск
    if (currentSearch.trim()) {
        const search = currentSearch.toLowerCase().trim();
        filtered = filtered.filter(p => 
            p.title.toLowerCase().includes(search) ||
            (p.description && p.description.toLowerCase().includes(search)) ||
            (p.tags && p.tags.some(tag => tag.toLowerCase().includes(search)))
        );
    }

    // Сортировка
    switch (currentSort) {
        case 'newest':
            filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            break;
        case 'oldest':
            filtered.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
            break;
        case 'popular':
            filtered.sort((a, b) => (b.views || 0) - (a.views || 0));
            break;
        case 'liked':
            filtered.sort((a, b) => (b.likes || 0) - (a.likes || 0));
            break;
        case 'title':
            filtered.sort((a, b) => a.title.localeCompare(b.title));
            break;
    }

    renderProjects(filtered);
}

function renderProjects(projects) {
    const container = document.getElementById('projects-container');
    
    if (!projects || projects.length === 0) {
        container.innerHTML = `
            <div class="empty-projects">
                <p style="font-size: 2rem; margin-bottom: 8px;">🔍</p>
                <p>${t('no_projects')}</p>
                <p style="font-size: 0.9rem; color: var(--text-muted);">
                    Попробуйте изменить фильтры
                </p>
            </div>
        `;
        return;
    }

    let html = '';
    
    projects.forEach((project, index) => {
        let sizeClass = 'bento-medium';
        if (index === 0) sizeClass = 'bento-large';
        else if (index % 3 === 0 && index !== 0) sizeClass = 'bento-medium dark-card';
        else if (index % 5 === 0 && index !== 0) sizeClass = 'bento-small';
        
        const title = escapeHtml(project.title);
        const description = project.description_md || project.description || 'Без описания';
        const status = project.status || 'published';
        const statusLabel = t(`status_${status}`) || status;
        const statusClass = `status-${status}`;
        
        // Технологии
        const techs = project.tags || (project.technologies ? project.technologies.split(',').map(t => t.trim()) : []);
        
        html += `
            <div class="bento-card ${sizeClass}" data-project-id="${project.id}">
                ${project.image_url ? `
                    <img 
                        src="${escapeHtml(project.image_url)}" 
                        alt="${title}" 
                        class="project-image" 
                        loading="lazy"
                        onclick="openLightbox('${escapeHtml(project.image_url)}')"
                    >
                ` : ''}
                <span class="project-status ${statusClass}">${statusLabel}</span>
                <span class="card-label">${project.category || 'Проект'}</span>
                <h3>${title}</h3>
                <div class="markdown-body">${renderMarkdown(description)}</div>
                ${techs.length > 0 ? `
                    <div class="tech-tags">
                        ${techs.map(tech => `<span class="tech-tag">${escapeHtml(tech)}</span>`).join('')}
                    </div>
                ` : ''}
                <div class="project-meta">
                    <span>👁️ ${project.views || 0} ${t('views')}</span>
                    <span>
                        <button class="like-btn ${hasUserLiked(project.id) ? 'liked' : ''}" 
                                onclick="toggleLike(${project.id})">
                            ${hasUserLiked(project.id) ? '❤️' : '🤍'} ${project.likes || 0}
                        </button>
                    </span>
                    ${project.github_link ? `<span><a href="${escapeHtml(project.github_link)}" target="_blank">🐙</a></span>` : ''}
                    ${project.demo_link ? `<span><a href="${escapeHtml(project.demo_link)}" target="_blank">🚀</a></span>` : ''}
                </div>
            </div>
        `;
    });

    container.innerHTML = html;

    // Анимация появления
    setTimeout(() => {
        document.querySelectorAll('.bento-card').forEach((card, i) => {
            setTimeout(() => {
                card.classList.add('visible');
            }, i * 100);
        });
    }, 200);
}

// ============================================
//  ФИЛЬТРЫ (UI)
// ============================================

function initFilters() {
    // Фильтр по статусу
    const statusFilter = document.getElementById('status-filter');
    if (statusFilter) {
        statusFilter.addEventListener('change', function() {
            currentFilter = this.value;
            applyFilters();
        });
    }

    // Фильтр по категории
    const categoryFilter = document.getElementById('category-filter');
    if (categoryFilter) {
        categoryFilter.addEventListener('change', function() {
            currentCategory = this.value;
            applyFilters();
        });
    }

    // Поиск
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        let debounceTimer;
        searchInput.addEventListener('input', function() {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                currentSearch = this.value;
                applyFilters();
            }, 300);
        });
    }

    // Сортировка
    const sortSelect = document.getElementById('sort-select');
    if (sortSelect) {
        sortSelect.addEventListener('change', function() {
            currentSort = this.value;
            applyFilters();
        });
    }

    // Фильтры по технологиям (теги)
    document.querySelectorAll('.filter-tag').forEach(tag => {
        tag.addEventListener('click', function() {
            document.querySelectorAll('.filter-tag').forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            currentCategory = this.dataset.tag || 'all';
            applyFilters();
        });
    });
}

// ============================================
//  МАРКДАУН (простой рендеринг)
// ============================================

function renderMarkdown(text) {
    if (!text) return '';
    
    // Простой парсер Markdown
    let html = text
        // Заголовки
        .replace(/^### (.*$)/gim, '<h3>$1</h3>')
        .replace(/^## (.*$)/gim, '<h2>$1</h2>')
        .replace(/^# (.*$)/gim, '<h1>$1</h1>')
        // Жирный
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        // Курсив
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        // Код
        .replace(/`(.*?)`/g, '<code>$1</code>')
        // Списки
        .replace(/^\s*-\s(.*$)/gim, '<li>$1</li>')
        .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
        // Переносы строк
        .replace(/\n/g, '<br>');

    return html;
}

// ============================================
//  СИСТЕМА ЛАЙКОВ
// ============================================

function getSessionId() {
    let sessionId = localStorage.getItem('session_id');
    if (!sessionId) {
        sessionId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('session_id', sessionId);
    }
    return sessionId;
}

async function hasUserLiked(projectId) {
    const sessionId = getSessionId();
    try {
        const { data, error } = await supabaseClient
            .from('project_likes')
            .select('id')
            .eq('project_id', projectId)
            .eq('session_id', sessionId)
            .limit(1);

        if (error) return false;
        return data && data.length > 0;
    } catch {
        return false;
    }
}

async function toggleLike(projectId) {
    const sessionId = getSessionId();
    const isLiked = await hasUserLiked(projectId);

    try {
        if (isLiked) {
            // Удаляем лайк
            await supabaseClient
                .from('project_likes')
                .delete()
                .eq('project_id', projectId)
                .eq('session_id', sessionId);

            await supabaseClient.rpc('decrement_likes', { project_id: projectId });
        } else {
            // Добавляем лайк
            await supabaseClient
                .from('project_likes')
                .insert([{ project_id: projectId, session_id: sessionId }]);

            await supabaseClient.rpc('increment_likes', { project_id: projectId });
        }

        // Обновляем проекты
        await loadProjects();

    } catch (error) {
        console.error('Ошибка при лайке:', error);
    }
}

// ============================================
//  АНАЛИТИКА ПРОСМОТРОВ
// ============================================

async function trackView(projectId) {
    const sessionId = getSessionId();
    
    try {
        // Проверяем, был ли уже просмотр
        const { data, error } = await supabaseClient
            .from('project_views')
            .select('id')
            .eq('project_id', projectId)
            .eq('session_id', sessionId)
            .limit(1);

        if (error || data.length > 0) return;

        // Записываем просмотр
        await supabaseClient
            .from('project_views')
            .insert([{ project_id: projectId, session_id: sessionId }]);

        // Увеличиваем счётчик
        await supabaseClient.rpc('increment_views', { project_id: projectId });

    } catch (error) {
        console.error('Ошибка отслеживания просмотра:', error);
    }
}

// ============================================
//  LIGHTBOX ДЛЯ ИЗОБРАЖЕНИЙ
// ============================================

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
//  СТАТИСТИКА
// ============================================

function updateStats(projects) {
    const statsContainer = document.getElementById('project-stats');
    if (!statsContainer) return;

    const published = projects.filter(p => p.status === 'published').length;
    const totalViews = projects.reduce((sum, p) => sum + (p.views || 0), 0);
    const totalLikes = projects.reduce((sum, p) => sum + (p.likes || 0), 0);

    statsContainer.innerHTML = `
        <div class="project-stat">
            <span class="number">${published}</span>
            <span class="label">${t('projects_subtitle')}</span>
        </div>
        <div class="project-stat">
            <span class="number">${totalViews}</span>
            <span class="label">${t('views')}</span>
        </div>
        <div class="project-stat">
            <span class="number">${totalLikes}</span>
            <span class="label">${t('likes')}</span>
        </div>
    `;
}

// ============================================
//  ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function isAdminMode() {
    return localStorage.getItem('isAdmin') === 'true';
}

// ============================================
//  ОБРАБОТЧИКИ СОБЫТИЙ
// ============================================

document.addEventListener('DOMContentLoaded', function() {
    // Загрузка проектов
    loadProjects();
    
    // Инициализация фильтров
    initFilters();
    
    // Навигация
    initSmoothScroll();
    
    // Закрытие лайтбокса по клику
    const lightbox = document.getElementById('lightbox');
    if (lightbox) {
        lightbox.addEventListener('click', closeLightbox);
    }

    console.log('%c🚀 Apple-style Portfolio v2.0', 'color: #0066CC; font-size: 18px; font-weight: bold;');
    console.log('%cВсе функции активированы!', 'color: #34c759; font-size: 14px;');
});

// ============================================
//  ПЛАВНАЯ НАВИГАЦИЯ
// ============================================

function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            const href = this.getAttribute('href');
            if (href === '#') return;
            e.preventDefault();
            const target = document.querySelector(href);
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
}