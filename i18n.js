// i18n.js

let translationsCache = {};

// Загрузка переводов из Supabase
async function loadTranslations() {
    try {
        const { data, error } = await supabaseClient
            .from('translations')
            .select('*');

        if (error) throw error;

        translationsCache = {};
        data.forEach(item => {
            translationsCache[item.key] = {
                ru: item.ru || item.key,
                en: item.en || item.key
            };
        });

        return translationsCache;
    } catch (error) {
        console.error('Ошибка загрузки переводов:', error);
        return {};
    }
}

// Получение перевода
function t(key) {
    if (translationsCache[key] && translationsCache[key][currentLanguage]) {
        return translationsCache[key][currentLanguage];
    }
    return key;
}

// Обновление всех текстов на странице
function updateUI() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.dataset.i18n;
        el.textContent = t(key);
    });

    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.dataset.i18nPlaceholder;
        el.placeholder = t(key);
    });

    // Обновляем meta-теги
    const titleEl = document.querySelector('title');
    if (titleEl && titleEl.dataset.i18n) {
        titleEl.textContent = t(titleEl.dataset.i18n);
    }

    // Обновляем кнопку переключения языка
    const langBtn = document.getElementById('lang-toggle');
    if (langBtn) {
        langBtn.textContent = currentLanguage === 'ru' ? 'EN' : 'RU';
    }
}

// Переключение языка
async function switchLanguage(lang) {
    if (setLanguage(lang)) {
        await loadTranslations();
        updateUI();
        // Перезагружаем проекты с новым языком
        if (typeof loadProjects === 'function') {
            loadProjects();
        }
    }
}

// Инициализация i18n
async function initI18n() {
    await loadTranslations();
    updateUI();

    // Кнопка переключения языка
    const langBtn = document.getElementById('lang-toggle');
    if (langBtn) {
        langBtn.addEventListener('click', () => {
            const nextLang = currentLanguage === 'ru' ? 'en' : 'ru';
            switchLanguage(nextLang);
        });
    }
}

// Загружаем переводы при старте
document.addEventListener('DOMContentLoaded', () => {
    initI18n();
});