// config.js

// Настройки Supabase
const SUPABASE_URL = 'https://olqcbsltlgjythieykzw.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9scWNic2x0bGdqeXRoaWV5a3p3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQyMDczODUsImV4cCI6MjA5OTc4MzM4NX0.oaw5ow2eARBwnH_GUmQ6fNm62VJa8_ocVX9Shrr78uU';

// Настройки сайта
const SITE_CONFIG = {
    name: 'Developer Portfolio',
    url: 'https://we1337834.github.io/',
    defaultLanguage: 'ru',
    languages: ['ru', 'en']
};

// Инициализация Supabase
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Генерация уникального ID для сессии (для лайков и просмотров)
function getSessionId() {
    let sessionId = localStorage.getItem('session_id');
    if (!sessionId) {
        sessionId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('session_id', sessionId);
    }
    return sessionId;
}

// Текущий язык
let currentLanguage = localStorage.getItem('language') || 'ru';

function setLanguage(lang) {
    if (SITE_CONFIG.languages.includes(lang)) {
        currentLanguage = lang;
        localStorage.setItem('language', lang);
        document.documentElement.lang = lang;
        return true;
    }
    return false;
}