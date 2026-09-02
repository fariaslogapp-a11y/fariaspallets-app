import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  onSnapshot,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { getDb } from './firebase';

// Helper for local storage backup
function getLocalCollection(name) {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(`fp_${name}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function setLocalCollection(name, items) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(`fp_${name}`, JSON.stringify(items));
    window.dispatchEvent(new Event('fp_data_changed'));
  } catch (e) {
    console.error(e);
  }
}

// ============ Generic CRUD ============

export async function createDocument(collectionName, data) {
  try {
    const docRef = await addDoc(collection(getDb(), collectionName), {
      ...data,
      createdAt: serverTimestamp(),
    });
    
    // Backup to local for fast UI sync
    const item = { id: docRef.id, ...data, createdAt: new Date().toISOString() };
    const items = getLocalCollection(collectionName);
    items.push(item);
    setLocalCollection(collectionName, items);
    
    return docRef.id;
  } catch (err) {
    console.error(`Erro ao salvar no Firestore (${collectionName}):`, err);
    
    // Fallback if cloud fails
    const item = {
      id: 'loc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      ...data,
      createdAt: new Date().toISOString(),
    };
    const items = getLocalCollection(collectionName);
    items.push(item);
    setLocalCollection(collectionName, items);
    return item.id;
  }
}

export async function updateDocument(collectionName, docId, data) {
  try {
    const docRef = doc(getDb(), collectionName, docId);
    await updateDoc(docRef, {
      ...data,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    console.error(`Erro ao atualizar no Firestore (${collectionName}):`, err);
  }

  const items = getLocalCollection(collectionName);
  const idx = items.findIndex((i) => i.id === docId);
  if (idx !== -1) {
    items[idx] = { ...items[idx], ...data, updatedAt: new Date().toISOString() };
    setLocalCollection(collectionName, items);
  }
}

export async function deleteDocument(collectionName, docId) {
  try {
    const docRef = doc(getDb(), collectionName, docId);
    await deleteDoc(docRef);
  } catch (err) {
    console.error(`Erro ao excluir no Firestore (${collectionName}):`, err);
  }

  const items = getLocalCollection(collectionName);
  const filtered = items.filter((i) => i.id !== docId);
  setLocalCollection(collectionName, filtered);
}

export async function getDocument(collectionName, docId) {
  try {
    const docRef = doc(getDb(), collectionName, docId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() };
    }
  } catch (err) {
    console.error(`Erro ao buscar no Firestore (${collectionName}):`, err);
  }

  const items = getLocalCollection(collectionName);
  return items.find((i) => i.id === docId) || null;
}

export async function getDocuments(collectionName, constraints = [], sortField = null, sortDir = 'asc') {
  try {
    let q = collection(getDb(), collectionName);
    const queryConstraints = [...constraints];
    
    if (sortField) {
      queryConstraints.push(orderBy(sortField, sortDir));
    }
    
    if (queryConstraints.length > 0) {
      q = query(q, ...queryConstraints);
    }
    
    const snapshot = await getDocs(q);
    const remoteDocs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    setLocalCollection(collectionName, remoteDocs);
    return remoteDocs;
  } catch (err) {
    console.warn(`Firestore inacessível para ${collectionName}, usando armazenamento local.`, err?.message || err);
    let items = getLocalCollection(collectionName);
    if (sortField) {
      items.sort((a, b) => {
        const valA = String(a[sortField] || '').toLowerCase();
        const valB = String(b[sortField] || '').toLowerCase();
        if (valA < valB) return sortDir === 'asc' ? -1 : 1;
        if (valA > valB) return sortDir === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return items;
  }
}

export async function getDocumentsPaginated(collectionName, constraints = [], sortField = 'createdAt', sortDir = 'desc', pageSize = 20, lastDoc = null) {
  const docs = await getDocuments(collectionName, constraints, sortField, sortDir);
  return {
    docs: docs.slice(0, pageSize),
    lastDoc: null,
    hasMore: docs.length > pageSize,
  };
}

// ============ Real-time Listeners ============

export function subscribeToCollection(collectionName, callback) {
  try {
    const q = collection(getDb(), collectionName);
    return onSnapshot(
      q,
      (snapshot) => {
        const docs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        setLocalCollection(collectionName, docs);
        callback(docs);
      },
      () => {
        callback(getLocalCollection(collectionName));
      }
    );
  } catch {
    callback(getLocalCollection(collectionName));
    return () => {};
  }
}

// ============ Helpers ============

export function timestampToDate(timestamp) {
  if (!timestamp) return null;
  if (timestamp instanceof Timestamp) {
    return timestamp.toDate();
  }
  if (timestamp.seconds) {
    return new Timestamp(timestamp.seconds, timestamp.nanoseconds).toDate();
  }
  return new Date(timestamp);
}

export function dateToTimestamp(date) {
  return Timestamp.fromDate(new Date(date));
}

export { where, orderBy, Timestamp, serverTimestamp };
