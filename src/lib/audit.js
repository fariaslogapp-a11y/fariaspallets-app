import { db } from './firebase';
import { collection, addDoc, getDocs, query, where, orderBy, serverTimestamp } from 'firebase/firestore';

export async function logAuditAction(action, userId, userName, details = {}) {
  try {
    await addDoc(collection(db, 'audit_logs'), {
      action, // 'create', 'update', 'delete'
      userId,
      userName,
      details, // { collection, documentId, before, after }
      timestamp: serverTimestamp(),
    });
  } catch (error) {
    console.error('Erro ao registrar log de auditoria:', error);
  }
}

export async function getAuditLogs(filters = {}) {
  let constraints = [];

  if (filters.userId) {
    constraints.push(where('userId', '==', filters.userId));
  }
  if (filters.action) {
    constraints.push(where('action', '==', filters.action));
  }

  constraints.push(orderBy('timestamp', 'desc'));

  const q = query(collection(db, 'audit_logs'), ...constraints);
  const snapshot = await getDocs(q);

  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
}
