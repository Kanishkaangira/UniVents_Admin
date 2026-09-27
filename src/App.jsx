import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AdminProvider } from './context/AdminContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import PostForm from './pages/PostForm';
import PendingApprovals from './pages/PendingApprovals';
import Management from './pages/Management';

export default function App() {
  return (
    <BrowserRouter>
      <AdminProvider>
        <div className="relative isolate min-h-screen">
          <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
            <span className="absolute -right-[125px] top-[78px] h-[235px] w-[235px] rounded-full border border-white/70 bg-[#E1DCFF]" />
            <span className="absolute -left-[103px] top-[340px] h-[185px] w-[185px] rounded-full border border-white/70 bg-[#DDF5F1]" />
            <span className="absolute -right-[140px] bottom-[45px] h-[250px] w-[250px] rounded-full border border-white/70 bg-[#FFE9DD]" />
          </div>
          <div className="relative z-10">
          <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Dashboard mineOnly />
              </ProtectedRoute>
            }
          />
          <Route
            path="/scope-posts"
            element={
              <ProtectedRoute>
                <Dashboard mineOnly={false} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/new"
            element={
              <ProtectedRoute>
                <PostForm />
              </ProtectedRoute>
            }
          />
          <Route
            path="/edit/:id"
            element={
              <ProtectedRoute>
                <PostForm />
              </ProtectedRoute>
            }
          />
          <Route
            path="/pending"
            element={
              <ProtectedRoute>
                <PendingApprovals />
              </ProtectedRoute>
            }
          />
          <Route
            path="/management"
            element={
              <ProtectedRoute requireSuper>
                <Management />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
          </div>
        </div>
      </AdminProvider>
    </BrowserRouter>
  );
}
