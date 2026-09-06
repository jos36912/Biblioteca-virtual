const viewLogin = document.getElementById('view-login');
const viewPanel = document.getElementById('view-panel');
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');
const loginSubmit = document.getElementById('login-submit');
const panelEmail = document.getElementById('panel-email');
const logoutButton = document.getElementById('logout');

let supabaseClient = null;

function showView(name) {
  viewLogin.classList.toggle('hidden', name !== 'login');
  viewPanel.classList.toggle('hidden', name !== 'panel');
  if (name === 'panel') {
    renderModule('perfil');
  }
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

const MODULE_LABELS = {
  perfil: 'Perfil',
  experiencia: 'Experiencia',
  educacion: 'Educación',
  certificaciones: 'Certificaciones',
  proyectos: 'Proyectos',
  habilidades: 'Habilidades',
  contacto: 'Contacto',
  medios: 'Medios',
  tokens: 'Tokens'
};

const VISIBILITY_OPTIONS = [
  ['public', 'Público'],
  ['recruiter', 'Reclutador'],
  ['private', 'Privado']
];

const VISIBILITY_LABELS = Object.fromEntries(VISIBILITY_OPTIONS);

const CONTEXT_OPTIONS = [
  ['tech', 'Tech'],
  ['trayectoria', 'Trayectoria'],
  ['ambos', 'Ambos']
];
const CONTEXT_LABELS = Object.fromEntries(CONTEXT_OPTIONS);

function renderContextSelect(value) {
  const select = el('select', 'module-input module-select');
  CONTEXT_OPTIONS.forEach(([key, label]) => {
    const option = el('option', null, label);
    option.value = key;
    if (key === value) option.selected = true;
    select.appendChild(option);
  });
  return select;
}

const CONTEXT_FALLBACK_ID = { tech: 1, trayectoria: 2 };

function renderVisibilitySelect(value) {
  const select = el('select', 'module-input module-select');
  VISIBILITY_OPTIONS.forEach(([key, label]) => {
    const option = el('option', null, label);
    option.value = key;
    if (key === value) option.selected = true;
    select.appendChild(option);
  });
  return select;
}

const MODULES = {
  perfil: {
    type: 'form',
    table: 'profile',
    itemLabel: 'Perfil',
    fields: [
      ['name', 'Nombre', 'text'],
      ['role', 'Rol', 'text'],
      ['tagline', 'Tagline', 'text'],
      ['photo', 'Foto (URL)', 'text'],
      ['location', 'Ubicación', 'text'],
      ['summary', 'Resumen (una línea por párrafo)', 'list'],
      ['highlights', 'Destacados (una línea por ítem)', 'list']
    ]
  },
  contacto: {
    type: 'form',
    table: 'contact',
    itemLabel: 'Contacto',
    fields: [
      ['email', 'Correo', 'text'],
      ['github', 'GitHub (URL)', 'text'],
      ['linkedin', 'LinkedIn (URL)', 'text'],
      ['website', 'Sitio web (URL)', 'text'],
      ['message', 'Mensaje de presentación', 'textarea']
    ]
  },
  experiencia: {
    type: 'list',
    table: 'experience',
    itemLabel: 'Experiencia',
    titleFields: ['role', 'company'],
    metaFields: ['period'],
    tagsField: 'tech',
    fields: [
      ['role', 'Rol', 'text'],
      ['company', 'Empresa', 'text'],
      ['period', 'Período', 'text'],
      ['summary', 'Resumen', 'textarea'],
      ['tech', 'Tecnologías (una por línea)', 'list']
    ]
  },
  educacion: {
    type: 'list',
    table: 'education',
    itemLabel: 'Educación',
    titleFields: ['degree', 'institution'],
    metaFields: ['period'],
    fields: [
      ['degree', 'Título o grado', 'text'],
      ['institution', 'Institución', 'text'],
      ['period', 'Período', 'text'],
      ['notes', 'Notas', 'textarea']
    ]
  },
  certificaciones: {
    type: 'list',
    table: 'certifications',
    itemLabel: 'Certificación',
    titleFields: ['title'],
    metaFields: ['issuer', 'date'],
    fields: [
      ['title', 'Título', 'text'],
      ['issuer', 'Institución / emisor', 'text'],
      ['date', 'Fecha', 'text'],
      ['description', 'Descripción', 'textarea'],
      ['credential_id', 'ID de credencial (visible solo para reclutadores)', 'text'],
      ['tech', 'Certificado tech (carrusel superior)', 'checkbox'],
      ['media_asset_id', 'Archivo (PDF/imagen subido en Medios)', 'select', 'media_assets']
    ]
  },
  proyectos: {
    type: 'list',
    table: 'projects',
    itemLabel: 'Proyectos',
    titleFields: ['title'],
    metaFields: ['demo', 'repo'],
    tagsField: 'tech',
    fields: [
      ['title', 'Nombre', 'text'],
      ['description', 'Descripción', 'textarea'],
      ['tech', 'Tecnologías (una por línea)', 'list'],
      ['repo', 'Repositorio (URL)', 'text'],
      ['demo', 'Demo (URL)', 'text']
    ]
  },
  habilidades: {
    type: 'list',
    table: 'skills',
    itemLabel: 'Habilidades',
    titleFields: ['category'],
    tagsField: 'items',
    fields: [
      ['category', 'Categoría', 'text'],
      ['items', 'Habilidades (una por línea)', 'list']
    ]
  },
  medios: {
    type: 'media',
    table: 'media_assets',
    itemLabel: 'Medio'
  },
  tokens: {
    type: 'tokens',
    table: 'recruiter_tokens',
    itemLabel: 'Token'
  }
};

function splitLines(value) {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function showFeedback(node, message, isError) {
  node.textContent = message;
  node.hidden = false;
  node.classList.toggle('module-feedback--error', Boolean(isError));
}

function describeFunctionError(error, data) {
  const status =
    (error && (error.status || (error.context && error.context.status))) || null;
  const bodyError = data && typeof data === 'object' && data.error ? data.error : null;

  if (status === 401) {
    const suffix = bodyError ? ' (' + bodyError + ')' : '';
    return 'Sesión caducada. Cierra sesión y vuelve a iniciar sesión.' + suffix;
  }

  const parts = [];
  if (status) parts.push('HTTP ' + status);
  if (bodyError) parts.push(bodyError);
  if (error && error.message && !error.message.includes('non-2xx')) parts.push(error.message);
  return parts.join(' — ') || (error && error.message) || 'Error desconocido';
}

function renderModule(name) {
  const view = document.getElementById('module-view');
  const title = document.getElementById('panel-title');
  view.innerHTML = '';
  title.textContent = MODULE_LABELS[name] || name;

  const def = MODULES[name];
  if (!def) {
    view.appendChild(el('p', 'placeholder-text', 'Módulo próximamente disponible.'));
    return;
  }

  if (def.type === 'form') {
    renderFormModule(view, def);
  } else if (def.type === 'tokens') {
    renderTokensModule(view, def);
  } else if (def.type === 'media') {
    renderMediaModule(view, def);
  } else {
    renderListModule(view, def);
  }
}

function renderFormModule(view, def) {
  if (!supabaseClient) {
    view.appendChild(el('p', 'module-feedback module-feedback--error', 'Supabase no está disponible.'));
    return;
  }

  const form = el('form', 'module-form');
  const inputs = {};
  const visibilitySelects = {};

  const contextRow = el('div', 'module-field-row');
  contextRow.appendChild(el('label', 'module-label', 'Sitio (contexto)'));
  const contextSelect = renderContextSelect('tech');
  contextRow.appendChild(contextSelect);
  form.appendChild(contextRow);

  def.fields.forEach(([key, label, type]) => {
    const row = el('div', 'module-field-row');
    row.appendChild(el('label', 'module-label', label));
    const input = el(type === 'textarea' || type === 'list' ? 'textarea' : 'input');
    input.name = key;
    input.id = def.table + '-' + key;
    input.className = 'module-input';
    if (type === 'text') input.type = 'text';
    if (type === 'textarea' || type === 'list') input.rows = 4;
    row.appendChild(input);
    const visRow = el('div', 'module-field-vis');
    visRow.appendChild(el('span', 'module-vis-label', 'Visibilidad'));
    const visibility = renderVisibilitySelect('public');
    visRow.appendChild(visibility);
    row.appendChild(visRow);
    form.appendChild(row);
    inputs[key] = input;
    visibilitySelects[key] = visibility;
  });

  const feedback = el('p', 'module-feedback');
  feedback.hidden = true;
  const submit = el('button', 'btn', 'Guardar cambios');
  submit.type = 'submit';
  const actions = el('div', 'module-actions');
  actions.appendChild(submit);
  form.appendChild(feedback);
  form.appendChild(actions);
  view.appendChild(form);

  let currentRowId = null;

  function populateWhenLoaded(data) {
    const values = data || {};
    def.fields.forEach(([key, _label, type]) => {
      inputs[key].value = type === 'list' ? (values[key] || []).join('\n') : (values[key] || '');
      const visSelect = visibilitySelects[key];
      if (visSelect) visSelect.value = values[key + '_visibility'] || 'public';
    });
  }

  function loadForContext() {
    const context = contextSelect.value;
    supabaseClient
      .from(def.table)
      .select('*')
      .eq('context', context)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) {
          showFeedback(feedback, 'No se pudo cargar el ' + def.itemLabel.toLowerCase() + '. ¿Ejecutaste supabase/multisite.sql?', true);
          return;
        }
        currentRowId = data ? data.id : CONTEXT_FALLBACK_ID[context];
        populateWhenLoaded(data);
      });
  }

  contextSelect.addEventListener('change', loadForContext);
  loadForContext();

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    feedback.hidden = true;

    const payload = { id: currentRowId, context: contextSelect.value };
    def.fields.forEach(([key, _label, type]) => {
      payload[key] = fieldValue(inputs[key], type);
      const visSelect = visibilitySelects[key];
      payload[key + '_visibility'] = (visSelect && visSelect.value) || 'public';
    });

    submit.disabled = true;
    submit.textContent = 'Guardando...';

    const { error } = await supabaseClient.from(def.table).upsert(payload);

    submit.disabled = false;
    submit.textContent = 'Guardar cambios';

    if (error) {
      showFeedback(feedback, 'Error al guardar: ' + error.message, true);
    } else {
      showFeedback(feedback, def.itemLabel + ' guardado correctamente.');
    }
  });
}

function renderListModule(view, def) {
  view.innerHTML = '';

  if (!supabaseClient) {
    view.appendChild(el('p', 'module-feedback module-feedback--error', 'Supabase no está disponible.'));
    return;
  }

  view.appendChild(el('p', 'module-feedback', 'Cargando...'));

  supabaseClient
    .from(def.table)
    .select('*')
    .order('id')
    .then(({ data, error }) => {
      view.innerHTML = '';

      if (error) {
        view.appendChild(
          el('p', 'module-feedback module-feedback--error', 'No se pudieron cargar los datos. ¿Ejecutaste supabase/multisite.sql?')
        );
        return;
      }

      const rows = data || [];

      const toolbar = el('div', 'module-toolbar');
      const countEl = el('span', 'module-count', rows.length + ' registro(s)');
      toolbar.appendChild(countEl);

      const filterSelect = el('select', 'module-input module-select module-context-filter');
      const FILTER_OPTIONS = [['all', 'Todos los sitios'], ...CONTEXT_OPTIONS];
      FILTER_OPTIONS.forEach(([key, label]) => {
        const option = el('option', null, label);
        option.value = key;
        filterSelect.appendChild(option);
      });
      toolbar.appendChild(filterSelect);

      const newButton = el('button', 'btn btn--small', 'Nuevo');
      newButton.type = 'button';
      newButton.addEventListener('click', () => renderItemForm(view, def, null));
      toolbar.appendChild(newButton);
      view.appendChild(toolbar);

      const list = el('div', 'module-list');

      function applyFilter() {
        const filter = filterSelect.value;
        const filtered =
          filter === 'all'
            ? rows
            : rows.filter((row) => (row.context || 'ambos') === filter);
        countEl.textContent = filtered.length + ' registro(s)';
        list.innerHTML = '';
        filtered.forEach((row) => list.appendChild(buildItemCard(view, row, def)));
      }

      filterSelect.addEventListener('change', applyFilter);
      applyFilter();

      if (!rows.length) {
        view.appendChild(el('p', 'module-empty', 'No hay registros todavía. Crea el primero.'));
        return;
      }

      view.appendChild(list);
    });
}

function hexFromBytes(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function hashBytes(bytes) {
  if (crypto && crypto.subtle) {
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return hexFromBytes(new Uint8Array(digest));
  }
  if (window.SHA256) return window.SHA256.hex(bytes);
  throw new Error('No hay proveedor SHA-256 disponible. Accede por HTTPS o localhost.');
}

async function generateRecruiterToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const token = hexFromBytes(bytes);
  const hash = await hashBytes(bytes);
  return { token, hash };
}

function tokenState(token) {
  if (token.revoked_at) return { key: 'revocado', label: 'Revocado', badge: 'module-badge--revocado' };
  if (token.expires_at && new Date(token.expires_at) < new Date()) {
    return { key: 'caducado', label: 'Caducado', badge: 'module-badge--caducado' };
  }
  return { key: 'activo', label: 'Activo', badge: 'module-badge--activo' };
}

function formatDateTime(value) {
  if (!value) return '';
  return new Date(value).toLocaleString();
}

function renderTokenBox(container, token) {
  container.hidden = false;
  container.innerHTML = '';
  container.appendChild(
    el('p', 'module-label', 'Token generado. Cópialo ahora y entrégalo por correo o mensaje privado: solo se muestra una vez.')
  );
  const code = el('code', 'module-token-code', token);
  const copy = el('button', 'btn btn--small', 'Copiar');
  copy.type = 'button';
  copy.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(token);
    } catch (_) {
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(code);
      selection.removeAllRanges();
      selection.addRange(range);
    }
    copy.textContent = 'Copiado';
    setTimeout(() => {
      copy.textContent = 'Copiar';
    }, 1500);
  });
  const box = el('div', 'module-token-box');
  box.appendChild(code);
  box.appendChild(copy);
  container.appendChild(box);
}

function renderTokensModule(view, def) {
  view.innerHTML = '';

  if (!supabaseClient) {
    view.appendChild(el('p', 'module-feedback module-feedback--error', 'Supabase no está disponible.'));
    return;
  }

  const feedback = el('p', 'module-feedback');
  feedback.hidden = true;

  const form = el('form', 'module-form');
  form.appendChild(el('label', 'module-label', 'Etiqueta (ej. "Reclutador — Empresa X")'));
  const labelInput = el('input');
  labelInput.name = 'label';
  labelInput.className = 'module-input';
  labelInput.type = 'text';
  form.appendChild(labelInput);

  form.appendChild(el('label', 'module-label', 'Duración (horas)'));
  const durationInput = el('input');
  durationInput.name = 'duration';
  durationInput.className = 'module-input';
  durationInput.type = 'number';
  durationInput.min = '1';
  durationInput.value = '24';
  form.appendChild(durationInput);

  const submit = el('button', 'btn', 'Generar token');
  submit.type = 'submit';
  const actions = el('div', 'module-actions');
  actions.appendChild(submit);
  form.appendChild(feedback);
  form.appendChild(actions);
  view.appendChild(form);

  const tokenOutput = el('div', 'module-token-output');
  tokenOutput.hidden = true;
  view.appendChild(tokenOutput);

  const listBox = el('div', 'module-tokens-list');
  view.appendChild(listBox);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    feedback.hidden = true;
    submit.disabled = true;
    submit.textContent = 'Generando...';
    try {
      const { token, hash } = await generateRecruiterToken();
      const hours = Math.max(1, parseInt(durationInput.value, 10) || 24);
      const expiresAt = new Date(Date.now() + hours * 3600 * 1000).toISOString();
      const { error } = await supabaseClient.from(def.table).insert({
        label: labelInput.value.trim() || 'Token de reclutador',
        token_hash: hash,
        scope: 'extended',
        expires_at: expiresAt
      });
      if (error) {
        showFeedback(feedback, 'Error al generar el token: ' + error.message, true);
      } else {
        renderTokenBox(tokenOutput, token);
        labelInput.value = '';
        loadTokensList(listBox, def);
      }
    } catch (error) {
      showFeedback(feedback, 'No se pudo generar el token: ' + error.message, true);
    } finally {
      submit.disabled = false;
      submit.textContent = 'Generar token';
    }
  });

  loadTokensList(listBox, def);
}

function loadTokensList(listBox, def) {
  listBox.innerHTML = '';
  listBox.appendChild(el('h3', 'module-subtitle', 'Tokens existentes'));

  supabaseClient
    .from(def.table)
    .select('*')
    .order('created_at', { ascending: false })
    .then(({ data, error }) => {
      if (error) {
        listBox.appendChild(
          el('p', 'module-feedback module-feedback--error', 'No se pudieron cargar los tokens. ¿Ejecutaste supabase/schema.sql?')
        );
        return;
      }

      if (!data.length) {
        listBox.appendChild(el('p', 'module-empty', 'No hay tokens todavía. Genera el primero arriba.'));
        return;
      }

      const list = el('div', 'module-list');
      data.forEach((token) => {
        const card = el('article', 'module-item');
        const state = tokenState(token);

        const title = el('h3', 'module-item-title', token.label || 'Token');
        card.appendChild(title);
        card.appendChild(el('span', 'module-badge ' + state.badge, state.label));

        const meta = el('p', 'module-item-meta');
        meta.textContent = 'Creado: ' + formatDateTime(token.created_at) + (token.expires_at ? ' · Expira: ' + formatDateTime(token.expires_at) : '');
        card.appendChild(meta);

        if (token.last_used_at) {
          card.appendChild(el('p', 'module-item-meta', 'Último uso: ' + formatDateTime(token.last_used_at)));
        }

        if (state.key === 'activo') {
          const actions = el('div', 'module-item-actions');
          const revokeButton = el('button', 'btn btn--small btn--danger', 'Revocar');
          revokeButton.type = 'button';
          revokeButton.addEventListener('click', async () => {
            if (!window.confirm('¿Revocar este token? Dejará de funcionar de inmediato (sesiones incluidas).')) return;
            const { error } = await supabaseClient.rpc('revoke_recruiter_token', { p_token_id: token.id });
            if (error) {
              window.alert('Error al revocar: ' + error.message);
            } else {
              loadTokensList(listBox, def);
            }
          });
          actions.appendChild(revokeButton);
          card.appendChild(actions);
        }

        list.appendChild(card);
      });
      listBox.appendChild(list);
    });
}

function buildItemCard(view, row, def) {
  const card = el('article', 'module-item');

  const titleParts = (def.titleFields || [])
    .map((key) => row[key])
    .filter(Boolean);
  card.appendChild(el('h3', 'module-item-title', titleParts.join(' · ') || 'Sin título'));

  const visibility = row.visibility || 'public';
  if (visibility !== 'public') {
    card.appendChild(
      el('span', 'module-badge module-badge--' + visibility, VISIBILITY_LABELS[visibility] || visibility)
    );
  }

  const context = row.context || 'ambos';
  card.appendChild(el('span', 'module-badge module-badge--ctx-' + context, CONTEXT_LABELS[context] || context));

  if (row.tech) {
    card.appendChild(el('span', 'module-badge module-badge--tech', 'Tech'));
  }

  const metaParts = (def.metaFields || [])
    .map((key) => row[key])
    .filter(Boolean);
  if (metaParts.length) {
    card.appendChild(el('p', 'module-item-meta', metaParts.join(' · ')));
  }

  if (def.tagsField && row[def.tagsField] && row[def.tagsField].length) {
    const tags = el('div', 'module-tags');
    row[def.tagsField].forEach((tag) => tags.appendChild(el('span', 'module-tag', tag)));
    card.appendChild(tags);
  }

  const actions = el('div', 'module-item-actions');
  const editButton = el('button', 'btn btn--small btn--secondary', 'Editar');
  editButton.type = 'button';
  editButton.addEventListener('click', () => renderItemForm(view, def, row));
  const deleteButton = el('button', 'btn btn--small btn--danger', 'Eliminar');
  deleteButton.type = 'button';
  deleteButton.addEventListener('click', async () => {
    if (!window.confirm('¿Eliminar este registro?')) return;
    const { error } = await supabaseClient.from(def.table).delete().eq('id', row.id);
    if (error) {
      window.alert('Error al eliminar: ' + error.message);
    } else {
      renderListModule(view, def);
    }
  });
  actions.appendChild(editButton);
  actions.appendChild(deleteButton);
  card.appendChild(actions);

  return card;
}

function fieldValue(input, type) {
  if (type === 'checkbox') return Boolean(input.checked);
  return type === 'list' ? splitLines(input.value) : input.value.trim();
}

function renderItemForm(view, def, row) {
  const editing = Boolean(row);
  const form = el('form', 'module-form');
  const inputs = {};

  def.fields.forEach(([key, label, type, optionTable]) => {
    form.appendChild(el('label', 'module-label', label));

    if (type === 'select') {
      const select = el('select', 'module-input module-select');
      select.name = key;
      select.id = def.table + '-' + key;
      const empty = el('option', null, '— Ninguno —');
      empty.value = '';
      select.appendChild(empty);
      inputs[key] = select;
      if (optionTable) {
        supabaseClient
          .from(optionTable)
          .select('id,name,visibility')
          .then(({ data }) => {
            (data || []).forEach((optionRow) => {
              let label = optionRow.name || ('#' + optionRow.id);
              if (optionTable === 'media_assets' && optionRow.visibility) {
                label += ' (' + (VISIBILITY_LABELS[optionRow.visibility] || optionRow.visibility) + ')';
              }
              const option = el('option', null, label);
              option.value = optionRow.id;
              select.appendChild(option);
            });
            if (editing && row[key]) select.value = row[key];
          });
      }
      form.appendChild(select);
      if (key === 'media_asset_id' && optionTable === 'media_assets') {
        form.appendChild(
          el('p', 'module-hint',
            'La visibilidad del adjunto se controla en Medios: public = todos, recruiter/private = solo reclutadores con token.')
        );
      }
      return;
    }

    const input = el(type === 'checkbox' ? 'input' : type === 'list' || type === 'textarea' ? 'textarea' : 'input');
    input.name = key;
    input.id = def.table + '-' + key;
    input.className = 'module-input' + (type === 'checkbox' ? ' module-input--checkbox' : '');
    if (type === 'text') input.type = 'text';
    if (type === 'checkbox') input.type = 'checkbox';
    if (type === 'list' || type === 'textarea') input.rows = 4;
    form.appendChild(input);
    inputs[key] = input;
  });

  const feedback = el('p', 'module-feedback');
  feedback.hidden = true;
  const submit = el('button', 'btn', editing ? 'Guardar cambios' : 'Crear');
  submit.type = 'submit';
  const cancelButton = el('button', 'btn btn--secondary', 'Cancelar');
  cancelButton.type = 'button';
  cancelButton.addEventListener('click', () => renderListModule(view, def));
  const actions = el('div', 'module-actions');
  actions.appendChild(submit);
  actions.appendChild(cancelButton);

  const visRow = el('div', 'module-field-row');
  visRow.appendChild(el('label', 'module-label', 'Visibilidad'));
  const visibility = renderVisibilitySelect(editing ? row.visibility || 'public' : 'public');
  visRow.appendChild(visibility);

  const ctxRow = el('div', 'module-field-row');
  ctxRow.appendChild(el('label', 'module-label', 'Contexto'));
  const context = renderContextSelect(editing && row.context ? row.context : 'ambos');
  ctxRow.appendChild(context);

  form.appendChild(feedback);
  form.appendChild(ctxRow);
  form.appendChild(visRow);
  form.appendChild(actions);
  view.appendChild(form);

  if (editing) {
    def.fields.forEach(([key, _label, type]) => {
      if (type === 'select') return;
      if (type === 'checkbox') {
        inputs[key].checked = Boolean(row[key]);
        return;
      }
      const value = row[key];
      inputs[key].value = type === 'list' ? (value || []).join('\n') : (value || '');
    });
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    feedback.hidden = true;

    const payload = {};
    def.fields.forEach(([key, _label, type]) => {
      payload[key] =
        type === 'select'
          ? (inputs[key].value ? Number(inputs[key].value) : null)
          : fieldValue(inputs[key], type);
    });
    payload.visibility = visibility.value;
    payload.context = context.value;

    submit.disabled = true;
    submit.textContent = 'Guardando...';

    const result = editing
      ? await supabaseClient.from(def.table).update(payload).eq('id', row.id)
      : await supabaseClient.from(def.table).insert(payload);

    submit.disabled = false;
    submit.textContent = editing ? 'Guardar cambios' : 'Crear';

    if (result.error) {
      showFeedback(feedback, 'Error al guardar: ' + result.error.message, true);
    } else {
      renderListModule(view, def);
    }
  });
}

const MEDIA_TYPES = [
  ['image', 'Imagen'],
  ['document', 'Documento'],
  ['certificate', 'Certificado'],
  ['video', 'Video'],
  ['audio', 'Audio']
];

function renderMediaTypeSelect(value) {
  const select = el('select', 'module-input module-select');
  MEDIA_TYPES.forEach(([key, label]) => {
    const option = el('option', null, label);
    option.value = key;
    if (key === value) option.selected = true;
    select.appendChild(option);
  });
  return select;
}

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + units[i];
}

const IMAGE_MAX_WIDTH = 1600;
const IMAGE_QUALITY = 0.8;

function loadImageBitmap(file) {
  if (window.createImageBitmap) {
    return createImageBitmap(file, { imageOrientation: 'from-image' });
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('No se pudo leer la imagen'));
    };
    img.src = url;
  });
}

async function compressImage(file) {
  try {
    const image = await loadImageBitmap(file);
    const scale = Math.min(1, IMAGE_MAX_WIDTH / image.width);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const ctx = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', IMAGE_QUALITY));
    if (!blob || blob.size >= file.size) return null;
    return blob;
  } catch (_) {
    return null;
  }
}

function renderMediaModule(view, def) {
  view.innerHTML = '';

  if (!supabaseClient) {
    view.appendChild(el('p', 'module-feedback module-feedback--error', 'Supabase no está disponible.'));
    return;
  }

  const feedback = el('p', 'module-feedback');
  feedback.hidden = true;

  const form = el('form', 'module-form');
  form.appendChild(el('label', 'module-label', 'Archivo'));
  const fileInput = el('input');
  fileInput.type = 'file';
  fileInput.name = 'file';
  fileInput.className = 'module-input';
  form.appendChild(fileInput);

  form.appendChild(el('label', 'module-label', 'Nombre'));
  const nameInput = el('input');
  nameInput.type = 'text';
  nameInput.name = 'name';
  nameInput.className = 'module-input';
  form.appendChild(nameInput);

  form.appendChild(el('label', 'module-label', 'Tipo'));
  const typeSelect = renderMediaTypeSelect('document');
  form.appendChild(typeSelect);

  form.appendChild(el('label', 'module-label', 'Visibilidad'));
  const visSelect = renderVisibilitySelect('public');
  form.appendChild(visSelect);

  const submit = el('button', 'btn', 'Subir a R2');
  submit.type = 'submit';
  const actions = el('div', 'module-actions');
  actions.appendChild(submit);
  form.appendChild(feedback);
  form.appendChild(actions);
  view.appendChild(form);

  const listBox = el('div', 'module-media-list');
  view.appendChild(listBox);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    feedback.hidden = true;
    const rawFile = fileInput.files[0];
    if (!rawFile) {
      showFeedback(feedback, 'Selecciona un archivo primero.', true);
      return;
    }

    let file = rawFile;
    let mimeType = file.type || 'application/octet-stream';
    let compressionNote = '';
    if (mimeType.startsWith('image/')) {
      const compressed = await compressImage(file);
      if (compressed) {
        const before = file.size;
        file = compressed;
        mimeType = file.type || 'image/webp';
        compressionNote = ' · WebP ' + formatBytes(before) + ' → ' + formatBytes(file.size);
      }
    }

    submit.disabled = true;
    submit.textContent = 'Subiendo...';
    try {
      const { data, error } = await supabaseClient.functions.invoke('media-upload', {
        body: {
          name: nameInput.value.trim() || rawFile.name,
          type: typeSelect.value,
          mime_type: mimeType,
          visibility: visSelect.value
        }
      });
      if (error || !data.ok) {
        throw new Error(describeFunctionError(error, data));
      }
      const put = await fetch(data.upload_url, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': mimeType }
      });
      if (!put.ok) throw new Error('Fallo al subir el archivo: HTTP ' + put.status);

      const { error: insertError } = await supabaseClient.from('media_assets').insert({
        name: nameInput.value.trim() || rawFile.name,
        type: typeSelect.value,
        mime_type: mimeType,
        provider: 'cloudflare_r2',
        object_key: data.object_key,
        visibility: visSelect.value,
        size_bytes: file.size
      });
      if (insertError) throw insertError;

      showFeedback(feedback, 'Archivo subido correctamente.' + compressionNote);
      fileInput.value = '';
      nameInput.value = '';
      loadMediaList(listBox);
    } catch (error) {
      showFeedback(feedback, 'Error al subir: ' + error.message, true);
    } finally {
      submit.disabled = false;
      submit.textContent = 'Subir a R2';
    }
  });

  loadMediaList(listBox);
}

function loadMediaList(listBox) {
  listBox.innerHTML = '';
  listBox.appendChild(el('h3', 'module-subtitle', 'Medios existentes'));

  supabaseClient
    .from('media_assets')
    .select('*')
    .order('id', { ascending: false })
    .then(({ data, error }) => {
      if (error) {
        listBox.appendChild(
          el('p', 'module-feedback module-feedback--error', 'No se pudieron cargar los medios. ¿Ejecutaste supabase/schema.sql?')
        );
        return;
      }

      if (!data.length) {
        listBox.appendChild(el('p', 'module-empty', 'No hay archivos todavía. Sube el primero arriba.'));
        return;
      }

      const list = el('div', 'module-list');
      data.forEach((asset) => {
        const card = el('article', 'module-item');
        card.appendChild(el('h3', 'module-item-title', asset.name || ('#' + asset.id)));
        const badge = el('span', 'module-badge module-badge--' + asset.visibility, VISIBILITY_LABELS[asset.visibility] || asset.visibility);
        card.appendChild(badge);
        card.appendChild(el('p', 'module-item-meta', asset.type + ' · ' + asset.mime_type + ' · ' + formatBytes(asset.size_bytes)));
        card.appendChild(el('p', 'module-item-meta', 'Clave R2: ' + asset.object_key));

        const actions = el('div', 'module-item-actions');
        const deleteButton = el('button', 'btn btn--small btn--danger', 'Eliminar');
        deleteButton.type = 'button';
        deleteButton.addEventListener('click', async () => {
          if (!window.confirm('¿Eliminar este medio? Se borra el registro y el archivo en R2.')) return;
          let r2Failed = false;
          try {
            const del = await supabaseClient.functions.invoke('media-delete', { body: { object_key: asset.object_key } });
            r2Failed = Boolean(del.error) || !(del.data && del.data.ok);
          } catch (error) {
            r2Failed = true;
          }
          const { error: delError } = await supabaseClient.from('media_assets').delete().eq('id', asset.id);
          if (delError) {
            window.alert('Registro borrado en R2 pero falló la eliminación local: ' + delError.message);
            return;
          }
          if (r2Failed) {
            window.alert('El archivo se eliminó del registro, pero no se pudo borrar de R2. Revísalo en el dashboard de Cloudflare.');
          }
          loadMediaList(listBox);
        });
        actions.appendChild(deleteButton);
        card.appendChild(actions);

        list.appendChild(card);
      });
      listBox.appendChild(list);
    });
}

function setLoginError(message) {
  loginError.textContent = message;
  loginError.hidden = false;
}

function initSupabase() {
  if (typeof window.supabase === 'undefined' || !window.supabase.createClient) {
    return false;
  }
  supabaseClient = window.supabase.createClient(
    CONFIG.SUPABASE_URL,
    CONFIG.SUPABASE_ANON_KEY
  );
  return true;
}

function handleSession(session) {
  if (session) {
    panelEmail.textContent = session.user.email;
    showView('panel');
  } else {
    showView('login');
  }
}

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  loginError.hidden = true;

  if (!supabaseClient) {
    setLoginError('Supabase no está disponible. Recarga la página o revisa la conexión.');
    return;
  }

  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;

  loginSubmit.disabled = true;
  loginSubmit.textContent = 'Ingresando...';

  const { error } = await supabaseClient.auth.signInWithPassword({ email, password });

  loginSubmit.disabled = false;
  loginSubmit.textContent = 'Iniciar sesión';

  if (error) {
    setLoginError(error.message);
  }
});

logoutButton.addEventListener('click', () => {
  if (supabaseClient) supabaseClient.auth.signOut();
});

document.querySelectorAll('.panel-nav a').forEach((link) => {
  link.addEventListener('click', (event) => {
    event.preventDefault();
    document.querySelectorAll('.panel-nav a').forEach((item) => {
      item.classList.remove('active');
    });
    link.classList.add('active');
    renderModule(link.dataset.view);
  });
});

showView('login');

if (!initSupabase()) {
  setLoginError('No se pudo cargar el cliente de Supabase. Recarga la página.');
} else {
  supabaseClient.auth
    .getSession()
    .then(({ data }) => handleSession(data.session))
    .catch(() => {});
  supabaseClient.auth.onAuthStateChange((_event, session) => {
    handleSession(session);
  });
}
