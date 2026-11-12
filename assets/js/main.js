document.addEventListener('DOMContentLoaded', () => {
    const $ = (selector) => document.querySelector(selector);
    const $$ = (selector) => [...document.querySelectorAll(selector)];
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const drawer = $('.mobile-nav-drawer');
    const toggle = $('.mobile-toggle');
    const popup = $('.wa-popup');
    const waButton = $('.wa-floating-btn');
    let previousFocus;
    let previousOverflow = '';
    const focusable = (root) => [...root.querySelectorAll('a[href], button, summary, [tabindex="0"]')].filter(el => el.getClientRects().length);

    function setPopup(open, returnFocus = false) {
        popup.classList.toggle('open', open);
        popup.inert = !open;
        waButton.setAttribute('aria-expanded', String(open));
        if (open) popup.querySelector('button').focus();
        else if (returnFocus) waButton.focus();
    }

    function setDrawer(open, destination) {
        if (open === drawer.classList.contains('open')) return;
        if (open) {
            previousFocus = document.activeElement;
            previousOverflow = document.body.style.overflow;
            setPopup(false);
        }
        drawer.inert = !open;
        drawer.classList.toggle('open', open);
        $('.mobile-backdrop').classList.toggle('open', open);
        document.body.classList.toggle('menu-open', open);
        toggle.setAttribute('aria-expanded', String(open));
        // Isolate the modal, including the header controls outside it.
        $$('main, footer, .topbar, .header-nav, .wa-widget, .mobile-action-bar, .back-to-top, .skip-link').forEach(el => { el.inert = open; });
        document.body.style.overflow = open ? 'hidden' : previousOverflow;
        if (open) {
            const focusClose = () => {
                if (drawer.classList.contains('open') && !drawer.contains(document.activeElement)) {
                    $('.drawer-close').focus({ preventScroll: true });
                }
            };
            focusClose();
            // A sliding panel can still be off-screen in the first render.
            setTimeout(focusClose, reducedMotion.matches ? 0 : 270);
        }
        else if (destination) {
            destination.setAttribute('tabindex', '-1');
            destination.focus({ preventScroll: true });
        } else previousFocus?.focus();
    }
    toggle.addEventListener('click', () => setDrawer(true));
    $('.drawer-close').addEventListener('click', () => setDrawer(false));
    $('.mobile-backdrop').addEventListener('click', () => setDrawer(false));
    $$('.mobile-nav-links a').forEach(link => link.addEventListener('click', () => setDrawer(false, $(link.hash))));
    const desktop = window.matchMedia('(min-width: 1101px)');
    desktop.addEventListener('change', event => { if (event.matches) setDrawer(false); });
    window.matchMedia('(max-width: 768px)').addEventListener('change', event => { if (event.matches) setPopup(false); });
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape') {
            if (drawer.classList.contains('open')) setDrawer(false);
            else if (popup.classList.contains('open')) setPopup(false, true);
        }
        if (event.key === 'Tab' && drawer.classList.contains('open')) {
            const items = focusable(drawer);
            const first = items[0], last = items[items.length - 1];
            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
            else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
        }
    });
    waButton.addEventListener('click', () => setPopup(!popup.classList.contains('open')));
    $('.wa-popup-close').addEventListener('click', () => setPopup(false, true));
    document.addEventListener('click', event => {
        if (popup.classList.contains('open') && !event.target.closest('.wa-widget')) setPopup(false);
    });
    popup.addEventListener('focusout', () => requestAnimationFrame(() => {
        if (!popup.contains(document.activeElement) && document.activeElement !== waButton) setPopup(false);
    }));

    const updateScroll = () => {
        $('.site-header').classList.toggle('scrolled', window.scrollY > 40);
        const distance = document.documentElement.scrollHeight - window.innerHeight;
        $('.scroll-progress').style.width = `${distance > 0 ? window.scrollY / distance * 100 : 0}%`;
        const topButton = $('.back-to-top');
        topButton.classList.toggle('visible', window.scrollY > 600);
        topButton.inert = window.scrollY <= 600;
    };
    let ticking = false;
    window.addEventListener('scroll', () => {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(() => { updateScroll(); ticking = false; });
    }, { passive: true });
    updateScroll();
    $('.back-to-top').addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: reducedMotion.matches ? 'instant' : 'smooth' });
        $('.nav-logo').focus({ preventScroll: true });
    });

    // Content is visible by default. Only enable reveals after observers are ready.
    if ('IntersectionObserver' in window) {
        const reveal = new IntersectionObserver(entries => entries.forEach(entry => {
            if (entry.isIntersecting) { entry.target.classList.add('active'); reveal.unobserve(entry.target); }
        }), { threshold: 0.08 });
        if (!reducedMotion.matches) {
            $$('.reveal').forEach(el => reveal.observe(el));
            document.documentElement.classList.add('reveal-ready');
        }
        reducedMotion.addEventListener('change', () => {
            if (reducedMotion.matches) document.documentElement.classList.remove('reveal-ready');
        });
        const links = $$('.header-nav .nav-link, .mobile-nav-links .nav-link');
        const nav = new IntersectionObserver(entries => entries.forEach(entry => {
            if (!entry.isIntersecting) return;
            links.forEach(link => {
                const active = link.hash === `#${entry.target.id}`;
                link.classList.toggle('active', active);
                if (active) link.setAttribute('aria-current', 'location');
                else link.removeAttribute('aria-current');
            });
        }), { rootMargin: '-15% 0px -65% 0px' });
        [...new Set(links.map(link => link.hash))].forEach(hash => { if ($(hash)) nav.observe($(hash)); });
    }

    const track = $('.gallery-track');
    const slides = $$('.gallery-slide');
    const counter = $('.gallery-counter');
    if (track && slides.length) {
        let index = 0;
        const update = () => {
            track.style.transform = `translateX(-${index * 100}%)`;
            slides.forEach((slide, i) => { slide.inert = i !== index; slide.setAttribute('aria-hidden', String(i !== index)); });
            counter.textContent = `${index + 1} / ${slides.length}`;
        };
        const move = delta => { index = (index + delta + slides.length) % slides.length; update(); };
        counter.setAttribute('aria-live', 'polite');
        $('.gallery-nav.prev').addEventListener('click', () => move(-1));
        $('.gallery-nav.next').addEventListener('click', () => move(1));
        $('.gallery-slider').addEventListener('keydown', event => {
            if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
                event.preventDefault(); move(event.key === 'ArrowLeft' ? -1 : 1);
            }
        });
        let start;
        track.addEventListener('touchstart', event => { const touch = event.changedTouches[0]; start = { x: touch.clientX, y: touch.clientY }; }, { passive: true });
        track.addEventListener('touchend', event => {
            if (!start) return;
            const touch = event.changedTouches[0], dx = touch.clientX - start.x, dy = touch.clientY - start.y;
            if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) move(dx < 0 ? 1 : -1);
            start = null;
        }, { passive: true });
        update();
    }
});
