import { Routes, Route } from 'react-router-dom';
import Layout            from '../components/layout/Layout';
import ProtectedRoute    from './ProtectedRoute';
import RoleHomeRedirect  from './RoleHomeRedirect';
import Login             from '../pages/auth/Login';
import AccessDenied      from '../pages/auth/AccessDenied';
import StudentDashboard  from '../pages/dashboards/StudentDashboard';
import FacultyDashboard  from '../pages/dashboards/FacultyDashboard';
import CCDashboard       from '../pages/dashboards/CCDashboard';
import HODDashboard      from '../pages/dashboards/HODDashboard';
import NotFound          from '../pages/NotFound';

// HOD Admin pages
import DepartmentsPage   from '../pages/hod/admin/DepartmentsPage';
import AcademicYearsPage from '../pages/hod/admin/AcademicYearsPage';
import SemestersPage     from '../pages/hod/admin/SemestersPage';
import BatchesPage       from '../pages/hod/admin/BatchesPage';
import DivisionsPage     from '../pages/hod/admin/DivisionsPage';
import StudentsPage      from '../pages/hod/admin/StudentsPage';
import FacultyPage       from '../pages/hod/admin/FacultyPage';
import SubjectsPage      from '../pages/hod/admin/SubjectsPage';
import AssignmentsPage   from '../pages/hod/admin/AssignmentsPage';
import ImportPage        from '../pages/hod/ImportPage';
import TimetableListPage   from '../pages/hod/timetable/TimetableListPage';
import TimetableImportWizard from '../pages/hod/timetable/TimetableImportWizard';
import TimetableDetailPage from '../pages/hod/timetable/TimetableDetailPage';

// Role-specific pages
import StudentTimetablePage from '../pages/student/StudentTimetablePage';
import StudentSyllabusPage  from '../pages/student/StudentSyllabusPage';
import StudentSyllabusTrackingPage from '../pages/student/StudentSyllabusTrackingPage';
import FacultyTimetablePage from '../pages/faculty/FacultyTimetablePage';
import FacultySyllabusPage  from '../pages/faculty/FacultySyllabusPage';
import CCTimetablePage      from '../pages/cc/CCTimetablePage';
import CCSyllabusPage       from '../pages/cc/CCSyllabusPage';
import StudentFeedbackListPage from '../pages/feedback/StudentFeedbackListPage';

const HOD_ONLY = ({ children }) => (
  <ProtectedRoute allowedRoles={['hod']}>{children}</ProtectedRoute>
);

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/login"         element={<Login />} />
      <Route path="/access-denied" element={<AccessDenied />} />
      <Route path="/"              element={<RoleHomeRedirect />} />

      <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        {/* Student routes */}
        <Route path="/student" element={<ProtectedRoute allowedRoles={['student']}><StudentDashboard /></ProtectedRoute>} />
        <Route path="/student/syllabus-tracking" element={<ProtectedRoute allowedRoles={['student']}><StudentSyllabusTrackingPage /></ProtectedRoute>} />
        <Route path="/student/timetable" element={<ProtectedRoute allowedRoles={['student']}><StudentTimetablePage /></ProtectedRoute>} />
        <Route path="/student/subjects/:id/syllabus" element={<ProtectedRoute allowedRoles={['student']}><StudentSyllabusPage /></ProtectedRoute>} />

        {/* Faculty routes */}
        <Route path="/faculty" element={<ProtectedRoute allowedRoles={['faculty']}><FacultyDashboard /></ProtectedRoute>} />
        <Route path="/faculty/subjects" element={<ProtectedRoute allowedRoles={['faculty']}><FacultyDashboard /></ProtectedRoute>} />
        <Route path="/faculty/subjects/:id/syllabus" element={<ProtectedRoute allowedRoles={['faculty']}><FacultySyllabusPage /></ProtectedRoute>} />
        <Route path="/faculty/feedback" element={<ProtectedRoute allowedRoles={['faculty']}><StudentFeedbackListPage role="faculty" /></ProtectedRoute>} />
        <Route path="/faculty/timetable" element={<ProtectedRoute allowedRoles={['faculty']}><FacultyTimetablePage /></ProtectedRoute>} />

        {/* CC routes */}
        <Route path="/cc"      element={<ProtectedRoute allowedRoles={['cc']}><CCDashboard /></ProtectedRoute>} />
        <Route path="/cc/batches" element={<ProtectedRoute allowedRoles={['cc']}><CCDashboard /></ProtectedRoute>} />
        <Route path="/cc/subjects" element={<ProtectedRoute allowedRoles={['cc']}><CCDashboard /></ProtectedRoute>} />
        <Route path="/cc/subjects/:id/syllabus" element={<ProtectedRoute allowedRoles={['cc']}><CCSyllabusPage /></ProtectedRoute>} />
        <Route path="/cc/feedback" element={<ProtectedRoute allowedRoles={['cc', 'faculty']}><StudentFeedbackListPage role="cc" /></ProtectedRoute>} />
        <Route path="/cc/timetable" element={<ProtectedRoute allowedRoles={['cc']}><CCTimetablePage initialTab="class" /></ProtectedRoute>} />
        <Route path="/cc/my-schedule" element={<ProtectedRoute allowedRoles={['cc']}><CCTimetablePage initialTab="my" /></ProtectedRoute>} />

        {/* HOD Dashboard */}
        <Route path="/hod"     element={<ProtectedRoute allowedRoles={['hod']}><HODDashboard /></ProtectedRoute>} />
        <Route path="/hod/feedback" element={<HOD_ONLY><StudentFeedbackListPage role="hod" /></HOD_ONLY>} />

        {/* HOD Admin pages */}
        <Route path="/hod/admin/departments"    element={<HOD_ONLY><DepartmentsPage /></HOD_ONLY>} />
        <Route path="/hod/admin/academic-years" element={<HOD_ONLY><AcademicYearsPage /></HOD_ONLY>} />
        <Route path="/hod/admin/semesters"      element={<HOD_ONLY><SemestersPage /></HOD_ONLY>} />
        <Route path="/hod/admin/batches"        element={<HOD_ONLY><BatchesPage /></HOD_ONLY>} />
        <Route path="/hod/admin/divisions"      element={<HOD_ONLY><DivisionsPage /></HOD_ONLY>} />
        <Route path="/hod/admin/students"       element={<HOD_ONLY><StudentsPage /></HOD_ONLY>} />
        <Route path="/hod/admin/faculty"        element={<HOD_ONLY><FacultyPage /></HOD_ONLY>} />
        <Route path="/hod/admin/subjects"       element={<HOD_ONLY><SubjectsPage /></HOD_ONLY>} />
        <Route path="/hod/admin/assignments"    element={<HOD_ONLY><AssignmentsPage /></HOD_ONLY>} />
        <Route path="/hod/admin/import"         element={<HOD_ONLY><ImportPage /></HOD_ONLY>} />
        <Route path="/hod/admin/timetables"        element={<HOD_ONLY><TimetableListPage /></HOD_ONLY>} />
        <Route path="/hod/admin/timetables/import" element={<HOD_ONLY><TimetableImportWizard /></HOD_ONLY>} />
        <Route path="/hod/admin/timetables/:id"    element={<HOD_ONLY><TimetableDetailPage /></HOD_ONLY>} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}