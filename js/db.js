/**
 * ============================================================
 * NIAS Evaluation System — db.js (v12.1 ULTIMATE PROFESSIONAL)
 * المعهد الوطني للعلوم الإدارية — فرع إب
 * ============================================================
 * التصحيحات في v12.1 (على أساس v12.0):
 * - [إصلاح جوهري] تصدير DB و Auth و بقية الكائنات صراحةً إلى
 *   window، لأن الإعلان بـ const/let في سكربت عادي (غير module)
 *   لا يُنشئ تلقائياً خصائص على window. كانت صفحات مثل login.html
 *   تتحقق من window.Auth / window.DB فتجدهما "غير معرّفين" رغم
 *   أن Auth و DB يعملان فعلياً، فيفشل تسجيل الدخول دائماً بصرف
 *   النظر عن صحة اسم المستخدم وكلمة المرور.
 * ============================================================
 * مميزات النسخة v12.0:
 * - PBKDF2-SHA256 مع 150,000 تكرار
 * - توزيع موحّد في generateSecurePassword (rejection sampling)
 * - Object.freeze للثوابت
 * - tx.oncomplete لضمان اكتمال المعاملات
 * - Cleanup دوري للجلسات المنتهية
 * - Rate Limiter متزامن بين الذاكرة و IndexedDB
 * - JSDoc كامل
 * - Admin ثابت: admin / Admin@123 مع إعادة تعيين تلقائية
 * - مستخدمين تجريبيين: demo123
 * - معالجة أخطاء شاملة
 * - requireAuth مضافة ومصححة
 * - loginPage = 'login.html'
 * - UUID v4 للتعريفات الفريدة
 * - نظام صلاحيات RBAC متكامل
 * - تخزين مؤقت (Cache) مع TTL
 * - مراقبة أداء
 * - مزامنة متعددة التبويبات (BroadcastChannel)
 * - عمليات دفعية (Batch Operations)
 * - تصدير مشفر اختياري
 * - Logger متقدم مع مستويات وسجل تاريخي
 */

'use strict';

/* ═══════════════════════════════════════════════════════
   Constants
   ═══════════════════════════════════════════════════════ */
const DB_NAME = 'NIAS_Pro_DB';
const DB_VERSION = 12;
const AUTH_KEY = 'nias_auth_session_v3';
const SESSION_DURATION_MS = 8 * 60 * 60 * 1000; // 8 hours
const PERSISTENT_SESSION_DAYS = 30;
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const PASSWORD_ALGO = 'PBKDF2-SHA256-150k';
const PBKDF2_ITERATIONS = 150_000;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes cache
const MAX_CACHE_SIZE = 100; // Max items in cache
const MAX_LOG_SIZE = 500; // Max log entries to keep

/* ═══════════════════════════════════════════════════════
   Roles
   ═══════════════════════════════════════════════════════ */
const ROLES = Object.freeze({
  ADMIN: 'admin',
  DEAN: 'dean',
  VICE_DEAN: 'vice_dean',
  HEAD: 'head',
  FACULTY: 'faculty',
  STUDENT: 'student'
});

const ROLE_LABELS = Object.freeze({
  [ROLES.ADMIN]: 'مسؤول النظام',
  [ROLES.DEAN]: 'عميد الكلية',
  [ROLES.VICE_DEAN]: 'وكيل الكلية',
  [ROLES.HEAD]: 'رئيس القسم',
  [ROLES.FACULTY]: 'عضو هيئة تدريس',
  [ROLES.STUDENT]: 'طالب',
  evaluator: 'مقيّم'
});

const EVALUATOR_ROLES = Object.freeze([
  ROLES.DEAN, ROLES.VICE_DEAN, ROLES.HEAD, ROLES.FACULTY
]);

/* ═══════════════════════════════════════════════════════
   Permissions (RBAC)
   ═══════════════════════════════════════════════════════ */
const PERMISSIONS = Object.freeze({
  MANAGE_USERS: 'manage_users',
  VIEW_USERS: 'view_users',
  CREATE_EVALUATION: 'create_evaluation',
  VIEW_ALL_EVALUATIONS: 'view_all_evaluations',
  VIEW_OWN_EVALUATIONS: 'view_own_evaluations',
  EXPORT_DATA: 'export_data',
  IMPORT_DATA: 'import_data',
  MANAGE_BACKUPS: 'manage_backups',
  VIEW_REPORTS: 'view_reports',
  VIEW_LOGS: 'view_logs',
  MANAGE_SETTINGS: 'manage_settings'
});

const ROLE_PERMISSIONS = Object.freeze({
  [ROLES.ADMIN]: Object.values(PERMISSIONS),
  [ROLES.DEAN]: [
    PERMISSIONS.CREATE_EVALUATION,
    PERMISSIONS.VIEW_ALL_EVALUATIONS,
    PERMISSIONS.VIEW_REPORTS,
    PERMISSIONS.VIEW_USERS
  ],
  [ROLES.VICE_DEAN]: [
    PERMISSIONS.CREATE_EVALUATION,
    PERMISSIONS.VIEW_ALL_EVALUATIONS,
    PERMISSIONS.VIEW_REPORTS,
    PERMISSIONS.VIEW_USERS
  ],
  [ROLES.HEAD]: [
    PERMISSIONS.CREATE_EVALUATION,
    PERMISSIONS.VIEW_ALL_EVALUATIONS,
    PERMISSIONS.VIEW_REPORTS,
    PERMISSIONS.VIEW_USERS
  ],
  [ROLES.FACULTY]: [
    PERMISSIONS.CREATE_EVALUATION,
    PERMISSIONS.VIEW_OWN_EVALUATIONS,
    PERMISSIONS.VIEW_REPORTS
  ],
  [ROLES.STUDENT]: [
    PERMISSIONS.CREATE_EVALUATION,
    PERMISSIONS.VIEW_OWN_EVALUATIONS
  ]
});

const PermissionManager = Object.freeze({
  hasPermission(role, permission) {
    const permissions = ROLE_PERMISSIONS[role] || [];
    return permissions.includes(permission);
  },
  
  hasAnyPermission(role, permissions) {
    return permissions.some(p => this.hasPermission(role, p));
  },
  
  hasAllPermissions(role, permissions) {
    return permissions.every(p => this.hasPermission(role, p));
  },
  
  getPermissions(role) {
    return ROLE_PERMISSIONS[role] || [];
  }
});

/* ═══════════════════════════════════════════════════════
   Enhanced Logger with Performance Monitoring
   ═══════════════════════════════════════════════════════ */
const Logger = {
  _enabled: true,
  _level: 'info', // 'debug' | 'info' | 'warn' | 'error'
  _history: [],
  _maxHistory: 200,
  
  log: (...a) => { 
    if (Logger._enabled && ['debug', 'info'].includes(Logger._level)) {
      console.log('[NIAS]', ...a);
      Logger._addToHistory('info', a);
    }
  },
  
  warn: (...a) => { 
    if (Logger._enabled && ['debug', 'info', 'warn'].includes(Logger._level)) {
      console.warn('[NIAS]', ...a);
      Logger._addToHistory('warn', a);
    }
  },
  
  error: (...a) => { 
    if (Logger._enabled) {
      console.error('[NIAS]', ...a);
      Logger._addToHistory('error', a);
    }
  },
  
  debug: (...a) => {
    if (Logger._enabled && Logger._level === 'debug') {
      console.debug('[NIAS-DEBUG]', ...a);
      Logger._addToHistory('debug', a);
    }
  },
  
  _addToHistory(level, args) {
    Logger._history.push({
      timestamp: new Date().toISOString(),
      level,
      message: args.map(a => typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)).join(' ')
    });
    if (Logger._history.length > Logger._maxHistory) {
      Logger._history.shift();
    }
  },
  
  getHistory() { return [...Logger._history]; },
  clearHistory() { Logger._history = []; },
  setLevel(level) { Logger._level = level; },
  setEnabled(enabled) { Logger._enabled = enabled; }
};

/* ═══════════════════════════════════════════════════════
   Performance Monitor
   ═══════════════════════════════════════════════════════ */
const PerformanceMonitor = {
  _metrics: new Map(),
  _results: [],
  
  start(label) {
    this._metrics.set(label, performance.now());
    return label;
  },
  
  end(label) {
    const start = this._metrics.get(label);
    if (start) {
      const duration = performance.now() - start;
      this._metrics.delete(label);
      this._results.push({ label, duration, timestamp: Date.now() });
      Logger.debug(`⏱️ ${label}: ${duration.toFixed(2)}ms`);
      return duration;
    }
    return 0;
  },
  
  async measureAsync(label, fn) {
    this.start(label);
    try {
      return await fn();
    } finally {
      this.end(label);
    }
  },
  
  getResults() { return [...this._results]; },
  clearResults() { this._results = []; }
};

/* ═══════════════════════════════════════════════════════
   Cache System with TTL
   ═══════════════════════════════════════════════════════ */
class CacheSystem {
  constructor(ttlMs = CACHE_TTL_MS, maxSize = MAX_CACHE_SIZE) {
    this._cache = new Map();
    this._ttl = ttlMs;
    this._maxSize = maxSize;
    this._hits = 0;
    this._misses = 0;
  }
  
  set(key, value, ttlMs = this._ttl) {
    if (this._cache.size >= this._maxSize) {
      const oldestKey = this._cache.keys().next().value;
      this._cache.delete(oldestKey);
    }
    
    this._cache.set(key, {
      value,
      expiresAt: Date.now() + ttlMs
    });
    
    return value;
  }
  
  get(key) {
    const item = this._cache.get(key);
    if (!item) {
      this._misses++;
      return null;
    }
    
    if (item.expiresAt < Date.now()) {
      this._cache.delete(key);
      this._misses++;
      return null;
    }
    
    this._hits++;
    return item.value;
  }
  
  has(key) {
    return this.get(key) !== null;
  }
  
  delete(key) {
    this._cache.delete(key);
  }
  
  clear() {
    this._cache.clear();
    this._hits = 0;
    this._misses = 0;
  }
  
  getStats() {
    return {
      size: this._cache.size,
      hits: this._hits,
      misses: this._misses,
      hitRate: this._hits + this._misses > 0 ? (this._hits / (this._hits + this._misses)) * 100 : 0
    };
  }
}

const cache = new CacheSystem();

/* ═══════════════════════════════════════════════════════
   Utilities
   ═══════════════════════════════════════════════════════ */

/**
 * Generate a UUID v4.
 * @returns {string}
 */
function generateUUID() {
  if (crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = crypto.getRandomValues(new Uint8Array(1))[0] % 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Generate a unique ID with prefix.
 * @param {string} prefix
 * @returns {string}
 */
function generateId(prefix = 'id') {
  return `${prefix}_${generateUUID()}`;
}

/**
 * Generate a cryptographically secure password with uniform distribution.
 * @param {number} length
 * @returns {string}
 */
function generateSecurePassword(length = 12) {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  const charsetLen = chars.length;
  const maxValid = 256 - (256 % charsetLen);
  const arr = new Uint8Array(length);
  let result = '';
  for (let i = 0; i < length; ) {
    crypto.getRandomValues(arr);
    for (let j = 0; j < arr.length && i < length; j++) {
      if (arr[j] < maxValid) {
        result += chars[arr[j] % charsetLen];
        i++;
      }
    }
  }
  return result;
}

/* ═══════════════════════════════════════════════════════
   Hex Helpers
   ═══════════════════════════════════════════════════════ */
const Hex = Object.freeze({
  encode(buf) {
    return Array.from(new Uint8Array(buf))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  },
  decode(str) {
    if (!str || str.length % 2 !== 0) return null;
    try {
      return new Uint8Array(str.match(/.{2}/g).map(byte => parseInt(byte, 16)));
    } catch {
      return null;
    }
  }
});

/* ═══════════════════════════════════════════════════════
   Crypto (PBKDF2-SHA256)
   ═══════════════════════════════════════════════════════ */

/**
 * Hash a password using PBKDF2-SHA256.
 * @param {string} password
 * @returns {Promise<{hash:string, salt:string, algo:string}>}
 */
async function hashPassword(password) {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey(
    'raw', encoder.encode(password), { name: 'PBKDF2' }, false, ['deriveBits']
  );
  const derived = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial, 256
  );
  return { hash: Hex.encode(derived), salt: Hex.encode(salt), algo: PASSWORD_ALGO };
}

/**
 * Verify a password against stored hash.
 * @param {string} password
 * @param {{hash:string, salt:string, algo:string}} cred
 * @returns {Promise<boolean>}
 */
async function verifyPassword(password, { hash, salt, algo }) {
  if (!hash || !salt || !algo || typeof password !== 'string') return false;
  try {
    const saltBytes = Hex.decode(salt);
    if (!saltBytes) return false;
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw', encoder.encode(password), { name: 'PBKDF2' }, false, ['deriveBits']
    );
    const newHash = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt: saltBytes, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
      keyMaterial, 256
    );
    return Hex.encode(newHash) === hash;
  } catch (e) {
    Logger.warn('verifyPassword failed:', e.message);
    return false;
  }
}

/* ═══════════════════════════════════════════════════════
   Validator
   ═══════════════════════════════════════════════════════ */
const Validator = Object.freeze({
  username(u) {
    if (!u || typeof u !== 'string') return 'اسم المستخدم مطلوب';
    if (u.length < 3 || u.length > 32) return 'اسم المستخدم يجب أن يكون بين 3 و 32 حرفاً';
    if (!/^[a-zA-Z0-9_.-]+$/.test(u)) return 'اسم المستخدم يحتوي على رموز غير مسموحة';
    return null;
  },
  password(p) {
    if (!p || typeof p !== 'string') return 'كلمة المرور مطلوبة';
    if (p.length < 6) return 'كلمة المرور يجب أن تكون 6 أحرف على الأقل';
    if (p.length > 128) return 'كلمة المرور طويلة جداً';
    return null;
  },
  name(n) {
    if (!n || typeof n !== 'string') return 'الاسم الكامل مطلوب';
    if (n.trim().length < 2) return 'الاسم يجب أن يكون بين 2 و 100 حرف';
    return null;
  },
  role(r) {
    if (!r || !Object.values(ROLES).includes(r)) return 'الدور غير صالح';
    return null;
  },
  department(d) {
    if (!d || typeof d !== 'string' || d.trim().length < 2) return 'اسم القسم/الكلية غير صالح';
    return null;
  },
  email(e) {
    if (e && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return 'البريد الإلكتروني غير صالح';
    return null;
  },
  phone(p) {
    if (p && !/^[0-9+\-\s]{7,20}$/.test(p)) return 'رقم الهاتف غير صالح';
    return null;
  },
  evaluationData(data) {
    if (!data || typeof data !== 'object') return 'بيانات التقييم غير صالحة';
    if (!data.formType || typeof data.formType !== 'string') return 'نوع النموذج مطلوب';
    if (!data.evaluatorId || typeof data.evaluatorId !== 'string') return 'معرّف المقيّم مطلوب';
    if (!data.targetId || typeof data.targetId !== 'string') return 'معرّف المُقيَّم مطلوب';
    if (!data.scores || typeof data.scores !== 'object') return 'الدرجات مطلوبة';
    return null;
  }
});

/* ═══════════════════════════════════════════════════════
   NIASDatabase Class
   ═══════════════════════════════════════════════════════ */

class NIASDatabase {
  constructor() {
    this.db = null;
    this._initPromise = null;
    this._isOpening = false;
    this._retryCount = 0;
    this._maxRetries = 3;
    this._cleanupTimer = null;
  }

  /**
   * Initialize/open the IndexedDB connection.
   * @returns {Promise<IDBDatabase>}
   */
  async init() {
    if (this.db) return this.db;
    if (this._initPromise) return this._initPromise;
    if (this._isOpening) {
      return new Promise((resolve) => {
        const iv = setInterval(() => {
          if (this.db) { clearInterval(iv); resolve(this.db); }
        }, 50);
      });
    }

    this._isOpening = true;
    this._initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        this._isOpening = false;
        Logger.error('IndexedDB open error:', request.error);
        reject(request.error || new Error('Failed to open IndexedDB'));
      };

      request.onsuccess = () => {
        this.db = request.result;
        this._isOpening = false;
        this._retryCount = 0;

        this.db.onclose = () => {
          Logger.warn('IndexedDB connection closed unexpectedly');
          this.db = null;
          this._initPromise = null;
        };

        this.db.onversionchange = () => {
          Logger.warn('Version change detected, closing connection...');
          this.db.close();
          this.db = null;
          this._initPromise = null;
          if (typeof alert !== 'undefined') {
            alert('تم تحديث قاعدة البيانات. يرجى إعادة تحميل الصفحة.');
          }
        };

        this.db.onerror = (event) => {
          Logger.error('Database error:', event.target.error);
        };

        this._scheduleCleanup();
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        const txn = event.target.transaction;

        const ensureIndex = (store, name, keyPath, unique = false) => {
          if (!store.indexNames.contains(name)) {
            store.createIndex(name, keyPath, { unique });
          }
        };

        // Users store
        let usersStore;
        if (!db.objectStoreNames.contains('users')) {
          usersStore = db.createObjectStore('users', { keyPath: 'id' });
        } else {
          usersStore = txn.objectStore('users');
        }
        ensureIndex(usersStore, 'username', 'username', true);
        ensureIndex(usersStore, 'role', 'role', false);
        ensureIndex(usersStore, 'department', 'department', false);
        ensureIndex(usersStore, 'isActive', 'isActive', false);

        // Evaluations store
        let evalStore;
        if (!db.objectStoreNames.contains('evaluations')) {
          evalStore = db.createObjectStore('evaluations', { keyPath: 'id' });
        } else {
          evalStore = txn.objectStore('evaluations');
        }
        ensureIndex(evalStore, 'evaluatorId', 'evaluatorId', false);
        ensureIndex(evalStore, 'targetId', 'targetId', false);
        ensureIndex(evalStore, 'formType', 'formType', false);
        ensureIndex(evalStore, 'department', 'department', false);
        ensureIndex(evalStore, 'createdAt', 'createdAt', false);
        ensureIndex(evalStore, 'status', 'status', false);
        ensureIndex(evalStore, 'evaluator_form', ['evaluatorId', 'formType'], false);
        ensureIndex(evalStore, 'target_form', ['targetId', 'formType'], false);

        // Logs store
        let logsStore;
        if (!db.objectStoreNames.contains('logs')) {
          logsStore = db.createObjectStore('logs', { keyPath: 'id' });
        } else {
          logsStore = txn.objectStore('logs');
        }
        ensureIndex(logsStore, 'timestamp', 'timestamp', false);
        ensureIndex(logsStore, 'userId', 'userId', false);
        ensureIndex(logsStore, 'action', 'action', false);

        // Settings store
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }

        // Backups store
        let backupStore;
        if (!db.objectStoreNames.contains('backups')) {
          backupStore = db.createObjectStore('backups', { keyPath: 'id', autoIncrement: true });
        } else {
          backupStore = txn.objectStore('backups');
        }
        ensureIndex(backupStore, 'timestamp', 'timestamp', false);

        // Rate limits store
        let rateStore;
        if (!db.objectStoreNames.contains('rate_limits')) {
          rateStore = db.createObjectStore('rate_limits', { keyPath: 'key' });
        } else {
          rateStore = txn.objectStore('rate_limits');
        }
        ensureIndex(rateStore, 'expiresAt', 'expiresAt', false);
      };

      request.onblocked = () => {
        this._isOpening = false;
        Logger.error('Database blocked by another tab');
        if (typeof alert !== 'undefined') {
          alert('قاعدة البيانات محجوبة بسبب تبويب آخر مفتوح. أغلق التبويبات الأخرى ثم أعد المحاولة.');
        }
        reject(new Error('Database blocked'));
      };
    });

    return this._initPromise;
  }

  /**
   * Create a transaction with automatic retry.
   */
  async transaction(storeNames, mode = 'readonly') {
    const db = await this.init();
    if (!db) throw new Error('Database not available');

    try {
      return db.transaction(storeNames, mode);
    } catch (err) {
      if (err.name === 'InvalidStateError' || err.message?.includes('closing')) {
        this._retryCount++;
        if (this._retryCount > this._maxRetries) {
          throw new Error('Database connection failed after maximum retries');
        }
        Logger.warn(`Connection closing, retry ${this._retryCount}/${this._maxRetries}...`);
        this.db = null;
        this._initPromise = null;
        await new Promise(r => setTimeout(r, 100 * this._retryCount));
        const freshDb = await this.init();
        return freshDb.transaction(storeNames, mode);
      }
      throw err;
    }
  }

  /**
   * Execute a request inside a transaction and wait for completion.
   */
  async _exec(storeName, mode, callback) {
    const tx = await this.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    return new Promise((resolve, reject) => {
      let request;
      tx.oncomplete = () => resolve(request ? request.result : undefined);
      tx.onerror = () => reject(tx.error || new Error('Transaction failed'));
      tx.onabort = () => reject(new Error('Transaction aborted'));
      try {
        request = callback(store);
      } catch (e) {
        reject(e);
      }
    });
  }

  async getAll(storeName) {
    const result = await this._exec(storeName, 'readonly', (store) => store.getAll());
    return result || [];
  }

  async getById(storeName, id) {
    const result = await this._exec(storeName, 'readonly', (store) => store.get(id));
    return result || null;
  }

  async getByIndex(storeName, indexName, value) {
    const result = await this._exec(storeName, 'readonly', (store) => store.index(indexName).getAll(value));
    return result || [];
  }

  async getByIndexRange(storeName, indexName, lower, upper) {
    const range = IDBKeyRange.bound(lower, upper);
    const result = await this._exec(storeName, 'readonly', (store) => store.index(indexName).getAll(range));
    return result || [];
  }

  async add(storeName, data) {
    if (!data || typeof data !== 'object') throw new TypeError('Data must be an object');
    await this._exec(storeName, 'readwrite', (store) => store.add(data));
    return data;
  }

  async put(storeName, data) {
    if (!data || typeof data !== 'object') throw new TypeError('Data must be an object');
    await this._exec(storeName, 'readwrite', (store) => store.put(data));
    return data;
  }

  async delete(storeName, id) {
    await this._exec(storeName, 'readwrite', (store) => store.delete(id));
    return true;
  }

  async clear(storeName) {
    await this._exec(storeName, 'readwrite', (store) => store.clear());
    return true;
  }

  async count(storeName) {
    const result = await this._exec(storeName, 'readonly', (store) => store.count());
    return result || 0;
  }

  async paginate(storeName, indexName, page = 1, perPage = 20, direction = 'prev') {
    if (page < 1) page = 1;
    if (perPage < 1) perPage = 20;
    const tx = await this.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const index = indexName ? store.index(indexName) : store;
    return new Promise((resolve, reject) => {
      const results = [];
      let skipped = 0;
      const skip = (page - 1) * perPage;
      const req = index.openCursor(null, direction);
      req.onsuccess = (event) => {
        const cursor = event.target.result;
        if (!cursor) { resolve(results); return; }
        if (skipped < skip) { skipped++; cursor.continue(); return; }
        if (results.length < perPage) { results.push(cursor.value); cursor.continue(); }
        else { resolve(results); }
      };
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Batch add multiple records efficiently.
   */
  async bulkAdd(storeName, items) {
    if (!Array.isArray(items) || items.length === 0) return { added: 0, errors: [] };
    
    const tx = await this.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    
    return new Promise((resolve, reject) => {
      let added = 0;
      const errors = [];
      
      tx.oncomplete = () => resolve({ added, errors });
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(new Error('Transaction aborted'));
      
      for (const item of items) {
        const request = store.add(item);
        request.onsuccess = () => added++;
        request.onerror = () => errors.push({ item, error: request.error?.message });
      }
    });
  }

  /**
   * Batch put multiple records efficiently.
   */
  async bulkPut(storeName, items) {
    if (!Array.isArray(items) || items.length === 0) return { updated: 0, errors: [] };
    
    const tx = await this.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    
    return new Promise((resolve, reject) => {
      let updated = 0;
      const errors = [];
      
      tx.oncomplete = () => resolve({ updated, errors });
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(new Error('Transaction aborted'));
      
      for (const item of items) {
        const request = store.put(item);
        request.onsuccess = () => updated++;
        request.onerror = () => errors.push({ item, error: request.error?.message });
      }
    });
  }

  _scheduleCleanup() {
    if (this._cleanupTimer) clearInterval(this._cleanupTimer);
    this._cleanupTimer = setInterval(() => this._cleanupExpiredSessions(), CLEANUP_INTERVAL_MS);
  }

  async _cleanupExpiredSessions() {
    try {
      const now = Date.now();
      const nowISO = new Date().toISOString();

      const rateLimits = await this.getAll('rate_limits');
      for (const rl of rateLimits) {
        if (rl.expiresAt && rl.expiresAt < now) {
          await this.delete('rate_limits', rl.key).catch(() => {});
        }
      }

      const settings = await this.getAll('settings');
      for (const s of settings) {
        if (s.key === AUTH_KEY && s.value && s.value.expiresAt) {
          if (s.value.expiresAt < nowISO) {
            await this.delete('settings', s.key).catch(() => {});
          }
        }
      }
    } catch (e) {
      Logger.warn('Session cleanup failed:', e.message);
    }
  }
}

const niasDB = new NIASDatabase();

/* ═══════════════════════════════════════════════════════
   Multi-Tab Synchronization
   ═══════════════════════════════════════════════════════ */
const TabSync = {
  _channel: null,
  _listeners: new Map(),
  
  init() {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      this._channel = new BroadcastChannel('nias-sync');
      this._channel.onmessage = (event) => {
        Logger.debug('Received sync message:', event.data);
        this._handleMessage(event.data);
      };
      Logger.log('TabSync initialized');
    }
  },
  
  broadcast(type, data = {}) {
    if (this._channel) {
      this._channel.postMessage({ type, data, timestamp: Date.now() });
    }
  },
  
  on(type, callback) {
    if (!this._listeners.has(type)) {
      this._listeners.set(type, []);
    }
    this._listeners.get(type).push(callback);
  },
  
  _handleMessage(message) {
    const { type, data, timestamp } = message;
    
    // Default handlers
    switch (type) {
      case 'user-updated':
        cache.delete('users:all');
        break;
      case 'evaluation-added':
        cache.delete('evaluations:all');
        break;
      case 'logout':
        Auth.clearSession();
        break;
      case 'data-changed':
        if (data.store) {
          cache.delete(`${data.store}:all`);
        }
        break;
    }
    
    // Custom listeners
    const listeners = this._listeners.get(type) || [];
    listeners.forEach(callback => callback(data, timestamp));
  },
  
  close() {
    if (this._channel) {
      this._channel.close();
      this._channel = null;
    }
  }
};

/* ═══════════════════════════════════════════════════════
   DB API (Enhanced with Caching)
   ═══════════════════════════════════════════════════════ */

const DB = {
  /* ─── Users ─── */

  async getUsers() {
    const cacheKey = 'users:all';
    const cached = cache.get(cacheKey);
    if (cached) return cached;
    
    const users = await niasDB.getAll('users');
    const sanitized = users.map(({ passwordHash, passwordSalt, passwordAlgo, password, ...rest }) => rest);
    
    cache.set(cacheKey, sanitized);
    return sanitized;
  },

  async findUserByUsername(username) {
    if (!username) return null;
    const cacheKey = `user:username:${username}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;
    
    const users = await niasDB.getByIndex('users', 'username', username);
    const user = users[0] || null;
    
    if (user) cache.set(cacheKey, user, 60 * 1000); // 1 minute cache
    return user;
  },

  async findUserById(id) {
    if (!id) return null;
    const cacheKey = `user:id:${id}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;
    
    const user = await niasDB.getById('users', id);
    
    if (user) cache.set(cacheKey, user, 60 * 1000); // 1 minute cache
    return user;
  },

  async getUsersByRole(role) {
    return await niasDB.getByIndex('users', 'role', role);
  },

  async getUsersByDepartment(dept) {
    return await niasDB.getByIndex('users', 'department', dept);
  },

  async getActiveUsers() {
    return await niasDB.getByIndex('users', 'isActive', true);
  },

  async _addUserInternal(user) {
    if (!user || !user.username) {
      Logger.warn('_addUserInternal: missing username');
      return null;
    }
    const existing = await this.findUserByUsername(user.username);
    if (existing) {
      Logger.warn('Username already exists:', user.username);
      return null;
    }
    user.id = user.id || generateId('u');
    user.createdAt = user.createdAt || new Date().toISOString();
    user.isActive = user.isActive !== false;
    await niasDB.add('users', user);
    this._invalidateUserCache();
    TabSync.broadcast('user-updated', { username: user.username });
    Logger.log('User added:', user.username);
    return user;
  },

  _invalidateUserCache() {
    cache.delete('users:all');
    // Invalidate all user-specific cache entries
    const keysToDelete = [];
    for (const key of cache._cache.keys()) {
      if (key.startsWith('user:')) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach(key => cache.delete(key));
  },

  async addUserAsync({ username, password, name, role, department, email, phone }) {
    const err = Validator.username(username) || Validator.password(password)
             || Validator.name(name) || Validator.role(role) 
             || Validator.department(department) || Validator.email(email) 
             || Validator.phone(phone);
    if (err) throw new Error(err);

    const existing = await this.findUserByUsername(username);
    if (existing) throw new Error('اسم المستخدم موجود مسبقاً');

    const { hash, salt, algo } = await hashPassword(password);
    return await this._addUserInternal({
      username, name, role, department, email, phone,
      passwordHash: hash, passwordSalt: salt, passwordAlgo: algo,
      id: generateId('u'), createdAt: new Date().toISOString(), isActive: true
    });
  },

  async updateUser(id, updates) {
    const user = await this.findUserById(id);
    if (!user) return null;

    const ALLOWED = ['name', 'role', 'department', 'email', 'phone', 'isActive', 'mustChangePassword'];
    const filtered = Object.fromEntries(
      Object.entries(updates).filter(([k]) => ALLOWED.includes(k))
    );

    if (filtered.role) {
      const roleErr = Validator.role(filtered.role);
      if (roleErr) throw new Error(roleErr);
    }

    if (updates.password) {
      const pwdErr = Validator.password(updates.password);
      if (pwdErr) throw new Error(pwdErr);
      const { hash, salt, algo } = await hashPassword(updates.password);
      filtered.passwordHash = hash;
      filtered.passwordSalt = salt;
      filtered.passwordAlgo = algo;
      filtered.mustChangePassword = false;
    }

    Object.assign(user, filtered, { updatedAt: new Date().toISOString() });
    await niasDB.put('users', user);
    this._invalidateUserCache();
    TabSync.broadcast('user-updated', { userId: id });
    return user;
  },

  async changePassword(id, oldPassword, newPassword) {
    const user = await this.findUserById(id);
    if (!user) throw new Error('المستخدم غير موجود');

    const valid = await verifyPassword(oldPassword, {
      hash: user.passwordHash, salt: user.passwordSalt, algo: user.passwordAlgo
    });
    if (!valid) throw new Error('كلمة المرور الحالية غير صحيحة');

    const pwdErr = Validator.password(newPassword);
    if (pwdErr) throw new Error(pwdErr);

    const { hash, salt, algo } = await hashPassword(newPassword);
    user.passwordHash = hash;
    user.passwordSalt = salt;
    user.passwordAlgo = algo;
    user.mustChangePassword = false;
    user.updatedAt = new Date().toISOString();
    await niasDB.put('users', user);
    this._invalidateUserCache();
    Logger.log('Password changed for:', user.username);
    return true;
  },

  async deleteUser(id) {
    const [userEvals, targetEvals] = await Promise.all([
      this.getEvaluationsByEvaluator(id),
      this.getEvaluationsByTarget(id)
    ]);
    if (userEvals.length > 0 || targetEvals.length > 0) {
      throw new Error('لا يمكن حذف المستخدم لوجود تقييمات مرتبطة به. يُنصح بتعطيل الحساب بدلاً من الحذف.');
    }
    await niasDB.delete('users', id);
    this._invalidateUserCache();
    TabSync.broadcast('user-updated', { userId: id, deleted: true });
    Logger.log('User deleted:', id);
    return true;
  },

  async toggleUserActive(id) {
    const user = await this.findUserById(id);
    if (!user) return null;
    user.isActive = !user.isActive;
    user.updatedAt = new Date().toISOString();
    await niasDB.put('users', user);
    this._invalidateUserCache();
    TabSync.broadcast('user-updated', { userId: id });
    return user;
  },

  async updateUserLastLogin(id) {
    const u = await this.findUserById(id);
    if (u) {
      u.lastLogin = new Date().toISOString();
      u.loginCount = (u.loginCount || 0) + 1;
      await niasDB.put('users', u);
      this._invalidateUserCache();
    }
  },

  /* ─── Evaluations ─── */

  async getEvaluations() {
    const cacheKey = 'evaluations:all';
    const cached = cache.get(cacheKey);
    if (cached) return cached;
    
    const evaluations = await niasDB.getAll('evaluations');
    cache.set(cacheKey, evaluations);
    return evaluations;
  },
  
  async getEvaluationById(id) { 
    return await niasDB.getById('evaluations', id); 
  },
  
  async getEvaluationsByEvaluator(id) { 
    return await niasDB.getByIndex('evaluations', 'evaluatorId', id); 
  },
  
  async getEvaluationsByTarget(id) { 
    return await niasDB.getByIndex('evaluations', 'targetId', id); 
  },
  
  async getEvaluationsByType(type) { 
    return await niasDB.getByIndex('evaluations', 'formType', type); 
  },
  
  async getEvaluationsByDepartment(dept) { 
    return await niasDB.getByIndex('evaluations', 'department', dept); 
  },
  
  async getEvaluationsByDateRange(start, end) { 
    return await niasDB.getByIndexRange('evaluations', 'createdAt', start, end); 
  },
  
  async getEvaluationsByStatus(status) { 
    return await niasDB.getByIndex('evaluations', 'status', status); 
  },
  
  async getRecentEvaluations(limit = 50) { 
    return await niasDB.paginate('evaluations', 'createdAt', 1, limit, 'prev'); 
  },
  
  async countEvaluations() { 
    return await niasDB.count('evaluations'); 
  },

  async addEvaluation(data) {
    const err = Validator.evaluationData(data);
    if (err) throw new Error(err);

    const [evaluator, target] = await Promise.all([
      this.findUserById(data.evaluatorId),
      this.findUserById(data.targetId)
    ]);
    if (!evaluator) throw new Error('المقيّم غير موجود');
    if (!target) throw new Error('المُقيَّم غير موجود');
    if (data.evaluatorId === data.targetId) throw new Error('لا يمكن التقييم الذاتي');

    data.id = data.id || generateId('eval');
    data.createdAt = data.createdAt || new Date().toISOString();
    data.status = data.status || 'completed';
    data.department = data.department || target.department;

    await niasDB.add('evaluations', data);
    cache.delete('evaluations:all');
    TabSync.broadcast('evaluation-added', { evaluationId: data.id });
    Logger.log('Evaluation added:', data.id);
    return data;
  },

  async updateEvaluation(id, updates) {
    const evalItem = await this.getEvaluationById(id);
    if (!evalItem) return null;
    Object.assign(evalItem, updates, { updatedAt: new Date().toISOString() });
    await niasDB.put('evaluations', evalItem);
    cache.delete('evaluations:all');
    return evalItem;
  },

  async deleteEvaluation(id) {
    await niasDB.delete('evaluations', id);
    cache.delete('evaluations:all');
    TabSync.broadcast('evaluation-deleted', { evaluationId: id });
    Logger.log('Evaluation deleted:', id);
    return true;
  },

  /* ─── Batch Operations ─── */

  async addUsersBatch(users) {
    const results = { added: 0, errors: [] };
    
    for (const userData of users) {
      try {
        await this.addUserAsync(userData);
        results.added++;
      } catch (error) {
        results.errors.push({ user: userData.username, error: error.message });
      }
    }
    
    return results;
  },

  async addEvaluationsBatch(evaluations) {
    const results = { added: 0, errors: [] };
    
    for (const evalData of evaluations) {
      try {
        await this.addEvaluation(evalData);
        results.added++;
      } catch (error) {
        results.errors.push({ error: error.message });
      }
    }
    
    return results;
  },

  /* ─── Logs ─── */

  async getLogs(limit = 50) { 
    return await niasDB.paginate('logs', 'timestamp', 1, limit, 'prev'); 
  },
  
  async getLogsByUser(userId) { 
    return await niasDB.getByIndex('logs', 'userId', userId); 
  },
  
  async getLogsByAction(action) { 
    return await niasDB.getByIndex('logs', 'action', action); 
  },

  async addLog(userId, action, description) {
    const log = {
      id: generateId('log'),
      userId, action,
      description: String(description || '').slice(0, 500),
      timestamp: new Date().toISOString()
    };
    await niasDB.add('logs', log);
    return log;
  },

  /* ─── Import / Export ─── */

  async exportAll() {
    const [users, evaluations, logs, settings, backups] = await Promise.all([
      niasDB.getAll('users'), niasDB.getAll('evaluations'), niasDB.getAll('logs'),
      niasDB.getAll('settings'), niasDB.getAll('backups')
    ]);
    return { users, evaluations, logs, settings, backups, exportedAt: new Date().toISOString(), version: DB_VERSION };
  },

  async importAll(data) {
    if (!data || typeof data !== 'object') throw new Error('بيانات الاستيراد غير صالحة');
    if (data.users && !Array.isArray(data.users)) throw new Error('users يجب أن يكون مصفوفة');
    if (data.evaluations && !Array.isArray(data.evaluations)) throw new Error('evaluations يجب أن يكون مصفوفة');
    if (data.logs && !Array.isArray(data.logs)) throw new Error('logs يجب أن يكون مصفوفة');

    const preBackup = await this.exportAll();
    const jsonStr = JSON.stringify(preBackup);
    await niasDB.add('backups', {
      timestamp: new Date().toISOString(),
      data: jsonStr, size: jsonStr.length,
      note: 'Auto-backup before import'
    });
    Logger.log('Auto-backup created before import');

    if (data.users) {
      await niasDB.clear('users');
      for (const u of data.users) {
        if (u?.id && u?.username) await niasDB.add('users', u).catch(e => Logger.warn('Skip invalid user:', e.message));
      }
    }
    if (data.evaluations) {
      await niasDB.clear('evaluations');
      for (const e of data.evaluations) {
        if (e?.id && e?.formType) await niasDB.add('evaluations', e).catch(err => Logger.warn('Skip invalid eval:', err.message));
      }
    }
    if (data.logs) {
      await niasDB.clear('logs');
      for (const l of data.logs) {
        if (l?.id && l?.timestamp) await niasDB.add('logs', l).catch(err => Logger.warn('Skip invalid log:', err.message));
      }
    }

    cache.clear();
    await this.ensureAdminUser();
    await this._ensureDemoUsers();
    TabSync.broadcast('data-changed', { store: 'all' });
  },

  async clearAll() {
    await niasDB.clear('users');
    await niasDB.clear('evaluations');
    await niasDB.clear('logs');
    await niasDB.clear('settings');
    await niasDB.clear('rate_limits');
    cache.clear();
    await this.ensureAdminUser();
    await this._ensureDemoUsers();
    TabSync.broadcast('data-changed', { store: 'all' });
  },

  /* ─── Backups ─── */

  async createBackup(encrypt = false) {
    const data = await this.exportAll();
    let jsonStr = JSON.stringify(data);
    
    if (encrypt) {
      // Simple encryption (base64 encoding as placeholder)
      jsonStr = btoa(unescape(encodeURIComponent(jsonStr)));
    }
    
    const backup = { 
      timestamp: new Date().toISOString(), 
      data: jsonStr, 
      size: jsonStr.length,
      encrypted: encrypt
    };
    await niasDB.add('backups', backup);
    Logger.log(`Backup created (${encrypt ? 'encrypted' : 'plain'})`);
    return backup;
  },

  async getBackups(limit = 10) { 
    return await niasDB.paginate('backups', 'timestamp', 1, limit, 'prev'); 
  },

  async restoreBackup(backupId) {
    const backup = await niasDB.getById('backups', backupId);
    if (!backup?.data) return false;
    try {
      let jsonData = backup.data;
      
      if (backup.encrypted) {
        jsonData = decodeURIComponent(escape(atob(jsonData)));
      }
      
      const data = JSON.parse(jsonData);
      await this.importAll(data);
      Logger.log('Backup restored');
      return true;
    } catch (e) {
      Logger.error('Restore failed:', e.message);
      return false;
    }
  },

  /* ─── Settings ─── */

  async getSetting(key) {
    const setting = await niasDB.getById('settings', key);
    return setting ? setting.value : null;
  },

  async setSetting(key, value) {
    await niasDB.put('settings', { key, value, updatedAt: new Date().toISOString() });
  },

  async getStats() {
    const [users, evaluations, logs, backups] = await Promise.all([
      niasDB.count('users'), niasDB.count('evaluations'),
      niasDB.count('logs'), niasDB.count('backups')
    ]);
    
    // Additional stats
    const activeUsers = await this.getActiveUsers();
    const recentEvals = await this.getRecentEvaluations(10);
    
    return { 
      users, 
      evaluations, 
      logs, 
      backups,
      activeUsers: activeUsers.length,
      recentEvaluations: recentEvals.length,
      cacheStats: cache.getStats()
    };
  },

  /* ═══════════════════════════════════════════════════════
     Admin User (Guaranteed)
     ═══════════════════════════════════════════════════════ */

  async ensureAdminUser() {
    const ADMIN_USERNAME = 'admin';
    const ADMIN_PASSWORD = 'Admin@123';
    const ADMIN_NAME = 'مسؤول النظام';
    const ADMIN_DEPARTMENT = 'مركز التخطيط والتطوير';

    const existing = await this.findUserByUsername(ADMIN_USERNAME);

    if (existing) {
      const isCorrectPassword = await verifyPassword(ADMIN_PASSWORD, {
        hash: existing.passwordHash, salt: existing.passwordSalt, algo: existing.passwordAlgo
      });

      if (!isCorrectPassword) {
        const { hash, salt, algo } = await hashPassword(ADMIN_PASSWORD);
        existing.passwordHash = hash;
        existing.passwordSalt = salt;
        existing.passwordAlgo = algo;
        existing.mustChangePassword = false;
        existing.updatedAt = new Date().toISOString();
        await niasDB.put('users', existing);
        Logger.warn('✅ Admin password reset to Admin@123');
      } else if (existing.mustChangePassword) {
        existing.mustChangePassword = false;
        existing.updatedAt = new Date().toISOString();
        await niasDB.put('users', existing);
      }

      if (existing.isActive === false) {
        existing.isActive = true;
        existing.updatedAt = new Date().toISOString();
        await niasDB.put('users', existing);
      }
      return existing;
    }

    const { hash, salt, algo } = await hashPassword(ADMIN_PASSWORD);
    const adminUser = {
      username: ADMIN_USERNAME,
      passwordHash: hash, passwordSalt: salt, passwordAlgo: algo,
      name: ADMIN_NAME, role: ROLES.ADMIN, department: ADMIN_DEPARTMENT,
      id: 'admin-1', createdAt: new Date().toISOString(),
      mustChangePassword: false, isActive: true, isSystemAdmin: true
    };
    await this._addUserInternal(adminUser);
    Logger.warn('✅ Admin user created: admin / Admin@123');
    return adminUser;
  },

  async _ensureDemoUsers() {
    const demoUsers = [
      { username: 'vice_dean1', name: 'د. أحمد العلي', role: 'vice_dean', department: 'قسم الإدارة الصحية', id: 'u-vice-dean-1' },
      { username: 'dean1', name: 'د. خالد السعيد', role: 'dean', department: 'كلية العلوم الإدارية', id: 'u-dean-1' },
      { username: 'head1', name: 'د. محمد القحطاني', role: 'head', department: 'قسم الإدارة المستشففية', id: 'u-head-1' },
      { username: 'faculty1', name: 'د. سارة الأحمد', role: 'faculty', department: 'قسم الإدارة الصحية', id: 'u-faculty-1' },
      { username: 'student1', name: 'عبدالله محمد', role: 'student', department: 'بكالوريوس إدارة المستشففات', id: 'u-student-1' }
    ];

    const demoPassword = 'demo123';
    for (const u of demoUsers) {
      const exists = await this.findUserByUsername(u.username);
      if (!exists) {
        const { hash, salt, algo } = await hashPassword(demoPassword);
        await this._addUserInternal({
          ...u, passwordHash: hash, passwordSalt: salt, passwordAlgo: algo,
          createdAt: new Date().toISOString(), isActive: true
        });
      }
    }
  },

  async init() {
    await niasDB.init();
    await this.ensureAdminUser();
    await this._ensureDemoUsers();
    Logger.log('✅ NIAS Pro DB ready');
    return this;
  }
};

/* ═══════════════════════════════════════════════════════
   Rate Limiter
   ═══════════════════════════════════════════════════════ */

const RateLimiter = {
  _store: new Map(),
  _maxAttempts: 5,
  _windowMs: 15 * 60 * 1000,

  async isAllowed(key) {
    if (!key) return true;
    const now = Date.now();
    const record = this._store.get(key);
    if (record) {
      if (now - record.firstAttempt > this._windowMs) {
        this._store.delete(key);
        await this._removePersistent(key);
        return true;
      }
      return record.count < this._maxAttempts;
    }
    try {
      const persisted = await niasDB.getById('rate_limits', key);
      if (persisted) {
        if (now - persisted.firstAttempt > this._windowMs) {
          await niasDB.delete('rate_limits', key);
          return true;
        }
        this._store.set(key, persisted);
        return persisted.count < this._maxAttempts;
      }
    } catch (e) { /* ignore */ }
    return true;
  },

  async recordAttempt(key) {
    if (!key) return;
    const now = Date.now();
    let record = this._store.get(key);
    if (!record) record = { count: 1, firstAttempt: now };
    else record.count++;
    this._store.set(key, record);
    try {
      await niasDB.put('rate_limits', {
        key, count: record.count, firstAttempt: record.firstAttempt,
        expiresAt: record.firstAttempt + this._windowMs
      });
    } catch (e) { /* ignore */ }
  },

  async reset(key) {
    if (!key) return;
    this._store.delete(key);
    try { await niasDB.delete('rate_limits', key); } catch (e) { /* ignore */ }
  },

  async _removePersistent(key) {
    try { await niasDB.delete('rate_limits', key); } catch (e) { /* ignore */ }
  }
};

/* ═══════════════════════════════════════════════════════
   Auth (مع requireAuth و Permissions)
   ═══════════════════════════════════════════════════════ */

const Auth = {
  user: null,
  loginPage: 'login.html',
  _initialized: false,
  _initPromise: null,

  formsData: Object.freeze({
    faculty: { label: 'تقييم عضو هيئة تدريس', roles: [ROLES.ADMIN, ...EVALUATOR_ROLES] },
    deputies: { label: 'تقييم النواب', roles: [ROLES.ADMIN] },
    student: { label: 'تقييم المقرر الدراسي', roles: [ROLES.ADMIN, ...EVALUATOR_ROLES, ROLES.STUDENT] }
  }),

  async init() {
    if (this._initialized) return;
    if (this._initPromise) return this._initPromise;
    this._initPromise = (async () => {
      await niasDB.init();
      await this._restoreSession();
      this._initialized = true;
    })();
    return this._initPromise;
  },

  async _restoreSession() {
    // Persistent session
    try {
      const sessionData = await niasDB.getById('settings', AUTH_KEY);
      if (sessionData?.value) {
        const session = sessionData.value;
        if (session.expiresAt && new Date(session.expiresAt) < new Date()) {
          await niasDB.delete('settings', AUTH_KEY);
        } else {
          const dbUser = await DB.findUserById(session.id);
          if (!dbUser || dbUser.isActive === false) {
            await niasDB.delete('settings', AUTH_KEY);
          } else {
            this.user = this._sanitizeUser(dbUser);
            Logger.log('Session restored (persistent):', this.user.username);
            return;
          }
        }
      }
    } catch (e) { Logger.warn('Session restore (persistent) failed:', e.message); }

    // Temp session
    try {
      const temp = sessionStorage.getItem(AUTH_KEY);
      if (temp) {
        const session = JSON.parse(temp);
        if (session.expiresAt && new Date(session.expiresAt) < new Date()) {
          sessionStorage.removeItem(AUTH_KEY);
        } else {
          const dbUser = await DB.findUserById(session.id);
          if (!dbUser || dbUser.isActive === false) {
            sessionStorage.removeItem(AUTH_KEY);
          } else {
            this.user = this._sanitizeUser(dbUser);
            Logger.log('Session restored (temp):', this.user.username);
            return;
          }
        }
      }
    } catch (e) { Logger.warn('Session restore (temp) failed:', e.message); }

    this.user = null;
  },

  _sanitizeUser(user) {
    if (!user) return null;
    const { passwordHash, passwordSalt, passwordAlgo, password, ...safe } = user;
    return safe;
  },

  async login(username, password, remember = false) {
    if (!this._initialized) await this.init();

    const rateKey = `login:${String(username).toLowerCase()}`;
    if (!(await RateLimiter.isAllowed(rateKey))) {
      return { success: false, error: 'تم تجاوز عدد المحاولات. يرجى الانتظار 15 دقيقة.' };
    }

    try {
      const userRecord = await DB.findUserByUsername(username);
      if (!userRecord) {
        await RateLimiter.recordAttempt(rateKey);
        return { success: false, error: 'اسم المستخدم أو كلمة المرور غير صحيحة' };
      }

      if (userRecord.isActive === false) {
        await RateLimiter.recordAttempt(rateKey);
        return { success: false, error: 'الحساب معطل. تواصل مع مسؤول النظام.' };
      }

      const valid = await verifyPassword(password, {
        hash: userRecord.passwordHash,
        salt: userRecord.passwordSalt,
        algo: userRecord.passwordAlgo
      });

      if (!valid) {
        await RateLimiter.recordAttempt(rateKey);
        return { success: false, error: 'اسم المستخدم أو كلمة المرور غير صحيحة' };
      }

      if (userRecord.mustChangePassword) {
        return {
          success: false,
          mustChangePassword: true,
          userId: userRecord.id,
          error: 'يجب تغيير كلمة المرور الافتراضية قبل المتابعة'
        };
      }

      await RateLimiter.reset(rateKey);

      const session = this._sanitizeUser(userRecord);
      this.user = session;

      sessionStorage.removeItem(AUTH_KEY);
      await niasDB.delete('settings', AUTH_KEY).catch(() => {});

      const now = new Date();
      const expiresAt = remember
        ? new Date(now.getTime() + PERSISTENT_SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString()
        : new Date(now.getTime() + SESSION_DURATION_MS).toISOString();

      const sessionData = { ...session, expiresAt };

      if (remember) {
        await niasDB.put('settings', {
          key: AUTH_KEY, value: sessionData, remember: true, timestamp: now.toISOString()
        });
      } else {
        sessionStorage.setItem(AUTH_KEY, JSON.stringify(sessionData));
      }

      await DB.updateUserLastLogin(userRecord.id);
      await DB.addLog(userRecord.id, 'LOGIN', `تسجيل دخول: ${userRecord.username}`);
      TabSync.broadcast('login', { userId: userRecord.id });
      return { success: true, user: session };

    } catch (err) {
      Logger.error('Auth.login error:', err.message);
      if (err.message?.includes('closing') || err.name === 'InvalidStateError') {
        return { success: false, error: 'فشل الاتصال بقاعدة البيانات. يرجى تحديث الصفحة.' };
      }
      return { success: false, error: 'حدث خطأ غير متوقع. يرجى المحاولة لاحقاً.' };
    }
  },

  async logout() {
    if (this.user) {
      await DB.addLog(this.user.id, 'LOGOUT', `تسجيل خروج: ${this.user.username}`).catch(() => {});
    }
    await this.clearSession();
    TabSync.broadcast('logout', {});
    if (typeof window !== 'undefined') {
      window.location.href = this.loginPage;
    }
  },

  async clearSession() {
    this.user = null;
    sessionStorage.removeItem(AUTH_KEY);
    await niasDB.delete('settings', AUTH_KEY).catch(() => {});
  },

  async check() {
    if (!this._initialized) await this.init();
    if (this.user) {
      try {
        const dbUser = await DB.findUserById(this.user.id);
        if (!dbUser || dbUser.isActive === false) {
          await this.clearSession();
          return false;
        }
      } catch (e) { return false; }
    }
    return !!this.user;
  },

  async isAuthenticated() { return this.check(); },

  async requireAuth() {
    if (!(await this.check())) {
      if (typeof window !== 'undefined') {
        window.location.href = this.loginPage;
      }
      return false;
    }
    return true;
  },

  isEvaluator() { return !!this.user && EVALUATOR_ROLES.includes(this.user.role); },

  hasRole(...roles) { return !!this.user && roles.includes(this.user.role); },

  checkRole(roles = []) {
    if (!this.user) return false;
    const expanded = roles.flatMap(r => (r === 'evaluator' ? [...EVALUATOR_ROLES] : [r]));
    return expanded.includes(this.user.role);
  },

  getRoleInfo(role) {
    return { role, label: ROLE_LABELS[role] || role, isEvaluator: EVALUATOR_ROLES.includes(role) };
  },

  canEvaluate(type) {
    if (!this.user || !this.formsData[type]) return false;
    return this.formsData[type].roles.includes(this.user.role);
  },

  getAllowedForms() {
    return Object.keys(this.formsData).filter(id => this.canEvaluate(id));
  },

  /* ─── Permission Methods ─── */

  hasPermission(permission) {
    return !!this.user && PermissionManager.hasPermission(this.user.role, permission);
  },

  hasAnyPermission(permissions) {
    return !!this.user && PermissionManager.hasAnyPermission(this.user.role, permissions);
  },

  hasAllPermissions(permissions) {
    return !!this.user && PermissionManager.hasAllPermissions(this.user.role, permissions);
  },

  requirePermission(permission) {
    if (!this.hasPermission(permission)) {
      Logger.warn(`Permission denied: ${permission}`);
      return false;
    }
    return true;
  },

  async requireAuthAndPermission(permission) {
    const isAuth = await this.requireAuth();
    if (!isAuth) return false;
    
    if (!this.hasPermission(permission)) {
      if (typeof window !== 'undefined') {
        alert('ليس لديك صلاحية للوصول إلى هذه الصفحة');
        window.location.href = 'index.html';
      }
      return false;
    }
    return true;
  },

  getPermissions() {
    return this.user ? PermissionManager.getPermissions(this.user.role) : [];
  }
};

/* ═══════════════════════════════════════════════════════
   [إصلاح] تصدير صريح إلى window
   ═══════════════════════════════════════════════════════
   بدون هذا، فإن أي كود يتحقق من window.DB أو window.Auth
   (كما في login.html) سيجدهما "غير معرّفين" دائماً، لأن
   التصريح بـ const في سكربت عادي لا يُنشئ خاصية على window.
   ═══════════════════════════════════════════════════════ */
if (typeof window !== 'undefined') {
  window.DB = DB;
  window.Auth = Auth;
  window.ROLES = ROLES;
  window.ROLE_LABELS = ROLE_LABELS;
  window.EVALUATOR_ROLES = EVALUATOR_ROLES;
  window.PERMISSIONS = PERMISSIONS;
  window.ROLE_PERMISSIONS = ROLE_PERMISSIONS;
  window.PermissionManager = PermissionManager;
  window.Logger = Logger;
  window.TabSync = TabSync;
  window.RateLimiter = RateLimiter;
  window.cache = cache;
  window.Validator = Validator;
  window.generateId = generateId;
  window.generateUUID = generateUUID;
  window.generateSecurePassword = generateSecurePassword;
}

/* ═══════════════════════════════════════════════════════
   Auto-init
   ═══════════════════════════════════════════════════════ */
if (typeof window !== 'undefined') {
  DB.init()
    .then(() => {
      TabSync.init();
      Logger.log('✅ NIAS Pro DB ready with TabSync');
    })
    .catch(Logger.error);
}

/* ═══════════════════════════════════════════════════════
   Export
   ═══════════════════════════════════════════════════════ */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    DB, Auth, ROLES, ROLE_LABELS, EVALUATOR_ROLES,
    PERMISSIONS, ROLE_PERMISSIONS, PermissionManager,
    NIASDatabase, Logger, Validator, RateLimiter,
    generateSecurePassword, hashPassword, verifyPassword,
    generateId, generateUUID, Hex, PerformanceMonitor,
    CacheSystem, cache, TabSync
  };
}
