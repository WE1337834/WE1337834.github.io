// script.js
async function loadProjects() {
    const container = document.getElementById('projects-container');
    if (!container) return;

    const { data: projects, error } = await supabaseClient
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Ошибка загрузки:', error);
        container.innerHTML = '<p class="loading">Не удалось загрузить проекты. Пожалуйста, зайдите позже.</p>';
        return;
    }

    if (projects.length === 0) {
        container.innerHTML = '<p class="loading">Пока здесь пусто. Зайдите в админ-панель, чтобы добавить проекты.</p>';
        return;
    }

    container.innerHTML = projects.map(project => {
        // Парсим теги технологий (делим по запятой)
        const tagsHTML = project.technologies 
            ? project.technologies.split(',').map(tech => `<span class="tech-tag">${tech.trim()}</span>`).join('') 
            : '';

        // Генерируем ссылки, если они указаны в БД
        const githubBtn = project.github_link 
            ? `<a href="${project.github_link}" target="_blank" class="link-github">GitHub</a>` 
            : '';
        const demoBtn = project.demo_link 
            ? `<a href="${project.demo_link}" target="_blank" class="link-demo">Демо</a>` 
            : '';

        return `
            <div class="project-card">
                <div>
                    <h3>${project.title}</h3>
                    <p>${project.description || 'Описание отсутствует.'}</p>
                    <div class="tech-tags">${tagsHTML}</div>
                </div>
                <div class="project-links">
                    ${githubBtn}
                    ${demoBtn}
                </div>
            </div>
        `;
    }).join('');
}

// Загружаем проекты при полной загрузке страницы
document.addEventListener('DOMContentLoaded', loadProjects);