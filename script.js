const DATA_URL = 'data/content.json';

const DEFAULT_SITE = {
  title: 'Portfolio',
  lang: 'es',
  theme: 'dark'
};

const DEFAULT_SECTIONS = [
  { id: 'inicio', label: 'Inicio', type: 'hero' },
  { id: 'sobre-mi', label: 'Sobre mí', type: 'about' },
  { id: 'cv', label: 'Hoja de vida', type: 'cv' },
  { id: 'certificaciones', label: 'Certificaciones', type: 'certifications' },
  { id: 'proyectos', label: 'Proyectos', type: 'projects' },
  { id: 'habilidades', label: 'Habilidades', type: 'skills' },
  { id: 'contacto', label: 'Contacto', type: 'contact' },
  { id: 'reclutador', label: 'Reclutador', type: 'recruiter' }
];

const app = document.getElementById('app');

const SESSION_KEY = 'recruiter_session';
let publicData = null;
let extendedData = null;
let recruiterExpiryTimer = null;
let recruiterExpiryCheck = null;
let recruiterNotice = null;
const RECRUITER_REVALIDATE_INTERVAL = 60000;

function isRecruiterActive() {
  return Boolean(extendedData);
}

const HERO_FIELDS = ['name', 'role', 'tagline', 'photo'];
const ABOUT_FIELDS = ['summary', 'highlights'];
const CONTACT_FIELDS = ['email', 'github', 'linkedin', 'website', 'message'];

function isFieldVisible(item, key) {
  const level = item[key + '_visibility'];
  return !level || level === 'public';
}

function itemVisibleForCurrent(item) {
  if (!item.visibility) return true;
  if (isRecruiterActive()) return item.visibility === 'public' || item.visibility === 'recruiter';
  return item.visibility === 'public';
}

function fieldHasContent(item, key) {
  const value = item[key];
  return Array.isArray(value) ? value.length > 0 : Boolean(value);
}

function markRecruiterItem(node, item) {
  if (isRecruiterActive() && item.visibility === 'recruiter') {
    node.classList.add('recruiter-marked');
  }
}

function sectionHasVisibleContent(section, data) {
  const type = section.type;

  if (type === 'hero' || type === 'about') {
    const profile = data.profile || {};
    const fields = type === 'hero' ? HERO_FIELDS : ABOUT_FIELDS;
    return fields.some((key) => isFieldVisible(profile, key) && fieldHasContent(profile, key));
  }

  if (type === 'cv') {
    return (data.experience || []).some(itemVisibleForCurrent) || (data.education || []).some(itemVisibleForCurrent);
  }

  if (type === 'projects') {
    return (data.projects || []).some(itemVisibleForCurrent);
  }

  if (type === 'skills') {
    return (data.skills || []).some(itemVisibleForCurrent);
  }

  if (type === 'certifications') {
    return (data.certifications || []).some(itemVisibleForCurrent);
  }

  if (type === 'contact') {
    const contact = data.contact || {};
    return CONTACT_FIELDS.some((key) => isFieldVisible(contact, key) && fieldHasContent(contact, key));
  }

  return true;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function buildHeader(sections) {
  const header = el('header', 'site-header');
  const nav = el('nav', 'nav');
  const list = el('ul');

  sections.forEach((section) => {
    const item = el('li');
    const link = el('a', null, section.label);
    link.href = '#' + section.id;
    link.dataset.section = section.id;
    item.appendChild(link);
    list.appendChild(item);
  });

  nav.appendChild(list);
  header.appendChild(nav);
  document.body.prepend(header);
}

function createSection(section) {
  const sec = el('section', 'section');
  sec.id = section.id;

  if (section.type !== 'hero') {
    sec.appendChild(el('h2', 'section-title', section.label));
  }

  return sec;
}

function renderHero(sec, profile) {
  const inner = el('div', 'hero');

  if (isFieldVisible(profile, 'photo') && profile.photo) {
    const img = el('img', 'hero-photo');
    img.src = profile.photo;
    img.alt = 'Foto de ' + profile.name;
    inner.appendChild(img);
  }

  if (isFieldVisible(profile, 'name') && profile.name) {
    inner.appendChild(el('h1', 'hero-name', profile.name));
  }
  if (isFieldVisible(profile, 'role') && profile.role) {
    inner.appendChild(el('p', 'hero-role', profile.role));
  }
  if (isFieldVisible(profile, 'tagline') && profile.tagline) {
    inner.appendChild(el('p', 'hero-tagline', profile.tagline));
  }

  const actions = el('div', 'hero-actions');
  const cvLink = el('a', 'btn', 'Ver perfil');
  cvLink.href = '#sobre-mi';
  const contactLink = el('a', 'btn btn--secondary', 'Contacto');
  contactLink.href = '#contacto';
  actions.appendChild(cvLink);
  actions.appendChild(contactLink);
  inner.appendChild(actions);

  sec.appendChild(inner);
}

function renderAbout(sec, profile) {
  const inner = el('div', 'about');

  if (isFieldVisible(profile, 'summary') && profile.summary.length) {
    profile.summary.forEach((paragraph) => {
      inner.appendChild(el('p', 'about-text', paragraph));
    });
  }

  if (isFieldVisible(profile, 'highlights') && profile.highlights.length) {
    const list = el('ul', 'about-highlights');
    profile.highlights.forEach((highlight) => {
      list.appendChild(el('li', null, highlight));
    });
    inner.appendChild(list);
  }

  sec.appendChild(inner);
}

function renderCv(sec, data) {
  const inner = el('div', 'cv');

  const experienceBlock = el('div', 'cv-block');
  experienceBlock.appendChild(el('h3', 'cv-subtitle', 'Experiencia'));
  const experienceList = el('div', 'timeline');

  data.experience.filter(itemVisibleForCurrent).forEach((item) => {
    const entry = el('article', 'timeline-entry');
    markRecruiterItem(entry, item);
    entry.appendChild(el('h4', 'timeline-role', item.role));
    entry.appendChild(el('p', 'timeline-meta', item.company + ' · ' + item.period));
    entry.appendChild(el('p', 'timeline-summary', item.summary));
    if (item.tech.length) {
      entry.appendChild(buildTechList(item.tech));
    }
    experienceList.appendChild(entry);
  });

  experienceBlock.appendChild(experienceList);
  inner.appendChild(experienceBlock);

  const educationBlock = el('div', 'cv-block');
  educationBlock.appendChild(el('h3', 'cv-subtitle', 'Educación'));
  const educationList = el('div', 'timeline');

  data.education.filter(itemVisibleForCurrent).forEach((item) => {
    const entry = el('article', 'timeline-entry');
    markRecruiterItem(entry, item);
    entry.appendChild(el('h4', 'timeline-role', item.degree));
    entry.appendChild(el('p', 'timeline-meta', item.institution + ' · ' + item.period));
    if (item.notes) {
      entry.appendChild(el('p', 'timeline-summary', item.notes));
    }
    educationList.appendChild(entry);
  });

  educationBlock.appendChild(educationList);
  inner.appendChild(educationBlock);

  sec.appendChild(inner);
}

function buildTechList(items) {
  const list = el('ul', 'tags');
  items.forEach((tech) => {
    list.appendChild(el('li', 'tag', tech));
  });
  return list;
}

function renderProjects(sec, projects) {
  const grid = el('div', 'projects-grid');

  projects.filter(itemVisibleForCurrent).forEach((project) => {
    const card = el('article', 'project-card');
    markRecruiterItem(card, project);
    card.appendChild(el('h3', 'project-title', project.title));
    card.appendChild(el('p', 'project-description', project.description));
    card.appendChild(buildTechList(project.tech));

    const links = el('div', 'project-links');
    if (project.demo) {
      const demo = el('a', 'btn btn--small', 'Demo');
      demo.href = project.demo;
      demo.target = '_blank';
      demo.rel = 'noopener noreferrer';
      links.appendChild(demo);
    }
    if (project.repo) {
      const repo = el('a', 'btn btn--small btn--secondary', 'Código');
      repo.href = project.repo;
      repo.target = '_blank';
      repo.rel = 'noopener noreferrer';
      links.appendChild(repo);
    }
    card.appendChild(links);

    grid.appendChild(card);
  });

  sec.appendChild(grid);
}

function renderSkills(sec, skills) {
  const grid = el('div', 'skills-grid');

  skills.filter(itemVisibleForCurrent).forEach((group) => {
    const block = el('div', 'skill-group');
    markRecruiterItem(block, group);
    block.appendChild(el('h3', 'skill-category', group.category));

    const list = el('ul', 'tags');
    group.items.forEach((item) => {
      list.appendChild(el('li', 'tag', item));
    });
    block.appendChild(list);

    grid.appendChild(block);
  });

  sec.appendChild(grid);
}

function mediaGatewayUrl(assetId, download) {
  const config = window.CONFIG || {};
  const base = config.MEDIA_GATEWAY_URL;
  if (!base || !assetId) return null;
  const url = new URL(base);
  url.searchParams.set('asset_id', String(assetId));
  if (download) url.searchParams.set('download', '1');
  const session = getStoredSession();
  if (session && session.session_token) {
    url.searchParams.set('session_token', session.session_token);
  }
  return url.toString();
}

function mediaIsRestricted(mediaVisibility) {
  return mediaVisibility && mediaVisibility !== 'public';
}

function openCertModal(cert) {
  const overlay = el('div', 'cert-modal-overlay');
  const modal = el('div', 'cert-modal');
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-label', cert.title);

  const header = el('div', 'cert-modal-header');
  header.appendChild(el('h3', 'cert-modal-title', cert.title));
  const close = el('button', 'cert-modal-close', '×');
  close.type = 'button';
  close.setAttribute('aria-label', 'Cerrar');
  close.addEventListener('click', closeCertModal);
  header.appendChild(close);
  modal.appendChild(header);

  const body = el('div', 'cert-modal-body');

  if (mediaIsRestricted(cert.media_visibility) && !isRecruiterActive()) {
    body.appendChild(
      el('div', 'cert-modal-notice',
        'Este archivo solo está disponible para reclutadores. Ingresa tu token de acceso para verlo.')
    );
  } else {
    const url = mediaGatewayUrl(cert.media_asset_id, false);
    if (url) {
      if (cert.media_type === 'image') {
        const img = el('img', 'cert-modal-media');
        img.src = url;
        img.alt = 'Evidencia de la certificación';
        img.loading = 'lazy';
        body.appendChild(img);
      } else {
        const frame = el('iframe', 'cert-modal-media cert-modal-frame');
        frame.src = url;
        frame.title = 'Vista previa de la certificación';
        frame.loading = 'lazy';
        body.appendChild(frame);
      }
    }
    const download = el('a', 'btn btn--small', 'Descargar');
    download.href = mediaGatewayUrl(cert.media_asset_id, true);
    download.target = '_blank';
    download.rel = 'noopener noreferrer';
    body.appendChild(download);
  }

  modal.appendChild(body);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  const onKeydown = (event) => {
    if (event.key === 'Escape') closeCertModal();
  };
  overlay._onKeydown = onKeydown;
  document.addEventListener('keydown', onKeydown);
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) closeCertModal();
  });

  close.focus();
}

function closeCertModal() {
  const overlay = document.querySelector('.cert-modal-overlay');
  if (!overlay) return;
  if (overlay._onKeydown) document.removeEventListener('keydown', overlay._onKeydown);
  overlay.remove();
}

function buildCertCard(cert) {
  const card = el('article', 'certification-card');
  markRecruiterItem(card, cert);
  card.appendChild(el('h3', 'certification-title', cert.title));
  card.appendChild(el('p', 'certification-meta', cert.issuer + ' · ' + cert.date));
  if (cert.description) {
    card.appendChild(el('p', 'certification-description', cert.description));
  }
  if (isRecruiterActive() && cert.credential_id) {
    card.appendChild(el('p', 'certification-credential', 'ID de credencial: ' + cert.credential_id));
  }
  if (cert.media_asset_id) {
    const open = el('button', 'btn btn--small', 'Mostrar certificación');
    open.type = 'button';
    open.addEventListener('click', () => openCertModal(cert));
    card.appendChild(open);
  }
  return card;
}

function renderCertifications(sec, certifications) {
  const visible = certifications.filter(itemVisibleForCurrent);
  const tech = visible.filter((cert) => Boolean(cert.tech));
  const general = visible.filter((cert) => !cert.tech);

  if (tech.length) {
    const group = el('div', 'certifications-group');
    group.appendChild(el('h3', 'certifications-subtitle', 'Certificados Tech'));
    group.appendChild(buildCertCarousel(tech));
    sec.appendChild(group);
  }
  if (general.length) {
    sec.appendChild(buildCertCarousel(general));
  }
}

function buildCertCarousel(list) {
  const carousel = el('div', 'certifications-carousel');
  const track = el('div', 'cert-carousel-track');

  list.forEach((cert) => track.appendChild(buildCertCard(cert)));
  list.forEach((cert) => {
    const copy = buildCertCard(cert);
    copy.inert = true;
    copy.setAttribute('aria-hidden', 'true');
    track.appendChild(copy);
  });

  carousel.appendChild(track);
  createCertCarousel(carousel, track);
  return carousel;
}

const certCarouselRegistry = [];
let certCarouselDocListener = null;

function destroyCertCarousels() {
  certCarouselRegistry.splice(0).forEach((car) => car.destroy());
}

function createCertCarousel(container, track) {
  const hasRaf = typeof requestAnimationFrame === 'function';
  const hasDoc = typeof document !== 'undefined' && typeof document.addEventListener === 'function';
  const hoverSupported = typeof matchMedia !== 'undefined' && matchMedia('(hover: hover)').matches;
  const reduceMotion =
    typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const HELD_RESUME_MS = 5000;
  const DRAG_SLOP = 8;

  const cards = Array.prototype.slice.call(track.children || []);
  const state = {
    progress: 0,
    half: 0,
    speed: 0,
    moving: false,
    dragging: false,
    held: false,
    paused: false,
    hovered: null,
    rafId: null,
    lastTs: 0,
    visible: true,
    resumeTimer: null,
    startX: 0,
    startProgress: 0,
    pointerId: null,
    pointerMoved: 0,
    captured: false,
    didDrag: false,
    observer: null,
    destroyed: false
  };

  function measure() {
    state.half = typeof track.scrollWidth === 'number' && track.scrollWidth > 0 ? track.scrollWidth / 2 : (cards.length || 1) * 344;
    state.speed = state.half / 40000;
  }

  function wrap(p) {
    return state.half ? ((p % state.half) + state.half) % state.half : 0;
  }

  function setProgress(p) {
    state.progress = p;
    track.style.transform = 'translateX(' + -p + 'px)';
  }

  function cardCenter(card) {
    return (card.offsetLeft || 0) + (card.offsetWidth || 320) / 2 - state.progress;
  }

  function containerCenter() {
    return (container.offsetWidth || 960) / 2;
  }

  function focusScale(card) {
    const cw = card.offsetWidth || 320;
    const range = cw * 0.9;
    const dist = Math.abs(cardCenter(card) - containerCenter());
    return 0.8 + Math.max(0, 1 - dist / range) * 0.2;
  }

  function applyMoving() {
    container.classList.add('is-moving');
    cards.forEach((card) => {
      card.style.transform = 'scale(' + focusScale(card).toFixed(3) + ')';
      card.style.zIndex = '';
      card.classList.remove('is-focus');
    });
  }

  function applyStatic(focusCard) {
    container.classList.remove('is-moving');
    cards.forEach((card) => {
      card.style.transform = 'scale(' + (card === focusCard ? 1 : 0.8) + ')';
      if (card === focusCard) {
        card.classList.add('is-focus');
        card.style.zIndex = '2';
      } else {
        card.classList.remove('is-focus');
        card.style.zIndex = '';
      }
    });
  }

  function nearestCard() {
    const c = containerCenter();
    let best = null;
    let bestDist = Infinity;
    cards.forEach((card) => {
      const d = Math.abs(cardCenter(card) - c);
      if (d < bestDist) {
        bestDist = d;
        best = card;
      }
    });
    return { card: best, dist: bestDist };
  }

  function stopLoop() {
    if (state.rafId) {
      cancelAnimationFrame(state.rafId);
      state.rafId = null;
    }
    state.lastTs = 0;
  }

  function beginHold(after) {
    clearTimeout(state.resumeTimer);
    state.resumeTimer = null;
    stopLoop();
    state.moving = false;
    state.paused = false;
    state.held = true;
    container.classList.add('is-held');
    if (after) after();
    state.resumeTimer = setTimeout(function () {
      resumeAuto(0);
    }, HELD_RESUME_MS);
  }

  function setHeld(card) {
    beginHold(function () {
      applyStatic(card);
    });
  }

  function park() {
    beginHold(null);
  }

  function releaseHeld() {
    if (!state.held) return;
    state.held = false;
    container.classList.remove('is-held');
  }

  function startMoving() {
    if (reduceMotion || state.destroyed) return;
    if (state.dragging || state.held || state.paused) return;
    if (state.moving && state.rafId) return;
    state.moving = true;
    if (hasRaf) {
      state.lastTs = 0;
      state.rafId = requestAnimationFrame(step);
    }
  }

  function resumeAuto(delay) {
    releaseHeld();
    state.hovered = null;
    state.paused = false;
    clearTimeout(state.resumeTimer);
    state.resumeTimer = null;
    applyMoving();
    if (delay != null && delay > 0) {
      state.resumeTimer = setTimeout(startMoving, delay);
    } else {
      startMoving();
    }
  }

  function deselect() {
    resumeAuto(150);
  }

  function step(ts) {
    if (state.destroyed || !state.visible) {
      state.rafId = null;
      state.moving = false;
      return;
    }
    if (!state.lastTs) state.lastTs = ts;
    const dt = Math.min(64, ts - state.lastTs);
    state.lastTs = ts;

    if (!state.dragging && !state.held && !state.paused) {
      setProgress(wrap(state.progress + state.speed * dt));
      applyMoving();
    }

    if (state.moving && !state.dragging && !state.held && !state.paused) {
      state.rafId = requestAnimationFrame(step);
    } else {
      state.rafId = null;
    }
  }

  function onPointerDown(event) {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    state.pointerId = event.pointerId;
    state.dragging = true;
    state.pointerMoved = 0;
    state.captured = false;
    state.didDrag = false;
    state.startX = event.clientX;
    state.startProgress = state.progress;
    container.classList.add('is-dragging');
    releaseHeld();
    clearTimeout(state.resumeTimer);
    state.resumeTimer = null;
    state.paused = false;
    stopLoop();
  }

  function onPointerMove(event) {
    if (!state.dragging || event.pointerId !== state.pointerId) return;
    const dx = event.clientX - state.startX;
    state.pointerMoved = Math.max(state.pointerMoved, Math.abs(dx));
    if (state.pointerMoved >= DRAG_SLOP) {
      state.didDrag = true;
      if (!state.captured && track.setPointerCapture) {
        try {
          track.setPointerCapture(event.pointerId);
          state.captured = true;
        } catch (err) {
          state.captured = false;
        }
      }
    }
    setProgress(wrap(state.startProgress - dx));
    applyMoving();
    if (event.preventDefault) event.preventDefault();
  }

  function onPointerUp(event) {
    if (!state.dragging || event.pointerId !== state.pointerId) return;
    state.dragging = false;
    container.classList.remove('is-dragging');
    if (state.captured) {
      if (track.releasePointerCapture) track.releasePointerCapture(event.pointerId);
      state.captured = false;
    }

    const onButton = event.target && event.target.closest && event.target.closest('button');
    if (state.pointerMoved < DRAG_SLOP) {
      const card = event.target && event.target.closest ? event.target.closest('.certification-card') : null;
      if (card && !onButton) {
        setHeld(card);
        return;
      }
      resumeAuto(0);
      return;
    }

    const near = nearestCard();
    if (near.card && near.dist < 0.45 * (near.card.offsetWidth || 320)) {
      const from = state.progress;
      const target = wrap(from + (cardCenter(near.card) - containerCenter()));
      const start = performance.now();
      const dur = 180;
      const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
      const animate = (now) => {
        const t = Math.min(1, (now - start) / dur);
        setProgress(wrap(from + (target - from) * ease(t)));
        if (t < 1) {
          requestAnimationFrame(animate);
        } else {
          setProgress(target);
          setHeld(near.card);
        }
      };
      requestAnimationFrame(animate);
    } else {
      park();
    }
  }

  function onMouseOver(event) {
    if (state.dragging || state.held) return;
    const card = event.target && event.target.closest ? event.target.closest('.certification-card') : null;
    state.hovered = card || null;
    state.paused = true;
    stopLoop();
    clearTimeout(state.resumeTimer);
    state.resumeTimer = null;
    applyStatic(card);
  }

  function onMouseLeave() {
    if (state.dragging || state.held) return;
    state.hovered = null;
    state.paused = false;
    resumeAuto(150);
  }

  if (hoverSupported) {
    container.addEventListener('mouseover', onMouseOver);
    container.addEventListener('mouseleave', onMouseLeave);
  }

  function onResize() {
    measure();
    setProgress(state.progress);
  }

  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('resize', onResize);
  }

  if (typeof IntersectionObserver === 'function' && typeof window !== 'undefined' && 'IntersectionObserver' in window) {
    state.observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        state.visible = entry.isIntersecting;
        if (!state.visible) {
          releaseHeld();
          stopLoop();
          state.moving = false;
          state.paused = false;
          state.hovered = null;
          clearTimeout(state.resumeTimer);
          state.resumeTimer = null;
        } else if (state.dragging || state.held || state.paused) {
          state.lastTs = 0;
        } else {
          startMoving();
        }
      });
    });
    state.observer.observe(container);
  }

  if (hasDoc && !certCarouselDocListener) {
    certCarouselDocListener = (event) => {
      document.querySelectorAll('.certifications-carousel').forEach((c) => {
        if (typeof c.contains === 'function' && c.contains(event.target)) return;
        if (c._certCarousel && typeof c._certCarousel.deselect === 'function') c._certCarousel.deselect();
      });
    };
    document.addEventListener('pointerdown', certCarouselDocListener, true);
  }

  function onContainerClick(event) {
    if (state.didDrag) {
      event.preventDefault();
      event.stopPropagation();
      state.didDrag = false;
    }
  }

  container.addEventListener('pointerdown', onPointerDown);
  container.addEventListener('pointermove', onPointerMove);
  container.addEventListener('pointerup', onPointerUp);
  container.addEventListener('pointercancel', onPointerUp);
  container.addEventListener('click', onContainerClick, true);

  container._certCarousel = {
    releaseHeld,
    deselect,
    destroy() {
      state.destroyed = true;
      stopLoop();
      clearTimeout(state.resumeTimer);
      if (state.observer) state.observer.disconnect();
      if (hoverSupported) {
        container.removeEventListener('mouseover', onMouseOver);
        container.removeEventListener('mouseleave', onMouseLeave);
      }
      container.removeEventListener('pointerdown', onPointerDown);
      container.removeEventListener('pointermove', onPointerMove);
      container.removeEventListener('pointerup', onPointerUp);
      container.removeEventListener('pointercancel', onPointerUp);
      container.removeEventListener('click', onContainerClick, true);
      if (typeof window !== 'undefined' && typeof window.removeEventListener === 'function') {
        window.removeEventListener('resize', onResize);
      }
    }
  };

  certCarouselRegistry.push(container._certCarousel);

  measure();
  setProgress(0);
  applyStatic(null);
  startMoving();
}

const SOCIAL_ICONS = {
  email:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>',
  github:
    '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/></svg>',
  linkedin:
    '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.225 0z"/></svg>',
  website:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/><path d="M2 12h20"/></svg>'
};

function renderContact(sec, contact) {
  const inner = el('div', 'contact');

  if (isFieldVisible(contact, 'message') && contact.message) {
    inner.appendChild(el('p', 'contact-message', contact.message));
  }

  const socials = el('div', 'social-links');
  const entries = [
    { key: 'email', label: 'Correo', value: contact.email, href: 'mailto:' + contact.email },
    { key: 'github', label: 'GitHub', value: contact.github },
    { key: 'linkedin', label: 'LinkedIn', value: contact.linkedin },
    { key: 'website', label: 'Sitio web', value: contact.website }
  ];

  entries.forEach((entry) => {
    if (!isFieldVisible(contact, entry.key) || !entry.value) return;
    const link = el('a', 'social-link');
    link.href = entry.href || entry.value;
    link.title = entry.label;
    link.setAttribute('aria-label', entry.label);
    if (entry.key !== 'email') {
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
    }
    link.innerHTML = SOCIAL_ICONS[entry.key] || '';
    socials.appendChild(link);
  });

  inner.appendChild(socials);
  sec.appendChild(inner);
}

function getStoredSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw);
    if (!session || !session.session_token || !session.session_expires) return null;
    if (new Date(session.session_expires).getTime() <= Date.now()) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    return session;
  } catch (_) {
    return null;
  }
}

function clearRecruiterSession() {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch (_) {}
}

function clearRecruiterTimers() {
  if (recruiterExpiryTimer) {
    clearTimeout(recruiterExpiryTimer);
    recruiterExpiryTimer = null;
  }
  if (recruiterExpiryCheck) {
    clearInterval(recruiterExpiryCheck);
    recruiterExpiryCheck = null;
  }
  window.removeEventListener('focus', revalidateRecruiterAccess);
  document.removeEventListener('visibilitychange', onRecruiterVisibilityChange);
}

function expireRecruiterAccess() {
  recruiterNotice = 'expired';
  deactivateRecruiterAccess();
}

function revokeRecruiterAccess(reason) {
  recruiterNotice = reason === 'revoked' ? 'revoked' : 'expired';
  deactivateRecruiterAccess();
}

function onRecruiterVisibilityChange() {
  if (document.visibilityState === 'visible') revalidateRecruiterAccess();
}

async function revalidateRecruiterAccess() {
  const session = getStoredSession();
  if (!session || !isRecruiterActive()) return;
  try {
    const content = await fetchRecruiterContent(session.session_token);
    if (!content || !content.ok) {
      revokeRecruiterAccess(content && content.error === 'revoked' ? 'revoked' : 'expired');
      return;
    }
    const next = buildExtendedData(content);
    if (JSON.stringify(next) !== JSON.stringify(extendedData)) {
      extendedData = next;
      render(extendedData);
    }
  } catch (_) {
    // Transitorio (red); no desactivar.
  }
}

function scheduleRecruiterExpiry() {
  clearRecruiterTimers();
  const session = getStoredSession();
  if (!session) return;
  const ms = new Date(session.session_expires).getTime() - Date.now();
  if (ms <= 0) {
    expireRecruiterAccess();
    return;
  }
  recruiterExpiryTimer = setTimeout(expireRecruiterAccess, ms + 500);
  recruiterExpiryCheck = setInterval(() => {
    if (isRecruiterActive() && getStoredSession()) {
      revalidateRecruiterAccess();
    } else if (extendedData) {
      expireRecruiterAccess();
    }
  }, RECRUITER_REVALIDATE_INTERVAL);
  window.addEventListener('focus', revalidateRecruiterAccess);
  document.addEventListener('visibilitychange', onRecruiterVisibilityChange);
}

async function callRpc(name, payload) {
  const config = window.CONFIG;
  const url = config.SUPABASE_URL + '/rest/v1/rpc/' + name;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      apikey: config.SUPABASE_ANON_KEY,
      Authorization: 'Bearer ' + config.SUPABASE_ANON_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload || {})
  });
  if (!response.ok) throw new Error(name + ': HTTP ' + response.status);
  return response.json();
}

function validateRecruiterToken(token) {
  return callRpc('validate_recruiter_token', { p_token: token });
}

function fetchRecruiterContent(sessionToken) {
  return callRpc('get_recruiter_content', { p_session_token: sessionToken });
}

function hasValue(value) {
  return Array.isArray(value) ? value.length > 0 : Boolean(value);
}

function mergeObjectFields(base, extra) {
  const merged = Object.assign({}, base || {});
  for (const key of Object.keys(extra || {})) {
    if (key === 'id') continue;
    if (hasValue(extra[key])) merged[key] = extra[key];
  }
  return merged;
}

function buildExtendedData(content) {
  return {
    ...publicData,
    experience: content.experience || [],
    education: content.education || [],
    projects: content.projects || [],
    skills: content.skills || [],
    certifications: content.certifications || [],
    profile: mergeObjectFields(publicData.profile, content.profile),
    contact: mergeObjectFields(publicData.contact, content.contact)
  };
}

async function loadExtendedData(session) {
  const content = await fetchRecruiterContent(session.session_token);
  if (!content || !content.ok) {
    extendedData = null;
    return false;
  }
  extendedData = buildExtendedData(content);
  return true;
}

function deactivateRecruiterAccess() {
  clearRecruiterTimers();
  clearRecruiterSession();
  extendedData = null;
  render(publicData);
}

function renderRecruiter(sec) {
  const inner = el('div', 'recruiter');

  const session = getStoredSession();
  if (isRecruiterActive() && session) {
    inner.appendChild(
      el('p', 'recruiter-status', 'Acceso ampliado activo hasta ' + new Date(session.session_expires).toLocaleString())
    );
    const deactivate = el('button', 'btn btn--small btn--secondary', 'Desactivar acceso');
    deactivate.type = 'button';
    deactivate.addEventListener('click', deactivateRecruiterAccess);
    inner.appendChild(deactivate);
    sec.appendChild(inner);
    return;
  }

  if (extendedData) extendedData = null;

  const form = el('form', 'recruiter-form');
  const input = el('input', 'recruiter-input');
  input.type = 'text';
  input.placeholder = 'Ingresa tu token de reclutador';
  input.autocomplete = 'off';
  input.setAttribute('aria-label', 'Token de reclutador');
  const submit = el('button', 'btn', 'Activar acceso');
  submit.type = 'submit';
  const feedback = el('p', 'recruiter-feedback');
  feedback.hidden = !recruiterNotice;
  if (recruiterNotice) {
    feedback.textContent =
      recruiterNotice === 'revoked'
        ? 'El acceso fue revocado por el propietario. Ingresa un token nuevo.'
        : 'El acceso ampliado caducó. Ingresa un token nuevo.';
    recruiterNotice = null;
  }
  form.appendChild(input);
  form.appendChild(submit);
  form.appendChild(feedback);
  inner.appendChild(form);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    feedback.hidden = true;
    const token = input.value.trim();
    if (!token) return;
    submit.disabled = true;
    submit.textContent = 'Validando...';
    try {
      const result = await validateRecruiterToken(token);
      if (result && result.ok) {
        localStorage.setItem(
          SESSION_KEY,
          JSON.stringify({ session_token: result.session_token, session_expires: result.session_expires })
        );
        const loaded = await loadExtendedData(result);
        if (loaded) {
          render(extendedData);
          scheduleRecruiterExpiry();
          window.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
          clearRecruiterSession();
          feedback.hidden = false;
          feedback.textContent = 'No se pudo cargar el contenido ampliado.';
        }
      } else {
        feedback.hidden = false;
        feedback.textContent = 'Token inválido, caducado o revocado.';
      }
    } catch (_) {
      feedback.hidden = false;
      feedback.textContent = 'No se pudo validar el token en este momento.';
    } finally {
      submit.disabled = false;
      submit.textContent = 'Activar acceso';
    }
  });

  sec.appendChild(inner);
}

function render(data) {
  document.documentElement.lang = data.site.lang || 'es';
  document.title = data.site.title || 'Portfolio';

  const existingHeader = document.querySelector('.site-header');
  if (existingHeader) existingHeader.remove();
  destroyCertCarousels();
  app.innerHTML = '';

  const sections = data.sections.filter((section) => sectionHasVisibleContent(section, data));

  buildHeader(sections);

  sections.forEach((section) => {
    const sec = createSection(section);
    const content =
      data[section.type === 'hero' || section.type === 'about' ? 'profile' : section.type];

    switch (section.type) {
      case 'hero':
        renderHero(sec, content);
        break;
      case 'about':
        renderAbout(sec, content);
        break;
      case 'cv':
        renderCv(sec, data);
        break;
      case 'projects':
        renderProjects(sec, data.projects);
        break;
      case 'skills':
        renderSkills(sec, data.skills);
        break;
      case 'certifications':
        renderCertifications(sec, data.certifications);
        break;
      case 'contact':
        renderContact(sec, data.contact);
        break;
      case 'recruiter':
        renderRecruiter(sec);
        break;
      default:
        sec.appendChild(el('p', null, 'Sección sin renderizador: ' + section.label));
    }

    app.appendChild(sec);
  });

  setupActiveNav(sections);
  initRevealAnimations();
}

function setupActiveNav(sections) {
  const links = document.querySelectorAll('.nav a');

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          links.forEach((link) => {
            link.classList.toggle('active', link.dataset.section === entry.target.id);
          });
        }
      });
    },
    { rootMargin: '-40% 0px -55% 0px' }
  );

  sections.forEach((section) => {
    const node = document.getElementById(section.id);
    if (node) observer.observe(node);
  });
}

const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        revealObserver.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.08, rootMargin: '0px 0px -40px 0px' }
);

function initRevealAnimations() {
  if (typeof IntersectionObserver === 'undefined') return;
  const reduceMotion =
    typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion) return;

  app.querySelectorAll('.section, .project-card, .timeline-entry, .skill-group').forEach((node) => {
    if (node.classList.contains('is-visible') || node.closest('.certifications-carousel')) return;
    node.classList.add('reveal');
    revealObserver.observe(node);
  });
}

async function fetchSupabaseTable(table, single) {
  const config = window.CONFIG;
  const url = config.SUPABASE_URL + '/rest/v1/' + table + '?select=*&order=id.asc';
  const headers = {
    apikey: config.SUPABASE_ANON_KEY,
    Authorization: 'Bearer ' + config.SUPABASE_ANON_KEY
  };
  const response = await fetch(url, { headers });
  if (!response.ok) throw new Error(table + ': HTTP ' + response.status);
  const rows = await response.json();
  return single ? rows[0] : rows;
}

function normalizeContent(data) {
  return {
    site: DEFAULT_SITE,
    sections: DEFAULT_SECTIONS,
    profile: data.profile || {},
    experience: data.experience || [],
    education: data.education || [],
    projects: data.projects || [],
    skills: data.skills || [],
    certifications: data.certifications || [],
    contact: data.contact || {}
  };
}

async function loadSupabaseContent() {
  const [profile, experience, education, projects, skills, contact, certifications] = await Promise.all([
    fetchSupabaseTable('profile_public', true),
    fetchSupabaseTable('experience'),
    fetchSupabaseTable('education'),
    fetchSupabaseTable('projects'),
    fetchSupabaseTable('skills'),
    fetchSupabaseTable('contact_public', true),
    fetchSupabaseTable('certifications_public')
  ]);
  return normalizeContent({ profile, experience, education, projects, skills, contact, certifications });
}

async function loadContent() {
  if (window.CONFIG && window.CONFIG.SUPABASE_URL) {
    try {
      return await loadSupabaseContent();
    } catch (error) {
      console.warn('Supabase no disponible, usando content.json:', error.message);
    }
  }
  const response = await fetch(DATA_URL);
  if (!response.ok) throw new Error('HTTP ' + response.status);
  return response.json();
}

(async function init() {
  try {
    publicData = await loadContent();
    render(publicData);

    const session = getStoredSession();
    if (session) {
      try {
        if (await loadExtendedData(session)) {
          render(extendedData);
          scheduleRecruiterExpiry();
        }
      } catch (_) {}
    }
  } catch (error) {
    const message = el('section', 'error');
    message.appendChild(el('h1', null, 'No se pudo cargar el contenido'));
    message.appendChild(el('p', null, error.message));
    message.appendChild(
      el('p', null, 'Felíz Jueves si la página no cargó...')
    );
    app.appendChild(message);
  }
})();
