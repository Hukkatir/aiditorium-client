import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Landing from './pages/Landing';
import Auth from "./pages/Auth";
import Profile from './pages/Profile';
import Courses from './pages/Courses';
import CourseDetailPage from './pages/CourseDetailPage';
import DisciplineDetailPage from './pages/DisciplineDetailPage';
import FilePreviewPage from './pages/FilePreviewPage';
import MyTasksPage from './pages/MyTasksPage';
import AdminDashboardPage from './pages/AdminDashboardPage';
import TaskDetailPage from './pages/TaskDetailPage';
import TaskPeerReviewSettingsPage from './pages/TaskPeerReviewSettingsPage';
import TaskReviewSettingsPage from './pages/TaskReviewSettingsPage';
import TaskSubmissionsPage from './pages/TaskSubmissionsPage';
import { isGlobalAdmin } from './utils/roleUtils';
// Защищённый маршрут (без Layout – Layout уже внутри страниц)
const ProtectedRoute = ({ children }) => {
    const { isAuthenticated, loading } = useAuth();
    if (loading) {
        return null;
    }
    if (!isAuthenticated) {
        return <Navigate to="/auth" replace />;
    }
    return children;
};

// Публичный маршрут (без Layout)
const PublicRoute = ({ children }) => {
    const { isAuthenticated, loading } = useAuth();
    if (loading) {
        return null;
    }
    if (isAuthenticated) {
        return <Navigate to="/courses" replace />;
    }
    return children;
};

const AdminRoute = ({ children }) => {
    const { user, isAuthenticated, loading } = useAuth();

    if (loading) {
        return null;
    }

    if (!isAuthenticated) {
        return <Navigate to="/auth" replace />;
    }

    if (!isGlobalAdmin(user)) {
        return <Navigate to="/courses" replace />;
    }

    return children;
};

function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<Landing />} />
                <Route path="/auth" element={
                    <PublicRoute>
                        <Auth />
                    </PublicRoute>
                } />

                {/* Защищённые страницы – они сами оборачивают себя в MainLayout */}
                <Route path="/profile" element={
                    <ProtectedRoute>
                        <Profile />
                    </ProtectedRoute>
                } />
                <Route path="/courses" element={
                    <ProtectedRoute>
                        <Courses />
                    </ProtectedRoute>
                } />
                <Route path="/my-tasks" element={
                    <ProtectedRoute>
                        <MyTasksPage />
                    </ProtectedRoute>
                } />
                <Route path="/admin" element={
                    <AdminRoute>
                        <AdminDashboardPage />
                    </AdminRoute>
                } />
                <Route path="/peer-review" element={
                    <ProtectedRoute>
                        <Navigate to="/my-tasks" replace />
                    </ProtectedRoute>
                } />
                <Route path="/file/:fileId/preview" element={
                    <ProtectedRoute>
                        <FilePreviewPage />
                    </ProtectedRoute>
                } />
                <Route path="/courses/:courseId" element={
                    <ProtectedRoute>
                        <CourseDetailPage />
                    </ProtectedRoute>
                } />
                <Route path="/course/:courseIdOrSlug" element={
                    <ProtectedRoute>
                        <CourseDetailPage />
                    </ProtectedRoute>
                } />
                <Route path="/course/:courseIdOrSlug/discipline/:disciplineIdOrSlug" element={
                    <ProtectedRoute>
                        <DisciplineDetailPage />
                    </ProtectedRoute>
                } />
                <Route path="/course/:courseIdOrSlug/discipline/:disciplineIdOrSlug/task/:taskNumber/submissions" element={
                    <ProtectedRoute>
                        <TaskSubmissionsPage />
                    </ProtectedRoute>
                } />
                <Route path="/course/:courseIdOrSlug/discipline/:disciplineIdOrSlug/task/:taskNumber/review-settings" element={
                    <ProtectedRoute>
                        <TaskReviewSettingsPage />
                    </ProtectedRoute>
                } />
                <Route path="/course/:courseIdOrSlug/discipline/:disciplineIdOrSlug/task/:taskNumber/ai-review-settings" element={
                    <ProtectedRoute>
                        <TaskReviewSettingsPage />
                    </ProtectedRoute>
                } />
                <Route path="/course/:courseIdOrSlug/discipline/:disciplineIdOrSlug/task/:taskNumber/peer-review-settings" element={
                    <ProtectedRoute>
                        <TaskPeerReviewSettingsPage />
                    </ProtectedRoute>
                } />
                <Route path="/course/:courseIdOrSlug/discipline/:disciplineIdOrSlug/task/:taskNumber" element={
                    <ProtectedRoute>
                        <TaskDetailPage />
                    </ProtectedRoute>
                } />

                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </BrowserRouter>
    );
}

export default App;
