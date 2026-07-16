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
        container.innerHTML = '<div class="loading-state">Не удалось загрузить проекты. Попробуйте обновить страницу.</div>';
        return;
    }

    if (projects.length === 0) {
        container.innerHTML = '<div class="loading-state">Проекты пока не добавлены. Зайдите в админ-панель.</div>';
        return;
    }

    container.innerHTML = projects.map(project => {
        const tagsHTML = project.technologies 
            ? project.technologies.split(',').map(tech => `<span class="tech-tag">${tech.trim()}</span>`).join('') 
            : '';

        const githubBtn = project.github_link 
            ? `<a href="${project.github_link}" target="_blank">GitHub</a>` 
            : '';
        const demoBtn = project.demo_link 
            ? `<a href="${project.demo_link}" target="_blank">Live Demo</a>` 
            : '';

        return `
            <div class="project-card">
                <div>
                    <h3>${project.title}</h3>
                    <p>${project.description || 'Описание не предоставлено.'}</p>
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

document.addEventListener('DOMContentLoaded', loadProjects);