// admin-script.js
let editingId = null;

// Проверка авторизации
function checkAuth() {
    const isLoggedIn = localStorage.getItem('isAdmin') === 'true';
    const loginForm = document.getElementById('login-form');
    const adminPanel = document.getElementById('admin-panel');

    if (isLoggedIn) {
        if (loginForm) loginForm.style.display = 'none';
        if (adminPanel) adminPanel.style.display = 'block';
        loadProjects();
    } else {
        if (loginForm) loginForm.style.display = 'block';
        if (adminPanel) adminPanel.style.display = 'none';
    }
}

// Логин
async function login(event) {
    event.preventDefault();
    const password = document.getElementById('admin-password').value;
    
    // Простая проверка (можно улучшить с Supabase Auth)
    if (password === 'admin123') { // Смените пароль!
        localStorage.setItem('isAdmin', 'true');
        checkAuth();
    } else {
        alert('Неверный пароль!');
    }
}

// Выход
function logout() {
    localStorage.removeItem('isAdmin');
    checkAuth();
}

// Загрузка проектов в админке
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
        container.innerHTML = '<p>Нет проектов</p>';
        return;
    }

    container.innerHTML = projects.map(project => `
        <div class="admin-project-item">
            <div>
                <strong>${project.title}</strong>
                <p>${project.description || ''}</p>
                <span>${project.technologies || ''}</span>
            </div>
            <div>
                <button onclick="editProject(${project.id})">✏️</button>
                <button onclick="deleteProject(${project.id})">🗑️</button>
            </div>
        </div>
    `).join('');
}

// Добавление/обновление проекта
async function saveProject(event) {
    event.preventDefault();
    
    const title = document.getElementById('title').value;
    const description = document.getElementById('description').value;
    const technologies = document.getElementById('technologies').value;
    const github_link = document.getElementById('github_link').value;
    const demo_link = document.getElementById('demo_link').value;

    if (editingId) {
        // Обновление
        const { error } = await supabaseClient
            .from('projects')
            .update({ title, description, technologies, github_link, demo_link })
            .eq('id', editingId);

        if (error) {
            alert('Ошибка обновления: ' + error.message);
            return;
        }
        editingId = null;
    } else {
        // Добавление
        const { error } = await supabaseClient
            .from('projects')
            .insert([{ title, description, technologies, github_link, demo_link }]);

        if (error) {
            alert('Ошибка добавления: ' + error.message);
            return;
        }
    }

    document.getElementById('project-form').reset();
    loadProjects();
}

// Редактирование
async function editProject(id) {
    const { data: project, error } = await supabaseClient
        .from('projects')
        .select('*')
        .eq('id', id)
        .single();

    if (error) {
        alert('Ошибка загрузки проекта');
        return;
    }

    editingId = id;
    document.getElementById('title').value = project.title;
    document.getElementById('description').value = project.description || '';
    document.getElementById('technologies').value = project.technologies || '';
    document.getElementById('github_link').value = project.github_link || '';
    document.getElementById('demo_link').value = project.demo_link || '';
    document.querySelector('button[type="submit"]').textContent = 'Обновить проект';
}

// Удаление
async function deleteProject(id) {
    if (!confirm('Удалить проект?')) return;

    const { error } = await supabaseClient
        .from('projects')
        .delete()
        .eq('id', id);

    if (error) {
        alert('Ошибка удаления: ' + error.message);
        return;
    }

    loadProjects();
}

// Инициализация
document.addEventListener('DOMContentLoaded', () => {
    // Навешиваем обработчики событий
    document.getElementById('login-form')?.addEventListener('submit', login);
    document.getElementById('project-form')?.addEventListener('submit', saveProject);
    document.getElementById('logout-btn')?.addEventListener('click', logout);
    
    checkAuth();
});

// Очистка формы при добавлении нового
function resetForm() {
    editingId = null;
    document.getElementById('project-form').reset();
    document.querySelector('button[type="submit"]').textContent = 'Добавить проект';
}