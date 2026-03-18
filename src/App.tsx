import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { AuthProvider } from "./context/AuthContext";
import { RoleProvider } from "./context/RoleContext";
import { FeedbackProvider } from "./context/FeedbackContext";
import Navbar from "./components/Navbar";
import ProtectedRoute from "./components/ProtectedRoute";
import Login from "./pages/Login";
import Profile from "./pages/Profile";
import Home from "./pages/Home";
import WorkoutList from "./pages/WorkoutList";
import WorkoutDetail from "./pages/WorkoutDetail";
import WorkoutForm from "./pages/WorkoutForm";
import CoachDashboard from "./pages/CoachDashboard";
import StudentWorkouts from "./pages/StudentWorkouts";
import AssignWorkoutForm from "./pages/AssignWorkoutForm";
import MyAssignedWorkouts from "./pages/MyAssignedWorkouts";
import CoachDirectory from "./pages/CoachDirectory";
import CoachPublicProfile from "./pages/CoachPublicProfile";
import CoachProfileEdit from "./pages/CoachProfileEdit";
import CoachTemplates from "./pages/CoachTemplates";
import CoachWeeklyTemplates from './pages/CoachWeeklyTemplates';
import WeeklyTemplateForm from './pages/WeeklyTemplateForm';
import CoachDailyView from "./pages/CoachDailyView";
import AdminDashboard from "./pages/AdminDashboard";
import AdminUsers from "./pages/AdminUsers";
import AdminAchievements from "./pages/AdminAchievements";
import AdminAchievementDetail from "./pages/AdminAchievementDetail";
import AdminRoute from "./components/AdminRoute";
import Notifications from "./pages/Notifications";
import Onboarding from "./pages/Onboarding";
import AssignmentDetail from "./pages/AssignmentDetail";
import "./App.css";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string;

function AppShell() {
  const location = useLocation();
  const isLanding = location.pathname === '/login';

  return (
    <>
      {!isLanding && <Navbar />}
      <main className={isLanding ? '' : 'container'}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
          <Route path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />
          <Route path="/workouts" element={<ProtectedRoute><WorkoutList /></ProtectedRoute>} />
          <Route path="/workouts/new" element={<ProtectedRoute><WorkoutForm /></ProtectedRoute>} />
          <Route path="/workouts/:id" element={<ProtectedRoute><WorkoutDetail /></ProtectedRoute>} />
          <Route path="/workouts/:id/edit" element={<ProtectedRoute><WorkoutForm /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="/coach" element={<ProtectedRoute><CoachDashboard /></ProtectedRoute>} />
          <Route path="/coach/students/:id" element={<ProtectedRoute><StudentWorkouts /></ProtectedRoute>} />
          <Route path="/coach/assign/:studentId" element={<ProtectedRoute><AssignWorkoutForm /></ProtectedRoute>} />
          <Route path="/coach/assigned-workouts/:id/edit" element={<ProtectedRoute><AssignWorkoutForm /></ProtectedRoute>} />
          <Route path="/my-assignments" element={<ProtectedRoute><MyAssignedWorkouts /></ProtectedRoute>} />
          <Route path="/assignments/:id" element={<ProtectedRoute><AssignmentDetail /></ProtectedRoute>} />
          <Route path="/coaches" element={<ProtectedRoute><CoachDirectory /></ProtectedRoute>} />
          <Route path="/coaches/:id" element={<ProtectedRoute><CoachPublicProfile /></ProtectedRoute>} />
          <Route path="/coach/profile" element={<ProtectedRoute><CoachProfileEdit /></ProtectedRoute>} />
          <Route path="/coach/templates" element={<ProtectedRoute><CoachTemplates /></ProtectedRoute>} />
          <Route path="/coach/weekly-templates" element={<ProtectedRoute><CoachWeeklyTemplates /></ProtectedRoute>} />
          <Route path="/coach/weekly-templates/new" element={<ProtectedRoute><WeeklyTemplateForm /></ProtectedRoute>} />
          <Route path="/coach/weekly-templates/:id/edit" element={<ProtectedRoute><WeeklyTemplateForm /></ProtectedRoute>} />
          <Route path="/coach/daily" element={<ProtectedRoute><CoachDailyView /></ProtectedRoute>} />
          <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
          <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
          <Route path="/admin/users" element={<AdminRoute><AdminUsers /></AdminRoute>} />
          <Route path="/admin/achievements" element={<AdminRoute><AdminAchievements /></AdminRoute>} />
          <Route path="/admin/achievements/:id" element={<AdminRoute><AdminAchievementDetail /></AdminRoute>} />
        </Routes>
      </main>
    </>
  );
}

function App() {
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <BrowserRouter>
        <AuthProvider>
          <RoleProvider>
            <FeedbackProvider>
              <AppShell />
            </FeedbackProvider>
          </RoleProvider>
        </AuthProvider>
      </BrowserRouter>
    </GoogleOAuthProvider>
  );
}

export default App;
