// script.js

let allProjects = [];
let currentFilter = 'all';
let currentSearch = '';
let currentSort = 'newest';
let currentCategory = 'all';

// ============================================
//  СИСТЕМА ПРОСМОТРОВ
// ============================================

function getSessionId() {
    let sessionId = localStorage.getItem('session_id');
    if (!sessionId) {
        sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('session_id', sessionId);
    }
    return sessionId;
}

async function trackView(projectId) {
    const sessionId = getSessionId();
    
    try {
        // Проверяем, был ли уже просмотр от этой сессии
        const { data, error } = await supabaseClient
            .from('project_views')
            .select('id')
            .eq('project_id', projectId)
            .eq('session_id', sessionId)
            .limit(1);

        if (error) {
            console.error('Ошибка проверки просмотра:', error);
            return;
        }

        // Если просмотр уже был — ничего не делаем
        if (data && data.length > 0) {
            return;
        }

        // Записываем новый просмотр
        const { error: insertError } = await supabaseClient
            .from('project_views')
            .insert([{ 
                project_id: projectId, 
                session_id: sessionId 
            }]);

        if (insertError) {
            console.error('Ошибка записи просмотра:', insertError);
            return;
        }

        // Увеличиваем счётчик просмотров в таблице projects
        await supabaseClient.rpc('increment_views', { project_id: projectId });

        // ✅ ВМЕСТО ПОЛНОЙ ПЕРЕЗАГРУЗКИ — ОБНОВЛЯЕМ ТОЛЬКО ОДНУ КАРТОЧКУ
        updateProjectViews(projectId);

        // Обновляем статистику (общее число просмотров)
        updateStats(allProjects);

    } catch (error) {
        console.error('Ошибка отслеживания просмотра:', error);
    }
}

async function updateProjectViews(projectId) {
    // Получаем актуальное количество просмотров из БД
    const { data, error } = await supabaseClient
        .from('projects')
        .select('views')
        .eq('id', projectId)
        .single();

    if (error || !data) {
        console.error('Ошибка получения просмотров:', error);
        return;
    }

    // Находим карточку на странице
    const card = document.querySelector(`.bento-card[data-project-id="${projectId}"]`);
    if (!card) return;

    // Находим элемент с просмотрами внутри карточки
    const viewsElement = card.querySelector('.project-meta span:first-child');
    if (viewsElement) {
        viewsElement.innerHTML = `👁️ ${data.views || 0}`;
    }

    // Обновляем данные в allProjects
    const project = allProjects.find(p => p.id === projectId);
    if (project) {
        project.views = data.views || 0;
    }
}

// ============================================
//  ЗАГРУЗКА ПРОЕКТОВ
// ============================================

// ============================================
//  ЗАГРУЗКА ПРОЕКТОВ (оптимизированная)
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

        if (!isAdminMode()) {
            query = query.eq('status', 'published');
        }

        const { data: projects, error } = await query;

        if (error) throw error;

        // ✅ СОХРАНЯЕМ ДАННЫЕ
        allProjects = projects || [];
        
        // ✅ ОБНОВЛЯЕМ СТАТИСТИКУ (ПОСЛЕ ЗАГРУЗКИ)
        updateStats(allProjects);

        if (subtitle) {
            const count = allProjects.filter(p => p.status === 'published').length;
            subtitle.textContent = count > 0 
                ? `${count} проектов в портфолио` 
                : 'Проектов пока нет';
        }

        updateTagFilters(allProjects);
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
//  ОТРИСОВКА ПРОЕКТОВ
// ============================================

function renderProjects(projects) {
    const container = document.getElementById('projects-container');
    
    if (!projects || projects.length === 0) {
        container.innerHTML = `
            <div class="empty-projects">
                <p style="font-size: 2rem; margin-bottom: 8px;">🔍</p>
                <p>Проектов не найдено</p>
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
        const statusLabel = status === 'published' ? '✅ Опубликован' : 
                           status === 'draft' ? '🔄 В разработке' : '📦 В архиве';
        const statusClass = `status-${status}`;
        
        const techs = project.tags || (project.technologies ? project.technologies.split(',').map(t => t.trim()) : []);
        
        html += `
            <div class="bento-card ${sizeClass}" data-project-id="${project.id}" onclick="handleCardClick(${project.id}, event)">
                ${project.image_url ? `
                    <img 
                        src="${escapeHtml(project.image_url)}" 
                        alt="${title}" 
                        class="project-image" 
                        loading="lazy"
                        onclick="event.stopPropagation(); openLightbox('${escapeHtml(project.image_url)}')"
                    >
                ` : ''}
                <span class="project-status ${statusClass}">${statusLabel}</span>
                <span class="card-label">${escapeHtml(project.category || 'Проект')}</span>
                <h3>${title}</h3>
                <div class="markdown-body">${renderMarkdown(description)}</div>
                ${techs.length > 0 ? `
                    <div class="tech-tags">
                        ${techs.map(tech => `<span class="tech-tag">${escapeHtml(tech)}</span>`).join('')}
                    </div>
                ` : ''}
                <div class="project-meta">
                    <span>👁️ ${project.views || 0}</span>
                    ${project.github_link ? `<span><a href="${escapeHtml(project.github_link)}" target="_blank" onclick="event.stopPropagation();">🐙</a></span>` : ''}
                    ${project.demo_link ? `<span><a href="${escapeHtml(project.demo_link)}" target="_blank" onclick="event.stopPropagation();">🚀</a></span>` : ''}
                </div>
            </div>
        `;
    });

    container.innerHTML = html;

    setTimeout(() => {
        document.querySelectorAll('.bento-card').forEach((card, i) => {
            setTimeout(() => {
                card.classList.add('visible');
            }, i * 100);
        });
    }, 200);
}

// ============================================
//  ОБРАБОТЧИК КЛИКА ПО КАРТОЧКЕ
// ============================================

function handleCardClick(projectId, event) {
    if (event.target.closest('a') || event.target.closest('button')) {
        return;
    }
    trackView(projectId);
}

// ============================================
//  ФИЛЬТРЫ И ПОИСК
// ============================================

function updateTagFilters(projects) {
    const container = document.getElementById('tag-filters');
    if (!container) return;

    const allTags = new Set();
    projects.forEach(p => {
        if (p.tags && Array.isArray(p.tags)) {
            p.tags.forEach(tag => allTags.add(tag));
        }
    });

    let html = `<button class="filter-tag active" data-tag="all">Все</button>`;
    allTags.forEach(tag => {
        html += `<button class="filter-tag" data-tag="${tag}">#${tag}</button>`;
    });

    container.innerHTML = html;

    container.querySelectorAll('.filter-tag').forEach(btn => {
        btn.addEventListener('click', function() {
            container.querySelectorAll('.filter-tag').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            currentCategory = this.dataset.tag;
            applyFilters();
        });
    });
}

function applyFilters() {
    let filtered = [...allProjects];

    if (currentFilter !== 'all') {
        filtered = filtered.filter(p => p.status === currentFilter);
    }

    if (currentCategory !== 'all') {
        filtered = filtered.filter(p => {
            if (!p.tags || !Array.isArray(p.tags)) return false;
            return p.tags.includes(currentCategory);
        });
    }

    if (currentSearch.trim()) {
        const search = currentSearch.toLowerCase().trim();
        filtered = filtered.filter(p => 
            p.title.toLowerCase().includes(search) ||
            (p.description && p.description.toLowerCase().includes(search)) ||
            (p.tags && p.tags.some(tag => tag.toLowerCase().includes(search)))
        );
    }

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
        case 'title':
            filtered.sort((a, b) => a.title.localeCompare(b.title));
            break;
    }

    renderProjects(filtered);
}

function initFilters() {
    const statusFilter = document.getElementById('status-filter');
    if (statusFilter) {
        statusFilter.addEventListener('change', function() {
            currentFilter = this.value;
            applyFilters();
        });
    }

    const categoryFilter = document.getElementById('category-filter');
    if (categoryFilter) {
        const categories = new Set();
        allProjects.forEach(p => {
            if (p.category) categories.add(p.category);
        });
        
        categories.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat;
            option.textContent = cat;
            categoryFilter.appendChild(option);
        });

        categoryFilter.addEventListener('change', function() {
            currentCategory = this.value;
            applyFilters();
        });
    }

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

    const sortSelect = document.getElementById('sort-select');
    if (sortSelect) {
        sortSelect.addEventListener('change', function() {
            currentSort = this.value;
            applyFilters();
        });
    }
}

// ============================================
//  МАРКДАУН И СТАТИСТИКА
// ============================================

function renderMarkdown(text) {
    if (!text) return '';
    
    let html = text
        .replace(/^### (.*$)/gim, '<h3>$1</h3>')
        .replace(/^## (.*$)/gim, '<h2>$1</h2>')
        .replace(/^# (.*$)/gim, '<h1>$1</h1>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/`(.*?)`/g, '<code>$1</code>')
        .replace(/^\s*-\s(.*$)/gim, '<li>$1</li>')
        .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
        .replace(/\n/g, '<br>');

    return html;
}

// ============================================
//  ОБНОВЛЕНИЕ СТАТИСТИКИ (с проверкой данных)
// ============================================

function updateStats(projects) {
    const statsContainer = document.getElementById('project-stats');
    if (!statsContainer) {
        console.warn('⚠️ Контейнер статистики не найден');
        return;
    }

    // Проверяем, есть ли проекты
    if (!projects || projects.length === 0) {
        console.log('📊 Нет проектов для статистики');
        statsContainer.innerHTML = `
            <div class="project-stat">
                <span class="number">0</span>
                <span class="label">Проектов</span>
            </div>
            <div class="project-stat">
                <span class="number">0</span>
                <span class="label">Просмотров</span>
            </div>
        `;
        return;
    }

    // Считаем
    const published = projects.filter(p => p.status === 'published').length;
    const totalViews = projects.reduce((sum, p) => sum + (p.views || 0), 0);

    console.log(`📊 Статистика: ${published} проектов, ${totalViews} просмотров`);

    // Обновляем существующие элементы или создаём новые
    const statElements = statsContainer.querySelectorAll('.project-stat');
    
    if (statElements.length === 2) {
        // Обновляем существующие
        const numbers = statElements[0].querySelector('.number');
        const viewsNum = statElements[1].querySelector('.number');
        
        if (numbers) numbers.textContent = published;
        if (viewsNum) viewsNum.textContent = totalViews;
    } else {
        // Создаём заново (первый запуск)
        statsContainer.innerHTML = `
            <div class="project-stat">
                <span class="number">${published}</span>
                <span class="label">Проектов</span>
            </div>
            <div class="project-stat">
                <span class="number">${totalViews}</span>
                <span class="label">Просмотров</span>
            </div>
        `;
    }
}
// ============================================
//  ПЛАВНАЯ АНИМАЦИЯ ИЗМЕНЕНИЯ ЧИСЛА
// ============================================

function animateNumberChange(element, target) {
    const current = parseInt(element.textContent) || 0;
    const difference = target - current;
    
    if (difference === 0) return;
    
    const duration = 600;
    const startTime = performance.now();
    const startValue = current;

    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        const value = Math.round(startValue + difference * eased);
        
        element.textContent = value;

        if (progress < 1) {
            requestAnimationFrame(update);
        } else {
            element.textContent = target;
        }
    }

    requestAnimationFrame(update);
}


// ============================================
//  LIGHTBOX
// ============================================

function openLightbox(imageUrl) {
    const lightbox = document.getElementById('lightbox');
    const img = document.getElementById('lightbox-img');
    if (lightbox && img) {
        img.src = imageUrl;
        lightbox.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

function closeLightbox() {
    const lightbox = document.getElementById('lightbox');
    if (lightbox) {
        lightbox.classList.remove('active');
        document.body.style.overflow = '';
    }
}

// ============================================
//  ЗАГРУЗКА КОНТАКТОВ
// ============================================

async function loadContacts() {
    const container = document.getElementById('contacts-container');
    const subtitle = document.getElementById('contact-subtitle');
    const footerGithub = document.getElementById('footer-github');
    const footerTelegram = document.getElementById('footer-telegram');

    if (!container) {
        console.error('❌ Контейнер #contacts-container не найден!');
        return;
    }

    console.log('🔍 Загрузка контактов...');

    try {
        const { data: contacts, error } = await supabaseClient
            .from('contacts')
            .select('*')
            .limit(1)
            .single();

        if (error || !contacts || Object.values(contacts).every(v => !v)) {
            container.innerHTML = `
                <div style="padding:20px; text-align:center; color:var(--text-muted); width:100%;">
                    <span style="font-size:2rem; display:block; margin-bottom:8px;">📞</span>
                    Контакты пока не добавлены<br>
                    <a href="admin.html" style="color:var(--accent-blue); text-decoration:none;">Добавить в админке</a>
                </div>
            `;
            if (subtitle) {
                subtitle.textContent = 'Добавьте контакты в админке';
            }
            // 👇 ДОБАВЛЯЕМ visible ДАЖЕ ЕСЛИ НЕТ КОНТАКТОВ
            const contactSection = document.getElementById('contact');
            if (contactSection) contactSection.classList.add('visible');
            return;
        }

        if (subtitle) {
            subtitle.textContent = 'Я всегда на связи — выберите удобный способ';
        }

        const contactMap = {
            email: { icon: '📧', label: 'Email', url: (v) => `mailto:${v}` },
            telegram: { icon: '💬', label: 'Telegram', url: (v) => `https://t.me/${v.replace('@', '')}` },
            github: { icon: '🐙', label: 'GitHub', url: (v) => v.startsWith('http') ? v : `https://github.com/${v}` },
            linkedin: { icon: '💼', label: 'LinkedIn', url: (v) => v.startsWith('http') ? v : `https://linkedin.com/in/${v}` },
            phone: { icon: '📱', label: 'Телефон', url: (v) => `tel:${v.replace(/\s/g, '')}` },
            whatsapp: { icon: '💚', label: 'WhatsApp', url: (v) => `https://wa.me/${v.replace(/\s/g, '')}` }
        };

        let chipsHtml = '';
        let hasContacts = false;

        Object.keys(contactMap).forEach(key => {
            const value = contacts[key];
            if (value && value.trim()) {
                hasContacts = true;
                const info = contactMap[key];
                chipsHtml += `
                    <a href="${info.url(value)}" target="_blank" class="contact-chip" style="
                        display: inline-flex;
                        align-items: center;
                        gap: 10px;
                        padding: 12px 20px;
                        background: #f5f5f7;
                        border-radius: 100px;
                        border: 1px solid rgba(0,0,0,0.05);
                        text-decoration: none;
                        color: #1D1D1F;
                        font-weight: 500;
                        font-size: 14px;
                        transition: all 0.3s ease;
                    ">
                        <span style="font-size:18px;">${info.icon}</span>
                        ${info.label}
                    </a>
                `;
            }
        });

        if (hasContacts) {
            container.innerHTML = chipsHtml;
        } else {
            container.innerHTML = `
                <div style="padding:20px; text-align:center; color:var(--text-muted); width:100%;">
                    <span style="font-size:2rem; display:block; margin-bottom:8px;">📞</span>
                    Контакты пока не добавлены
                </div>
            `;
        }

        if (footerGithub && contacts.github) {
            footerGithub.href = contacts.github.startsWith('http') ? contacts.github : `https://github.com/${contacts.github}`;
            footerGithub.textContent = 'GitHub';
        }
        if (footerTelegram && contacts.telegram) {
            footerTelegram.href = `https://t.me/${contacts.telegram.replace('@', '')}`;
            footerTelegram.textContent = 'Telegram';
        }

        // ============================================
        // ⭐ ГЛАВНОЕ: ДОБАВЛЯЕМ КЛАСС visible ДЛЯ СЕКЦИИ
        // ============================================
        const contactSection = document.getElementById('contact');
        if (contactSection) {
            contactSection.classList.add('visible');
            console.log('✅ Добавлен класс visible для секции контактов');
        }

        console.log('✅ Контакты успешно отображены!');

    } catch (error) {
        console.error('❌ Ошибка загрузки контактов:', error);
        container.innerHTML = `
            <div style="padding:20px; text-align:center; color:#ff3b30; width:100%;">
                ⚠️ Ошибка загрузки контактов: ${error.message}
            </div>
        `;
        if (subtitle) {
            subtitle.textContent = 'Ошибка загрузки контактов';
        }
    }
}

// ============================================
//  ФОРМА СВЯЗИ
// ============================================

function initContactForm() {
    const form = document.getElementById('contact-form');
    if (!form) {
        console.log('⚠️ Форма контактов не найдена');
        return;
    }

    form.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const nameInput = document.getElementById('contact-name');
        const emailInput = document.getElementById('contact-email-input');
        const statusEl = document.getElementById('contact-form-status');
        
        const name = nameInput ? nameInput.value.trim() : '';
        const email = emailInput ? emailInput.value.trim() : '';

        if (!name || !email) {
            if (statusEl) {
                statusEl.style.display = 'block';
                statusEl.textContent = '⚠️ Пожалуйста, заполните все поля';
                statusEl.style.background = 'rgba(255, 59, 48, 0.08)';
                statusEl.style.color = '#ff3b30';
            }
            return;
        }

        if (statusEl) {
            statusEl.style.display = 'block';
            statusEl.textContent = `✅ Спасибо, ${name}! Я свяжусь с вами в ближайшее время.`;
            statusEl.style.background = 'rgba(52, 199, 89, 0.1)';
            statusEl.style.color = '#34c759';
        }

        form.reset();

        setTimeout(() => {
            if (statusEl) {
                statusEl.style.display = 'none';
            }
        }, 5000);
    });
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

function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            const href = this.getAttribute('href');
            if (href === '#' || href === '#about') return;
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

// ============================================
//  ИНИЦИАЛИЗАЦИЯ
// ============================================
// ============================================
//  ПЛАВАЮЩИЕ ЧАСТИЦЫ (Particles)
// ============================================

function initParticles() {
    const canvas = document.getElementById('particles-canvas');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    let particles = [];
    let width, height;

    function resize() {
        width = canvas.width = window.innerWidth;
        height = canvas.height = window.innerHeight;
    }

    window.addEventListener('resize', resize);
    resize();

    class Particle {
        constructor() {
            this.x = Math.random() * width;
            this.y = Math.random() * height;
            this.size = Math.random() * 2 + 0.5;
            this.speedX = (Math.random() - 0.5) * 0.5;
            this.speedY = (Math.random() - 0.5) * 0.5;
            this.opacity = Math.random() * 0.5 + 0.2;
        }

        update() {
            this.x += this.speedX;
            this.y += this.speedY;

            if (this.x > width) this.x = 0;
            if (this.x < 0) this.x = width;
            if (this.y > height) this.y = 0;
            if (this.y < 0) this.y = height;
        }

        draw() {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(0, 102, 204, ${this.opacity})`;
            ctx.fill();
        }
    }

    // Создаём частицы
    for (let i = 0; i < 80; i++) {
        particles.push(new Particle());
    }

    // Анимация
    function animate() {
        ctx.clearRect(0, 0, width, height);
        particles.forEach(p => {
            p.update();
            p.draw();
        });

        // Соединяем близкие частицы линиями
        for (let i = 0; i < particles.length; i++) {
            for (let j = i + 1; j < particles.length; j++) {
                const dx = particles[i].x - particles[j].x;
                const dy = particles[i].y - particles[j].y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < 120) {
                    ctx.beginPath();
                    ctx.strokeStyle = `rgba(0, 102, 204, ${0.08 * (1 - distance / 120)})`;
                    ctx.lineWidth = 0.5;
                    ctx.moveTo(particles[i].x, particles[i].y);
                    ctx.lineTo(particles[j].x, particles[j].y);
                    ctx.stroke();
                }
            }
        }

        requestAnimationFrame(animate);
    }

    animate();
}

// Вызываем в DOMContentLoaded
// ============================================
//  КАСТОМНЫЙ КУРСОР
// ============================================

function initCursor() {
    const dot = document.getElementById('cursor-dot');
    const ring = document.getElementById('cursor-ring');
    
    if (!dot || !ring) return;
    if (window.innerWidth <= 768) return;

    let mouseX = 0, mouseY = 0;
    let ringX = 0, ringY = 0;

    document.addEventListener('mousemove', (e) => {
        mouseX = e.clientX;
        mouseY = e.clientY;
        dot.style.left = mouseX + 'px';
        dot.style.top = mouseY + 'px';
    });

    // Плавное движение кольца
    function animateRing() {
        ringX += (mouseX - ringX) * 0.15;
        ringY += (mouseY - ringY) * 0.15;
        ring.style.left = ringX + 'px';
        ring.style.top = ringY + 'px';
        requestAnimationFrame(animateRing);
    }
    animateRing();

    // Эффект при наведении на интерактивные элементы
    const hoverElements = document.querySelectorAll('a, button, .bento-card, .contact-chip');
    hoverElements.forEach(el => {
        el.addEventListener('mouseenter', () => {
            ring.classList.add('hover');
            dot.style.transform = 'translate(-50%, -50%) scale(1.5)';
        });
        el.addEventListener('mouseleave', () => {
            ring.classList.remove('hover');
            dot.style.transform = 'translate(-50%, -50%) scale(1)';
        });
    });
}
// ============================================
//  АНИМИРОВАННЫЙ СЧЁТЧИК (дополнение к updateStats)
// ============================================

function animateNumber(element, target, duration = 1500) {
    const start = 0;
    const startTime = performance.now();

    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        const current = Math.round(start + (target - start) * eased);
        
        element.textContent = current;

        if (progress < 1) {
            requestAnimationFrame(update);
        } else {
            element.textContent = target;
        }
    }

    requestAnimationFrame(update);
}

// В updateStats замените вставку на:
// Вызываем в DOMContentLoaded

document.addEventListener('DOMContentLoaded', function() {
    loadProjects();
        initCursor();

    loadContacts();
    setTimeout(initFilters, 500);
    initSmoothScroll();
    initContactForm();
    initParticles();

    const lightbox = document.getElementById('lightbox');
    if (lightbox) {
        lightbox.addEventListener('click', closeLightbox);
    }

    setTimeout(() => {
        const heroContent = document.querySelector('.hero-content');
        if (heroContent) heroContent.classList.add('visible');
    }, 100);

    console.log('%c🚀 Apple-style Portfolio v2.0', 'color: #0066CC; font-size: 18px; font-weight: bold;');
    console.log('%cВсе функции активированы!', 'color: #34c759; font-size: 14px;');
    console.log('%c👁️ Система просмотров активна', 'color: #ff9500; font-size: 14px;');
});