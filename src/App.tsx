import React, { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { AuthProvider, useAuth } from './lib/AuthContext';
import { DataProvider } from './lib/DataContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { RouteTracker } from './components/RouteTracker';

// Lazy loading pages with preloading helpers for instant mobile touch navigation
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

const Login = lazy(() => loadLogin().then(m => ({ default: m.Login })));
const Home = lazy(() => loadHome().then(m => ({ default: m.Home })));
const ProjectDetail = lazy(() => loadProjectDetail().then(m => ({ default: m.ProjectDetail })));
const SharedProjects = lazy(() => loadSharedProjects().then(m => ({ default: m.SharedProjects })));
const AddExpense = lazy(() => loadAddExpense().then(m => ({ default: m.AddExpense })));
const ManageCategories = lazy(() => loadManageCategories().then(m => ({ default: m.ManageCategories })));
const Stats = lazy(() => loadStats().then(m => ({ default: m.Stats })));
const Settings = lazy(() => loadSettings().then(m => ({ default: m.Settings })));
const History = lazy(() => loadHistory().then(m => ({ default: m.History })));
const Reports = lazy(() => loadReports().then(m => ({ default: m.Reports })));
const Budgets = lazy(() => loadBudgets().then(m => ({ default: m.Budgets })));
const ManageShortcuts = lazy(() => loadManageShortcuts().then(m => ({ default: m.ManageShortcuts })));

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
