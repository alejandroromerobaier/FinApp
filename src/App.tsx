import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Home } from './pages/Home';
import { ProjectDetail } from './pages/ProjectDetail';
import { SharedProjects } from './pages/SharedProjects';
import { AddExpense } from './pages/AddExpense';
import { ManageCategories } from './pages/ManageCategories';
import { Stats } from './pages/Stats';
import { Settings } from './pages/Settings';
import { History } from './pages/History';
import { Reports } from './pages/Reports';
import { Budgets } from './pages/Budgets';
import { AuthProvider, useAuth } from './lib/AuthContext';
import { DataProvider } from './lib/DataContext';
import { ErrorBoundary } from './components/ErrorBoundary';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

function AppContent() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <Layout>
                <Routes>
                  <Route path="/" element={<Home />} />
                  <Route path="/history" element={<History />} />
                  <Route path="/project/:id" element={<ProjectDetail />} />
                  <Route path="/shared" element={<SharedProjects />} />
                  <Route path="/add" element={<AddExpense />} />
                  <Route path="/edit/:id" element={<AddExpense />} />
                  <Route path="/categories" element={<ManageCategories />} />
                  <Route path="/stats" element={<Stats />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="/reports" element={<Reports />} />
                  <Route path="/budgets" element={<Budgets />} />
                  <Route path="/project-demo" element={<ProjectDetail />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </Layout>
            </ProtectedRoute>
          }
        />
      </Routes>
    </Router>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <DataProvider>
          <AppContent />
        </DataProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
