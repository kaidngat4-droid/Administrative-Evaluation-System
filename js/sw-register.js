/**
 * ============================================================
 * NIAS — Service Worker Registration (Professional Edition)
 * المعهد الوطني للعلوم الإدارية — فرع إب
 * ============================================================
 * @version 2.0.0
 * @author NIAS Dev Team
 * @license MIT
 */

'use strict';

/**
 * @typedef {Object} SWConfig
 * @property {string} swPath - مسار ملف Service Worker
 * @property {string} scope - نطاق التسجيل
 * @property {boolean} updateViaCache - استخدام التخزين المؤقت للتحديث
 */

/**
 * @typedef {Object} SWState
 * @property {ServiceWorkerRegistration|null} registration
 * @property {ServiceWorker|null} controller
 * @property {boolean} isSupported
 * @property {boolean} isOnline
 * @property {string} status - 'unregistered' | 'registering' | 'registered' | 'updating' | 'error'
 * @property {string|null} updateAvailable
 */

/**
 * @typedef {'debug'|'info'|'warn'|'error'} LogLevel
 */

/**
 * Configuration par défaut
 */
const DEFAULT_CONFIG = Object.freeze({
  swPath: '/sw.js',
  scope: '/',
  updateViaCache: 'none', // 'imports' | 'all' | 'none'
  updateCheckInterval: 60 * 60 * 1000, // فحص كل ساعة
  skipWaitingOnUpdate: false,
  showUpdateNotification: true
});

/**
 * Niveaux de log
 */
const LOG_LEVELS = Object.freeze({
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3
});

/**
 * ============================================================
 * Logger Professionnel
 * ============================================================
 */
class SWLogger {
  /** @type {number} */
  #level;
  /** @type {string} */
  #prefix;

  /**
   * @param {LogLevel} level
   * @param {string} prefix
   */
  constructor(level = 'info', prefix = '[SW]') {
    this.#level = LOG_LEVELS[level.toUpperCase()] ?? LOG_LEVELS.INFO;
    this.#prefix = prefix;
  }

  /**
   * @param {LogLevel} level
   * @param {...*} args
   */
  #log(level, ...args) {
    if (LOG_LEVELS[level.toUpperCase()] < this.#level) return;
    
    const timestamp = new Date().toISOString();
    const style = this.#getStyle(level);
    
    // eslint-disable-next-line no-console
    console.log(
      `%c${this.#prefix} %c[${timestamp}] %c[${level.toUpperCase()}]`,
      'color: #0d4a2e; font-weight: bold;',
      'color: #64748b; font-size: 0.85em;',
      style,
      ...args
    );
  }

  /**
   * @param {LogLevel} level
   * @returns {string}
   */
  #getStyle(level) {
    const styles = {
      debug: 'color: #8b5cf6;',
      info: 'color: #0ea5e9;',
      warn: 'color: #f59e0b; font-weight: bold;',
      error: 'color: #ef4444; font-weight: bold;'
    };
    return styles[level] || styles.info;
  }

  debug(...args) { this.#log('debug', ...args); }
  info(...args) { this.#log('info', ...args); }
  warn(...args) { this.#log('warn', ...args); }
  error(...args) { this.#log('error', ...args); }
}

/**
 * ============================================================
 * Gestionnaire d'État Réseau
 * ============================================================
 */
class NetworkManager {
  /** @type {boolean} */
  #isOnline;
  /** @type {Set<Function>} */
  #listeners;
  /** @type {number|null} */
  #debounceTimer;
  /** @type {SWLogger} */
  #logger;

  constructor(logger) {
    this.#isOnline = navigator.onLine;
    this.#listeners = new Set();
    this.#debounceTimer = null;
    this.#logger = logger;
    
    this.#bindEvents();
  }

  #bindEvents() {
    window.addEventListener('online', () => this.#handleChange(true));
    window.addEventListener('offline', () => this.#handleChange(false));
    
    // Détection avancée avec fetch de secours
    this.#verifyConnection();
  }

  /**
   * Vérification réelle de la connectivité (pas seulement l'événement du navigateur)
   */
  async #verifyConnection() {
    if (!navigator.onLine) return;
    
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      
      await fetch('/manifest.json', {
        method: 'HEAD',
        cache: 'no-store',
        signal: controller.signal
      });
      
      clearTimeout(timeout);
    } catch {
      this.#handleChange(false);
    }
  }

  /**
   * @param {boolean} status
   */
  #handleChange(status) {
    clearTimeout(this.#debounceTimer);
    
    // Debounce pour éviter les oscillations rapides
    this.#debounceTimer = setTimeout(() => {
      if (this.#isOnline !== status) {
        this.#isOnline = status;
        this.#logger.info(`Network status changed: ${status ? 'online' : 'offline'}`);
        this.#notify(status);
      }
    }, 300);
  }

  /**
   * @param {boolean} status
   */
  #notify(status) {
    this.#listeners.forEach(cb => {
      try { cb(status); } 
      catch (e) { this.#logger.error('Network listener error:', e); }
    });
  }

  /**
   * @param {Function} callback
   * @returns {Function} Fonction de désinscription
   */
  onChange(callback) {
    this.#listeners.add(callback);
    // Appel immédiat avec l'état actuel
    callback(this.#isOnline);
    
    return () => this.#listeners.delete(callback);
  }

  get isOnline() { return this.#isOnline; }
}

/**
 * ============================================================
 * Gestionnaire de Notifications Push
 * ============================================================
 */
class NotificationManager {
  /** @type {SWLogger} */
  #logger;
  /** @type {string} */
  #permission;

  constructor(logger) {
    this.#logger = logger;
    this.#permission = Notification.permission;
  }

  /**
   * @returns {Promise<boolean>}
   */
  async requestPermission() {
    if (!('Notification' in window)) {
      this.#logger.warn('Notifications not supported');
      return false;
    }

    try {
      this.#permission = await Notification.requestPermission();
      this.#logger.info('Notification permission:', this.#permission);
      return this.#permission === 'granted';
    } catch (error) {
      this.#logger.error('Permission request failed:', error);
      return false;
    }
  }

  /**
   * @param {string} title
   * @param {NotificationOptions} options
   */
  show(title, options = {}) {
    if (this.#permission !== 'granted') {
      this.#logger.warn('Cannot show notification: permission not granted');
      return;
    }

    try {
      const defaultOptions = {
        icon: '/assets/images/icon-192x192.png',
        badge: '/assets/images/icon-72x72.png',
        dir: 'rtl',
        lang: 'ar',
        requireInteraction: false
      };

      new Notification(title, { ...defaultOptions, ...options });
    } catch (error) {
      this.#logger.error('Failed to show notification:', error);
    }
  }

  get permission() { return this.#permission; }
  get isGranted() { return this.#permission === 'granted'; }
}

/**
 * ============================================================
 * Gestionnaire de Mise à Jour
 * ============================================================
 */
class UpdateManager {
  /** @type {SWLogger} */
  #logger;
  /** @type {Function|null} */
  #onUpdateCallback;
  /** @type {ServiceWorker|null} */
  #waitingWorker;
  /** @type {boolean} */
  #updateFound;

  constructor(logger) {
    this.#logger = logger;
    this.#onUpdateCallback = null;
    this.#waitingWorker = null;
    this.#updateFound = false;
  }

  /**
   * @param {ServiceWorkerRegistration} registration
   */
  attach(registration) {
    registration.addEventListener('updatefound', () => {
      this.#logger.info('Update found, new worker installing...');
      
      const newWorker = registration.installing;
      
      newWorker?.addEventListener('statechange', () => {
        this.#logger.debug('New worker state:', newWorker.state);
        
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          this.#waitingWorker = newWorker;
          this.#updateFound = true;
          this.#handleUpdateAvailable(newWorker);
        }
      });
    });
  }

  /**
   * @param {ServiceWorker} worker
   */
  #handleUpdateAvailable(worker) {
    this.#logger.info('New version ready to activate');
    
    if (this.#onUpdateCallback) {
      this.#onUpdateCallback({
        type: 'UPDATE_AVAILABLE',
        version: null, // Peut être récupéré via message
        skip: () => this.skipWaiting(worker),
        postpone: () => this.#logger.info('Update postponed by user')
      });
    } else {
      // Comportement par défaut : notification discrète
      this.#showDefaultUpdateUI(worker);
    }
  }

  /**
   * @param {ServiceWorker} worker
   */
  #showDefaultUpdateUI(worker) {
    // Créer une notification toast au lieu de confirm()
    if (window.App?.toast) {
      window.App.toast(
        'نسخة جديدة متاحة. <button onclick="SWRegistration.applyUpdate()" style="background:#0d4a2e;color:#fff;border:none;padding:4px 12px;border-radius:4px;cursor:pointer;margin-right:8px;">تحديث الآن</button>',
        'info',
        10000
      );
    } else {
      // Fallback si App.toast n'existe pas
      if (confirm('نسخة جديدة متاحة من التطبيق. هل تريد التحديث الآن؟')) {
        this.skipWaiting(worker);
      }
    }
  }

  /**
   * @param {ServiceWorker} [worker]
   */
  skipWaiting(worker = this.#waitingWorker) {
    if (!worker) {
      this.#logger.warn('No waiting worker to skip');
      return;
    }

    this.#logger.info('Sending SKIP_WAITING to new worker...');
    
    worker.postMessage({ type: 'SKIP_WAITING' });
    
    // Écouter le rechargement
    let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!reloaded) {
        reloaded = true;
        window.location.reload();
      }
    });
  }

  /**
   * @param {Function} callback
   */
  onUpdate(callback) {
    this.#onUpdateCallback = callback;
  }

  get hasUpdate() { return this.#updateFound; }
}

/**
 * ============================================================
 * Gestionnaire de Cache (Client Side)
 * ============================================================
 */
class CacheManager {
  /** @type {SWLogger} */
  #logger;

  constructor(logger) {
    this.#logger = logger;
  }

  /**
   * Effacer tous les caches
   * @returns {Promise<{success: boolean, deleted: number, error?: string}>}
   */
  async clearAll() {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map(name => caches.delete(name)));
      this.#logger.info('All caches cleared:', keys.length);
      return { success: true, deleted: keys.length };
    } catch (error) {
      this.#logger.error('Cache clear failed:', error);
      return { success: false, deleted: 0, error: error.message };
    }
  }

  /**
   * Obtenir la taille totale des caches
   * @returns {Promise<{entries: number, sizeBytes: number, sizeMB: string}>}
   */
  async getSize() {
    try {
      const keys = await caches.keys();
      let totalSize = 0;
      let totalEntries = 0;

      for (const name of keys) {
        const cache = await caches.open(name);
        const requests = await cache.keys();
        totalEntries += requests.length;

        for (const req of requests) {
          const res = await cache.match(req);
          if (res) {
            const blob = await res.blob();
            totalSize += blob.size;
          }
        }
      }

      return {
        entries: totalEntries,
        sizeBytes: totalSize,
        sizeMB: (totalSize / 1024 / 1024).toFixed(2)
      };
    } catch (error) {
      this.#logger.error('Cache size calculation failed:', error);
      return { entries: 0, sizeBytes: 0, sizeMB: '0.00' };
    }
  }

  /**
   * Envoyer un message au Service Worker actif
   * @param {string} type
   * @param {*} payload
   * @returns {Promise<*>}
   */
  async sendMessage(type, payload = {}) {
    return new Promise((resolve, reject) => {
      const channel = new MessageChannel();
      
      channel.port1.onmessage = (event) => {
        if (event.data?.error) {
          reject(new Error(event.data.error));
        } else {
          resolve(event.data);
        }
      };

      navigator.serviceWorker.controller?.postMessage(
        { type, ...payload },
        [channel.port2]
      ) ?? reject(new Error('No active service worker'));
    });
  }
}

/**
 * ============================================================
 * Classe Principale : SWRegistration
 * ============================================================
 */
class SWRegistrationClass {
  /** @type {SWConfig} */
  #config;
  /** @type {SWState} */
  #state;
  /** @type {SWLogger} */
  #logger;
  /** @type {NetworkManager} */
  #network;
  /** @type {NotificationManager} */
  #notifications;
  /** @type {UpdateManager} */
  #updates;
  /** @type {CacheManager} */
  #cache;
  /** @type {number|null} */
  #updateInterval;
  /** @type {BroadcastChannel|null} */
  #broadcastChannel;

  constructor() {
    this.#config = { ...DEFAULT_CONFIG };
    this.#logger = new SWLogger('info', '[NIAS-SW]');
    this.#network = new NetworkManager(this.#logger);
    this.#notifications = new NotificationManager(this.#logger);
    this.#updates = new UpdateManager(this.#logger);
    this.#cache = new CacheManager(this.#logger);
    this.#updateInterval = null;
    
    this.#state = {
      registration: null,
      controller: null,
      isSupported: 'serviceWorker' in navigator,
      isOnline: navigator.onLine,
      status: 'unregistered',
      updateAvailable: null
    };

    // Canal de diffusion pour communication inter-onglets
    if ('BroadcastChannel' in window) {
      this.#broadcastChannel = new BroadcastChannel('nias-sw-channel');
      this.#broadcastChannel.onmessage = (event) => this.#handleBroadcast(event.data);
    }
  }

  /**
   * Initialisation complète
   * @param {Partial<SWConfig>} customConfig
   * @returns {Promise<SWState>}
   */
  async init(customConfig = {}) {
    this.#config = { ...DEFAULT_CONFIG, ...customConfig };
    
    if (!this.#state.isSupported) {
      this.#logger.warn('Service Worker not supported');
      return this.#state;
    }

    try {
      this.#state.status = 'registering';
      this.#logger.info('Initializing SWRegistration v2.0.0...');

      // Écouter les messages du SW
      this.#listenToMessages();

      // Enregistrer le SW
      await this.#register();

      // Démarrer la vérification périodique
      this.#startPeriodicUpdateCheck();

      // Synchronisation en arrière-plan si supportée
      this.#registerBackgroundSync();

      this.#state.status = 'registered';
      this.#logger.info('SWRegistration initialized successfully');

    } catch (error) {
      this.#state.status = 'error';
      this.#logger.error('Initialization failed:', error);
    }

    return this.#state;
  }

  /**
   * Enregistrement du Service Worker
   */
  async #register() {
    const { swPath, scope, updateViaCache } = this.#config;

    this.#logger.debug('Registering service worker...', { path: swPath, scope });

    const registration = await navigator.serviceWorker.register(swPath, {
      scope,
      updateViaCache
    });

    this.#state.registration = registration;
    this.#state.controller = registration.active || registration.installing;

    this.#logger.info('Service Worker registered:', registration.scope);

    // Attacher le gestionnaire de mises à jour
    this.#updates.attach(registration);

    // Écouter les changements de contrôleur
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      this.#logger.info('Controller changed');
      this.#state.controller = navigator.serviceWorker.controller;
    });

    // Forcer une vérification immédiate
    await registration.update();
  }

  /**
   * Écouter les messages du Service Worker
   */
  #listenToMessages() {
    navigator.serviceWorker.addEventListener('message', (event) => {
      const { data } = event;
      
      if (!data?.type) return;

      this.#logger.debug('Message from SW:', data.type);

      switch (data.type) {
        case 'SW_ACTIVATED':
          this.#logger.info(`Service Worker activated: ${data.version}`);
          this.#state.updateAvailable = null;
          break;

        case 'CACHE_SIZE_INFO':
          this.#logger.debug('Cache size:', data);
          break;

        case 'SYNC_COMPLETE':
          this.#logger.info('Background sync completed:', data.queue);
          break;

        case 'SYNC_FAILED':
          this.#logger.error('Background sync failed:', data);
          break;

        case 'NOTIFICATION_CLICKED':
          this.#logger.info('Notification clicked:', data);
          break;
      }
    });
  }

  /**
   * Gérer les messages du BroadcastChannel
   */
  #handleBroadcast(data) {
    if (data.type === 'UPDATE_APPLIED' && data.tabId !== this.#getTabId()) {
      this.#logger.info('Update applied in another tab');
    }
  }

  /**
   * Vérification périodique des mises à jour
   */
  #startPeriodicUpdateCheck() {
    if (this.#updateInterval) clearInterval(this.#updateInterval);
    
    this.#updateInterval = setInterval(() => {
      this.checkForUpdates();
    }, this.#config.updateCheckInterval);
  }

  /**
   * Enregistrer la synchronisation en arrière-plan
   */
  async #registerBackgroundSync() {
    if (!('sync' in registration)) {
      this.#logger.debug('Background Sync not supported');
      return;
    }

    try {
      const registration = this.#state.registration;
      await registration.sync.register('sync-evaluations');
      this.#logger.info('Background sync registered');
    } catch (error) {
      this.#logger.warn('Background sync registration failed:', error);
    }
  }

  /**
   * Vérifier manuellement les mises à jour
   */
  async checkForUpdates() {
    if (!this.#state.registration) return;

    try {
      this.#state.status = 'updating';
      this.#logger.info('Checking for updates...');
      
      await this.#state.registration.update();
      
      this.#state.status = 'registered';
    } catch (error) {
      this.#state.status = 'error';
      this.#logger.error('Update check failed:', error);
    }
  }

  /**
   * Appliquer une mise à jour en attente
   */
  applyUpdate() {
    this.#updates.skipWaiting();
    
    if (this.#broadcastChannel) {
      this.#broadcastChannel.postMessage({
        type: 'UPDATE_APPLIED',
        tabId: this.#getTabId(),
        timestamp: Date.now()
      });
    }
  }

  /**
   * Demander la permission de notification
   */
  async requestNotificationPermission() {
    return this.#notifications.requestPermission();
  }

  /**
   * Afficher une notification locale
   */
  showNotification(title, options) {
    this.#notifications.show(title, options);
  }

  /**
   * Effacer tous les caches
   */
  async clearCaches() {
    return this.#cache.clearAll();
  }

  /**
   * Obtenir la taille des caches
   */
  async getCacheSize() {
    return this.#cache.getSize();
  }

  /**
   * Envoyer un message au SW
   */
  async sendMessage(type, payload) {
    return this.#cache.sendMessage(type, payload);
  }

  /**
   * S'abonner aux changements de connexion
   * @param {Function} callback
   * @returns {Function} Unsubscribe function
   */
  onConnectionChange(callback) {
    return this.#network.onChange(callback);
  }

  /**
   * S'abonner aux mises à jour disponibles
   * @param {Function} callback
   */
  onUpdateAvailable(callback) {
    this.#updates.onUpdate(callback);
  }

  /**
   * Obtenir un ID unique pour cet onglet
   */
  #getTabId() {
    return sessionStorage.getItem('nias-tab-id') || 
           sessionStorage.setItem('nias-tab-id', Math.random().toString(36).slice(2)) ||
           sessionStorage.getItem('nias-tab-id');
  }

  // Getters publics
  get state() { return { ...this.#state }; }
  get isOnline() { return this.#network.isOnline; }
  get isSupported() { return this.#state.isSupported; }
  get registration() { return this.#state.registration; }
  get hasUpdate() { return this.#updates.hasUpdate; }
  get notificationPermission() { return this.#notifications.permission; }
}

// ============================================================
// Instance Globale
// ============================================================

/** @type {SWRegistrationClass} */
const SWRegistration = new SWRegistrationClass();

// ============================================================
// Auto-initialisation
// ============================================================

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => SWRegistration.init());
} else {
  SWRegistration.init();
}

// ============================================================
// Exposition Globale
// ============================================================

window.SWRegistration = SWRegistration;

// ============================================================
// Compatibilité API v1 (pour code existant)
// ============================================================

/**
 * @deprecated Utilisez SWRegistration directement
 */
window.SWRegistrationCompat = {
  register: () => SWRegistration.init(),
  requestNotificationPermission: () => SWRegistration.requestNotificationPermission(),
  clearCaches: () => SWRegistration.clearCaches(),
  isOnline: () => SWRegistration.isOnline,
  onConnectionChange: (cb) => SWRegistration.onConnectionChange(cb)
};

/**
 * ============================================================
 * Export pour modules ES (optionnel)
 * ============================================================
 */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { SWRegistration, SWRegistrationClass, SWLogger };
}
