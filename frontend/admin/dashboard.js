const API_BASE = window.ENQUIRY_API_BASE || 'http://localhost:5000/api';

let state = {
  token: localStorage.getItem('enquiry_token') || null,
  admin: JSON.parse(localStorage.getItem('enquiry_admin') || 'null'),
  page: 1,
  limit: 20,
  filters: { search: '', status: '', priority: '', sortBy: 'createdAt' },
  auditPage: 1,
};

// ---------------- API helper ----------------
async function api(path, opts = {}) {
  const headers = opts.headers || {};
  if (state.token) headers['Authorization'] = `Bearer ${state.token}`;
  if (!(opts.body instanceof FormData) && opts.body) {
    headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(`${API_BASE}${path}`, { ...opts, headers });
  if (res.status === 401) {
    logout();
    throw new Error('Session expired. Please sign in again.');
  }
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Request failed');
  return data;
}

// ---------------- Auth ----------------
const loginForm = document.getElementById('loginForm');
const loginError = document.getElementById('loginError');

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  loginError.textContent = '';
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  const btn = document.getElementById('loginBtn');
  btn.disabled = true;
  btn.textContent = 'Signing in...';
  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Login failed');
    state.token = data.token;
    state.admin = data.admin;
    localStorage.setItem('enquiry_token', data.token);
    localStorage.setItem('enquiry_admin', JSON.stringify(data.admin));
    showApp();
  } catch (err) {
    loginError.textContent = err.message;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Sign in';
  }
});

document.getElementById('logoutBtn').addEventListener('click', logout);

function logout() {
  state.token = null;
  state.admin = null;
  localStorage.removeItem('enquiry_token');
  localStorage.removeItem('enquiry_admin');
  document.getElementById('appView').style.display = 'none';
  document.getElementById('loginView').style.display = 'flex';
}

function showApp() {
  document.getElementById('loginView').style.display = 'none';
  document.getElementById('appView').style.display = 'flex';
  document.getElementById('whoName').textContent = state.admin.name;
  document.getElementById('whoRole').textContent = state.admin.role;
  loadDashboard();
}

// ---------------- Navigation ----------------
document.querySelectorAll('.nav-item').forEach((btn) => {
  btn.addEventListener('click', () => switchView(btn.dataset.view));
});
document.getElementById('backToList').addEventListener('click', () => switchView('enquiries'));

function switchView(name) {
  document.querySelectorAll('.view').forEach((v) => (v.style.display = 'none'));
  document.querySelectorAll('.nav-item').forEach((b) => b.classList.remove('active'));
  const navBtn = document.querySelector(`.nav-item[data-view="${name}"]`);
  if (navBtn) navBtn.classList.add('active');
  document.getElementById(`view-${name}`).style.display = 'block';

  if (name === 'dashboard') loadDashboard();
  if (name === 'enquiries') loadEnquiries();
  if (name === 'audit') loadAuditLogs();
}

// ---------------- Dashboard ----------------
async function loadDashboard() {
  try {
    const { data } = await api('/enquiries/stats/summary');
    const statGrid = document.getElementById('statGrid');
    statGrid.innerHTML = `
      <div class="stat-card"><div class="num">${data.total}</div><div class="label">Total enquiries</div></div>
      <div class="stat-card"><div class="num">${data.last7Days}</div><div class="label">Last 7 days</div></div>
      <div class="stat-card"><div class="num">${data.byStatus['New'] || 0}</div><div class="label">New</div></div>
      <div class="stat-card"><div class="num">${data.byStatus['In Progress'] || 0}</div><div class="label">In progress</div></div>
    `;
    const statuses = ['New', 'In Progress', 'On Hold', 'Resolved', 'Closed'];
    const max = Math.max(...statuses.map((s) => data.byStatus[s] || 0), 1);
    document.getElementById('statusBars').innerHTML = statuses
      .map((s) => {
        const count = data.byStatus[s] || 0;
        const pct = Math.round((count / max) * 100);
        return `<div class="bar-row">
          <span class="bar-label">${s}</span>
          <div class="bar-track"><div class="bar-fill" style="width:${pct}%"></div></div>
          <span class="bar-count">${count}</span>
        </div>`;
      })
      .join('');
  } catch (err) {
    toast(err.message);
  }
}

// ---------------- Enquiries list ----------------
const searchInput = document.getElementById('searchInput');
const filterStatus = document.getElementById('filterStatus');
const filterPriority = document.getElementById('filterPriority');
const sortBySelect = document.getElementById('sortBy');

let searchDebounce;
searchInput.addEventListener('input', () => {
  clearTimeout(searchDebounce);
  searchDebounce = setTimeout(() => {
    state.filters.search = searchInput.value.trim();
    state.page = 1;
    loadEnquiries();
  }, 350);
});
filterStatus.addEventListener('change', () => {
  state.filters.status = filterStatus.value;
  state.page = 1;
  loadEnquiries();
});
filterPriority.addEventListener('change', () => {
  state.filters.priority = filterPriority.value;
  state.page = 1;
  loadEnquiries();
});
sortBySelect.addEventListener('change', () => {
  state.filters.sortBy = sortBySelect.value;
  state.page = 1;
  loadEnquiries();
});

function pillClass(value) {
  return value.replace(/\s+/g, '');
}

async function loadEnquiries() {
  const params = new URLSearchParams({
    page: state.page,
    limit: state.limit,
    sortBy: state.filters.sortBy,
  });
  if (state.filters.search) params.set('search', state.filters.search);
  if (state.filters.status) params.set('status', state.filters.status);
  if (state.filters.priority) params.set('priority', state.filters.priority);

  try {
    const { data, pagination } = await api(`/enquiries?${params.toString()}`);
    const tbody = document.getElementById('enquiryTableBody');
    if (data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--slate);padding:32px;">No enquiries match these filters.</td></tr>`;
    } else {
      tbody.innerHTML = data
        .map(
          (e) => `
        <tr data-id="${e._id}">
          <td class="ref-code">${e.referenceCode}</td>
          <td>${escapeHtml(e.fullName)}<br><span style="color:var(--slate);font-size:12px;">${escapeHtml(e.email)}</span></td>
          <td>${escapeHtml(e.subject)}</td>
          <td><span class="pill pill-${pillClass(e.status)}"><span class="dot"></span>${e.status}</span></td>
          <td><span class="pill pill-${e.priority}">${e.priority}</span></td>
          <td style="font-family:'IBM Plex Mono',monospace;font-size:12px;">${new Date(e.createdAt).toLocaleDateString()}</td>
        </tr>`
        )
        .join('');
      tbody.querySelectorAll('tr[data-id]').forEach((row) => {
        row.addEventListener('click', () => openDetail(row.dataset.id));
      });
    }

    document.getElementById('pagination').innerHTML = `
      <span>Page ${pagination.page} of ${pagination.totalPages} &middot; ${pagination.total} total</span>
      <div>
        <button id="prevPage" ${!pagination.hasPrevPage ? 'disabled' : ''}>Previous</button>
        <button id="nextPage" ${!pagination.hasNextPage ? 'disabled' : ''}>Next</button>
      </div>
    `;
    document.getElementById('prevPage')?.addEventListener('click', () => {
      state.page -= 1;
      loadEnquiries();
    });
    document.getElementById('nextPage')?.addEventListener('click', () => {
      state.page += 1;
      loadEnquiries();
    });
  } catch (err) {
    toast(err.message);
  }
}

// ---------------- Enquiry detail ----------------
async function openDetail(id) {
  switchView('detail');
  const content = document.getElementById('detailContent');
  content.innerHTML = '<p style="color:var(--slate);">Loading...</p>';

  try {
    const [{ data: e }, auditRes] = await Promise.all([
      api(`/enquiries/${id}`),
      api(`/audit-logs?enquiryId=${id}&limit=50`),
    ]);
    const logs = auditRes.data;

    const statusOptions = ['New', 'In Progress', 'On Hold', 'Resolved', 'Closed']
      .map((s) => `<option value="${s}" ${s === e.status ? 'selected' : ''}>${s}</option>`)
      .join('');
    const priorityOptions = ['Low', 'Medium', 'High', 'Urgent']
      .map((p) => `<option value="${p}" ${p === e.priority ? 'selected' : ''}>${p}</option>`)
      .join('');

    const attachmentsHtml = (e.attachments || [])
      .map(
        (a) => `
      <div class="attachment-item">
        <span>${escapeHtml(a.originalName)} <span style="color:var(--slate);">(${(a.sizeBytes / 1024).toFixed(0)} KB)</span></span>
        <a href="#" data-download="${a.storedName}" data-id="${e._id}">Download</a>
      </div>`
      )
      .join('') || '<p style="color:var(--slate);font-size:13px;">No attachments.</p>';

    const timelineHtml = logs.length
      ? logs
          .map(
            (l) => `
      <div class="timeline-item">
        <div class="t-action">${formatAction(l)}</div>
        <div class="t-meta">${new Date(l.createdAt).toLocaleString()} &middot; ${l.actorName || (l.actor && l.actor.name) || 'System'}</div>
      </div>`
          )
          .join('')
      : '<p style="color:var(--slate);font-size:13px;">No activity recorded yet.</p>';

    content.innerHTML = `
      <div class="detail-grid">
        <div>
          <div class="detail-card">
            <span class="code">${e.referenceCode}</span>
            <h2 style="margin-top:6px;">${escapeHtml(e.subject)}</h2>
            <dl class="kv">
              <dt>Name</dt><dd>${escapeHtml(e.fullName)}</dd>
              <dt>Email</dt><dd>${escapeHtml(e.email)}</dd>
              <dt>Phone</dt><dd>${escapeHtml(e.phone || '—')}</dd>
              <dt>Company</dt><dd>${escapeHtml(e.company || '—')}</dd>
              <dt>Project type</dt><dd>${e.projectType}</dd>
              <dt>Budget</dt><dd>${e.budgetRange}</dd>
              <dt>Received</dt><dd>${new Date(e.createdAt).toLocaleString()}</dd>
            </dl>
            <div class="message-box">${escapeHtml(e.message)}</div>
          </div>
          <div class="detail-card">
            <h3>Attachments</h3>
            ${attachmentsHtml}
          </div>
          <div class="detail-card">
            <h3>Internal notes</h3>
            <textarea id="notesInput">${escapeHtml(e.internalNotes || '')}</textarea>
            <div style="margin-top:10px;"><button class="save-btn" id="saveNotesBtn">Save notes</button></div>
          </div>
        </div>
        <div>
          <div class="detail-card">
            <h3>Manage</h3>
            <div class="control-row">
              <div>
                <label style="display:block;font-size:12px;color:var(--slate);margin-bottom:4px;">Status</label>
                <select id="statusSelect">${statusOptions}</select>
              </div>
              <div>
                <label style="display:block;font-size:12px;color:var(--slate);margin-bottom:4px;">Priority</label>
                <select id="prioritySelect">${priorityOptions}</select>
              </div>
            </div>
          </div>
          <div class="detail-card">
            <h3>Activity</h3>
            <div class="timeline">${timelineHtml}</div>
          </div>
        </div>
      </div>
    `;

    document.getElementById('statusSelect').addEventListener('change', async (ev) => {
      try {
        await api(`/enquiries/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status: ev.target.value }) });
        toast('Status updated');
        openDetail(id);
      } catch (err) {
        toast(err.message);
      }
    });
    document.getElementById('prioritySelect').addEventListener('change', async (ev) => {
      try {
        await api(`/enquiries/${id}/priority`, { method: 'PATCH', body: JSON.stringify({ priority: ev.target.value }) });
        toast('Priority updated');
        openDetail(id);
      } catch (err) {
        toast(err.message);
      }
    });
    document.getElementById('saveNotesBtn').addEventListener('click', async () => {
      const internalNotes = document.getElementById('notesInput').value;
      try {
        await api(`/enquiries/${id}/notes`, { method: 'PATCH', body: JSON.stringify({ internalNotes }) });
        toast('Notes saved');
      } catch (err) {
        toast(err.message);
      }
    });
    content.querySelectorAll('[data-download]').forEach((link) => {
      link.addEventListener('click', async (ev) => {
        ev.preventDefault();
        const storedName = link.dataset.download;
        try {
          const res = await fetch(`${API_BASE}/enquiries/${id}/attachments/${storedName}`, {
            headers: { Authorization: `Bearer ${state.token}` },
          });
          if (!res.ok) throw new Error('Download failed');
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = link.textContent;
          a.click();
          URL.revokeObjectURL(url);
        } catch (err) {
          toast(err.message);
        }
      });
    });
  } catch (err) {
    content.innerHTML = `<p style="color:var(--brick);">${err.message}</p>`;
  }
}

function formatAction(l) {
  const map = {
    ENQUIRY_CREATED: 'Enquiry submitted',
    STATUS_CHANGED: `Status changed: ${l.fromValue} → ${l.toValue}`,
    PRIORITY_CHANGED: `Priority changed: ${l.fromValue} → ${l.toValue}`,
    ASSIGNED: `Reassigned`,
    NOTE_UPDATED: 'Internal notes updated',
    ENQUIRY_VIEWED: 'Viewed by admin',
    ENQUIRY_DELETED: 'Enquiry deleted',
    ATTACHMENT_DOWNLOADED: 'Attachment downloaded',
  };
  return map[l.action] || l.action;
}

// ---------------- Audit log view ----------------
async function loadAuditLogs() {
  try {
    const { data, pagination } = await api(`/audit-logs?page=${state.auditPage}&limit=25`);
    document.getElementById('auditTableBody').innerHTML = data
      .map(
        (l) => `
      <tr>
        <td style="font-family:'IBM Plex Mono',monospace;font-size:12px;">${new Date(l.createdAt).toLocaleString()}</td>
        <td>${(l.actor && l.actor.name) || l.actorName || 'System'}</td>
        <td>${formatAction(l)}</td>
        <td style="color:var(--slate);font-size:12px;">${l.ipAddress || '—'}</td>
        <td class="ref-code">${(l.enquiry && l.enquiry.referenceCode) || '—'}</td>
      </tr>`
      )
      .join('');

    document.getElementById('auditPagination').innerHTML = `
      <span>Page ${pagination.page} of ${pagination.totalPages} &middot; ${pagination.total} total</span>
      <div>
        <button id="auditPrev" ${pagination.page <= 1 ? 'disabled' : ''}>Previous</button>
        <button id="auditNext" ${pagination.page >= pagination.totalPages ? 'disabled' : ''}>Next</button>
      </div>
    `;
    document.getElementById('auditPrev')?.addEventListener('click', () => {
      state.auditPage -= 1;
      loadAuditLogs();
    });
    document.getElementById('auditNext')?.addEventListener('click', () => {
      state.auditPage += 1;
      loadAuditLogs();
    });
  } catch (err) {
    toast(err.message);
  }
}

// ---------------- Utilities ----------------
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

let toastTimer;
function toast(msg) {
  let el = document.querySelector('.toast');
  if (!el) {
    el = document.createElement('div');
    el.className = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2800);
}

// ---------------- Boot ----------------
if (state.token && state.admin) {
  showApp();
} else {
  document.getElementById('loginView').style.display = 'flex';
}
