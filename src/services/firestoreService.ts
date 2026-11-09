import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  or,
  and,
  orderBy, 
  onSnapshot,
  serverTimestamp,
  Timestamp,
  getDocFromServer,
  arrayUnion,
  arrayRemove,
  writeBatch
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { parseLocalYYYYMMDD, getLocalMonth, formatLocalYYYYMMDD } from '../lib/dateUtils';
import { formatCurrency } from '../lib/utils';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string;
    email?: string | null;
    emailVerified?: boolean;
    isAnonymous?: boolean;
    tenantId?: string | null;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// --- Notifications ---

export const getNotifications = (callback: (notifications: any[]) => void) => {
  if (!auth.currentUser) return () => {};
  
  const q = query(
    collection(db, 'notifications'),
    where('userId', '==', auth.currentUser.uid),
    orderBy('createdAt', 'desc')
  );
  
  return onSnapshot(q, (snapshot) => {
    const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(data);
  }, (error) => {
    console.error('Error fetching notifications:', error);
  });
};

export const addNotification = async (notif: { userId: string, type: string, content: string, data?: any }) => {
  try {
    await addDoc(collection(db, 'notifications'), {
      ...notif,
      isRead: false,
      createdAt: serverTimestamp()
    });
  } catch (error) {
    console.error('Error adding notification:', error);
  }
};

export const markNotificationRead = async (id: string) => {
  try {
    const ref = doc(db, 'notifications', id);
    await updateDoc(ref, { isRead: true });
  } catch (error) {
    console.error('Error marking notification read:', error);
  }
};

export const markAllNotificationsRead = async (userId: string) => {
  try {
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', userId),
      where('isRead', '==', false)
    );
    const snap = await getDocs(q);
    if (snap.empty) return;
    const batch = writeBatch(db);
    snap.docs.forEach(docSnap => {
      batch.update(docSnap.ref, { isRead: true });
    });
    await batch.commit();
  } catch (error) {
    console.error('Error marking all notifications read:', error);
  }
};

export const deleteNotification = async (id: string) => {
  try {
    const ref = doc(db, 'notifications', id);
    await deleteDoc(ref);
  } catch (error) {
    console.error('Error deleting notification:', error);
  }
};

export const clearAllNotifications = async (userId: string) => {
  try {
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', userId)
    );
    const snap = await getDocs(q);
    if (snap.empty) return;
    const batch = writeBatch(db);
    snap.docs.forEach(docSnap => {
      batch.delete(docSnap.ref);
    });
    await batch.commit();
  } catch (error) {
    console.error('Error clearing all notifications:', error);
  }
};

export const cleanOldNotifications = async (userId: string, days: number = 7) => {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', userId)
    );
    const snap = await getDocs(q);
    const oldDocs = snap.docs.filter(docSnap => {
      const data = docSnap.data();
      if (!data.createdAt) return false;
      const created = typeof data.createdAt?.toDate === 'function' 
        ? data.createdAt.toDate() 
        : new Date(data.createdAt);
      return created < cutoffDate;
    });

    if (oldDocs.length > 0) {
      const batch = writeBatch(db);
      oldDocs.forEach(d => batch.delete(d.ref));
      await batch.commit();
      console.log(`[Notifications] Limpieza automática: eliminadas ${oldDocs.length} notificaciones >${days} días.`);
    }
  } catch (error) {
    console.error('Error cleaning old notifications:', error);
  }
};

/**
 * Alertas automáticas de vencimiento de tarjetas:
 * Notificación automática 3 días antes del vencimiento del resumen de la tarjeta para evitar intereses punitorios.
 */
export const checkCardDueAlerts = async (userId: string, cards: CreditCard[]) => {
  if (!userId || !cards || cards.length === 0) return;

  try {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const todayDate = now.getDate();

    // Query recent card_due notifications to prevent duplicate alerts in the same cycle
    const qNotifs = query(
      collection(db, 'notifications'),
      where('userId', '==', userId),
      where('type', '==', 'card_due')
    );
    const existingSnap = await getDocs(qNotifs);
    const existingCycles = new Set(
      existingSnap.docs.map(doc => {
        const d = doc.data();
        return `${d.data?.cardId}_${d.data?.dueCycle}`;
      })
    );

    for (const card of cards) {
      if (!card.dueDay || card.dueDay < 1 || card.dueDay > 31) continue;

      let dueYear = currentYear;
      let dueMonth = currentMonth;
      if (todayDate > card.dueDay) {
        dueMonth += 1;
        if (dueMonth > 11) {
          dueMonth = 0;
          dueYear += 1;
        }
      }

      const lastDayOfDueMonth = new Date(dueYear, dueMonth + 1, 0).getDate();
      const actualDueDay = Math.min(card.dueDay, lastDayOfDueMonth);
      const dueDate = new Date(dueYear, dueMonth, actualDueDay, 23, 59, 59);

      const msDiff = dueDate.getTime() - now.getTime();
      const daysRemaining = Math.max(0, Math.ceil(msDiff / (1000 * 60 * 60 * 24)));

      if (daysRemaining <= 3) {
        const dueCycle = `${dueYear}-${String(dueMonth + 1).padStart(2, '0')}-${String(actualDueDay).padStart(2, '0')}`;
        const cycleKey = `${card.id}_${dueCycle}`;

        if (!existingCycles.has(cycleKey)) {
          const daysText = daysRemaining === 0 
            ? 'vence hoy' 
            : daysRemaining === 1 
              ? 'vence mañana' 
              : `vence en ${daysRemaining} días`;

          await addNotification({
            userId,
            type: 'card_due',
            content: `El resumen de tu tarjeta ${card.name} ${daysText} (${actualDueDay}/${dueMonth + 1}). Recuerda abonar para evitar intereses punitorios.`,
            data: {
              cardId: card.id,
              cardName: card.name,
              dueDay: actualDueDay,
              dueDate: dueCycle,
              dueCycle,
              daysRemaining,
              last4Digits: card.last4Digits || '',
              bank: card.bank || ''
            }
          });
          existingCycles.add(cycleKey);
        }
      }
    }
  } catch (error) {
    console.error('Error checking card due alerts:', error);
  }
};

/**
 * Hitos de ahorro / Reportes:
 * Notifica automáticamente cuando el reporte del mes anterior está disponible para consultar.
 */
export const checkMonthlyReportAlert = async (userId: string) => {
  if (!userId) return;

  try {
    const now = new Date();
    let prevYear = now.getFullYear();
    let prevMonth = now.getMonth(); // 0 is January
    if (prevMonth === 0) {
      prevMonth = 12;
      prevYear -= 1;
    }
    const prevMonthStr = `${prevYear}-${String(prevMonth).padStart(2, '0')}`;

    const monthNames = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    const prevMonthName = monthNames[prevMonth - 1];

    const qNotifs = query(
      collection(db, 'notifications'),
      where('userId', '==', userId),
      where('type', '==', 'monthly_report')
    );
    const existingSnap = await getDocs(qNotifs);
    const alreadyNotified = existingSnap.docs.some(doc => doc.data().data?.month === prevMonthStr);

    if (!alreadyNotified) {
      await addNotification({
        userId,
        type: 'monthly_report',
        content: `Tu reporte mensual de ${prevMonthName} ya está disponible para consultar. Revisa el balance de tus finanzas.`,
        data: {
          month: prevMonthStr,
          monthName: prevMonthName,
          year: prevYear
        }
      });
    }
  } catch (error) {
    console.error('Error checking monthly report alert:', error);
  }
};

// --- User Profile ---

export const syncUserProfile = async (user: any, displayName?: string) => {
  const userRef = doc(db, 'users', user.uid);
  try {
    const userDoc = await getDoc(userRef);
    const email = user.email?.toLowerCase();
    
    if (!userDoc.exists()) {
      await setDoc(userRef, {
        name: displayName || user.displayName || 'Usuario',
        email: email,
        photoURL: user.photoURL || '',
        currency: 'ARS', // Default currency
        role: 'user',
        personalShowInHome: true,
        personalHomeOrder: 1,
        createdAt: serverTimestamp(),
      });
      // No longer seeding personal copies! System categories are shared via 'scope: system'
    } else {
      // Update existing user if needed (e.g., name changed or email missing)
      const data = userDoc.data();
      const updates: any = {};
      
      if (email && data.email !== email) {
        updates.email = email;
      }
      if (!data.currency) {
        updates.currency = 'ARS';
      }
      if (data.personalShowInHome === undefined) {
        updates.personalShowInHome = true;
        updates.personalHomeOrder = 1;
      }
      if (displayName && data.name !== displayName) {
        updates.name = displayName;
      }

      if (Object.keys(updates).length > 0) {
        await updateDoc(userRef, updates);
      }
    }
    
    // Claim any pending invitations for this user (new or existing)
    if (email) {
      await claimPendingInvitations(email, user.uid);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`);
  }
};

export const updateUserProfile = async (uid: string, updates: any) => {
  try {
    const userRef = doc(db, 'users', uid);
    await updateDoc(userRef, {
      ...updates,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
  }
};

export const ensureSystemCategories = async () => {
  const defaultCategories = [
    { name: 'Comida', icon: 'Utensils', color: 'bg-rose-500', type: 'expense', scope: 'system' },
    { name: 'Transporte', icon: 'Car', color: 'bg-blue-500', type: 'expense', scope: 'system' },
    { name: 'Vivienda', icon: 'Home', color: 'bg-amber-500', type: 'expense', scope: 'system' },
    { name: 'Ocio', icon: 'Play', color: 'bg-purple-500', type: 'expense', scope: 'system' },
    { name: 'Salud', icon: 'Heart', color: 'bg-emerald-500', type: 'expense', scope: 'system' },
    { name: 'Educación', icon: 'Book', color: 'bg-indigo-500', type: 'expense', scope: 'system' },
    { name: 'Otros', icon: 'MoreHorizontal', color: 'bg-slate-500', type: 'expense', scope: 'system' },
    { name: 'Salario', icon: 'Landmark', color: 'bg-emerald-600', type: 'income', scope: 'system' },
    { name: 'Inversiones', icon: 'Zap', color: 'bg-amber-600', type: 'income', scope: 'system' },
    { name: 'Regalo', icon: 'Gift', color: 'bg-rose-600', type: 'income', scope: 'system' },
  ];

  // We check for these specifically to ensure they exist once globally without overwriting user-edited names
  const qGlobal = query(collection(db, 'categories'), where('scope', '==', 'system'));
  const globalSnap = await getDocs(qGlobal);
  const existingDocIds = new Set(globalSnap.docs.map(doc => doc.id));
  const existingNames = new Set(globalSnap.docs.map(doc => doc.data().name));

  for (const cat of defaultCategories) {
    const catId = `system_${cat.name.toLowerCase().replace(/\s+/g, '_')}`;
    // Only insert if neither the predictable ID nor the category name exists
    if (!existingDocIds.has(catId) && !existingNames.has(cat.name)) {
      await setDoc(doc(db, 'categories', catId), {
        ...cat,
        ownerId: null,
        createdAt: serverTimestamp()
      });
    }
  }
};

/**
 * Clean up duplicate categories for the current user.
 * Deletes personal categories that match System categories by name.
 */
export const cleanupDuplicateCategories = async () => {
  if (!auth.currentUser) return;
  const uid = auth.currentUser.uid;
  
  const qPersonal = query(collection(db, 'categories'), where('ownerId', '==', uid));
  const qSystem = query(collection(db, 'categories'), where('scope', '==', 'system'));
  
  const [personalSnap, systemSnap] = await Promise.all([getDocs(qPersonal), getDocs(qSystem)]);
  
  const systemKeys = new Set(systemSnap.docs.map(doc => `${doc.data().name}_${doc.data().type}`));
  const seenPersonal = new Set<string>(); // name_type keys
  const toDelete: string[] = [];
  
  personalSnap.docs.forEach(doc => {
    const data = doc.data();
    const key = `${data.name}_${data.type}`;
    
    // If it matches a system category (name AND type), DELETE the personal one
    if (systemKeys.has(key)) {
      toDelete.push(doc.id);
      return;
    }
    
    // Internal deduplication (name AND type)
    if (seenPersonal.has(key)) {
      toDelete.push(doc.id);
    } else {
      seenPersonal.add(key);
    }
  });
  
  if (toDelete.length > 0) {
    for (const id of toDelete) {
      await deleteDoc(doc(db, 'categories', id));
    }
  }
};

/**
 * Reassigns all transactions from one category to another.
 */
export const reassignTransactions = async (fromCategoryId: string, toCategoryId: string) => {
  if (!auth.currentUser) return;
  const uid = auth.currentUser.uid;
  
  const q = query(
    collection(db, 'transactions'),
    where('categoryId', '==', fromCategoryId),
    where('authorId', '==', uid)
  );
  
  const snapshot = await getDocs(q);
  const batch = writeBatch(db);
  
  snapshot.docs.forEach((doc) => {
    batch.update(doc.ref, { categoryId: toCategoryId });
  });

  await batch.commit();
};

// --- Categories ---

export const getCategories = (callback: (categories: any[]) => void, includeUserIds: string[] = []) => {
  if (!auth.currentUser) return () => {};
  
  // Background maintenance
  ensureSystemCategories().then(() => cleanupDuplicateCategories());

  const uids = [auth.currentUser.uid, ...includeUserIds.filter(id => id !== auth.currentUser?.uid)];
  
  // Split into two queries to avoid complex index requirements for 'or' on different fields
  const qSystem = query(
    collection(db, 'categories'), 
    where('scope', '==', 'system')
  );

  const qPersonal = query(
    collection(db, 'categories'),
    where('ownerId', 'in', uids.slice(0, 10))
  );

  let systemCats: any[] = [];
  let personalCats: any[] = [];

  const updateAll = () => {
    // Merge, deduplicate by name AND type (prefer system version), and sort
    const all = [...systemCats];
    const systemKeys = new Set(all.map(c => `${c.name}_${c.type}`));
    
    personalCats.forEach(cat => {
      const key = `${cat.name}_${cat.type}`;
      if (!systemKeys.has(key)) {
        all.push(cat);
      }
    });

    all.sort((a, b) => a.name.localeCompare(b.name));
    callback(all);
  };

  const unsubSystem = onSnapshot(qSystem, (snapshot) => {
    systemCats = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    updateAll();
  });

  const unsubPersonal = onSnapshot(qPersonal, (snapshot) => {
    personalCats = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    updateAll();
  });

  return () => {
    unsubSystem();
    unsubPersonal();
  };
};

export const addCategory = async (category: any) => {
  try {
    await addDoc(collection(db, 'categories'), {
      ...category,
      scope: 'personal',
      ownerId: auth.currentUser?.uid,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'categories');
  }
};

export const updateCategory = async (id: string, category: any) => {
  try {
    const categoryRef = doc(db, 'categories', id);
    await updateDoc(categoryRef, {
      ...category,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `categories/${id}`);
  }
};

export const deleteCategory = async (categoryId: string) => {
  try {
    await deleteDoc(doc(db, 'categories', categoryId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `categories/${categoryId}`);
  }
};

// --- Projects ---

export const getProjects = (callback: (projects: any[]) => void) => {
  if (!auth.currentUser) return () => {};
  
  const uid = auth.currentUser.uid;
  const email = auth.currentUser.email;

  if (email) {
    claimPendingInvitations(email, uid).catch(err =>
      console.error('Error claiming pending invitations in getProjects:', err)
    );
  }

  const q = query(
    collection(db, 'projects'), 
    where('memberIds', 'array-contains', uid)
  );
  
  return onSnapshot(q, (snapshot) => {
    const projects = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];
    projects.sort((a, b) => {
      const timeA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
      const timeB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
      return timeB - timeA;
    });
    callback(projects);
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, 'projects');
  });
};

export const createProject = async (project: any) => {
  try {
    const docRef = await addDoc(collection(db, 'projects'), {
      ...project,
      ownerId: auth.currentUser?.uid,
      memberIds: [auth.currentUser?.uid],
      showInHome: project.showInHome !== undefined ? project.showInHome : true,
      showInExpenseSelector: project.showInExpenseSelector !== undefined ? project.showInExpenseSelector : true,
      status: project.status || 'active',
      homeOrder: project.homeOrder !== undefined ? project.homeOrder : 0,
      createdAt: serverTimestamp(),
    });
    return docRef;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'projects');
  }
};

export const updateProject = async (projectId: string, project: any) => {
  try {
    const projectRef = doc(db, 'projects', projectId);
    await updateDoc(projectRef, {
      ...project,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `projects/${projectId}`);
  }
};

export const deleteProject = async (projectId: string) => {
  try {
    // 1. Delete associated transactions
    const q = query(collection(db, 'transactions'), where('projectId', '==', projectId));
    const snapshot = await getDocs(q);
    const batch = writeBatch(db);
    snapshot.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();

    // 2. Delete project document
    await deleteDoc(doc(db, 'projects', projectId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `projects/${projectId}`);
  }
};

export const findUserByEmail = async (email: string) => {
  try {
    const normalizedEmail = email.toLowerCase().trim();
    const q = query(collection(db, 'users'), where('email', '==', normalizedEmail));
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
    }
    return null;
  } catch (error) {
    console.error('Error in findUserByEmail:', error);
    handleFirestoreError(error, OperationType.LIST, 'users');
  }
};

export const addMemberToProject = async (projectId: string, userId: string) => {
  try {
    const projectRef = doc(db, 'projects', projectId);
    await updateDoc(projectRef, {
      memberIds: arrayUnion(userId),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `projects/${projectId}`);
  }
};

export const inviteUserToProjectByEmail = async (projectId: string, email: string) => {
  try {
    const normalizedEmail = email.toLowerCase().trim();
    const user = await findUserByEmail(normalizedEmail);
    const projectRef = doc(db, 'projects', projectId);
    
    if (user) {
      // User exists, add to memberIds
      await updateDoc(projectRef, {
        memberIds: arrayUnion(user.id),
        updatedAt: serverTimestamp(),
      });
      
      const projectDoc = await getDoc(projectRef);
      const projectName = projectDoc.data()?.name || 'Un proyecto';
      
      await addNotification({
        userId: user.id,
        type: 'project_shared',
        content: `Te han compartido el proyecto: ${projectName}`,
        data: { projectId, projectName, ownerName: auth.currentUser?.displayName }
      });

      return { success: true, type: 'member' };
    } else {
      // User doesn't exist, add to pendingEmails
      await updateDoc(projectRef, {
        pendingEmails: arrayUnion(normalizedEmail),
        updatedAt: serverTimestamp(),
      });
      return { success: true, type: 'pending' };
    }
  } catch (error) {
    console.error('Error in inviteUserToProjectByEmail:', error);
    handleFirestoreError(error, OperationType.UPDATE, `projects/${projectId}`);
    // handleFirestoreError throws, so this is just for type safety
    throw error;
  }
};

export const claimPendingInvitations = async (email: string, userId: string) => {
  try {
    const q = query(
      collection(db, 'projects'),
      where('pendingEmails', 'array-contains', email.toLowerCase())
    );
    
    const snapshot = await getDocs(q);
    if (snapshot.empty) return;

    const batch = writeBatch(db);
    for (const projectDoc of snapshot.docs) {
      const projectName = projectDoc.data().name || 'Un proyecto';
      
      batch.update(projectDoc.ref, {
        memberIds: arrayUnion(userId),
        pendingEmails: arrayRemove(email.toLowerCase()),
        updatedAt: serverTimestamp(),
      });

      // Add notification for the user who just claimed the invitation
      await addNotification({
        userId: userId,
        type: 'project_shared',
        content: `Te has unido al proyecto: ${projectName}`,
        data: { projectId: projectDoc.id }
      });
    }
    
    await batch.commit();
  } catch (error) {
    console.error('Error claiming pending invitations:', error);
  }
};

export const removeMemberFromProject = async (projectId: string, userId: string) => {
  try {
    const projectRef = doc(db, 'projects', projectId);
    await updateDoc(projectRef, {
      memberIds: arrayRemove(userId),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `projects/${projectId}`);
  }
};

export const getUsersByIds = async (userIds: string[]) => {
  try {
    if (userIds.length === 0) return [];
    const q = query(collection(db, 'users'), where('__name__', 'in', userIds));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'users');
  }
};

export const getCategoriesByIds = async (categoryIds: string[]) => {
  try {
    if (categoryIds.length === 0) return [];
    // Firestore 'in' query supports up to 10-30 IDs depending on version, batching if needed
    const q = query(collection(db, 'categories'), where('__name__', 'in', categoryIds));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'categories');
  }
};

// --- Transactions ---

const safeToDate = (rawDate: any): Date => {
  if (!rawDate) return new Date();
  if (rawDate instanceof Date) return rawDate;
  if (typeof rawDate.toDate === 'function') return rawDate.toDate();
  if (typeof rawDate === 'string') return parseLocalYYYYMMDD(rawDate);
  if (typeof rawDate === 'number') return new Date(rawDate);
  return new Date();
};

export const getTransactions = (projectId: string | null, callback: (transactions: any[]) => void) => {
  if (!auth.currentUser) return () => {};

  let q;
  if (projectId) {
    q = query(
      collection(db, 'transactions'),
      where('projectId', '==', projectId)
    );
  } else {
    q = query(
      collection(db, 'transactions'),
      where('authorId', '==', auth.currentUser.uid),
      where('projectId', '==', null)
    );
  }

  return onSnapshot(q, (snapshot) => {
    const transactions = snapshot.docs.map(doc => ({ 
      id: doc.id, 
      ...doc.data(),
      date: safeToDate(doc.data().date)
    }));
    transactions.sort((a, b) => b.date.getTime() - a.date.getTime());
    callback(transactions);
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, 'transactions');
  });
};

export const getGlobalTransactions = (projectIds: string[], callback: (transactions: any[]) => void) => {
  if (!auth.currentUser) return () => {};

  const uid = auth.currentUser.uid;
  const projectTransactions: Record<string, any[]> = {};
  let personalTransactions: any[] = [];

  const updateAll = () => {
    let all = [...personalTransactions];
    Object.values(projectTransactions).forEach(list => {
      all = [...all, ...list];
    });
    // Remove duplicates by ID (just in case) and sort
    const unique = Array.from(new Map(all.map(t => [t.id, t])).values());
    unique.sort((a, b) => b.date.getTime() - a.date.getTime());
    callback(unique);
  };

  // Personal transactions (authorId == uid, filter out any with explicit valid projectIds)
  const qPersonal = query(
    collection(db, 'transactions'),
    where('authorId', '==', uid)
  );

  const unsubscribePersonal = onSnapshot(qPersonal, (snapshot) => {
    personalTransactions = snapshot.docs
      .filter(doc => {
        const pId = doc.data().projectId;
        return !pId || pId === 'personal' || pId === 'null';
      })
      .map(doc => ({ 
        id: doc.id, 
        ...doc.data(),
        date: safeToDate(doc.data().date)
      }));
    updateAll();
  }, (error) => {
    console.error("Personal transactions fetch error:", error);
    updateAll();
  });

  // Projects transactions
  const unsubscribesProjects: (() => void)[] = [];
  
  if (projectIds.length > 0) {
    // We fetch each project separately to be safe with indexes and real-time updates
    projectIds.slice(0, 50).forEach(projectId => {
      const qProject = query(
        collection(db, 'transactions'),
        where('projectId', '==', projectId)
      );
      
      const unsub = onSnapshot(qProject, (snapshot) => {
        projectTransactions[projectId] = snapshot.docs.map(doc => ({ 
          id: doc.id, 
          ...doc.data(),
          date: safeToDate(doc.data().date)
        }));
        updateAll();
      }, (error) => {
        console.error(`Project ${projectId} transactions fetch error:`, error);
        updateAll();
      });
      unsubscribesProjects.push(unsub);
    });
  }

  return () => {
    unsubscribePersonal();
    unsubscribesProjects.forEach(unsub => unsub());
  };
};

export const getTransaction = async (transactionId: string): Promise<any> => {
  try {
    let actualId = transactionId;
    let installmentNumber: number | null = null;

    if (transactionId.includes('_installment_')) {
      const parts = transactionId.split('_installment_');
      actualId = parts[0];
      installmentNumber = parseInt(parts[1], 10);
    }

    const transactionDoc = await getDoc(doc(db, 'transactions', actualId));
    if (transactionDoc.exists()) {
      const data = transactionDoc.data();
      const baseDate = safeToDate(data.date);

      if (installmentNumber !== null && data.isInstallmentPlan) {
        const override = data.overrides?.[installmentNumber];
        const installmentAmount = override?.amount !== undefined 
          ? override.amount 
          : (data.installmentAmount || Math.round((data.amount / (data.totalInstallments || 1)) * 100) / 100);

        const baseDueDateStr = data.firstDueDate || formatLocalYYYYMMDD(baseDate);
        const baseDueDate = parseLocalYYYYMMDD(baseDueDateStr);
        const startYear = baseDueDate.getFullYear();
        const startMonth = baseDueDate.getMonth();
        const targetDay = baseDueDate.getDate();

        const totalMonthIndex = startMonth + (installmentNumber - 1);
        const targetYear = startYear + Math.floor(totalMonthIndex / 12);
        const targetMonth = totalMonthIndex % 12;
        const daysInTargetMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
        const finalDay = Math.min(targetDay, daysInTargetMonth);
        const installmentDate = new Date(targetYear, targetMonth, finalDay, baseDate.getHours(), baseDate.getMinutes(), baseDate.getSeconds());

        return {
          id: transactionId,
          parentPlanId: actualId,
          ...data,
          amount: installmentAmount,
          description: data.description,
          date: installmentDate,
          isInstallment: true,
          installmentNumber,
          totalInstallments: data.totalInstallments,
          isVirtualInstallment: true
        };
      }

      return {
        id: transactionDoc.id,
        ...data,
        date: baseDate
      };
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `transactions/${transactionId}`);
  }
};

export const notifyCollaboratorsOnExpenseAdded = async (transaction: any) => {
  if (!transaction.projectId || !auth.currentUser) return;

  try {
    const projectRef = doc(db, 'projects', transaction.projectId);
    const projectSnap = await getDoc(projectRef);
    if (!projectSnap.exists()) return;

    const projectData = projectSnap.data();
    const currentUserId = auth.currentUser.uid;
    const authorName = auth.currentUser.displayName || auth.currentUser.email?.split('@')[0] || 'Un colaborador';

    const memberIds: string[] = projectData.memberIds || [];
    const targetMemberIds = memberIds.filter(id => id !== currentUserId);

    if (targetMemberIds.length === 0) return;

    const projectName = projectData.name || 'Proyecto compartido';
    const currency = projectData.currency || 'ARS';
    const catName = transaction.categoryName || transaction.description || 'General';
    const formattedAmount = formatCurrency(transaction.amount, currency);
    let content = `${authorName} registró un ${transaction.type === 'income' ? 'ingreso' : 'gasto'} de ${formattedAmount} en "${projectName}" (${catName})`;
    if (transaction.isInstallmentPlan && transaction.totalInstallments > 1) {
      const formattedInstallment = formatCurrency(transaction.installmentAmount, currency);
      content = `${authorName} financió una compra de ${formattedAmount} en ${transaction.totalInstallments} cuotas de ${formattedInstallment} en "${projectName}" (${catName})`;
    }

    for (const memberId of targetMemberIds) {
      await addNotification({
        userId: memberId,
        type: 'expense_added',
        content,
        data: {
          transactionId: transaction.id,
          projectId: transaction.projectId,
          projectName,
          amount: transaction.amount,
          categoryName: catName,
          isInstallmentPlan: !!transaction.isInstallmentPlan,
          totalInstallments: transaction.totalInstallments || 1
        }
      });
    }
  } catch (err) {
    console.error('Error notifying collaborators on expense added:', err);
  }
};

/**
 * Enfoque 3: Sincronización inteligente de notificaciones al editar un gasto.
 * - Si el colaborador no leyó la notificación: se actualiza en silencio con el nuevo monto/descripción.
 * - Si el colaborador YA la leyó: se actualiza, se le añade la marca 'isModified: true' y se resetea a 'isRead: false'
 *   para advertirle del cambio.
 */
export const syncNotificationsOnExpenseUpdated = async (
  transactionId: string,
  updatedTransaction: any,
  oldTransaction: any
) => {
  if (!auth.currentUser) return;

  try {
    const finalProjectId = updatedTransaction.projectId || null;
    const oldProjectId = oldTransaction?.projectId || null;

    // Buscar notificaciones vinculadas a esta transacción
    const qNotifs = query(
      collection(db, 'notifications'),
      where('data.transactionId', '==', transactionId)
    );
    const notifsSnap = await getDocs(qNotifs);

    // Caso A: No estaba en un proyecto compartido y ahora sí
    if (!oldProjectId && finalProjectId) {
      await notifyCollaboratorsOnExpenseAdded({
        id: transactionId,
        ...updatedTransaction,
        projectId: finalProjectId
      });
      return;
    }

    // Caso B: Estaba en un proyecto y se quitó o cambió de proyecto
    if (oldProjectId && (!finalProjectId || finalProjectId !== oldProjectId)) {
      for (const docSnap of notifsSnap.docs) {
        await deleteDoc(docSnap.ref);
      }
      if (finalProjectId) {
        await notifyCollaboratorsOnExpenseAdded({
          id: transactionId,
          ...updatedTransaction,
          projectId: finalProjectId
        });
      }
      return;
    }

    // Caso C: No tiene proyecto (personal)
    if (!finalProjectId) return;

    // Si aún no existía la notificación por compatibilidad histórica
    if (notifsSnap.empty) {
      await notifyCollaboratorsOnExpenseAdded({
        id: transactionId,
        ...updatedTransaction,
        projectId: finalProjectId
      });
      return;
    }

    // Obtener datos del proyecto
    const projectRef = doc(db, 'projects', finalProjectId);
    const projectSnap = await getDoc(projectRef);
    if (!projectSnap.exists()) return;

    const projectData = projectSnap.data();
    const projectName = projectData.name || 'Proyecto compartido';
    const currency = projectData.currency || 'ARS';
    const authorName = auth.currentUser.displayName || auth.currentUser.email?.split('@')[0] || 'Un colaborador';
    const catName = updatedTransaction.categoryName || updatedTransaction.description || 'General';
    const formattedAmount = formatCurrency(updatedTransaction.amount, currency);

    let updatedContent = `${authorName} actualizó el ${updatedTransaction.type === 'income' ? 'ingreso' : 'gasto'} a ${formattedAmount} en "${projectName}" (${catName})`;
    if (updatedTransaction.isInstallmentPlan && updatedTransaction.totalInstallments > 1) {
      const formattedInstallment = formatCurrency(updatedTransaction.installmentAmount, currency);
      updatedContent = `${authorName} actualizó la compra financiada a ${formattedAmount} (${updatedTransaction.totalInstallments} cuotas de ${formattedInstallment}) en "${projectName}" (${catName})`;
    }

    for (const docSnap of notifsSnap.docs) {
      const notifData = docSnap.data();
      const wasRead = !!notifData.isRead;

      if (wasRead) {
        // Enfoque 3: Ya leída -> marcar como modificada y pasar a no leída para notificar el cambio
        await updateDoc(docSnap.ref, {
          content: updatedContent,
          isRead: false,
          'data.amount': updatedTransaction.amount,
          'data.categoryName': catName,
          'data.isModified': true,
          updatedAt: serverTimestamp()
        });
      } else {
        // Enfoque 3: No leída -> actualización silenciosa en el lugar
        await updateDoc(docSnap.ref, {
          content: updatedContent,
          'data.amount': updatedTransaction.amount,
          'data.categoryName': catName,
          'data.isModified': false,
          updatedAt: serverTimestamp()
        });
      }
    }
  } catch (err) {
    console.error('Error syncing notifications on expense updated:', err);
  }
};

/**
 * Elimina las notificaciones vinculadas a una transacción borrada.
 */
export const syncNotificationsOnExpenseDeleted = async (transactionId: string) => {
  try {
    const qNotifs = query(
      collection(db, 'notifications'),
      where('data.transactionId', '==', transactionId)
    );
    const notifsSnap = await getDocs(qNotifs);
    for (const docSnap of notifsSnap.docs) {
      await deleteDoc(docSnap.ref);
    }
  } catch (err) {
    console.error('Error syncing notifications on expense deleted:', err);
  }
};

/**
 * Recálculo Reactivo de Presupuestos y Manejo Inteligente de Alertas:
 * - Si el gasto total acumulado cae por debajo del 80% (por corrección o borrado):
 *   se elimina la notificación de alerta (falsa alarma resuelta) para que el estado quede limpio.
 * - Si el gasto se ubica entre 80% y 99%: se actualiza la alerta a 80% con el nuevo porcentaje.
 * - Si el gasto supera el 100%: se promociona/actualiza a 100%.
 */
export const recalculateBudgetAlertsForCategory = async (
  categoryId: string,
  projectId: string | null,
  date: any,
  currentTx?: any
) => {
  if (!auth.currentUser || !categoryId) return;

  try {
    const currentUserId = auth.currentUser.uid;
    const dateObj = date instanceof Date ? date : safeToDate(date);
    const month = getLocalMonth(dateObj);

    // 1. Obtener presupuesto para esta categoría y mes
    let budgetAmount = 0;
    const budgetId = projectId 
      ? `budget_${projectId}_${categoryId}_${month}` 
      : `budget_personal_${currentUserId}_${categoryId}_${month}`;

    const budgetSnap = await getDoc(doc(db, 'budgets', budgetId));
    if (budgetSnap.exists()) {
      budgetAmount = budgetSnap.data()?.amount || 0;
    }

    // Fallback: Si no se encontró por ID determinista, buscar en colección budgets
    if (budgetAmount <= 0) {
      const qBudgets = projectId
        ? query(collection(db, 'budgets'), where('projectId', '==', projectId))
        : query(collection(db, 'budgets'), where('userId', '==', currentUserId));
      
      const bSnap = await getDocs(qBudgets);
      const matched = bSnap.docs.find(d => {
        const b = d.data();
        if (b.categoryId !== categoryId) return false;
        const pId = b.projectId;
        const isPersonal = !pId || pId === 'personal' || pId === 'null';
        if (projectId && pId !== projectId) return false;
        if (!projectId && !isPersonal) return false;
        return !b.month || b.month === month;
      });
      if (matched) {
        budgetAmount = matched.data()?.amount || 0;
      }
    }

    // Determinar destinatarios y moneda
    let targetUserIds: string[] = [currentUserId];
    let currency = 'ARS';

    if (projectId) {
      const projectSnap = await getDoc(doc(db, 'projects', projectId));
      if (projectSnap.exists()) {
        const pData = projectSnap.data();
        targetUserIds = pData.memberIds || [currentUserId];
        currency = pData.currency || 'ARS';
      }
    } else {
      const userSnap = await getDoc(doc(db, 'users', currentUserId));
      if (userSnap.exists()) {
        currency = userSnap.data()?.currency || 'ARS';
      }
    }

    // 2. Buscar alertas existentes para este mes, categoría y contexto
    const existingAlertsByUser: { [uid: string]: any[] } = {};
    if (projectId) {
      // En proyectos compartidos consultamos por data.projectId
      const qNotif = query(
        collection(db, 'notifications'),
        where('data.projectId', '==', projectId)
      );
      const notifSnap = await getDocs(qNotif);
      const projectAlerts = notifSnap.docs.filter(docSnap => {
        const d = docSnap.data();
        return d.type === 'budget_alert' &&
               d.data?.month === month && 
               d.data?.categoryId === categoryId;
      });
      for (const uid of targetUserIds) {
        existingAlertsByUser[uid] = projectAlerts.filter(d => d.data().userId === uid);
      }
    } else {
      // En presupuestos personales consultamos únicamente las del usuario actual
      const qNotif = query(
        collection(db, 'notifications'),
        where('userId', '==', currentUserId)
      );
      const notifSnap = await getDocs(qNotif);
      existingAlertsByUser[currentUserId] = notifSnap.docs.filter(docSnap => {
        const d = docSnap.data();
        return d.type === 'budget_alert' &&
               d.data?.month === month && 
               d.data?.categoryId === categoryId && 
               !d.data?.projectId;
      });
    }

    // Si el presupuesto no existe o es <= 0, eliminar alertas obsoletas
    if (budgetAmount <= 0) {
      for (const uid of targetUserIds) {
        for (const notifDoc of existingAlertsByUser[uid] || []) {
          await deleteDoc(notifDoc.ref);
        }
      }
      return;
    }

    // 3. Sumar todos los gastos de esta categoría y mes (query simple por authorId o projectId)
    const q = projectId
      ? query(collection(db, 'transactions'), where('projectId', '==', projectId))
      : query(collection(db, 'transactions'), where('authorId', '==', currentUserId));

    const txSnap = await getDocs(q);
    let totalSpent = 0;
    let catName = currentTx?.categoryName || 'Categoría';
    let foundCurrentTx = false;

    txSnap.docs.forEach(docSnap => {
      const data = docSnap.data() as any;
      if (data.type !== 'expense') return;
      if (data.categoryId !== categoryId) return;

      const pId = data.projectId;
      const isPersonal = !pId || pId === 'personal' || pId === 'null';
      if (projectId && pId !== projectId) return;
      if (!projectId && !isPersonal) return;

      if (currentTx && docSnap.id === currentTx.id) {
        foundCurrentTx = true;
      }

      const txDate = safeToDate(data.date);
      if (getLocalMonth(txDate) === month) {
        totalSpent += (data.amount || 0);
        if (data.categoryName && catName === 'Categoría') {
          catName = data.categoryName;
        }
      }
    });

    // Failsafe: Si la transacción actual fue recién agregada y getDocs no la indexó aún
    if (currentTx && !foundCurrentTx && currentTx.type === 'expense' && currentTx.categoryId === categoryId) {
      const currentTxDate = safeToDate(currentTx.date);
      if (getLocalMonth(currentTxDate) === month) {
        totalSpent += (currentTx.amount || 0);
        if (currentTx.categoryName) {
          catName = currentTx.categoryName;
        }
      }
    }

    const percentage = budgetAmount > 0 ? (totalSpent / budgetAmount) * 100 : 0;
    const formattedSpent = formatCurrency(totalSpent, currency);
    const formattedLimit = formatCurrency(budgetAmount, currency);

    console.log(`[BudgetAlert] Category: ${categoryId} (${catName}), Month: ${month}, Spent: ${totalSpent}, Limit: ${budgetAmount}, Pct: ${percentage.toFixed(1)}%`);

    // Escenario 1: percentage < 80% (Falsa alarma o gasto reducido por debajo de alerta)
    if (percentage < 80) {
      for (const uid of targetUserIds) {
        for (const notifDoc of existingAlertsByUser[uid] || []) {
          await deleteDoc(notifDoc.ref);
        }
      }
      return;
    }

    // Escenario 2: 80% <= percentage < 100%
    if (percentage >= 80 && percentage < 100) {
      const title = `Alerta de presupuesto: Has alcanzado el ${Math.round(percentage)}% del límite en ${catName} (${formattedSpent} de ${formattedLimit})`;

      for (const uid of targetUserIds) {
        const userAlerts = existingAlertsByUser[uid] || [];
        if (userAlerts.length > 0) {
          const primaryAlert = userAlerts[0];
          await updateDoc(primaryAlert.ref, {
            content: title,
            'data.threshold': 80,
            'data.percentage': Math.round(percentage),
            'data.spent': totalSpent,
            'data.limit': budgetAmount,
            updatedAt: serverTimestamp()
          });

          // Limpiar duplicados si existieran
          for (let i = 1; i < userAlerts.length; i++) {
            await deleteDoc(userAlerts[i].ref);
          }
        } else {
          await addNotification({
            userId: uid,
            type: 'budget_alert',
            content: title,
            data: {
              budgetAlert: true,
              threshold: 80,
              month,
              categoryId,
              projectId,
              percentage: Math.round(percentage),
              spent: totalSpent,
              limit: budgetAmount
            }
          });
        }
      }
      return;
    }

    // Escenario 3: percentage >= 100% (Límite superado)
    if (percentage >= 100) {
      const title = `¡Límite superado! Has alcanzado el ${Math.round(percentage)}% del presupuesto en ${catName} (${formattedSpent} de ${formattedLimit})`;

      for (const uid of targetUserIds) {
        const userAlerts = existingAlertsByUser[uid] || [];
        if (userAlerts.length > 0) {
          const primaryAlert = userAlerts[0];
          const prevThreshold = primaryAlert.data()?.data?.threshold;
          const shouldAlertAgain = prevThreshold === 80;

          const updatePayload: any = {
            content: title,
            'data.threshold': 100,
            'data.percentage': Math.round(percentage),
            'data.spent': totalSpent,
            'data.limit': budgetAmount,
            updatedAt: serverTimestamp()
          };
          if (shouldAlertAgain) {
            updatePayload.isRead = false;
          }

          await updateDoc(primaryAlert.ref, updatePayload);

          for (let i = 1; i < userAlerts.length; i++) {
            await deleteDoc(userAlerts[i].ref);
          }
        } else {
          await addNotification({
            userId: uid,
            type: 'budget_alert',
            content: title,
            data: {
              budgetAlert: true,
              threshold: 100,
              month,
              categoryId,
              projectId,
              percentage: Math.round(percentage),
              spent: totalSpent,
              limit: budgetAmount
            }
          });
        }
      }
    }
  } catch (err) {
    console.error('Error recalculating budget alerts for category:', err);
  }
};

/**
 * Mantiene compatibilidad con llamadas existentes a checkAndNotifyBudgetAlerts.
 */
export const checkAndNotifyBudgetAlerts = async (transaction: any) => {
  if (!transaction || transaction.type !== 'expense' || !transaction.categoryId) return;
  const date = transaction.date || new Date();
  await recalculateBudgetAlertsForCategory(
    transaction.categoryId, 
    transaction.projectId || null, 
    date,
    transaction
  );
};

export const addTransaction = async (transaction: any) => {
  try {
    const now = new Date();
    const transactionDate = parseLocalYYYYMMDD(transaction.date);
    
    // Combine selected date with current system time for precise chronological sorting
    // This preserves the local "Day" while adding time metadata
    transactionDate.setHours(now.getHours());
    transactionDate.setMinutes(now.getMinutes());
    transactionDate.setSeconds(now.getSeconds());

    const rawProjectId = transaction.projectId;
    const finalProjectId = (rawProjectId && typeof rawProjectId === 'string' && rawProjectId !== 'personal' && rawProjectId !== 'null' && rawProjectId.trim() !== '') 
      ? rawProjectId.trim() 
      : null;

    const docRef = await addDoc(collection(db, 'transactions'), {
      ...transaction,
      projectId: finalProjectId,
      authorId: auth.currentUser?.uid,
      createdAt: serverTimestamp(),
      date: Timestamp.fromDate(transactionDate),
      purchaseDate: transaction.purchaseDate || formatLocalYYYYMMDD(transactionDate),
      paymentMethod: transaction.paymentMethod || 'Efectivo',
      // Denormalized category data for better collaboration visibility
      categoryName: transaction.categoryName,
      categoryIcon: transaction.categoryIcon,
      categoryColor: transaction.categoryColor
    });

    // Notify collaborators if in a shared project
    if (finalProjectId) {
      notifyCollaboratorsOnExpenseAdded({ id: docRef.id, ...transaction, projectId: finalProjectId }).catch(err =>
        console.error('Collaborator notification error:', err)
      );
    }

    // Check budget thresholds if expense
    if (transaction.type === 'expense') {
      checkAndNotifyBudgetAlerts({ id: docRef.id, ...transaction, projectId: finalProjectId, date: transactionDate }).catch(err =>
        console.error('Budget alert error:', err)
      );
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'transactions');
  }
};

export const updateTransaction = async (transactionId: string, transaction: any) => {
  try {
    const rawProjectId = transaction.projectId;
    const finalProjectId = (rawProjectId && typeof rawProjectId === 'string' && rawProjectId !== 'personal' && rawProjectId !== 'null' && rawProjectId.trim() !== '') 
      ? rawProjectId.trim() 
      : null;

    // Support updating virtual installments by routing to parent plan
    if (transactionId.includes('_installment_')) {
      const parts = transactionId.split('_installment_');
      const parentId = parts[0];
      const installmentNum = parseInt(parts[1], 10);
      const parentRef = doc(db, 'transactions', parentId);
      const parentSnap = await getDoc(parentRef);

      if (parentSnap.exists()) {
        const parentData = parentSnap.data();
        const cleanDesc = (transaction.description || '').replace(/\s*\(\d+\/\d+\)$/, '').trim();
        const updates: any = {
          description: cleanDesc || parentData.description,
          categoryId: transaction.categoryId || parentData.categoryId,
          categoryName: transaction.categoryName || parentData.categoryName,
          categoryIcon: transaction.categoryIcon || parentData.categoryIcon,
          categoryColor: transaction.categoryColor || parentData.categoryColor,
          cardId: transaction.cardId !== undefined ? transaction.cardId : parentData.cardId,
          cardName: transaction.cardName !== undefined ? transaction.cardName : parentData.cardName,
          projectId: finalProjectId,
          classification: transaction.classification || parentData.classification,
          updatedAt: serverTimestamp()
        };

        if (transaction.amount !== undefined && transaction.amount !== parentData.installmentAmount) {
          updates[`overrides.${installmentNum}.amount`] = transaction.amount;
        }

        await updateDoc(parentRef, updates);

        const finalCatId = transaction.categoryId || parentData.categoryId;
        if (finalCatId) {
          recalculateBudgetAlertsForCategory(finalCatId, finalProjectId, transaction.date || parentData.date).catch(err =>
            console.error('Budget recalculation error on virtual installment update:', err)
          );
        }
        return;
      }
    }

    const transactionRef = doc(db, 'transactions', transactionId);
    const prevSnap = await getDoc(transactionRef);
    const prevData = prevSnap.exists() ? prevSnap.data() : null;
    
    // Parse the date part based on local time
    const finalDate = parseLocalYYYYMMDD(transaction.date);
    
    // Maintain original time if available, otherwise use current time
    if (transaction.originalDate) {
      const original = new Date(transaction.originalDate);
      finalDate.setHours(original.getHours(), original.getMinutes(), original.getSeconds(), original.getMilliseconds());
    } else {
      const now = new Date();
      finalDate.setHours(now.getHours(), now.getMinutes(), now.getSeconds());
    }

    // Remove the temporary originalDate before saving to Firestore
    const { originalDate, ...saveData } = transaction;
    
    await updateDoc(transactionRef, {
      ...saveData,
      projectId: finalProjectId,
      updatedAt: serverTimestamp(),
      date: Timestamp.fromDate(finalDate),
      paymentMethod: transaction.paymentMethod || 'Efectivo',
      // Update denormalized category data if changed
      categoryName: transaction.categoryName,
      categoryIcon: transaction.categoryIcon,
      categoryColor: transaction.categoryColor
    });

    // 1. Sincronizar notificaciones de colaboradores (Enfoque 3)
    syncNotificationsOnExpenseUpdated(
      transactionId, 
      { id: transactionId, ...transaction, projectId: finalProjectId, date: finalDate }, 
      prevData
    ).catch(err =>
      console.error('Error syncing notifications on update:', err)
    );

    // 2. Recálculo reactivo de alertas de presupuesto
    if (transaction.type === 'expense' && transaction.categoryId) {
      recalculateBudgetAlertsForCategory(transaction.categoryId, finalProjectId, finalDate, { id: transactionId, ...transaction }).catch(err =>
        console.error('Budget alert recalculation error on update:', err)
      );
    }

    // Si cambió de categoría, proyecto o mes, o si dejó de ser gasto:
    if (prevData && prevData.type === 'expense' && prevData.categoryId) {
      const prevDateObj = safeToDate(prevData.date);
      const isSameCategory = prevData.categoryId === transaction.categoryId;
      const isSameProject = (prevData.projectId || null) === finalProjectId;
      const isSameMonth = getLocalMonth(prevDateObj) === getLocalMonth(finalDate);
      const isStillExpense = transaction.type === 'expense';

      if (!isSameCategory || !isSameProject || !isSameMonth || !isStillExpense) {
        recalculateBudgetAlertsForCategory(prevData.categoryId, prevData.projectId || null, prevData.date).catch(err =>
          console.error('Previous budget alert recalculation error:', err)
        );
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `transactions/${transactionId}`);
  }
};

export const deleteTransaction = async (transactionId: string) => {
  try {
    if (transactionId.includes('_installment_')) {
      const parts = transactionId.split('_installment_');
      const parentId = parts[0];
      const installmentNum = parseInt(parts[1], 10);
      return await deleteSingleVirtualInstallment(parentId, installmentNum);
    }

    const txRef = doc(db, 'transactions', transactionId);
    const prevSnap = await getDoc(txRef);
    const prevData = prevSnap.exists() ? prevSnap.data() : null;

    await deleteDoc(txRef);

    // Sincronizar borrado en notificaciones de colaboradores
    syncNotificationsOnExpenseDeleted(transactionId).catch(err =>
      console.error('Error syncing notifications on delete:', err)
    );

    // Recalcular presupuesto reactivamente
    if (prevData && prevData.type === 'expense' && prevData.categoryId) {
      recalculateBudgetAlertsForCategory(prevData.categoryId, prevData.projectId || null, prevData.date).catch(err =>
        console.error('Error recalculating budget alerts on delete:', err)
      );
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `transactions/${transactionId}`);
  }
};

/**
 * Delete ALL transactions for the current user and their projects.
 * USE WITH CAUTION.
 */
export const deleteAllTransactions = async () => {
  if (!auth.currentUser) return;
  const uid = auth.currentUser.uid;
  
  // 1. Get user's projects to know where to delete from
  const qProjects = query(collection(db, 'projects'), where('memberIds', 'array-contains', uid));
  const projectsSnap = await getDocs(qProjects);
  const projectIds = projectsSnap.docs.map(doc => doc.id);
  
  // 2. Fetch all transactions (personal and from projects)
  const allIds: string[] = [];
  
  // Personal
  const qPersonal = query(collection(db, 'transactions'), where('projectId', '==', null), where('authorId', '==', uid));
  const personalSnap = await getDocs(qPersonal);
  personalSnap.docs.forEach(doc => allIds.push(doc.id));
  
  // From projects
  for (const pid of projectIds) {
    const q = query(collection(db, 'transactions'), where('projectId', '==', pid));
    const snap = await getDocs(q);
    snap.docs.forEach(doc => allIds.push(doc.id));
  }
  
  // 3. Delete them all
  console.log(`Deleting ${allIds.length} transactions...`);
  for (const id of allIds) {
    await deleteDoc(doc(db, 'transactions', id));
  }
};

/**
 * Resets the entire database for the current user.
 * Deletes all projects and transactions.
 */
export const resetDatabase = async () => {
  if (!auth.currentUser) return;
  const uid = auth.currentUser.uid;

  try {
    const batch = writeBatch(db);
    
    // 1. Get all transactions where user is author OR project member
    const qTx = query(collection(db, 'transactions'), where('authorId', '==', uid));
    const txSnap = await getDocs(qTx);
    txSnap.docs.forEach(doc => batch.delete(doc.ref));

    // 2. Get all projects where user is member
    const qProj = query(collection(db, 'projects'), where('memberIds', 'array-contains', uid));
    const projSnap = await getDocs(qProj);
    projSnap.docs.forEach(doc => batch.delete(doc.ref));

    await batch.commit();
    console.log('Database reset successfully');
  } catch (error) {
    console.error('Error resetting database:', error);
    throw error;
  }
};

// --- Budgets ---

/**
 * Get budgets for a specific month and year, including shared projects.
 * Returns a real-time unsubscribe function.
 */
export const getBudgets = (month: string, projectIds: string[], callback: (budgets: any[]) => void) => {
  if (!auth.currentUser) return () => {};
  
  const uid = auth.currentUser.uid;
  const safeProjectIds = projectIds.length > 0 ? projectIds.slice(0, 10) : [];
  
  // Use a query that fetches all budgets for the month
  // We'll filter visually in the UI if needed, but here we fetch all relevant ones
  const q = safeProjectIds.length > 0 
    ? query(
        collection(db, 'budgets'),
        and(
          where('month', '==', month),
          or(
            where('userId', '==', uid),
            where('projectId', 'in', safeProjectIds)
          )
        )
      )
    : query(
        collection(db, 'budgets'),
        and(
          where('month', '==', month),
          where('userId', '==', uid)
        )
      );
  
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any)));
  });
};

/**
 * Fetch budgets once for a specific month and year.
 */
export const getBudgetsOnce = async (month: string, projectIds: string[]) => {
  if (!auth.currentUser) return [];
  
  const uid = auth.currentUser.uid;
  const safeProjectIds = projectIds.length > 0 ? projectIds.slice(0, 10) : [];
  
  const q = safeProjectIds.length > 0 
    ? query(
        collection(db, 'budgets'),
        and(
          where('month', '==', month),
          or(
            where('userId', '==', uid),
            where('projectId', 'in', safeProjectIds)
          )
        )
      )
    : query(
        collection(db, 'budgets'),
        and(
          where('month', '==', month),
          where('userId', '==', uid)
        )
      );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
};

/**
 * Create or update a budget for a category, month, and project.
 */
export const updateBudget = async (categoryId: string, month: string, amount: number, projectId: string | null = null) => {
  if (!auth.currentUser) return;
  const uid = auth.currentUser.uid;
  
  // Deterministic ID ensures we don't duplicate budgets for the same bucket
  const budgetId = projectId 
    ? `budget_${projectId}_${categoryId}_${month}` 
    : `budget_personal_${uid}_${categoryId}_${month}`;
  
  console.log(`Saving budget: ${budgetId} -> ${amount}`);

  try {
    await setDoc(doc(db, 'budgets', budgetId), {
      userId: uid,
      categoryId,
      month,
      amount,
      projectId: projectId || null,
      updatedAt: serverTimestamp()
    }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `budgets/${budgetId}`);
  }
};

/**
 * Remove a budget document.
 */
export const deleteBudget = async (categoryId: string, month: string, projectId: string | null = null) => {
  if (!auth.currentUser) return;
  const uid = auth.currentUser.uid;
  
  const budgetId = projectId 
    ? `budget_${projectId}_${categoryId}_${month}` 
    : `budget_personal_${uid}_${categoryId}_${month}`;
    
  console.log(`Deleting budget: ${budgetId}`);
  try {
    const docRef = doc(db, 'budgets', budgetId);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `budgets/${budgetId}`);
  }
};

// --- Expense Shortcuts ---

export interface Shortcut {
  id: string;
  name: string;
  icon: string;
  projectId: string;
  categoryId: string;
  paymentMethod: string;
  classification?: 'fixed' | 'variable';
  defaultAmount?: number | null;
  userId: string;
  order?: number;
  createdAt?: any;
}

export const getShortcuts = (callback: (shortcuts: Shortcut[]) => void) => {
  if (!auth.currentUser) return () => {};

  const q = query(
    collection(db, 'shortcuts'),
    where('userId', '==', auth.currentUser.uid)
  );

  return onSnapshot(q, (snapshot) => {
    const shortcuts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Shortcut));
    shortcuts.sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
    callback(shortcuts);
  }, (error) => {
    console.error('Error fetching shortcuts:', error);
  });
};

export const createShortcut = async (shortcutData: Omit<Shortcut, 'id' | 'userId'>) => {
  try {
    if (!auth.currentUser) return;
    const docRef = await addDoc(collection(db, 'shortcuts'), {
      ...shortcutData,
      order: shortcutData.order !== undefined ? shortcutData.order : Date.now(),
      userId: auth.currentUser.uid,
      createdAt: serverTimestamp()
    });
    return docRef;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'shortcuts');
  }
};

export const updateShortcut = async (id: string, shortcutData: Partial<Shortcut>) => {
  try {
    const shortcutRef = doc(db, 'shortcuts', id);
    await updateDoc(shortcutRef, {
      ...shortcutData,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `shortcuts/${id}`);
  }
};

export const updateShortcutOrders = async (orderedShortcuts: { id: string; order: number }[]) => {
  try {
    const batch = writeBatch(db);
    orderedShortcuts.forEach(({ id, order }) => {
      const ref = doc(db, 'shortcuts', id);
      batch.update(ref, { order, updatedAt: serverTimestamp() });
    });
    await batch.commit();
  } catch (error) {
    console.error('Error updating shortcut orders:', error);
  }
};

export const deleteShortcut = async (id: string) => {
  try {
    await deleteDoc(doc(db, 'shortcuts', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `shortcuts/${id}`);
  }
};

// --- Connection Test ---
export const testConnection = async () => {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if(error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration. ");
    }
  }
};

// --- Credit Cards & Installments ---

export interface CreditCard {
  id: string;
  name: string;
  bank?: string;
  last4Digits?: string;
  currency: string;
  closingDay: number;
  dueDay: number;
  color: string;
  userId: string;
  createdAt?: any;
  updatedAt?: any;
}

export const getCards = (callback: (cards: CreditCard[]) => void) => {
  if (!auth.currentUser) return () => {};
  const q = query(
    collection(db, 'cards'),
    where('userId', '==', auth.currentUser.uid)
  );

  return onSnapshot(q, (snapshot) => {
    const cards = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CreditCard));
    cards.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    callback(cards);
  }, (error) => {
    console.error('Error fetching credit cards:', error);
  });
};

export const createCard = async (cardData: Omit<CreditCard, 'id' | 'userId'>) => {
  try {
    if (!auth.currentUser) return;
    const docRef = await addDoc(collection(db, 'cards'), {
      ...cardData,
      userId: auth.currentUser.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return docRef;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'cards');
  }
};

export const updateCard = async (id: string, cardData: Partial<CreditCard>) => {
  try {
    const cardRef = doc(db, 'cards', id);
    await updateDoc(cardRef, {
      ...cardData,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `cards/${id}`);
  }
};

export const deleteCard = async (id: string) => {
  try {
    await deleteDoc(doc(db, 'cards', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `cards/${id}`);
  }
};

export interface CreateInstallmentParams {
  totalAmount: number;
  installmentAmount: number;
  installments: number;
  description: string;
  categoryId: string;
  categoryName: string;
  categoryIcon: string;
  categoryColor: string;
  paymentMethod?: string;
  classification?: 'fixed' | 'variable';
  cardId?: string | null;
  cardName?: string | null;
  projectId?: string | null;
  firstDueDate: string; // YYYY-MM-DD
  purchaseDate?: string; // YYYY-MM-DD
}

/**
 * Creates a single parent installment transaction in Firestore with plan metadata.
 * Virtual monthly installments are projected dynamically on the client side.
 */
export const createInstallmentExpense = async (params: CreateInstallmentParams) => {
  try {
    if (!auth.currentUser) return;
    const uid = auth.currentUser.uid;
    const now = new Date();

    const rawProjectId = params.projectId;
    const finalProjectId = (rawProjectId && typeof rawProjectId === 'string' && rawProjectId !== 'personal' && rawProjectId !== 'null' && rawProjectId.trim() !== '') 
      ? rawProjectId.trim() 
      : null;

    const baseDate = parseLocalYYYYMMDD(params.firstDueDate);
    const firstDueDate = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate(), now.getHours(), now.getMinutes(), now.getSeconds());

    const purchaseDate = params.purchaseDate || formatLocalYYYYMMDD(now);

    const txData = {
      amount: params.totalAmount,
      installmentAmount: params.installmentAmount,
      originalPurchaseAmount: params.totalAmount,
      type: 'expense',
      description: params.description.trim(),
      date: Timestamp.fromDate(firstDueDate),
      firstDueDate: params.firstDueDate,
      purchaseDate,
      isInstallmentPlan: true,
      totalInstallments: Number(params.installments),
      categoryId: params.categoryId,
      categoryName: params.categoryName,
      categoryIcon: params.categoryIcon,
      categoryColor: params.categoryColor,
      paymentMethod: 'Tarjeta de Crédito',
      classification: params.classification || 'variable',
      cardId: params.cardId || null,
      cardName: params.cardName || null,
      status: 'active',
      overrides: {},
      projectId: finalProjectId,
      authorId: uid,
      authorName: auth.currentUser.displayName || 'Usuario',
      createdAt: serverTimestamp()
    };

    const docRef = await addDoc(collection(db, 'transactions'), txData);

    // Notify collaborators if in a shared project
    if (finalProjectId) {
      notifyCollaboratorsOnExpenseAdded({
        id: docRef.id,
        ...txData,
        amount: params.totalAmount,
        installmentAmount: params.installmentAmount,
        projectId: finalProjectId
      }).catch(err =>
        console.error('Collaborator notification error on installment plan:', err)
      );
    }

    // Check budget alert for the first installment
    checkAndNotifyBudgetAlerts({
      id: `${docRef.id}_installment_1`,
      ...txData,
      amount: params.installmentAmount,
      date: firstDueDate
    }).catch(err =>
      console.error('Budget alert error on installment:', err)
    );

    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'transactions (installment plan)');
    throw error;
  }
};

/**
 * Deletes an installment plan. If parent plan doc exists, removes it.
 * Also handles backward compatibility for legacy multi-doc plans.
 */
export const deleteInstallmentPlan = async (installmentPlanId: string) => {
  try {
    if (!auth.currentUser) return;

    // 1. Try deleting parent document directly
    const planRef = doc(db, 'transactions', installmentPlanId);
    const planSnap = await getDoc(planRef);
    if (planSnap.exists()) {
      const planData = planSnap.data();
      await deleteDoc(planRef);
      syncNotificationsOnExpenseDeleted(installmentPlanId).catch(err =>
        console.error('Error syncing notifications on plan delete:', err)
      );
      if (planData.type === 'expense' && planData.categoryId) {
        recalculateBudgetAlertsForCategory(planData.categoryId, planData.projectId || null, planData.date).catch(err =>
          console.error('Budget recalculation error on plan delete:', err)
        );
      }
      return;
    }

    // 2. Backward compatibility: if plan was created under legacy batch mode
    const q = query(
      collection(db, 'transactions'),
      where('installmentPlanId', '==', installmentPlanId),
      where('authorId', '==', auth.currentUser.uid)
    );
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      const batch = writeBatch(db);
      snapshot.docs.forEach(d => {
        batch.delete(d.ref);
      });
      await batch.commit();
      syncNotificationsOnExpenseDeleted(installmentPlanId).catch(err =>
        console.error('Error syncing notifications on legacy plan delete:', err)
      );
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `transactions (plan: ${installmentPlanId})`);
    throw error;
  }
};

/**
 * Marks a single virtual installment as deleted in the parent plan overrides.
 */
export const deleteSingleVirtualInstallment = async (parentPlanId: string, installmentNumber: number) => {
  try {
    if (!auth.currentUser) return;
    const planRef = doc(db, 'transactions', parentPlanId);
    const planSnap = await getDoc(planRef);
    const planData = planSnap.exists() ? planSnap.data() : null;

    await updateDoc(planRef, {
      [`overrides.${installmentNumber}.status`]: 'deleted',
      updatedAt: serverTimestamp()
    });

    if (planData && planData.type === 'expense' && planData.categoryId) {
      recalculateBudgetAlertsForCategory(planData.categoryId, planData.projectId || null, planData.date).catch(err =>
        console.error('Budget recalculation error on installment override delete:', err)
      );
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `transactions (installment override: ${parentPlanId})`);
    throw error;
  }
};

