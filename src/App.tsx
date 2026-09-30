import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { AuthProvider, useAuth } from './lib/AuthContext';
import { DataProvider } from './lib/DataContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { RouteTracker } from './components/RouteTracker';

// Lazy loading pages for code splitting and initial load performance
const Login = lazy(() => import('./pages/Login').then(m => ({ default: m.Login })));
const Home = lazy(() => import('./pages/Home').then(m => ({ default: m.Home })));
const ProjectDetail = lazy(() => import('./pages/ProjectDetail').then(m => ({ default: m.ProjectDetail })));
const SharedProjects = lazy(() => import('./pages/SharedProjects').then(m => ({ default: m.SharedProjects })));
const AddExpense = lazy(() => import('./pages/AddExpense').then(m => ({ default: m.AddExpense })));
const ManageCategories = lazy(() => import('./pages/ManageCategories').then(m => ({ default: m.ManageCategories })));
const Stats = lazy(() => import('./pages/Stats').then(m => ({ default: m.Stats })));
const Settings = lazy(() => import('./pages/Settings').then(m => ({ default: m.Settings })));
const History = lazy(() => import('./pages/History').then(m => ({ default: m.History })));
const Reports = lazy(() => import('./pages/Reports').then(m => ({ default: m.Reports })));
const Budgets = lazy(() => import('./pages/Budgets').then(m => ({ default: m.Budgets })));
const ManageShortcuts = lazy(() => import('./pages/ManageShortcuts').then(m => ({ default: m.ManageShortcuts })));

const PageLoader = () => (
  <div className="min-h-[60vh] flex items-center justify-center">
    <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
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
