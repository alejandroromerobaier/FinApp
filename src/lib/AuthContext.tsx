import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, onAuthStateChanged, User, signOut as firebaseSignOut } from './firebase';
import { syncUserProfile } from '../services/firestoreService';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';

interface UserProfile {
  name: string;
  email: string;
  photoURL: string;
  currency: string;
  personalShowInHome?: boolean;
  personalHomeOrder?: number;
  personalShowInExpenseSelector?: boolean;
  personalStatus?: 'active' | 'inactive';
  defaultProjectId?: string;
  createdAt: any;
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
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      
      if (user) {
        // Sync profile to Firestore
        await syncUserProfile(user);
        
        // Listen to profile changes
        const profileUnsubscribe = onSnapshot(doc(db, 'users', user.uid), (doc) => {
          if (doc.exists()) {
            setProfile(doc.data() as UserProfile);
          }
          setLoading(false);
        });
        
        return () => profileUnsubscribe();
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => unsubscribe();
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
