/**
 * ============================================================
 * NIAS Users Management Module — Professional Edition
 * المعهد الوطني للعلوم الإدارية — فرع إب
 * ============================================================
 * @version 3.0.0
 * @module UsersManager
 */

'use strict';

/* ═══════════════════════════════════════════════════════
   Constants & Enums
   ═══════════════════════════════════════════════════════ */

const ROLES_CONFIG = Object.freeze({
  admin:        { label: 'مدير النظام', badgeClass: 'badge-danger',  level: 100 },
  dean:         { label: 'عميد',        badgeClass: 'badge-gold',    level: 90 },
  vice_dean:    { label: 'نائب عميد',   badgeClass: 'badge-gold',    level: 80 },
  head:         { label: 'رئيس قسم',    badgeClass: 'badge-gold',    level: 70 },
  faculty:      { label: 'عضو هيئة تدريس', badgeClass: 'badge-success', level: 50 },
  evaluator:    { label: 'مقيّم',       badgeClass: 'badge-warning', level: 40 },
  student:      { label: 'طالب',        badgeClass: 'badge-info',    level: 10 }
});

const EVALUATOR_ROLES = Object.freeze(['faculty', 'evaluator', 'head', 'dean', 'vice_dean']);
const ITEMS_PER_PAGE = 15;

/* ═══════════════════════════════════════════════════════
   Utility Functions
   ═══════════════════════════════════════════════════════ */

const Utils = {
  /**
   * Escape HTML entities to prevent XSS
   * @param {string} text
   * @returns {string}
   */
  escapeHtml(text) {
    if (text == null) return '';
    const div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
  },

  /**
   * Format date to Arabic locale
   * @param {string|Date|null} date
   * @returns {string}
   */
  formatDate(date) {
    if (!date) return '—';
    try {
      return new Date(date).toLocaleDateString('ar-YE', {
        year: 'numeric', month: 'short', day: 'numeric'
      });
    } catch {
      return '—';
    }
  },

  /**
   * Debounce function calls
   * @param {Function} fn
   * @param {number} delay
   * @returns {Function}
   */
  debounce(fn, delay = 300) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  },

  /**
   * Generate UUID v4
   * @returns {string}
   */
  uuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  },

  /**
   * Validate email format
   * @param {string} email
   * @returns {boolean}
   */
  isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  },

  /**
   * Validate username format
   * @param {string} username
   * @returns {boolean}
   */
  isValidUsername(username) {
    return /^[a-zA-Z0-9_.\-]{3,32}$/.test(username);
  },

  /**
   * Sanitize phone number
   * @param {string} phone
   * @returns {string}
   */
  sanitizePhone(phone) {
    return phone.replace(/[^\d+\s\-]/g, '').trim();
  }
};

/* ═══════════════════════════════════════════════════════
   UsersManager Class
   ═══════════════════════════════════════════════════════ */

class UsersManager {
  /** @type {Array<Object>} */
  #users = [];
  /** @type {Array<Object>} */
  #filteredUsers = [];
  /** @type {string|null} */
  #deleteTargetId = null;
  /** @type {boolean} */
  #isEditing = false;
  /** @type {number} */
  #currentPage = 1;
  /** @type {Object} */
  #filters = { query: '', role: '', status: '' };
  /** @type {AbortController|null} */
  #currentRequest = null;

  constructor() {
    this.#cacheElements();
    this.#bindEvents();
  }

  /* ─── Initialization ─── */

  async init() {
    try {
      // Auth check
      const authed = await Auth.requireAuth();
      if (!authed) return;

      if (!Auth.hasPermission?.(PERMISSIONS?.VIEW_USERS)) {
        App.toast('ليس لديك صلاحية لعرض المستخدمين', 'error');
        window.location.href = 'index.html';
        return;
      }

      this.#renderUserChip();
      await this.#loadUsers();

    } catch (error) {
      console.error('[Users] Init failed:', error);
      App.toast('فشل تهيئة الصفحة', 'error');
    }
  }

  /* ─── DOM Cache ─── */

  #cacheElements() {
    this.els = {
      tableBody: document.getElementById('users-table-body'),
      emptyState: document.getElementById('empty-state'),
      searchInput: document.getElementById('user-search'),
      searchClear: document.getElementById('search-clear'),
      roleFilter: document.getElementById('role-filter'),
      statusFilter: document.getElementById('status-filter'),
      pagination: document.getElementById('pagination'),
      paginationInfo: document.getElementById('pagination-info'),
      btnPrev: document.getElementById('btn-prev'),
      btnNext: document.getElementById('btn-next'),
      btnAdd: document.getElementById('btn-add-user'),
      btnExport: document.getElementById('btn-export'),
      btnImport: document.getElementById('btn-import'),
      
      // Modal
      modal: document.getElementById('user-modal'),
      modalTitle: document.getElementById('user-modal-title'),
      form: document.getElementById('user-form'),
      btnSave: document.getElementById('btn-save'),
      btnCancel: document.getElementById('btn-cancel'),
      btnClose: document.getElementById('modal-close'),
      btnTogglePass: document.getElementById('btn-toggle-pass'),
      
      // Delete Modal
      deleteModal: document.getElementById('delete-modal'),
      deleteTargetName: document.getElementById('delete-user-name'),
      btnCancelDelete: document.getElementById('btn-cancel-delete'),
      btnConfirmDelete: document.getElementById('btn-confirm-delete'),
      btnCloseDelete: document.getElementById('delete-modal-close'),
      
      // User chip
      userAvatar: document.getElementById('user-avatar'),
      userNameLabel: document.getElementById('user-name-label'),
      userRoleLabel: document.getElementById('user-role-label'),
      userChip: document.getElementById('user-chip')
    };
  }

  /* ─── Event Binding ─── */

  #bindEvents() {
    // Search with debounce
    this.els.searchInput?.addEventListener('input', 
      Utils.debounce((e) => this.#handleSearch(e.target.value), 250)
    );
    
    this.els.searchClear?.addEventListener('click', () => {
      this.els.searchInput.value = '';
      this.els.searchClear.hidden = true;
      this.#handleSearch('');
    });

    // Filters
    this.els.roleFilter?.addEventListener('change', (e) => {
      this.#filters.role = e.target.value;
      this.#currentPage = 1;
      this.#applyFilters();
    });
    
    this.els.statusFilter?.addEventListener('change', (e) => {
      this.#filters.status = e.target.value;
      this.#currentPage = 1;
      this.#applyFilters();
    });

    // Pagination
    this.els.btnPrev?.addEventListener('click', () => this.#changePage(-1));
    this.els.btnNext?.addEventListener('click', () => this.#changePage(1));

    // Add user
    this.els.btnAdd?.addEventListener('click', () => this.#openAddModal());
    
    // Export/Import
    this.els.btnExport?.addEventListener('click', () => this.#exportToExcel());
    this.els.btnImport?.addEventListener('click', () => this.#importFromExcel());

    // Modal controls
    this.els.btnClose?.addEventListener('click', () => this.#closeModal());
    this.els.btnCancel?.addEventListener('click', () => this.#closeModal());
    this.els.btnTogglePass?.addEventListener('click', () => this.#togglePassword());
    this.els.form?.addEventListener('submit', (e) => this.#handleSubmit(e));

    // Delete modal
    this.els.btnCloseDelete?.addEventListener('click', () => this.#closeDeleteModal());
    this.els.btnCancelDelete?.addEventListener('click', () => this.#closeDeleteModal());
    this.els.btnConfirmDelete?.addEventListener('click', () => this.#confirmDelete());

    // Close modals on backdrop click
    this.els.modal?.addEventListener('click', (e) => {
      if (e.target === this.els.modal) this.#closeModal();
    });
    this.els.deleteModal?.addEventListener('click', (e) => {
      if (e.target === this.els.deleteModal) this.#closeDeleteModal();
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (this.els.deleteModal?.open) this.#closeDeleteModal();
        else if (this.els.modal?.open) this.#closeModal();
      }
    });

    // Logout
    this.els.userChip?.addEventListener('click', () => Auth.logout());
    this.els.userChip?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') Auth.logout();
    });
  }

  /* ─── Data Loading ─── */

  async #loadUsers() {
    this.#showSkeleton(true);
    
    // Cancel previous request if any
    this.#currentRequest?.abort();
    this.#currentRequest = new AbortController();

    try {
      this.#users = await DB.getUsers();
      this.#filteredUsers = [...this.#users];
      this.#updateStats();
      this.#applyFilters();
    } catch (error) {
      console.error('[Users] Load failed:', error);
      App.toast('فشل تحميل قائمة المستخدمين', 'error');
      this.#renderError();
    } finally {
      this.#showSkeleton(false);
      this.#currentRequest = null;
    }
  }

  /* ─── Statistics ─── */

  #updateStats() {
    const stats = {
      total: this.#users.length,
      active: this.#users.filter(u => u.isActive !== false).length,
      evaluators: this.#users.filter(u => EVALUATOR_ROLES.includes(u.role)).length,
      students: this.#users.filter(u => u.role === 'student').length
    };

    const cards = document.querySelectorAll('.stat-card');
    cards.forEach(card => {
      const key = card.dataset.stat;
      const valueEl = card.querySelector('.stat-value');
      if (valueEl && stats[key] !== undefined) {
        this.#animateCounter(valueEl, parseInt(valueEl.dataset.count) || 0, stats[key]);
        valueEl.dataset.count = stats[key];
      }
    });
  }

  /**
   * Animate number counter
   */
  #animateCounter(element, from, to, duration = 600) {
    const start = performance.now();
    const step = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3); // easeOutCubic
      element.textContent = Math.floor(from + (to - from) * ease);
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  /* ─── Filtering & Search ─── */

  #handleSearch(query) {
    this.els.searchClear.hidden = !query;
    this.#filters.query = query.trim().toLowerCase();
    this.#currentPage = 1;
    this.#applyFilters();
  }

  #applyFilters() {
    const { query, role, status } = this.#filters;
    
    this.#filteredUsers = this.#users.filter(user => {
      const matchesQuery = !query || 
        user.name?.toLowerCase().includes(query) ||
        user.username?.toLowerCase().includes(query) ||
        user.email?.toLowerCase().includes(query) ||
        user.department?.toLowerCase().includes(query);
      
      const matchesRole = !role || user.role === role;
      const matchesStatus = !status || (status === 'active' ? user.isActive !== false : user.isActive === false);
      
      return matchesQuery && matchesRole && matchesStatus;
    });

    this.#renderTable();
    this.#renderPagination();
  }

  /* ─── Pagination ─── */

  #changePage(delta) {
    const maxPage = Math.ceil(this.#filteredUsers.length / ITEMS_PER_PAGE) || 1;
    const newPage = Math.max(1, Math.min(maxPage, this.#currentPage + delta));
    if (newPage !== this.#currentPage) {
      this.#currentPage = newPage;
      this.#renderTable();
      this.#renderPagination();
      this.els.tableBody.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  #renderPagination() {
    const total = this.#filteredUsers.length;
    const maxPage = Math.ceil(total / ITEMS_PER_PAGE) || 1;
    
    if (total <= ITEMS_PER_PAGE) {
      this.els.pagination.hidden = true;
      return;
    }

    this.els.pagination.hidden = false;
    this.els.paginationInfo.textContent = `صفحة ${this.#currentPage} من ${maxPage} (${total} مستخدم)`;
    this.els.btnPrev.disabled = this.#currentPage === 1;
    this.els.btnNext.disabled = this.#currentPage === maxPage;
  }

  /* ─── Table Rendering ─── */

  #renderTable() {
    const start = (this.#currentPage - 1) * ITEMS_PER_PAGE;
    const pageUsers = this.#filteredUsers.slice(start, start + ITEMS_PER_PAGE);
    const tbody = this.els.tableBody;

    if (pageUsers.length === 0) {
      tbody.innerHTML = '';
      this.els.emptyState.hidden = false;
      return;
    }

    this.els.emptyState.hidden = true;

    const fragment = document.createDocumentFragment();
    
    pageUsers.forEach((user, idx) => {
      const tr = document.createElement('tr');
      tr.dataset.userId = user.id;
      
      const roleConfig = ROLES_CONFIG[user.role] || { label: user.role, badgeClass: 'badge' };
      const isActive = user.isActive !== false;
      const rowNum = start + idx + 1;

      tr.innerHTML = `
        <td class="col-num">${rowNum}</td>
        <td class="col-name">
          <div class="user-cell">
            <div class="user-cell-name">${Utils.escapeHtml(user.name || '—')}</div>
            <div class="user-cell-username">@${Utils.escapeHtml(user.username || '—')}</div>
          </div>
        </td>
        <td class="col-email">${Utils.escapeHtml(user.email || '—')}</td>
        <td class="col-dept">${Utils.escapeHtml(user.department || '—')}</td>
        <td class="col-role"><span class="badge ${roleConfig.badgeClass}">${roleConfig.label}</span></td>
        <td class="col-status">
          <span class="status-toggle ${isActive ? 'status-active' : 'status-inactive'}" 
                data-action="toggle" data-id="${user.id}" role="switch" aria-checked="${isActive}"
                tabindex="0" title="${isActive ? 'تعطيل' : 'تفعيل'}">
            <span class="status-dot"></span>
            <span class="status-text">${isActive ? 'نشط' : 'معطل'}</span>
          </span>
        </td>
        <td class="col-login">${Utils.formatDate(user.lastLogin)}</td>
        <td class="col-actions">
          <div class="action-group">
            <button class="btn btn-ghost btn-icon" data-action="edit" data-id="${user.id}" 
                    title="تعديل" aria-label="تعديل ${Utils.escapeHtml(user.name)}">
              <i class="fas fa-edit" aria-hidden="true"></i>
            </button>
            <button class="btn btn-ghost btn-icon btn-danger" data-action="delete" data-id="${user.id}"
                    title="حذف" aria-label="حذف ${Utils.escapeHtml(user.name)}">
              <i class="fas fa-trash" aria-hidden="true"></i>
            </button>
          </div>
        </td>
      `;
      
      fragment.appendChild(tr);
    });

    tbody.innerHTML = '';
    tbody.appendChild(fragment);

    // Delegate row actions
    tbody.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', (e) => this.#handleRowAction(e));
      if (btn.getAttribute('role') === 'switch') {
        btn.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') this.#handleRowAction(e);
        });
      }
    });
  }

  #renderError() {
    this.els.tableBody.innerHTML = `
      <tr>
        <td colspan="8" class="table-error">
          <i class="fas fa-exclamation-circle" aria-hidden="true"></i>
          <p>فشل تحميل البيانات</p>
          <button class="btn btn-primary btn-sm" onclick="location.reload()">إعادة المحاولة</button>
        </td>
      </tr>
    `;
  }

  #showSkeleton(show) {
    document.querySelectorAll('.stat-skeleton').forEach(el => el.hidden = !show);
  }

  /* ─── Row Actions ─── */

  #handleRowAction(event) {
    const target = event.currentTarget;
    const action = target.dataset.action;
    const id = target.dataset.id;

    switch (action) {
      case 'edit': this.#openEditModal(id); break;
      case 'delete': this.#openDeleteModal(id); break;
      case 'toggle': this.#toggleUserStatus(id); break;
    }
  }

  /* ─── Modals ─── */

  #openAddModal() {
    this.#isEditing = false;
    this.els.modalTitle.textContent = 'مستخدم جديد';
    this.els.form.reset();
    this.els.form.id.value = '';
    this.els.form.username.disabled = false;
    this.els.form.username.required = true;
    this.els.form.password.required = true;
    this.els.form.password.placeholder = '6 أحرف على الأقل';
    document.getElementById('pass-required').style.display = 'inline';
    this.#clearErrors();
    this.els.modal.showModal();
    this.els.form.name.focus();
  }

  async #openEditModal(id) {
    try {
      const user = await DB.findUserById(id);
      if (!user) {
        App.toast('المستخدم غير موجود', 'error');
        return;
      }

      this.#isEditing = true;
      this.els.modalTitle.textContent = 'تعديل مستخدم';
      
      this.els.form.id.value = user.id;
      this.els.form.name.value = user.name || '';
      this.els.form.username.value = user.username || '';
      this.els.form.username.disabled = true;
      this.els.form.username.required = false;
      this.els.form.email.value = user.email || '';
      this.els.form.phone.value = user.phone || '';
      this.els.form.department.value = user.department || '';
      this.els.form.role.value = user.role || '';
      this.els.form.status.value = user.isActive !== false ? 'active' : 'inactive';
      
      this.els.form.password.value = '';
      this.els.form.password.required = false;
      this.els.form.password.placeholder = 'اتركه فارغاً لعدم التغيير';
      document.getElementById('pass-required').style.display = 'none';
      
      this.#clearErrors();
      this.els.modal.showModal();
      this.els.form.name.focus();
      
    } catch (error) {
      console.error('[Users] Failed to open edit modal:', error);
      App.toast('فشل فتح نافذة التعديل', 'error');
    }
  }

  #closeModal() {
    this.els.modal.close();
    this.els.form.username.disabled = false;
  }

  #togglePassword() {
    const input = this.els.form.password;
    const icon = this.els.btnTogglePass.querySelector('i');
    const isVisible = input.type === 'text';
    
    input.type = isVisible ? 'password' : 'text';
    icon.className = isVisible ? 'fas fa-eye' : 'fas fa-eye-slash';
    this.els.btnTogglePass.setAttribute('aria-label', isVisible ? 'إظهار كلمة المرور' : 'إخفاء كلمة المرور');
  }

  /* ─── Form Validation ─── */

  #validateForm(data) {
    const errors = {};
    
    if (!data.name || data.name.trim().length < 3) {
      errors.name = 'الاسم الكامل مطلوب (3 أحرف على الأقل)';
    }
    
    if (!this.#isEditing) {
      if (!data.username || !Utils.isValidUsername(data.username)) {
        errors.username = 'اسم مستخدم صالح مطلوب (3-32 حرفاً)';
      }
      if (!data.password || data.password.length < 6) {
        errors.password = 'كلمة مرور مطلوبة (6 أحرف على الأقل)';
      }
    } else if (data.password && data.password.length < 6) {
      errors.password = 'كلمة المرور يجب أن تكون 6 أحرف على الأقل';
    }
    
    if (!data.department || data.department.trim().length < 2) {
      errors.department = 'القسم / الكلية مطلوب';
    }
    
    if (!data.role) {
      errors.role = 'الدور مطلوب';
    }
    
    if (data.email && !Utils.isValidEmail(data.email)) {
      errors.email = 'صيغة البريد الإلكتروني غير صحيحة';
    }
    
    return errors;
  }

  #showErrors(errors) {
    this.#clearErrors();
    Object.entries(errors).forEach(([field, message]) => {
      const errorEl = document.getElementById(`error-${field}`);
      const inputEl = this.els.form[field];
      if (errorEl) errorEl.textContent = message;
      if (inputEl) inputEl.classList.add('is-invalid');
    });
    
    // Focus first error
    const firstError = this.els.form.querySelector('.is-invalid');
    firstError?.focus();
  }

  #clearErrors() {
    this.els.form.querySelectorAll('.is-invalid').forEach(el => el.classList.remove('is-invalid'));
    this.els.form.querySelectorAll('.field-error').forEach(el => el.textContent = '');
  }

  /* ─── Submit Handler ─── */

  async #handleSubmit(event) {
    event.preventDefault();
    this.#clearErrors();

    const formData = new FormData(this.els.form);
    const data = {
      id: formData.get('id') || null,
      name: formData.get('name')?.trim(),
      username: formData.get('username')?.trim(),
      email: formData.get('email')?.trim(),
      phone: Utils.sanitizePhone(formData.get('phone') || ''),
      department: formData.get('department')?.trim(),
      role: formData.get('role'),
      status: formData.get('status'),
      password: formData.get('password')
    };

    const errors = this.#validateForm(data);
    if (Object.keys(errors).length > 0) {
      this.#showErrors(errors);
      return;
    }

    await this.#saveUser(data);
  }

  async #saveUser(data) {
    this.#setLoading(this.els.btnSave, true);
    
    try {
      if (this.#isEditing) {
        const updates = {
          name: data.name,
          email: data.email,
          phone: data.phone,
          department: data.department,
          role: data.role,
          isActive: data.status === 'active'
        };
        if (data.password) updates.password = data.password;
        
        await DB.updateUser(data.id, updates);
        App.toast('تم تحديث المستخدم بنجاح', 'success');
        await DB.addLog(Auth.user.id, 'UPDATE_USER', `تعديل المستخدم: ${data.username}`);
        
      } else {
        await DB.addUserAsync({
          username: data.username,
          password: data.password,
          name: data.name,
          role: data.role,
          department: data.department,
          email: data.email,
          phone: data.phone,
          isActive: data.status === 'active'
        });
        App.toast('تم إضافة المستخدم بنجاح', 'success');
        await DB.addLog(Auth.user.id, 'ADD_USER', `إضافة مستخدم: ${data.username}`);
      }

      this.#closeModal();
      await this.#loadUsers();
      
    } catch (error) {
      console.error('[Users] Save failed:', error);
      App.toast(error.message || 'فشل حفظ المستخدم', 'error');
    } finally {
      this.#setLoading(this.els.btnSave, false);
    }
  }

  /* ─── Toggle Status ─── */

  async #toggleUserStatus(id) {
    try {
      const user = await DB.toggleUserActive(id);
      if (user) {
        const action = user.isActive ? 'تفعيل' : 'تعطيل';
        App.toast(`تم ${action} المستخدم بنجاح`, 'success');
        await DB.addLog(Auth.user.id, 'TOGGLE_USER', `${action} المستخدم: ${user.username}`);
        await this.#loadUsers();
      }
    } catch (error) {
      console.error('[Users] Toggle failed:', error);
      App.toast('فشل تغيير حالة المستخدم', 'error');
    }
  }

  /* ─── Delete ─── */

  #openDeleteModal(id) {
    const user = this.#users.find(u => u.id === id);
    if (!user) return;
    
    this.#deleteTargetId = id;
    this.els.deleteTargetName.textContent = user.name || user.username;
    this.els.deleteModal.showModal();
  }

  #closeDeleteModal() {
    this.els.deleteModal.close();
    this.#deleteTargetId = null;
  }

  async #confirmDelete() {
    if (!this.#deleteTargetId) return;
    
    this.#setLoading(this.els.btnConfirmDelete, true);
    
    try {
      const user = await DB.findUserById(this.#deleteTargetId);
      await DB.deleteUser(this.#deleteTargetId);
      
      App.toast('تم حذف المستخدم بنجاح', 'success');
      await DB.addLog(Auth.user.id, 'DELETE_USER', `حذف المستخدم: ${user?.username || this.#deleteTargetId}`);
      
      this.#closeDeleteModal();
      await this.#loadUsers();
      
    } catch (error) {
      console.error('[Users] Delete failed:', error);
      App.toast(error.message || 'فشل حذف المستخدم', 'error');
    } finally {
      this.#setLoading(this.els.btnConfirmDelete, false);
    }
  }

  /* ─── Export / Import ─── */

  #exportToExcel() {
    const headers = ['الاسم', 'اسم المستخدم', 'البريد', 'الهاتف', 'القسم', 'الدور', 'الحالة', 'آخر دخول'];
    const rows = this.#filteredUsers.map(u => [
      u.name, u.username, u.email, u.phone, u.department,
      ROLES_CONFIG[u.role]?.label || u.role,
      u.isActive !== false ? 'نشط' : 'معطل',
      Utils.formatDate(u.lastLogin)
    ]);

    const csv = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `nias-users-${new Date().toISOString().slice(0,10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    
    App.toast('تم تصدير الملف بنجاح', 'success');
  }

  #importFromExcel() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv,.xlsx,.xls';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      App.toast('جاري معالجة الملف...', 'info');
      // TODO: Implement CSV parsing and bulk import
    };
    input.click();
  }

  /* ─── UI Helpers ─── */

  #renderUserChip() {
    const user = Auth.user;
    if (!user) return;
    
    this.els.userAvatar.textContent = (user.name?.charAt(0) || '?').toUpperCase();
    this.els.userNameLabel.textContent = user.name || 'مستخدم';
    this.els.userRoleLabel.textContent = ROLES_CONFIG[user.role]?.label || user.role;
    this.els.userChip.style.display = 'flex';
  }

  #setLoading(button, loading) {
    const text = button.querySelector('.btn-text');
    const loader = button.querySelector('.btn-loader');
    button.disabled = loading;
    if (text) text.hidden = loading;
    if (loader) loader.hidden = !loading;
  }
}

/* ═══════════════════════════════════════════════════════
   Initialize
   ═══════════════════════════════════════════════════════ */

const usersManager = new UsersManager();
document.addEventListener('DOMContentLoaded', () => usersManager.init());

// Expose for inline onclick fallbacks if needed
window.Users = {
  init: () => usersManager.init(),
  search: (q) => usersManager._handleSearch?.(q),
  filterByRole: (r) => usersManager._applyFilters?.(),
  filterByStatus: (s) => usersManager._applyFilters?.(),
  openAddModal: () => usersManager._openAddModal?.(),
  openEditModal: (id) => usersManager._openEditModal?.(id),
  closeModal: () => usersManager._closeModal?.(),
  togglePasswordVisibility: () => usersManager._togglePassword?.(),
  save: (e) => usersManager._handleSubmit?.(e),
  toggleActive: (id) => usersManager._toggleUserStatus?.(id),
  openDeleteModal: (id) => usersManager._openDeleteModal?.(id),
  closeDeleteModal: () => usersManager._closeDeleteModal?.(),
  confirmDelete: () => usersManager._confirmDelete?.()
};
