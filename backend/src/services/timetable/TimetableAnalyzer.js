class TimetableAnalyzer {
  /**
   * Analyzes parsed entries in-memory before or after saving
   */
  static analyze(entries) {
    const subjectsMap = new Map();
    const facultyMap = new Map();
    const dayMap = {
      Monday: { count: 0, minutes: 0 },
      Tuesday: { count: 0, minutes: 0 },
      Wednesday: { count: 0, minutes: 0 },
      Thursday: { count: 0, minutes: 0 },
      Friday: { count: 0, minutes: 0 },
      Saturday: { count: 0, minutes: 0 },
    };

    let totalMinutes = 0;
    let lectureSlots = 0;
    let labSlots = 0;

    for (const e of entries) {
      const duration = e.durationMinutes || 55;
      totalMinutes += duration;

      if (e.entryType === 'lab') {
        labSlots++;
      } else {
        lectureSlots++;
      }

      // Day analysis
      if (dayMap[e.day]) {
        dayMap[e.day].count++;
        dayMap[e.day].minutes += duration;
      }

      // Subject analysis
      const sKey = e.subjectCodeRaw || 'UNKNOWN';
      if (!subjectsMap.has(sKey)) {
        subjectsMap.set(sKey, {
          subjectCode: sKey,
          subjectName: e.subjectNameRaw || sKey,
          subjectId: e.subjectId || null,
          lectures: 0,
          labs: 0,
          totalSlots: 0,
          totalMinutes: 0,
          facultyInitials: new Set(),
        });
      }
      const sItem = subjectsMap.get(sKey);
      sItem.totalSlots++;
      sItem.totalMinutes += duration;
      if (e.entryType === 'lab') sItem.labs++;
      else sItem.lectures++;
      if (e.facultyInitial) sItem.facultyInitials.add(e.facultyInitial);

      // Faculty analysis
      const fKey = e.facultyInitial || (e.facultyId ? `FAC_${e.facultyId}` : 'UNASSIGNED');
      if (!facultyMap.has(fKey)) {
        facultyMap.set(fKey, {
          facultyInitial: e.facultyInitial || null,
          facultyId: e.facultyId || null,
          facultyName: e.facultyName || e.facultyInitial || 'Unassigned',
          totalSlots: 0,
          totalMinutes: 0,
          subjects: new Set(),
        });
      }
      const fItem = facultyMap.get(fKey);
      fItem.totalSlots++;
      fItem.totalMinutes += duration;
      if (e.subjectCodeRaw) fItem.subjects.add(e.subjectCodeRaw);
    }

    const subjectStats = Array.from(subjectsMap.values()).map(s => ({
      ...s,
      totalHours: Number((s.totalMinutes / 60).toFixed(2)),
      facultyInitials: Array.from(s.facultyInitials),
    }));

    const facultyStats = Array.from(facultyMap.values()).map(f => ({
      ...f,
      totalHours: Number((f.totalMinutes / 60).toFixed(2)),
      subjects: Array.from(f.subjects),
    }));

    const dayStats = Object.entries(dayMap).map(([day, val]) => ({
      day,
      slotCount: val.count,
      totalHours: Number((val.minutes / 60).toFixed(2)),
    }));

    return {
      summary: {
        totalEntries: entries.length,
        totalHours: Number((totalMinutes / 60).toFixed(2)),
        distinctSubjects: subjectsMap.size,
        distinctFaculty: facultyMap.size,
        lectureSlots,
        labSlots,
      },
      subjectStats,
      facultyStats,
      dayStats,
    };
  }
}

module.exports = TimetableAnalyzer;
