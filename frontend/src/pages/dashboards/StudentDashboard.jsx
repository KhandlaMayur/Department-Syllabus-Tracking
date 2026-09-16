import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import masterApi from '../../api/masterApi';
import '../../styles/admin.css';
import '../../styles/responsive.css';

export default function StudentDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [studentInfo, setStudentInfo] = useState(null);
  const [subjects,    setSubjects]    = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState('');

  useEffect(() => {
    async function load() {
      try {
        // Get student info (batch, semester, etc.)
        const meRes = await masterApi.students.me();
        const student = meRes.data.data;
        setStudentInfo(student);

        if (!student) {
          setLoading(false);
          return;
        }

        // Fetch subjects for the student's department/batch
        // Students have batch_id and user.department_id
        const deptId = user?.department_id;
        if (deptId) {
          const sRes = await masterApi.subjects.list({ departmentId: deptId, limit: 100 });
          setSubjects(sRes.data.data?.rows || []);
        }
      } catch (e) {
        console.error('Failed to load student data:', e);
        if (e?.response?.status === 404) {
          setError('Student profile not found. Please contact your administrator.');
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [user]);

  // Group subjects by semester
  const grouped = {};
  for (const s of subjects) {
    const sem = s.semester_number || 0;
    if (!grouped[sem]) grouped[sem] = [];
    grouped[sem].push(s);
  }
  const sortedSemesters = Object.keys(grouped).sort((a, b) => Number(a) - Number(b));

  return (
    <div className="admin-page">
      <div style={{ marginBottom: 8 }}>
        <h1 className="admin-page__title">
          Welcome, {user?.name?.split(' ')[0] || 'Student'} 👋
        </h1>
        <p className="admin-page__subtitle">
          Track syllabus progress for your enrolled subjects
        </p>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--admin-text-muted)' }}>Loading your subjects…</div>
      ) : error ? (
        <div className="card" style={{ textAlign: 'center', padding: '48px 24px' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>⚠️</div>
          <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--admin-text)' }}>{error}</div>
        </div>
      ) : subjects.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '48px 24px' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>📚</div>
          <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--admin-text)' }}>No subjects available yet</div>
          <div style={{ fontSize: '0.875rem', color: 'var(--admin-text-muted)', marginTop: 4 }}>
            Once subjects are set up for your department, they will appear here.
          </div>
        </div>
      ) : (
        <div>
          {/* Student info card */}
          {studentInfo && (
            <div className="stat-cards" style={{ marginBottom: 24 }}>
              <div className="stat-card">
                <div className="stat-card__icon">🎓</div>
                <div className="stat-card__label">Enrollment</div>
                <div className="stat-card__value" style={{ fontSize: '1.25rem' }}>{studentInfo.enrollment_number}</div>
              </div>
              <div className="stat-card">
                <div className="stat-card__icon">👥</div>
                <div className="stat-card__label">Batch</div>
                <div className="stat-card__value" style={{ fontSize: '1.25rem' }}>{studentInfo.batch_name || studentInfo.batch || '—'}</div>
              </div>
              <div className="stat-card">
                <div className="stat-card__icon">📅</div>
                <div className="stat-card__label">Semester</div>
                <div className="stat-card__value">{studentInfo.semester || '—'}</div>
              </div>
              <div className="stat-card">
                <div className="stat-card__icon">📚</div>
                <div className="stat-card__label">Subjects</div>
                <div className="stat-card__value">{subjects.length}</div>
              </div>
            </div>
          )}

          {/* Semester-wise subjects */}
          {sortedSemesters.map(sem => (
            <div key={sem} className="semester-group">
              <h3 className="semester-group__title">Semester {sem}</h3>
              <div className="subject-cards">
                {grouped[sem].map(s => (
                  <div
                    key={s.id}
                    className="subject-card"
                    onClick={() => navigate(`/student/subjects/${s.id}/syllabus?batchId=${studentInfo?.batch_id || ''}&semesterNumber=${sem}`)}
                  >
                    <div className="subject-card__header">
                      <h4 className="subject-card__name">{s.name}</h4>
                      <span className="subject-card__code">{s.code}</span>
                    </div>
                    <div className="subject-card__meta">
                      {s.credits} credits • {s.department_name}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
