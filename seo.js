// seo.js

document.addEventListener('DOMContentLoaded', function() {
    const pageTitle = document.querySelector('title');
    if (pageTitle) {
        pageTitle.textContent = 'Портфолио разработчика | Веб-приложения, боты, парсеры';
    }

    let metaDesc = document.querySelector('meta[name="description"]');
    if (!metaDesc) {
        metaDesc = document.createElement('meta');
        metaDesc.name = 'description';
        metaDesc.content = 'Портфолио разработчика. Создаю веб-приложения, телеграм-ботов и парсеры на PHP, Python, JavaScript.';
        document.head.appendChild(metaDesc);
    }

    const ogTags = {
        'og:title': 'Портфолио разработчика',
        'og:description': 'Веб-приложения, телеграм-боты и парсеры',
        'og:type': 'website',
        'og:url': window.location.href,
        'twitter:card': 'summary_large_image'
    };

    Object.keys(ogTags).forEach(property => {
        let meta = document.querySelector(`meta[property="${property}"]`);
        if (!meta) {
            meta = document.createElement('meta');
            meta.setAttribute('property', property);
            meta.content = ogTags[property];
            document.head.appendChild(meta);
        }
    });
});