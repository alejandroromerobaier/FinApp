import React, { createContext, useContext, useEffect, useState, useRef, useMemo } from 'react';
import {
  getCategories,
  getProjects,
  getGlobalTransactions,
  getUsersByIds,
  getCategoriesByIds,
  getNotifications,
  markNotificationRead,
  getBudgets
} from '../services/firestoreService';
import { useAuth } from './AuthContext';
import { getLocalMonth } from './dateUtils';

export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  type: 'expense' | 'income';
  ownerId: string | null;
  scope?: 'system' | 'project' | 'personal';
}

export interface Project {
  id: string;
  name: string;
  icon: string;
  currency: string;
  ownerId: string;
  memberIds: string[];
  showInHome?: boolean;
  homeOrder?: number;
  createdAt: any;
}

export interface Transaction {
  id: string;
  amount: number;
  type: 'expense' | 'income';
  description: string;
  date: Date;
  categoryId: string;
  categoryName: string;
  categoryIcon: string;
  categoryColor: string;
  projectId?: string | null;
  authorId: string;
  paymentMethod?: string;
  classification?: 'fixed' | 'variable';
}

export interface Budget {
  id: string;
  categoryId: string;
  amount: number;
  month: string;
  projectId?: string | null;
}

export interface DataContextType {
  categories: Category[];
  projects: Project[];
  transactions: any[];
  userNames: Record<string, string>;
  userEmails: Record<string, string>;
  loading: boolean;
  notifications: any[];
  budgets: Budget[];
  budgetMonth: string;
  setBudgetMonth: (month: string) => void;
  markAsRead: (id: string) => Promise<void>;
  showBalances: boolean;
  toggleShowBalances: () => void;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [userNames, setUserNames] = useState<Record<string, string>>({});
  const [userEmails, setUserEmails] = useState<Record<string, string>>({});
  const [notifications, setNotifications] = useState<any[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [budgetMonth, setBudgetMonth] = useState(getLocalMonth());
  const [loading, setLoading] = useState(true);
  const [showBalances, setShowBalances] = useState(() => {
    const saved = localStorage.getItem('showBalances');
    return saved !== 'false';
  });
  const fetchedCategoryIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      return;
    }

    // Sync notifications
    const unsubscribeNotifs = getNotifications((data: any[]) => {
      setNotifications(data);
    });

    return () => {
      unsubscribeNotifs();
    };
  }, [user]);

  const projectIdsStr = projects.map(p => p.id).sort().join(',');

  useEffect(() => {
    if (!user) {
      setBudgets([]);
      return;
    }

    // Sync budgets for budgetMonth, including shared projects
    const projectIds = projects.map(p => p.id);

    // Pass project IDs to fetch shared budgets
    const unsubscribeBudgets = getBudgets(budgetMonth, projectIds, (data: any[]) => {
      setBudgets(data);
    });

    return () => {
      unsubscribeBudgets();
    };
  }, [user, projectIdsStr, budgetMonth]);

  const markAsRead = async (id: string) => {
    await markNotificationRead(id);
  };

  const toggleShowBalances = () => {
    setShowBalances(prev => {
      const newValue = !prev;
      localStorage.setItem('showBalances', String(newValue));
      return newValue;
    });
  };

  // Calculate all member IDs from all projects to sync categories
  const allMemberIds = useMemo(() => {
    const ids = new Set<string>();
    projects.forEach(p => {
      p.memberIds?.forEach(mid => ids.add(mid));
    });
    return Array.from(ids).sort();
  }, [projects]);

  const memberIdsStr = allMemberIds.join(',');

  useEffect(() => {
    if (!user) {
      setCategories([]);
      setLoading(false);
      fetchedCategoryIds.current.clear();
      return;
    }

    // Pass member IDs of current collaborators to broaden category sync
    const unsubscribeCategories = getCategories((data) => {
      setCategories(prev => {
        // Build map of discovered categories (those not in system and not owned by current user OR members)
        const membersSet = new Set([user.uid, ...allMemberIds]);
        const discovered = prev.filter(c => c.ownerId !== null && !membersSet.has(c.ownerId || ''));
        const incomingIds = new Set(data.map(c => c.id));

        // Final categories is the combination of incoming categories + any lingering discovered ones
        const combined = [...data];
        discovered.forEach(c => {
          if (!incomingIds.has(c.id)) {
            combined.push(c);
          }
        });
        return combined;
      });
      data.forEach(c => fetchedCategoryIds.current.add(c.id));
    }, allMemberIds);

    return () => {
      unsubscribeCategories();
    };
  }, [user, memberIdsStr]);

  useEffect(() => {
    if (!user) {
      setProjects([]);
      return;
    }

    const unsubscribeProjects = getProjects((data) => {
      setProjects(data);
    });

    return () => {
      unsubscribeProjects();
    };
  }, [user]);



  const fetchedUserIds = useRef<Set<string>>(new Set());
  const categoriesRef = useRef(categories);
  categoriesRef.current = categories;
  const userNamesRef = useRef(userNames);
  userNamesRef.current = userNames;

  useEffect(() => {
    if (!user) {
      setTransactions([]);
      return;
    }

    const unsubscribeTransactions = getGlobalTransactions(projects.map(p => p.id), (data) => {
      setTransactions(data);
      setLoading(false);

      // 1. Fetch names for unique authors we don't have yet
      const authorIds = [...new Set(data.map(t => t.authorId))];
      const missingAuthorIds = authorIds.filter(id => !userNamesRef.current[id] && !fetchedUserIds.current.has(id));
      if (missingAuthorIds.length > 0) {
        missingAuthorIds.forEach(id => fetchedUserIds.current.add(id));
        getUsersByIds(missingAuthorIds).then(users => {
          if (users) {
            setUserNames(prev => {
              const next = { ...prev };
              users?.forEach(u => {
                const userData = u as any;
                next[u.id] = userData.name || userData.displayName || 'Usuario';
              });
              return next;
            });
            setUserEmails(prev => {
              const next = { ...prev };
              users?.forEach(u => {
                const userData = u as any;
                if (userData.email) next[u.id] = userData.email;
              });
              return next;
            });
          }
        });
      }

      // 2. Fetch metadata for categories we don't have in current list
      const allCategoryIds = [...new Set(data.map(t => t.categoryId))];
      const currentCategoryIds = new Set(categoriesRef.current.map(c => c.id));
      const missingCategoryIds = allCategoryIds.filter(id => !currentCategoryIds.has(id) && !fetchedCategoryIds.current.has(id));

      if (missingCategoryIds.length > 0) {
        // Mark as fetched immediately to avoid duplicate requests during transit
        missingCategoryIds.forEach(id => fetchedCategoryIds.current.add(id));

        getCategoriesByIds(missingCategoryIds).then(newCats => {
          if (newCats && newCats.length > 0) {
            setCategories(prev => {
              const existingIds = new Set(prev.map(c => c.id));
              const filteredNew = (newCats as Category[]).filter(c => !existingIds.has(c.id));
              if (filteredNew.length === 0) return prev;

              // Only add those that are truly new (double-check after fetch)
              return [...prev, ...filteredNew];
            });
          }
        }).catch(err => {
          console.error("Error fetching shared project categories:", err);
        });
      }
    });

    return () => {
      unsubscribeTransactions();
    };
  }, [user, projectIdsStr]);

  return (
    <DataContext.Provider value={{
      categories,
      projects,
      transactions,
      userNames,
      userEmails,
      notifications,
      budgets,
      budgetMonth,
      setBudgetMonth,
      markAsRead,
      loading,
      showBalances,
      toggleShowBalances
    }}>
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
};
