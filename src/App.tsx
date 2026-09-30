import React, { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { AuthProvider, useAuth } from './lib/AuthContext';
import { DataProvider } from './lib/DataContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { RouteTracker } from './components/RouteTracker';

// Safe lazy loader with auto-retry and reload recovery on deployment chunk errors
const lazyWithRetry = (importFn: () => Promise<any>, exportName?: string) =>
  lazy(async () => {
    try {
      const module = await importFn();
      sessionStorage.removeItem('chunk_reload_attempted');
      return exportName ? { default: module[exportName] } : module;
    } catch (error: any) {
      const isChunkError =
        error?.message?.includes('Failed to fetch dynamically imported module') ||
        error?.message?.includes('Importing a module script failed') ||
        error?.name === 'ChunkLoadError';

      if (isChunkError && !sessionStorage.getItem('chunk_reload_attempted')) {
        sessionStorage.setItem('chunk_reload_attempted', 'true');
        window.location.reload();
        return new Promise(() => {});
      }
      throw error;
    }
  });

const loadLogin = () => import('./pages/Login');
const loadHome = () => import('./pages/Home');
const loadProjectDetail = () => import('./pages/ProjectDetail');
const loadSharedProjects = () => import('./pages/SharedProjects');
const loadAddExpense = () => import('./pages/AddExpense');
const loadManageCategories = () => import('./pages/ManageCategories');
const loadStats = () => import('./pages/Stats');
const loadSettings = () => import('./pages/Settings');
const loadHistory = () => import('./pages/History');
const loadReports = () => import('./pages/Reports');
const loadBudgets = () => import('./pages/Budgets');
const loadManageShortcuts = () => import('./pages/ManageShortcuts');

const Login = lazyWithRetry(loadLogin, 'Login');
const Home = lazyWithRetry(loadHome, 'Home');
const ProjectDetail = lazyWithRetry(loadProjectDetail, 'ProjectDetail');
const SharedProjects = lazyWithRetry(loadSharedProjects, 'SharedProjects');
const AddExpense = lazyWithRetry(loadAddExpense, 'AddExpense');
const ManageCategories = lazyWithRetry(loadManageCategories, 'ManageCategories');
const Stats = lazyWithRetry(loadStats, 'Stats');
const Settings = lazyWithRetry(loadSettings, 'Settings');
const History = lazyWithRetry(loadHistory, 'History');
const Reports = lazyWithRetry(loadReports, 'Reports');
const Budgets = lazyWithRetry(loadBudgets, 'Budgets');
const ManageShortcuts = lazyWithRetry(loadManageShortcuts, 'ManageShortcuts');

const PageLoader = () => (
  <div className="min-h-[60vh] flex items-center justify-center">
    <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
  </div>
);

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();

  // Eagerly preload primary page bundles in the background after auth is ready
  useEffect(() => {
    if (user) {
      const preloadTimer = setTimeout(() => {
        loadHome();
        loadStats();
        loadAddExpense();
        loadHistory();
        loadSettings();
      }, 500);
      return () => clearTimeout(preloadTimer);
    }
  }, [user]);

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
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <Layout>
                  <Suspense fallback={<PageLoader />}>
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
                      <Route path="/project-demo" element={<ProjectDetail />} />
                      <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                  </Suspense>
                </Layout>
              </ProtectedRoute>
            }
          />
        </Routes>
      </Suspense>
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
