
const DB_NAME = 'SoulkynDB';
const DB_VERSION = 1;
const STORE_NAME = 'keyval';

// Singleton instance to prevent connection thrashing
let dbInstance: IDBDatabase | null = null;

const getDB = async (): Promise<IDBDatabase> => {
  if (dbInstance) return dbInstance;

  return new Promise((resolve, reject) => {
    // Check for support
    if (!window.indexedDB) {
        return reject(new Error("IndexedDB not supported"));
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      
      // Handle unexpected closures
      dbInstance.onversionchange = () => {
         dbInstance?.close();
         dbInstance = null;
      };
      dbInstance.onclose = () => {
         dbInstance = null;
      };
      
      resolve(dbInstance);
    };

    request.onerror = () => {
        console.error("IDB Open Error:", request.error);
        reject(request.error);
    };
  });
};

export const storage = {
  get: async <T>(key: string): Promise<T | null> => {
    let result: T | undefined;
    
    // 1. Try IndexedDB
    try {
       const db = await getDB();
       result = await new Promise((resolve, reject) => {
          try {
              const tx = db.transaction(STORE_NAME, 'readonly');
              const store = tx.objectStore(STORE_NAME);
              const req = store.get(key);
              req.onsuccess = () => resolve(req.result);
              req.onerror = () => reject(req.error);
          } catch (e) {
              reject(e);
          }
       });
    } catch (e) {
       console.warn(`IDB Read Error (${key}), falling back to LS:`, e);
    }

    // Return IDB result if found
    if (result !== undefined && result !== null) {
      return result;
    }

    // 2. Fallback to LocalStorage
    try {
      const lsItem = window.localStorage.getItem(key);
      return lsItem ? JSON.parse(lsItem) : null;
    } catch (e) {
      return null;
    }
  },

  set: async (key: string, value: any): Promise<void> => {
    // 1. Write to IndexedDB (Primary)
    try {
      const db = await getDB();
      await new Promise<void>((resolve, reject) => {
         const tx = db.transaction(STORE_NAME, 'readwrite');
         const store = tx.objectStore(STORE_NAME);
         const req = store.put(value, key);
         req.onsuccess = () => resolve();
         req.onerror = () => reject(req.error);
      });
    } catch (e) {
      console.error(`IDB Write Error (${key}):`, e);
    }

    // 2. Backup to LocalStorage (if size permits)
    try {
      const str = JSON.stringify(value);
      // Only backup if smaller than ~2MB to avoid quota errors
      if (str.length < 2000000) {
        window.localStorage.setItem(key, str);
      }
    } catch (e) {
      // Ignore LS errors (quota exceeded usually)
    }
  },

  delete: async (key: string): Promise<void> => {
    try {
      window.localStorage.removeItem(key);
    } catch (e) {}

    try {
      const db = await getDB();
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(key);
    } catch (e) {}
  }
};
