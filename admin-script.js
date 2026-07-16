// admin-script.js
let editingId = null;

function checkAuth() {
    const isLoggedIn = localStorage.getItem('isAdmin') === 'true';
    const loginForm = document.getElementById('login-form');
    const adminPanel = document.getElementById('admin-panel');
    const logoutBtn = document.getElementById('logout-btn');

    if (isLoggedIn) {
        if (loginForm) loginForm.style.display = 'none';
        if (adminPanel) adminPanel.style.display = 'block';
        if (logoutBtn) logoutBtn.style.display = 'block';
        loadProjects();
    } else {
        if (loginForm) loginForm.style.display = 'block';
        if (adminPanel) adminPanel.style.display = 'none';
        if (logoutBtn) logoutBtn.style.display = 'none';
    }
}

async function login(event) {
    event.preventDefault();
    const password = document.getElementById('admin-password').value;
    
    if (password === 'admin123') { 
        localStorage.setItem('isAdmin', 'true');
        checkAuth();
    } else {
        alert('Неверный пароль!');
    }
}

function logout() {
    localStorage.removeItem('isAdmin');
    checkAuth();
}

async function loadProjects() {
    const { data: projects, error } = await supabaseClient
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Ошибка загрузки:', error);
        return;
    }

    const container = document.getElementById('projects-list');
    if (!container) return;

    if (projects.length === 0) {
        container.innerHTML = '<p class="empty-text">База данных пуста.</p>';
        return;
    }

    container.innerHTML = projects.map(project => `
        <div class="admin-project-item">
            <div>
                <strong>${project.title}</strong>
                <p>${project.description ? project.description.substring(0, 100) + '...' : 'Без описания'}</p>
                <span>${project.technologies || 'Общий стек'}</span>
            </div>
            <div class="project-actions">
                <button onclick="editProject(${project.id})">ИЗМЕНИТЬ</button>
                <button onclick="deleteProject(${project.id})">УДАЛИТЬ</button>
            </div>
        </div>
    `).join('');
}

async function saveProject(event) {
    event.preventDefault();
    
    const title = document.getElementById('title').value;
    const description = document.getElementById('description').value;
    const technologies = document.getElementById('technologies').value;
    const github_link = document.getElementById('github_link').value;
    const demo_link = document.getElementById('demo_link').value;

    if (editingId) {
        const { error } = await supabaseClient
            .from('projects')
            .update({ title, description, technologies, github_link, demo_link })
            .eq('id', editingId);

        if (error) {
            alert('Ошибка при обновлении: ' + error.message);
            return;
        }
        editingId = null;
    } else {
        const { error } = await supabaseClient
            .from('projects')
            .insert([{ title, description, technologies, github_link, demo_link }]);

        if (error) {
            alert('Ошибка при сохранении: ' + error.message);
            return;
        }
    }

    document.getElementById('project-form').reset();
    document.getElementById('form-action-title').textContent = 'Добавить проект';
    document.querySelector('#project-form button[type="submit"]').textContent = 'Опубликовать';
    loadProjects();
}

async function editProject(id) {
    const { data: project, error } = await supabaseClient
        .from('projects')
        .select('*')
        .eq('id', id)
        .single();

    if (error) {
        alert('Ошибка при чтении записи');
        return;
    }

    editingId = id;
    document.getElementById('title').value = project.title;
    document.getElementById('description').value = project.description || '';
    document.getElementById('technologies').value = project.technologies || '';
    document.getElementById('github_link').value = project.github_link || '';
    document.getElementById('demo_link').value = project.demo_link || '';
    
    document.getElementById('form-action-title').textContent = 'Редактировать проект';
    document.querySelector('#project-form button[type="submit"]').textContent = 'Сохранить изменения';
}

async function deleteProject(id) {
    if (!confirm('Вы подтверждаете удаление?')) return;

    const { error } = await supabaseClient
        .from('projects')
        .delete()
        .eq('id', id);

    if (error) {
        alert('Удаление отклонено сервером: ' + error.message);
        return;
    }

    loadProjects();
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('login-form')?.addEventListener('submit', login);
    document.getElementById('project-form')?.addEventListener('submit', saveProject);
    document.getElementById('logout-btn')?.addEventListener('click', logout);
    
    checkAuth();
});

function resetForm() {
    editingId = null;
    document.getElementById('project-form').reset();
    document.getElementById('form-action-title').textContent = 'Добавить проект';
    document.querySelector('#project-form button[type="submit"]').textContent = 'Опубликовать';
}