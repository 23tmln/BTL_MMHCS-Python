import { openDB } from 'idb';

/**
 * secureStore.js
 * Lớp trừu tượng (Utility Wrapper) tương tác với cơ sở dữ liệu IndexedDB của trình duyệt.
 * Lưu trữ bền vững và cục bộ:
 * 1. keys: Các Key nhận dạng và Bundle của thiết bị (Private/Public Key).
 * 2. sessions: Các phiên thiết lập mã hóa E2E đang duy trì với những người dùng khác.
 * 3. messageCache: Bộ lưu trữ (cache) các tin nhắn đã được giải mã ít nhất một lần để tránh 
 *    mất tin nhắn do vấn đề giải mã lại khi restore.
 */
const DB_NAME = 'ChatifyE2EE';
const DB_VERSION = 2;

export async function getDB() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) {
      // v1 stores
      if (oldVersion < 1) {
        if (!db.objectStoreNames.contains('keys')) {
          db.createObjectStore('keys');
        }
        if (!db.objectStoreNames.contains('sessions')) {
          db.createObjectStore('sessions');
        }
      }
      // v2: message plaintext cache — survives backup/restore
      if (oldVersion < 2) {
        if (!db.objectStoreNames.contains('messageCache')) {
          db.createObjectStore('messageCache');
        }
      }
    },
  });
}

// --- CÁC HÀM TƯƠNG TÁC VỚI KHO LƯU BỘ KHÓA (KEYS) ---
export async function saveKey(name, value) {
  const db = await getDB();
  return db.put('keys', value, name);
}

export async function getKey(name) {
  const db = await getDB();
  return db.get('keys', name);
}

export async function clearKeys() {
  const db = await getDB();
  return db.clear('keys');
}

// Export ALL keys as a plain object { key: value }
export async function getAllKeys() {
  const db = await getDB();
  const tx = db.transaction('keys', 'readonly');
  const store = tx.objectStore('keys');
  const allKeys = await store.getAllKeys();
  const allValues = await store.getAll();
  const result = {};
  for (let i = 0; i < allKeys.length; i++) {
    result[allKeys[i]] = allValues[i];
  }
  return result;
}

// Restore ALL keys from a plain object { key: value }
export async function restoreKeys(data) {
  const db = await getDB();
  const tx = db.transaction('keys', 'readwrite');
  const store = tx.objectStore('keys');
  await store.clear();
  for (const [key, value] of Object.entries(data)) {
    await store.put(value, key);
  }
  await tx.done;
}

// --- CÁC HÀM TƯƠNG TÁC VỚI KHO LƯU PHIÊN BẢO MẬT (SESSIONS) ---
export async function saveSession(address, sessionData) {
  const db = await getDB();
  return db.put('sessions', sessionData, address);
}

export async function getSession(address) {
  const db = await getDB();
  return db.get('sessions', address);
}

export async function clearSessions() {
  const db = await getDB();
  return db.clear('sessions');
}

// Export ALL sessions as a plain object { address: sessionRecord }
export async function getAllSessions() {
  const db = await getDB();
  const tx = db.transaction('sessions', 'readonly');
  const store = tx.objectStore('sessions');
  const allKeys = await store.getAllKeys();
  const allValues = await store.getAll();
  const result = {};
  for (let i = 0; i < allKeys.length; i++) {
    result[allKeys[i]] = allValues[i];
  }
  return result;
}

// Restore ALL sessions from a plain object { address: sessionRecord }
export async function restoreSessions(data) {
  const db = await getDB();
  const tx = db.transaction('sessions', 'readwrite');
  const store = tx.objectStore('sessions');
  await store.clear();
  for (const [key, value] of Object.entries(data)) {
    await store.put(value, key);
  }
  await tx.done;
}

// --- BỘ ĐỆM TIN NHẮN (MESSAGE CACHE) ---
// Lưu các văn bản Plaintext sau khi giải mã thành công (dựa theo messageId).
// Dữ liệu này được đưa luôn vào Object Backup tải lên server. 
// Do bản chất Signal sẽ xóa key của tin nhắn sau khi mở, giải pháp này giúp đảm bảo 
// các phiên đăng nhập lại hoặc thiết bị mới từ điểm khôi phục vẫn xem được tin cũ.

export async function getCachedMessage(messageId) {
  const db = await getDB();
  return db.get('messageCache', messageId);
}

export async function cacheMessage(messageId, plaintext) {
  const db = await getDB();
  return db.put('messageCache', plaintext, messageId);
}

export async function clearMessageCache() {
  const db = await getDB();
  return db.clear('messageCache');
}

export async function getAllCachedMessages() {
  const db = await getDB();
  const tx = db.transaction('messageCache', 'readonly');
  const store = tx.objectStore('messageCache');
  const allKeys = await store.getAllKeys();
  const allValues = await store.getAll();
  const result = {};
  for (let i = 0; i < allKeys.length; i++) {
    result[allKeys[i]] = allValues[i];
  }
  return result;
}

export async function restoreCachedMessages(data) {
  const db = await getDB();
  const tx = db.transaction('messageCache', 'readwrite');
  const store = tx.objectStore('messageCache');
  // Merge instead of replace — keep any NEW messages decrypted after the backup was taken
  for (const [key, value] of Object.entries(data)) {
    const existing = await store.get(key);
    if (!existing) {
      await store.put(value, key);
    }
  }
  await tx.done;
}

/**
 * Clear all crypto state.
 * @param {boolean} preserveMessageCache - If true, keep the message plaintext cache.
 *   Use true during account restore (keep cached messages alongside restored keys).
 *   Use false (default) when switching accounts or doing a full reset.
 */
export async function clearAllCryptoState(preserveMessageCache = false) {
  await clearKeys();
  await clearSessions();
  if (!preserveMessageCache) {
    await clearMessageCache();
  }
}
