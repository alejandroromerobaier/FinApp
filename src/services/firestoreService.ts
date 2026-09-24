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
import { parseLocalYYYYMMDD, getLocalMonth } from '../lib/dateUtils';
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
      // Update existing user if needed (e.g., name changed)
      const data = userDoc.data();
      
      // Ensure currency exists even for older profiles
      if (!data.currency) {
        await updateDoc(userRef, { currency: 'ARS' });
      }

      // Ensure personal view settings exist for older profiles
      if (data.personalShowInHome === undefined) {
        await updateDoc(userRef, { 
          personalShowInHome: true,
          personalHomeOrder: 1
        });
      }

      if (displayName && data.name !== displayName) {
        await updateDoc(userRef, { name: displayName });
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

  // We check for these specifically to ensure they exist once globally
  const qGlobal = query(collection(db, 'categories'), where('scope', '==', 'system'));
  const globalSnap = await getDocs(qGlobal);
  const existingNames = new Set(globalSnap.docs.map(doc => doc.data().name));

  for (const cat of defaultCategories) {
    if (!existingNames.has(cat.name)) {
      // System categories have NO ownerId and a predictable ID for consistency
      const catId = `system_${cat.name.toLowerCase().replace(/\s+/g, '_')}`;
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
  
  const q = query(
    collection(db, 'projects'), 
    where('memberIds', 'array-contains', auth.currentUser.uid),
    orderBy('createdAt', 'desc')
  );
  
  return onSnapshot(q, (snapshot) => {
    const projects = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
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
        data: { projectId, ownerName: auth.currentUser?.displayName }
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
      where('projectId', '==', projectId),
      orderBy('date', 'desc')
    );
  } else {
    q = query(
      collection(db, 'transactions'),
      where('authorId', '==', auth.currentUser.uid),
      where('projectId', '==', null),
      orderBy('date', 'desc')
    );
  }

  return onSnapshot(q, (snapshot) => {
    const transactions = snapshot.docs.map(doc => ({ 
      id: doc.id, 
      ...doc.data(),
      date: safeToDate(doc.data().date)
    }));
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

  // Personal transactions
  const qPersonal = query(
    collection(db, 'transactions'),
    where('authorId', '==', uid),
    where('projectId', '==', null),
    orderBy('date', 'desc')
  );

  const unsubscribePersonal = onSnapshot(qPersonal, (snapshot) => {
    personalTransactions = snapshot.docs.map(doc => ({ 
      id: doc.id, 
      ...doc.data(),
      date: safeToDate(doc.data().date)
    }));
    updateAll();
  }, (error) => {
    console.error("Personal transactions fetch error:", error);
  });

  // Projects transactions
  const unsubscribesProjects: (() => void)[] = [];
  
  if (projectIds.length > 0) {
    // We fetch each project separately to be safe with indexes and real-time updates
    projectIds.slice(0, 10).forEach(projectId => {
      const qProject = query(
        collection(db, 'transactions'),
        where('projectId', '==', projectId),
        orderBy('date', 'desc')
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
    const transactionDoc = await getDoc(doc(db, 'transactions', transactionId));
    if (transactionDoc.exists()) {
      const data = transactionDoc.data();
      return {
        id: transactionDoc.id,
        ...data,
        date: safeToDate(data.date)
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
    const formattedAmount = formatCurrency(transaction.amount, currency);
    const catName = transaction.categoryName || 'Gasto';

    const content = `${authorName} registró un ${transaction.type === 'income' ? 'ingreso' : 'gasto'} de ${formattedAmount} en "${projectName}" (${catName})`;

    for (const memberId of targetMemberIds) {
      await addNotification({
        userId: memberId,
        type: 'expense_added',
        content,
        data: {
          projectId: transaction.projectId,
          amount: transaction.amount,
          categoryName: catName
        }
      });
    }
  } catch (err) {
    console.error('Error notifying collaborators on expense added:', err);
  }
};

export const checkAndNotifyBudgetAlerts = async (transaction: any) => {
  if (!auth.currentUser || transaction.type !== 'expense') return;

  try {
    const dateObj = transaction.date instanceof Date ? transaction.date : parseLocalYYYYMMDD(transaction.date);
    const month = getLocalMonth(dateObj);
    const categoryId = transaction.categoryId;
    const projectId = transaction.projectId || null;
    const currentUserId = auth.currentUser.uid;

    if (!categoryId) return;

    // 1. Fetch budget for this category & month
    const budgetId = projectId 
      ? `budget_${projectId}_${categoryId}_${month}` 
      : `budget_personal_${currentUserId}_${categoryId}_${month}`;

    const budgetSnap = await getDoc(doc(db, 'budgets', budgetId));
    if (!budgetSnap.exists()) return;

    const budgetData = budgetSnap.data();
    const budgetAmount = budgetData.amount || 0;
    if (budgetAmount <= 0) return;

    // 2. Fetch all expenses for this category, month, and project/personal context
    let q;
    if (projectId) {
      q = query(
        collection(db, 'transactions'),
        where('projectId', '==', projectId),
        where('categoryId', '==', categoryId),
        where('type', '==', 'expense')
      );
    } else {
      q = query(
        collection(db, 'transactions'),
        where('authorId', '==', currentUserId),
        where('projectId', '==', null),
        where('categoryId', '==', categoryId),
        where('type', '==', 'expense')
      );
    }

    const txSnap = await getDocs(q);
    let totalSpent = 0;
    txSnap.docs.forEach(doc => {
      const data = doc.data();
      const txDate = safeToDate(data.date);
      if (getLocalMonth(txDate) === month) {
        totalSpent += (data.amount || 0);
      }
    });

    const percentage = (totalSpent / budgetAmount) * 100;
    if (percentage < 80) return;

    // Determine targets
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

    const catName = transaction.categoryName || 'Categoría';
    const formattedSpent = formatCurrency(totalSpent, currency);
    const formattedLimit = formatCurrency(budgetAmount, currency);

    const targetThreshold = percentage >= 100 ? 100 : 80;

    for (const userId of targetUserIds) {
      const qNotif = query(
        collection(db, 'notifications'),
        where('userId', '==', userId),
        where('type', '==', 'budget_alert')
      );
      
      const notifSnap = await getDocs(qNotif);
      const alreadyNotified = notifSnap.docs.some(doc => {
        const d = doc.data();
        return d.data?.month === month && 
               d.data?.categoryId === categoryId && 
               d.data?.threshold === targetThreshold &&
               (projectId ? d.data?.projectId === projectId : !d.data?.projectId);
      });

      if (!alreadyNotified) {
        const title = targetThreshold === 100
          ? `¡Límite superado! Has alcanzado el ${Math.round(percentage)}% del presupuesto en ${catName} (${formattedSpent} de ${formattedLimit})`
          : `Alerta de presupuesto: Has alcanzado el ${Math.round(percentage)}% del límite en ${catName} (${formattedSpent} de ${formattedLimit})`;

        await addNotification({
          userId,
          type: 'budget_alert',
          content: title,
          data: {
            budgetAlert: true,
            threshold: targetThreshold,
            month,
            categoryId,
            projectId,
            percentage: Math.round(percentage)
          }
        });
      }
    }
  } catch (err) {
    console.error('Error checking budget alerts:', err);
  }
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

    const docRef = await addDoc(collection(db, 'transactions'), {
      ...transaction,
      authorId: auth.currentUser?.uid,
      createdAt: serverTimestamp(),
      date: Timestamp.fromDate(transactionDate),
      paymentMethod: transaction.paymentMethod || 'Efectivo',
      // Denormalized category data for better collaboration visibility
      categoryName: transaction.categoryName,
      categoryIcon: transaction.categoryIcon,
      categoryColor: transaction.categoryColor
    });

    // Notify collaborators if in a shared project
    if (transaction.projectId) {
      notifyCollaboratorsOnExpenseAdded({ id: docRef.id, ...transaction }).catch(err =>
        console.error('Collaborator notification error:', err)
      );
    }

    // Check budget thresholds if expense
    if (transaction.type === 'expense') {
      checkAndNotifyBudgetAlerts({ id: docRef.id, ...transaction, date: transactionDate }).catch(err =>
        console.error('Budget alert error:', err)
      );
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'transactions');
  }
};

export const updateTransaction = async (transactionId: string, transaction: any) => {
  try {
    const transactionRef = doc(db, 'transactions', transactionId);
    
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
      updatedAt: serverTimestamp(),
      date: Timestamp.fromDate(finalDate),
      paymentMethod: transaction.paymentMethod || 'Efectivo',
      // Update denormalized category data if changed
      categoryName: transaction.categoryName,
      categoryIcon: transaction.categoryIcon,
      categoryColor: transaction.categoryColor
    });

    // Check budget thresholds if expense
    if (transaction.type === 'expense') {
      checkAndNotifyBudgetAlerts({ id: transactionId, ...transaction, date: finalDate }).catch(err =>
        console.error('Budget alert error:', err)
      );
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `transactions/${transactionId}`);
  }
};

export const deleteTransaction = async (transactionId: string) => {
  try {
    await deleteDoc(doc(db, 'transactions', transactionId));
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

// --- Connection Test ---
export const testConnection = async () => {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if(error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration. ");
    }
  }
}
