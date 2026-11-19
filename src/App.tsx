import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { AuthProvider, useAuth } from './lib/AuthContext';
import { DataProvider } from './lib/DataContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { RouteTracker } from './components/RouteTracker';
import { UpdatePrompt } from './components/UpdatePrompt';

import { Home } from './pages/Home';
import { AddExpense } from './pages/AddExpense';

const lazyPage = <K extends string>(
  loader: () => Promise<Record<K, React.ComponentType<any>> & Record<string, any>>,
  exportName: K
) => React.lazy(() => loader().then(m => ({ default: m[exportName] })));

const Login = lazyPage(() => import('./pages/Login'), 'Login');
const ProjectDetail = lazyPage(() => import('./pages/ProjectDetail'), 'ProjectDetail');
const SharedProjects = lazyPage(() => import('./pages/SharedProjects'), 'SharedProjects');
const ManageCategories = lazyPage(() => import('./pages/ManageCategories'), 'ManageCategories');
const Stats = lazyPage(() => import('./pages/Stats'), 'Stats');
const Settings = lazyPage(() => import('./pages/Settings'), 'Settings');
const History = lazyPage(() => import('./pages/History'), 'History');
const Reports = lazyPage(() => import('./pages/Reports'), 'Reports');
const Budgets = lazyPage(() => import('./pages/Budgets'), 'Budgets');
const ManageShortcuts = lazyPage(() => import('./pages/ManageShortcuts'), 'ManageShortcuts');
const ManageCards = lazyPage(() => import('./pages/ManageCards'), 'ManageCards');
const CreditCards = lazyPage(() => import('./pages/CreditCards'), 'CreditCards');
const WelcomeOnboarding = lazyPage(() => import('./pages/WelcomeOnboarding'), 'WelcomeOnboarding');

const RouteFallback: React.FC = () => (
  <div className="min-h-[60dvh] flex items-center justify-center bg-surface">
    <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
  </div>
);

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
      <RouteTracker />
      <UpdatePrompt />
      <React.Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/bienvenida" element={<WelcomeOnboarding />} />
          <Route path="/inicio" element={<WelcomeOnboarding />} />
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <Layout>
                  <React.Suspense fallback={<RouteFallback />}>
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
                      <Route path="/shortcuts" element={<ManageShortcuts />} />
                      <Route path="/cards" element={<ManageCards />} />
                      <Route path="/credit-cards" element={<CreditCards />} />
                      <Route path="/project-demo" element={<ProjectDetail />} />
                      <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                  </React.Suspense>
                </Layout>
              </ProtectedRoute>
            }
          />
        </Routes>
      </React.Suspense>
    </Router>
  );
}

import { ThemeProvider } from './lib/ThemeContext';
import { ToastProvider } from './context/ToastContext';

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <DataProvider>
            <ToastProvider>
              <AppContent />
            </ToastProvider>
          </DataProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
