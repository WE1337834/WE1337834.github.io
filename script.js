// script.js
async function loadProjects() {
    const { data: projects, error } = await supabaseClient
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Ошибка загрузки:', error);
        return;
    }

    const container = document.getElementById('projects-container');
    if (!container) return;

    if (projects.length === 0) {
        container.innerHTML = '<p>Пока нет проектов. Зайдите в админку, чтобы добавить.</p>';
        return;
    }

    container.innerHTML = projects.map(project => `
        <div class="project-card">
            <h3>${project.title}</h3>
            <p>${project.description || ''}</p>
            <div class="tech-tags">
                ${project.technologies ? project.technologies.split(',').map(tech => 
                    `<span class="tech-tag">${tech.trim()}</span>`
                ).join('') : ''}
            </div>
            <div class="project-links">
                ${project.github_link ? `<a href="${project.github_link}" target="_blank">GitHub</a>` : ''}
                ${project.demo_link ? `<a href="${project.demo_link}" target="_blank">Демо</a>` : ''}
            </div>
        </div>
    `).join('');
}

// Загружаем проекты при загрузке страницы
document.addEventListener('DOMContentLoaded', loadProjects);