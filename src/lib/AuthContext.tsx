import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, onAuthStateChanged, User, signOut as firebaseSignOut } from './firebase';
import { syncUserProfile } from '../services/firestoreService';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';
import { setAnalyticsUser } from './analytics';

export interface UserProfile {
  name: string;
  email: string;
  photoURL: string;
  phone?: string;
  bio?: string;
  occupation?: string;
  currency: string;
  personalShowInHome?: boolean;
  personalHomeOrder?: number;
  personalShowInExpenseSelector?: boolean;
  personalStatus?: 'active' | 'inactive';
  defaultProjectId?: string;
  personalCardColor?: string;
  themePreference?: 'light' | 'dark' | 'system';
  createdAt: any;
  updatedAt?: any;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Failsafe: Never stay in loading state indefinitely
    const safetyTimer = setTimeout(() => {
      setLoading(false);
    }, 4000);

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      setAnalyticsUser(user?.uid || null);
      
      if (user) {
        // Sync profile to Firestore
        await syncUserProfile(user).catch(() => {});
        
        // Listen to profile changes
        const profileUnsubscribe = onSnapshot(doc(db, 'users', user.uid), (docSnapshot) => {
          if (docSnapshot.exists()) {
            setProfile(docSnapshot.data() as UserProfile);
          }
          setLoading(false);
        }, (error) => {
          console.error("Profile snapshot error:", error);
          setLoading(false);
        });
        
        return () => profileUnsubscribe();
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      clearTimeout(safetyTimer);
      unsubscribe();
    };
  }, []);

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
