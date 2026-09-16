import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import timetableApi from '../../../api/timetableApi';
import masterApi from '../../../api/masterApi';
import '../../../styles/timetable.css';

const STEPS = [
  { step: 1, label: 'Upload File' },
  { step: 2, label: 'Select Target' },
  { step: 3, label: 'Validation & Conflicts' },
  { step: 4, label: 'Subject / Faculty Mapping' },
  { step: 5, label: 'Finalize & Import' },
];

export default function TimetableImportWizard() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [currentStep, setCurrentStep] = useState(1);
  const [file, setFile] = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Target Scope
  const [academicYears, setAcademicYears] = useState([]);
  const [semesters, setSemesters] = useState([]);
  const [divisions, setDivisions] = useState([]);
  const [selectedAy, setSelectedAy] = useState('');
  const [selectedSem, setSelectedSem] = useState('');
  const [selectedDiv, setSelectedDiv] = useState('');

  // Processing & Preview Data
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [error, setError] = useState(null);

  // Commit state
  const [committing, setCommitting] = useState(false);
  const [archivePrevious, setArchivePrevious] = useState(true);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    loadDropdowns();
  }, []);

  async function loadDropdowns() {
    try {
      const [ayRes, semRes, divRes] = await Promise.all([
        masterApi.academicYears.list({ limit: 50 }),
        masterApi.semesters.list({ limit: 50 }),
        masterApi.divisions.list({ limit: 100 }),
      ]);
      setAcademicYears(ayRes.data?.data?.rows || []);
      setSemesters(semRes.data?.data?.rows || []);
      setDivisions(divRes.data?.data?.rows || []);
    } catch (err) {
      console.warn('Failed to load target dropdowns:', err);
    }
  }

  function handleFileDrop(e) {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processSelectedFile(e.dataTransfer.files[0]);
    }
  }

  function handleFileChange(e) {
    if (e.target.files && e.target.files[0]) {
      processSelectedFile(e.target.files[0]);
    }
  }

  function processSelectedFile(selected) {
    const ext = selected.name.split('.').pop().toLowerCase();
    if (!['pdf', 'xlsx', 'xls', 'png', 'jpg', 'jpeg', 'webp'].includes(ext)) {
      setError('Invalid file type. Please upload a PDF, Excel (.xlsx, .xls), or Image (.png, .jpg).');
      return;
    }
    setFile(selected);
    setError(null);
    setCurrentStep(2);
  }

  async function handleRunPreview() {
    if (!selectedAy || !selectedSem) {
      setError('Please select an Academic Year and Semester.');
      return;
    }

    setLoadingPreview(true);
    setError(null);
    try {
      const res = await timetableApi.preview({
        file,
        academicYearId: selectedAy,
        semesterId: selectedSem,
        divisionId: selectedDiv || null,
        onProgress: p => setUploadProgress(p),
      });

      setPreviewData(res.data?.data);
      setCurrentStep(3);
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message || 'Failed to parse timetable file.');
    } finally {
      setLoadingPreview(false);
    }
  }

  async function handleCommitImport() {
    if (!previewData || !previewData.entries.length) return;

    setCommitting(true);
    setError(null);
    try {
      const res = await timetableApi.commit({
        academicYearId: selectedAy,
        semesterId: selectedSem,
        divisionId: selectedDiv || null,
        fileName: file.name,
        fileType: file.type,
        sourceFormat: previewData.sourceFormat,
        entries: previewData.entries,
        notes,
        archivePrevious,
      });

      const newId = res.data?.data?.timetable?.id;
      navigate(`/hod/admin/timetables/${newId}?imported=true`);
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message || 'Import commit failed.');
      setCommitting(false);
    }
  }

  return (
    <div className="tt-container">
      {/* Title */}
      <div className="tt-header">
        <div className="tt-title-group">
          <h1>📤 Import Academic Timetable</h1>
          <p className="tt-subtitle">
            Upload PDF, Excel, or scanned Image timetables. Automatically extract slots, detect conflicts, and analyze hours.
          </p>
        </div>
      </div>

      {/* Step Indicators */}
      <div className="tt-wizard-steps">
        {STEPS.map(s => {
          const isActive = currentStep === s.step;
          const isCompleted = currentStep > s.step;
          return (
            <div
              key={s.step}
              className={`tt-step-item ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}
              onClick={() => {
                if (isCompleted) setCurrentStep(s.step);
              }}
            >
              <div className="tt-step-circle">
                {isCompleted ? '✓' : s.step}
              </div>
              <span>{s.label}</span>
            </div>
          );
        })}
      </div>

      {error && (
        <div className="tt-alert tt-alert-danger">
          <span>⚠️ {error}</span>
        </div>
      )}

      {/* Step 1: Upload File */}
      {currentStep === 1 && (
        <div style={{ background: '#fff', padding: '32px', borderRadius: '12px', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
          <h2 style={{ fontSize: '1.25rem', marginTop: 0, marginBottom: '8px' }}>Step 1: Select Timetable Document</h2>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', marginBottom: '24px' }}>
            Supported formats: PDF (.pdf), Excel matrix/table (.xlsx, .xls), or Images (.png, .jpg).
          </p>

          <div
            className={`tt-dropzone ${isDragOver ? 'drag-active' : ''}`}
            onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleFileDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              style={{ display: 'none' }}
              accept=".pdf,.xlsx,.xls,.png,.jpg,.jpeg,.webp"
              onChange={handleFileChange}
            />
            <div className="tt-dropzone-icon">📄</div>
            <div className="tt-dropzone-title">Click to upload or drag & drop file here</div>
            <div className="tt-dropzone-subtitle">PDF, XLSX, XLS, PNG, JPG (up to 25 MB)</div>
          </div>
        </div>
      )}

      {/* Step 2: Target Scope Selection */}
      {currentStep === 2 && (
        <div style={{ background: '#fff', padding: '32px', borderRadius: '12px', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
          <h2 style={{ fontSize: '1.25rem', marginTop: 0, marginBottom: '8px' }}>Step 2: Assign Target Semester & Division</h2>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', marginBottom: '24px' }}>
            Selected file: <strong>{file?.name}</strong> ({(file?.size / 1024).toFixed(1)} KB)
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', marginBottom: '28px' }}>
            <div className="tt-filter-item">
              <label>Academic Year *</label>
              <select
                className="tt-filter-select"
                value={selectedAy}
                onChange={e => setSelectedAy(e.target.value)}
                required
              >
                <option value="">Select Academic Year</option>
                {academicYears.map(ay => (
                  <option key={ay.id} value={ay.id}>{ay.year_name || ay.label}</option>
                ))}
              </select>
            </div>

            <div className="tt-filter-item">
              <label>Semester *</label>
              <select
                className="tt-filter-select"
                value={selectedSem}
                onChange={e => setSelectedSem(e.target.value)}
                required
              >
                <option value="">Select Semester</option>
                {semesters.map(s => (
                  <option key={s.id} value={s.id}>Semester {s.number}</option>
                ))}
              </select>
            </div>

            <div className="tt-filter-item">
              <label>Division (Optional)</label>
              <select
                className="tt-filter-select"
                value={selectedDiv}
                onChange={e => setSelectedDiv(e.target.value)}
              >
                <option value="">All / Entire Semester</option>
                {divisions
                  .filter(d => !selectedSem || String(d.semester_id) === String(selectedSem))
                  .map(d => (
                    <option key={d.id} value={d.id}>Division {d.name}</option>
                  ))}
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button
              type="button"
              className="tt-btn tt-btn-secondary"
              onClick={() => setCurrentStep(1)}
            >
              Back
            </button>
            <button
              type="button"
              className="tt-btn tt-btn-primary"
              disabled={loadingPreview || !selectedAy || !selectedSem}
              onClick={handleRunPreview}
            >
              {loadingPreview ? 'Extracting & Validating...' : 'Parse & Validate →'}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Validation & Conflict Detection */}
      {currentStep === 3 && previewData && (
        <div style={{ background: '#fff', padding: '32px', borderRadius: '12px', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
          <h2 style={{ fontSize: '1.25rem', marginTop: 0, marginBottom: '8px' }}>Step 3: Validation & Conflict Report</h2>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', marginBottom: '20px' }}>
            File parsed as <strong>{previewData.sourceFormat.toUpperCase()}</strong>. Extracted {previewData.totalSlots} timetable slots.
          </p>

          {/* Duplicate warning */}
          {previewData.duplicateWarning && (
            <div className="tt-alert tt-alert-warning">
              <div>
                <strong>🔄 Duplicate Timetable Detected:</strong>
                <div>{previewData.duplicateWarning.message}</div>
              </div>
            </div>
          )}

          {/* Conflict list */}
          {previewData.conflicts && previewData.conflicts.length > 0 ? (
            <div style={{ marginBottom: '24px' }}>
              <h3 style={{ fontSize: '1rem', color: '#991b1b', marginBottom: '10px' }}>
                ⚠️ Found {previewData.conflicts.length} Potential Conflict(s):
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {previewData.conflicts.map((c, i) => (
                  <div key={i} className={`tt-alert ${c.severity === 'error' ? 'tt-alert-danger' : 'tt-alert-warning'}`}>
                    <span>{c.message}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="tt-alert tt-alert-success">
              <span>✅ Zero schedule or room conflicts detected! All slots are valid.</span>
            </div>
          )}

          {/* Stat summary */}
          <div className="tt-stat-grid" style={{ marginTop: '20px' }}>
            <div className="tt-stat-card">
              <span className="tt-stat-label">Total Slots</span>
              <span className="tt-stat-val">{previewData.analysis?.summary?.totalEntries || 0}</span>
              <span className="tt-stat-desc">Parsed from file</span>
            </div>
            <div className="tt-stat-card">
              <span className="tt-stat-label">Total Weekly Hours</span>
              <span className="tt-stat-val">{previewData.analysis?.summary?.totalHours || 0} hrs</span>
              <span className="tt-stat-desc">Calculated duration</span>
            </div>
            <div className="tt-stat-card">
              <span className="tt-stat-label">Distinct Subjects</span>
              <span className="tt-stat-val">{previewData.analysis?.summary?.distinctSubjects || 0}</span>
              <span className="tt-stat-desc">Courses identified</span>
            </div>
            <div className="tt-stat-card">
              <span className="tt-stat-label">Distinct Faculty</span>
              <span className="tt-stat-val">{previewData.analysis?.summary?.distinctFaculty || 0}</span>
              <span className="tt-stat-desc">Instructors involved</span>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '28px' }}>
            <button type="button" className="tt-btn tt-btn-secondary" onClick={() => setCurrentStep(2)}>
              Back
            </button>
            <button type="button" className="tt-btn tt-btn-primary" onClick={() => setCurrentStep(4)}>
              Review Mappings →
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Subject & Faculty Mapping */}
      {currentStep === 4 && previewData && (
        <div style={{ background: '#fff', padding: '32px', borderRadius: '12px', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
          <h2 style={{ fontSize: '1.25rem', marginTop: 0, marginBottom: '8px' }}>Step 4: Review Subject & Faculty Mappings</h2>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', marginBottom: '20px' }}>
            Verify how parsed subject codes and faculty initials correspond to database entities.
          </p>

          <div className="form-grid-2" style={{ gap: '20px', marginBottom: '28px' }}>
            {/* Unmapped subjects */}
            <div style={{ border: '1px solid var(--color-border)', borderRadius: '8px', padding: '16px' }}>
              <h3 style={{ margin: '0 0 10px 0', fontSize: '1rem', color: 'var(--color-text)' }}>
                Subjects Mapping Status
              </h3>
              {previewData.unmappedSubjects?.length > 0 ? (
                <div>
                  <div style={{ fontSize: '0.82rem', color: '#b45309', marginBottom: '8px' }}>
                    ⚠️ {previewData.unmappedSubjects.length} subject(s) not matched with database codes:
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {previewData.unmappedSubjects.map((s, i) => (
                      <span key={i} className="tt-badge" style={{ background: '#fef3c7', color: '#92400e' }}>
                        {s}
                      </span>
                    ))}
                  </div>
                  <p style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginTop: '8px' }}>
                    These slots will be stored with their raw codes and can be linked to subjects anytime.
                  </p>
                </div>
              ) : (
                <div className="tt-alert tt-alert-success" style={{ margin: 0 }}>
                  <span>✅ All subject codes matched with database subjects.</span>
                </div>
              )}
            </div>

            {/* Unmapped faculty */}
            <div style={{ border: '1px solid var(--color-border)', borderRadius: '8px', padding: '16px' }}>
              <h3 style={{ margin: '0 0 10px 0', fontSize: '1rem', color: 'var(--color-text)' }}>
                Faculty Mapping Status
              </h3>
              {previewData.unmappedFaculty?.length > 0 ? (
                <div>
                  <div style={{ fontSize: '0.82rem', color: '#b45309', marginBottom: '8px' }}>
                    ⚠️ {previewData.unmappedFaculty.length} faculty initial(s) unmapped:
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {previewData.unmappedFaculty.map((f, i) => (
                      <span key={i} className="tt-badge" style={{ background: '#fef3c7', color: '#92400e' }}>
                        {f}
                      </span>
                    ))}
                  </div>
                  <p style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginTop: '8px' }}>
                    Add them to the Faculty Initials Map to link them to specific user profiles.
                  </p>
                </div>
              ) : (
                <div className="tt-alert tt-alert-success" style={{ margin: 0 }}>
                  <span>✅ All faculty initials mapped successfully.</span>
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <button type="button" className="tt-btn tt-btn-secondary" onClick={() => setCurrentStep(3)}>
              Back
            </button>
            <button type="button" className="tt-btn tt-btn-primary" onClick={() => setCurrentStep(5)}>
              Proceed to Finalize →
            </button>
          </div>
        </div>
      )}

      {/* Step 5: Finalize & Import */}
      {currentStep === 5 && previewData && (
        <div style={{ background: '#fff', padding: '32px', borderRadius: '12px', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
          <h2 style={{ fontSize: '1.25rem', marginTop: 0, marginBottom: '8px' }}>Step 5: Confirm & Import Timetable</h2>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', marginBottom: '24px' }}>
            Review the final settings before committing the timetable into the database.
          </p>

          <div style={{ background: 'var(--color-surface)', padding: '18px 22px', borderRadius: '10px', marginBottom: '24px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
              <div>
                <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', display: 'block' }}>File</span>
                <strong>{file?.name}</strong>
              </div>
              <div>
                <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', display: 'block' }}>Total Slots</span>
                <strong>{previewData.entries.length} slots</strong>
              </div>
              <div>
                <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', display: 'block' }}>Version</span>
                <strong>{previewData.duplicateWarning ? 'New Version (v+1)' : 'Version 1'}</strong>
              </div>
            </div>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '0.95rem' }}>
              <input
                type="checkbox"
                checked={archivePrevious}
                onChange={e => setArchivePrevious(e.target.checked)}
                style={{ width: '18px', height: '18px' }}
              />
              <span>Archive previous active version for this semester/division</span>
            </label>
          </div>

          <div style={{ marginBottom: '28px' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text)', marginBottom: '6px' }}>
              Notes (Optional)
            </label>
            <textarea
              className="tt-input"
              style={{ width: '100%', height: '80px', padding: '10px' }}
              placeholder="e.g. Approved by Department Committee on Sept 10"
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button type="button" className="tt-btn tt-btn-secondary" onClick={() => setCurrentStep(4)}>
              Back
            </button>
            <button
              type="button"
              className="tt-btn tt-btn-primary"
              disabled={committing}
              onClick={handleCommitImport}
              style={{ padding: '12px 28px', fontSize: '1rem' }}
            >
              {committing ? 'Importing...' : 'Confirm & Commit Timetable ✓'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
