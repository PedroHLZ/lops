'use strict';
document.documentElement.classList.add('js');
const menuButton = document.querySelector('.menu-toggle');
const navigation = document.querySelector('#navigation');
function closeMenu() { navigation.classList.remove('is-open'); menuButton.setAttribute('aria-expanded', 'false'); }
menuButton.addEventListener('click', () => { menuButton.setAttribute('aria-expanded', String(navigation.classList.toggle('is-open'))); });
navigation.addEventListener('click', event => { if (event.target.closest('a')) closeMenu(); });
document.addEventListener('keydown', event => { if (event.key === 'Escape' && navigation.classList.contains('is-open')) { closeMenu(); menuButton.focus(); } });
document.addEventListener('click', event => { if (!event.target.closest('.header')) closeMenu(); });
window.matchMedia('(max-width: 640px)').addEventListener('change', closeMenu);
const sectionLinks = [...navigation.querySelectorAll('a[href^="#"]')];
if ('IntersectionObserver' in window) {
 const observer = new IntersectionObserver(entries => { entries.forEach(entry => { if (!entry.isIntersecting) return; sectionLinks.forEach(link => { if (link.hash === '#' + entry.target.id) link.setAttribute('aria-current', 'location'); else link.removeAttribute('aria-current'); }); }); }, { rootMargin: '-20% 0px -55% 0px', threshold: 0 });
 document.querySelectorAll('main section[id]').forEach(section => observer.observe(section));
}
const serviceSelect = document.querySelector('#service');
document.querySelectorAll('[data-service]').forEach(link => { link.addEventListener('click', () => { serviceSelect.value = link.dataset.service; document.querySelector('#form-status').textContent = 'Serviço selecionado: ' + link.dataset.service + '. Complete seu nome para continuar.'; }); });
document.querySelector('#booking-form').addEventListener('submit', event => {
 event.preventDefault();
 const nameInput = document.querySelector('#customer-name');
 const name = nameInput.value.trim();
 if (!name) { nameInput.setCustomValidity('Digite seu nome para continuar.'); nameInput.reportValidity(); return; }
 const note = document.querySelector('#message').value.trim();
 const message = `Olá! Meu nome é ${name}. Quero agendar: ${serviceSelect.value}.${note ? '\n' + note : ''}\nQuais horários estão disponíveis?`;
 const url = 'https://wa.me/5581987576755?text=' + encodeURIComponent(message);
 const status = document.querySelector('#form-status');
 status.textContent = 'Sua mensagem está pronta. ';
 const fallback = document.createElement('a');
 fallback.href = url; fallback.target = '_blank'; fallback.rel = 'noopener noreferrer'; fallback.textContent = 'Abrir WhatsApp para revisar e enviar ↗'; status.append(fallback);
 window.open(url, '_blank', 'noopener,noreferrer');
});
document.querySelector('#customer-name').addEventListener('input', event => event.target.setCustomValidity(''));
document.querySelector('#year').textContent = new Date().getFullYear();
