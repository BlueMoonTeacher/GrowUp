import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Student, AttendanceRecord, AttendanceType, AttendanceCategory } from '../types';
import { AppSettings } from '../App';
import { auth } from '../firebase';
import { ATTENDANCE_SYMBOLS, getAttendanceSymbol, getAttendanceSymbolColorClass, ATTENDANCE_TYPES } from '../utils/attendanceUtils';
import { useModal } from '../context/ModalContext';

interface AttendanceOverviewProps {
  students: Student[];
  settings: AppSettings;
  onSelectStudent: (student: Student) => void;
  onUpdateStudent: (student: Student) => Promise<void>;
}

type OverviewPanel = 'table' | 'missingDocs' | 'specialNotes';

interface AttendanceRecordGroup {
  startDate: string;
  endDate: string;
  type: AttendanceType;
  category: AttendanceCategory;
  note: string;
  documents: AttendanceRecord['documents'];
}

const getRecordContentKey = (record: AttendanceRecord) => JSON.stringify({
  type: record.type,
  category: record.category,
  note: record.note?.trim() || '',
});

const mergeDocuments = (current: AttendanceRecord['documents'], incoming: AttendanceRecord['documents']) => {
  const merged = new Map<string, boolean>();
  [...(current || []), ...(incoming || [])].forEach(doc => {
    merged.set(doc.name, (merged.get(doc.name) ?? true) && doc.submitted);
  });
  return Array.from(merged, ([name, submitted]) => ({ name, submitted }));
};

const isNextCalendarDay = (previousDate: string, nextDate: string) => {
  const previous = new Date(`${previousDate}T00:00:00`);
  previous.setDate(previous.getDate() + 1);
  const expected = `${previous.getFullYear()}-${String(previous.getMonth() + 1).padStart(2, '0')}-${String(previous.getDate()).padStart(2, '0')}`;
  return expected === nextDate;
};

const groupConsecutiveRecords = (records: AttendanceRecord[]): AttendanceRecordGroup[] => {
  return records.reduce<AttendanceRecordGroup[]>((groups, record, index) => {
    const previousRecord = records[index - 1];
    const currentGroup = groups[groups.length - 1];
    if (currentGroup && previousRecord && isNextCalendarDay(previousRecord.date, record.date) && getRecordContentKey(previousRecord) === getRecordContentKey(record)) {
      currentGroup.endDate = record.date;
      currentGroup.documents = mergeDocuments(currentGroup.documents, record.documents || []);
      return groups;
    }
    groups.push({
      startDate: record.date,
      endDate: record.date,
      type: record.type,
      category: record.category,
      note: record.note?.trim() || '',
      documents: record.documents || [],
    });
    return groups;
  }, []);
};

const formatPeriod = (startDate: string, endDate: string) => {
  const format = (date: string) => `${date.slice(5, 7)}.${date.slice(8, 10)}.`;
  return startDate === endDate ? format(startDate) : `${format(startDate)} ~ ${format(endDate)}`;
};

interface PrintDetailRow {
  student: Student;
  record: AttendanceRecord;
}

const formatPrintDate = (date: string) => `${date.slice(0, 4)}.${date.slice(5, 7)}.${date.slice(8, 10)}.`;

const getAttendanceDivision = (record: AttendanceRecord) => `${record.category === '인정' ? '출석인정' : record.category}${record.type}`;

const getMissedPeriods = (record: AttendanceRecord) => {
  if (record.type === '결석') return '조회,1,2,3,4,5,6,종례';
  if (record.type === '지각') return '조회';
  if (record.type === '조퇴') return '해당 교시 이후';
  return '해당 교시';
};

const getDetailNote = (record: AttendanceRecord) => {
  if (record.note?.trim()) return record.note.trim();
  const documentNames = (record.documents || []).map(document => document.name);
  return documentNames.join(', ') || '-';
};

const NeisDetailTable = ({ rows }: { rows: PrintDetailRow[] }) => {
  return (
    <table className="neis-detail-table">
      <thead><tr><th>번호</th><th>성명</th><th>일자</th><th>출결구분</th><th>결시교시</th><th>비고</th></tr></thead>
      <tbody>
        {rows.length > 0 ? rows.map(({ student, record }, index) => {
          const isFirstStudentRow = index === 0 || rows[index - 1].student.id !== student.id;
          let rowSpan = 1;
          if (isFirstStudentRow) {
            while (index + rowSpan < rows.length && rows[index + rowSpan].student.id === student.id) rowSpan++;
          }
          return (
            <tr key={`${student.id}-${record.id}-${record.date}`}>
              {isFirstStudentRow && <td rowSpan={rowSpan}>{student.number}</td>}
              {isFirstStudentRow && <td rowSpan={rowSpan}>{student.name.hangul}</td>}
              <td>{formatPrintDate(record.date)}</td>
              <td>{getAttendanceDivision(record)}</td>
              <td>{getMissedPeriods(record)}</td>
              <td>{getDetailNote(record)}</td>
            </tr>
          );
        }) : <tr><td colSpan={6} className="neis-detail-empty">해당 월의 출결 상세 기록이 없습니다.</td></tr>}
      </tbody>
    </table>
  );
};

const AttendanceOverview = ({ students, settings, onSelectStudent, onUpdateStudent }: AttendanceOverviewProps): React.ReactElement => {
  const { showAlert, showConfirm } = useModal();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [activePanel, setActivePanel] = useState<OverviewPanel>('table');
  const [isBulkSubmittingDocs, setIsBulkSubmittingDocs] = useState(false);
  const [isPortraitDisplay, setIsPortraitDisplay] = useState(() => typeof window !== 'undefined' && window.matchMedia('(orientation: portrait)').matches);
  const [portraitHalf, setPortraitHalf] = useState<'first' | 'second'>('first');

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const visibleDays = isPortraitDisplay
    ? days.filter(day => portraitHalf === 'first' ? day <= 15 : day >= 16)
    : days;

  useEffect(() => {
    const mediaQuery = window.matchMedia('(orientation: portrait)');
    const handleChange = (event: MediaQueryListEvent) => setIsPortraitDisplay(event.matches);
    setIsPortraitDisplay(mediaQuery.matches);
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const sortedStudents = useMemo(() => {
    return [...students].sort((a, b) => {
      const numA = parseInt(a.number, 10) || Infinity;
      const numB = parseInt(b.number, 10) || Infinity;
      return numA - numB;
    });
  }, [students]);

  const monthlyRecordsByStudent = useMemo(() => {
    const map = new Map<string, AttendanceRecord[]>();
    sortedStudents.forEach(student => {
      const records = (student.attendanceRecords || [])
        .filter(record => {
          const recordDate = new Date(record.date);
          return recordDate.getFullYear() === year && recordDate.getMonth() === month;
        })
        .sort((a, b) => a.date.localeCompare(b.date));
      map.set(student.id, records);
    });
    return map;
  }, [sortedStudents, year, month]);

  const monthlyTotals = useMemo(() => {
    const totals: Record<AttendanceType, number> = { '결석': 0, '지각': 0, '조퇴': 0, '결과': 0 };
    monthlyRecordsByStudent.forEach(records => records.forEach(record => totals[record.type]++));
    return totals;
  }, [monthlyRecordsByStudent]);

  const specialNotesStudents = useMemo(() => {
    return sortedStudents
      .map(student => {
        const records = monthlyRecordsByStudent.get(student.id) || [];
        return { student, records, groups: groupConsecutiveRecords(records) };
      })
      .filter(item => item.records.length > 0);
  }, [sortedStudents, monthlyRecordsByStudent]);

  const missingDocsList = useMemo(() => {
    const list: { student: Student; record: AttendanceRecord; docName: string }[] = [];
    specialNotesStudents.forEach(({ student, records }) => {
      records.forEach(record => {
        (record.documents || []).forEach(doc => {
          if (!doc.submitted) list.push({ student, record, docName: doc.name });
        });
      });
    });
    return list.sort((a, b) => a.record.date.localeCompare(b.record.date));
  }, [specialNotesStudents]);

  const printDetailRows = useMemo<PrintDetailRow[]>(() => {
    return specialNotesStudents.flatMap(({ student, records }) => records.map(record => ({ student, record })));
  }, [specialNotesStudents]);

  const firstPageDetailRows = printDetailRows.slice(0, 4);
  const continuationDetailPages = useMemo(() => {
    const pages: PrintDetailRow[][] = [];
    const remaining = printDetailRows.slice(4);
    for (let index = 0; index < remaining.length; index += 16) pages.push(remaining.slice(index, index + 16));
    return pages;
  }, [printDetailRows]);

  const printDays = days.filter(day => {
    const dayOfWeek = new Date(year, month, day).getDay();
    return dayOfWeek !== 0 && dayOfWeek !== 6;
  });
  const maleCount = sortedStudents.filter(student => student.gender?.startsWith('남')).length;
  const femaleCount = sortedStudents.filter(student => student.gender?.startsWith('여')).length;
  const printNow = new Date();
  const printDateLabel = `${printNow.getFullYear()}.${String(printNow.getMonth() + 1).padStart(2, '0')}.${String(printNow.getDate()).padStart(2, '0')}.`;
  const teacherName = auth.currentUser?.displayName || '담임';

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
    setActivePanel('table');
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
    setActivePanel('table');
  };

  const togglePanel = (panel: Exclude<OverviewPanel, 'table'>) => {
    setActivePanel(current => current === panel ? 'table' : panel);
  };

  const handlePrint = () => window.print();

  const handleBulkSubmitDocuments = async () => {
    if (missingDocsList.length === 0 || isBulkSubmittingDocs) return;
    const affectedStudents = sortedStudents.filter(student =>
      (monthlyRecordsByStudent.get(student.id) || []).some(record => (record.documents || []).some(document => !document.submitted))
    );
    const confirmed = await showConfirm(
      `${year}년 ${month + 1}월 미제출 서류 ${missingDocsList.length}건을 모두 제출완료로 변경하시겠습니까?\n대상 학생: ${affectedStudents.length}명`,
      '제출서류 일괄 확인',
      '모두 제출 처리'
    );
    if (!confirmed) return;

    setIsBulkSubmittingDocs(true);
    try {
      await Promise.all(affectedStudents.map(student => {
        const attendanceRecords = (student.attendanceRecords || []).map(record => {
          const recordDate = new Date(record.date);
          const isSelectedMonth = recordDate.getFullYear() === year && recordDate.getMonth() === month;
          if (!isSelectedMonth || !(record.documents || []).some(document => !document.submitted)) return record;
          return {
            ...record,
            documents: (record.documents || []).map(document => ({ ...document, submitted: true }))
          };
        });
        return onUpdateStudent({ ...student, attendanceRecords });
      }));
      await showAlert(`${month + 1}월 미제출 서류 ${missingDocsList.length}건을 모두 제출완료로 처리했습니다.`, '일괄 처리 완료');
    } catch (error) {
      console.error('Failed to submit attendance documents in bulk:', error);
      await showAlert('서류 일괄 처리 중 오류가 발생했습니다. 다시 시도해 주세요.');
    } finally {
      setIsBulkSubmittingDocs(false);
    }
  };

  const getStudentMonthData = (student: Student) => {
    const records = monthlyRecordsByStudent.get(student.id) || [];
    const recordsByDay = new Map(records.map(record => [Number(record.date.slice(8, 10)), record]));
    const summary: Record<AttendanceType, number> = { '결석': 0, '지각': 0, '조퇴': 0, '결과': 0 };
    records.forEach(record => summary[record.type]++);
    return { records, recordsByDay, summary };
  };

  return (
    <>
      <div className="relative flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-base-300/80 bg-white shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-gray-300 bg-base-50 p-4">
          <div className="flex flex-wrap items-center gap-4">
            <h2 className="flex items-center gap-2 text-lg font-bold text-base-content">
              <span className="text-2xl">📊</span> 월별 출결 현황
            </h2>
            <div className="flex items-center gap-2 rounded-lg border border-base-300 bg-white px-3 py-1 shadow-sm">
              <button onClick={handlePrevMonth} className="rounded-full p-1 hover:bg-base-100" aria-label="이전 달">
                <svg className="h-5 w-5 text-base-content-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              </button>
              <span className="w-24 text-center font-bold text-base-content">{year}년 {month + 1}월</span>
              <button onClick={handleNextMonth} className="rounded-full p-1 hover:bg-base-100" aria-label="다음 달">
                <svg className="h-5 w-5 text-base-content-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            {isPortraitDisplay && (
              <div className="flex rounded-lg border border-base-300 bg-white p-1 shadow-sm">
                <button onClick={() => setPortraitHalf('first')} className={`rounded-md px-3 py-1 text-xs font-bold transition-colors ${portraitHalf === 'first' ? 'bg-primary text-white' : 'text-base-content-secondary hover:bg-base-100'}`}>1–15일</button>
                <button onClick={() => setPortraitHalf('second')} className={`rounded-md px-3 py-1 text-xs font-bold transition-colors ${portraitHalf === 'second' ? 'bg-primary text-white' : 'text-base-content-secondary hover:bg-base-100'}`}>16–말일</button>
              </div>
            )}
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-bold text-base-content shadow-sm transition-colors hover:bg-gray-100"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6z" /></svg>
              인쇄
            </button>
            <button
              onClick={() => togglePanel('specialNotes')}
              className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-bold shadow-sm transition-all ${activePanel === 'specialNotes' ? 'border-primary bg-primary text-primary-content' : 'border-base-300 bg-white text-base-content hover:bg-base-50'}`}
            >
              <span>🗂️</span>
              특기사항 학생
              <span className={`rounded-full px-1.5 text-xs ${activePanel === 'specialNotes' ? 'bg-white/25 text-white' : 'bg-primary/10 text-primary'}`}>{specialNotesStudents.length}</span>
            </button>
            <button
              onClick={() => togglePanel('missingDocs')}
              className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-bold shadow-sm transition-all ${activePanel === 'missingDocs' ? 'border-primary bg-primary text-primary-content' : 'border-base-300 bg-white text-base-content hover:bg-base-50'}`}
            >
              <span>📑</span>
              미제출 서류
              {missingDocsList.length > 0 && <span className="rounded-full bg-red-500 px-1.5 text-xs text-white">{missingDocsList.length}</span>}
            </button>
            <div className="hidden items-center gap-3 border-l border-base-300 pl-3 text-xs text-base-content-secondary sm:flex">
              {ATTENDANCE_TYPES.map(type => (
                <div key={type.type} className="flex items-center gap-1.5 rounded-md border border-base-200 bg-base-100 px-2 py-1">
                  <span className="font-bold text-base-content">{type.label}</span>
                  <span className="font-extrabold text-primary">{monthlyTotals[type.type]}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="relative min-h-0 flex-1 overflow-hidden">
          {activePanel === 'missingDocs' && (
            <div className="absolute inset-0 z-20 overflow-y-auto bg-base-50 p-4 pb-20 custom-scrollbar">
              <div className="mx-auto max-w-4xl">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <h3 className="flex items-center gap-2 text-lg font-bold text-base-content">
                    <span className="text-red-500">⚠️</span> {month + 1}월 미제출 증빙서류 목록
                  </h3>
                  {missingDocsList.length > 0 && (
                    <button
                      type="button"
                      onClick={handleBulkSubmitDocuments}
                      disabled={isBulkSubmittingDocs}
                      className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white shadow-sm transition-colors hover:bg-primary-focus disabled:cursor-wait disabled:opacity-60"
                    >
                      {isBulkSubmittingDocs && <span className="loading loading-spinner loading-xs" />}
                      제출서류 일괄 확인
                    </button>
                  )}
                </div>
                {missingDocsList.length > 0 ? (
                  <div className="grid grid-cols-1 gap-3">
                    {missingDocsList.map((item, index) => (
                      <div key={`${item.student.id}-${item.record.id}-${item.docName}-${index}`} className="flex items-center justify-between rounded-xl border border-gray-300 bg-white p-4 shadow-sm">
                        <div className="flex items-center gap-4">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-base-200 font-bold text-base-content">{item.student.number}</div>
                          <div>
                            <div className="font-bold text-base-content">{item.student.name.hangul}</div>
                            <div className="text-xs text-base-content-secondary">{item.record.date} · {item.record.type} ({item.record.category}){item.record.note ? ` · ${item.record.note}` : ''}</div>
                          </div>
                        </div>
                        <div className="rounded border border-red-100 bg-red-50 px-2 py-1 text-sm font-bold text-red-500">{item.docName}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-8 text-center text-base-content-secondary"><span className="mb-2 block text-4xl">✅</span><p>미제출된 증빙서류가 없습니다.</p></div>
                )}
              </div>
            </div>
          )}

          {activePanel === 'specialNotes' && (
            <div className="absolute inset-0 z-20 overflow-y-auto bg-base-50 p-4 pb-20 custom-scrollbar">
              <div className="mx-auto max-w-5xl">
                <div className="mb-4">
                  <h3 className="text-lg font-bold text-base-content">{month + 1}월 출결 특기사항 학생</h3>
                  <p className="mt-1 text-xs text-base-content-secondary">선택한 달에 결석·지각·조퇴·결과 기록이 있는 학생만 표시합니다.</p>
                </div>
                {specialNotesStudents.length > 0 ? (
                  <div className="overflow-hidden rounded-xl border border-gray-300 bg-white shadow-sm">
                    <div className="grid grid-cols-[4rem_6rem_9rem_8rem_minmax(0,1fr)_12rem] border-b border-gray-300 bg-gray-100 text-xs font-bold text-base-content">
                      {['번호', '이름', '기간', '구분', '상세 내용', '서류'].map(label => <div key={label} className="border-r border-gray-300 px-3 py-2 last:border-r-0">{label}</div>)}
                    </div>
                    {specialNotesStudents.flatMap(({ student, groups }) => groups.map((group, groupIndex) => (
                      <div key={`${student.id}-${group.startDate}-${groupIndex}`} className="grid grid-cols-[4rem_6rem_9rem_8rem_minmax(0,1fr)_12rem] border-b border-gray-300 text-sm last:border-b-0">
                        <div className="border-r border-gray-300 px-3 py-2 text-base-content-secondary">{student.number}</div>
                        <button onClick={() => onSelectStudent(student)} className="border-r border-gray-300 px-3 py-2 text-left font-bold text-base-content hover:text-primary hover:underline">{student.name.hangul}</button>
                        <div className="border-r border-gray-300 px-3 py-2 font-semibold">{formatPeriod(group.startDate, group.endDate)}</div>
                        <div className="border-r border-gray-300 px-3 py-2"><span className={`mr-1 font-black ${getAttendanceSymbolColorClass(group.category)}`}>{getAttendanceSymbol(group.type, group.category)}</span>{group.type}/{group.category}</div>
                        <div className="border-r border-gray-300 px-3 py-2">{group.note || '-'}</div>
                        <div className="px-3 py-2 text-xs">{group.documents.length ? group.documents.map(doc => `${doc.name}(${doc.submitted ? '완료' : '미제출'})`).join(', ') : '-'}</div>
                      </div>
                    )))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-base-300 bg-white py-10 text-center text-base-content-secondary">이 달의 출결 특기사항이 없습니다.</div>
                )}
              </div>
            </div>
          )}

          {activePanel === 'table' && (
            <div className="h-full overflow-auto pb-20 custom-scrollbar">
              <table className="w-full border-collapse text-sm">
                <thead className="sticky top-0 z-10 bg-base-100 text-base-content shadow-sm">
                  <tr>
                    <th className="sticky left-0 z-20 w-16 min-w-[4rem] whitespace-nowrap border-b-2 border-r-2 border-gray-300 bg-base-100 p-2 text-center">번호</th>
                    <th className="sticky left-16 z-20 w-24 min-w-[6rem] whitespace-nowrap border-b-2 border-r-2 border-gray-300 bg-base-100 p-2 text-center">이름</th>
                    {visibleDays.map(day => {
                      const dayOfWeek = new Date(year, month, day).getDay();
                      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                      return (
                        <th key={day} className={`min-w-[2rem] border-b-2 border-r border-gray-300 p-1 text-center font-normal ${isWeekend ? 'bg-gray-100' : ''}`}>
                          <div className={`text-xs ${dayOfWeek === 0 ? 'text-red-500' : dayOfWeek === 6 ? 'text-blue-500' : ''}`}>{day}</div>
                        </th>
                      );
                    })}
                    <th className="w-24 min-w-[6rem] whitespace-nowrap border-b-2 border-l border-gray-300 bg-base-100 p-2 text-center">요약</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedStudents.map(student => {
                    const { records, recordsByDay, summary } = getStudentMonthData(student);
                    return (
                      <tr key={student.id} className="border-b border-gray-300 transition-colors hover:bg-base-50">
                        <td className="sticky left-0 z-[5] w-16 min-w-[4rem] whitespace-nowrap border-r-2 border-gray-300 bg-white p-2 text-center font-bold text-gray-500">{student.number}</td>
                        <td onClick={() => onSelectStudent(student)} className="sticky left-16 z-[5] w-24 min-w-[6rem] cursor-pointer whitespace-nowrap border-r-2 border-gray-300 bg-white p-2 text-center font-bold text-gray-900 hover:text-primary hover:underline">{student.name.hangul}</td>
                        {visibleDays.map(day => {
                          const record = recordsByDay.get(day);
                          const dayOfWeek = new Date(year, month, day).getDay();
                          const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                          return (
                            <td key={day} className={`border-r border-gray-300 p-1 text-center ${isWeekend ? 'bg-gray-50' : ''}`}>
                              {record && <span className={`cursor-help text-lg font-black ${getAttendanceSymbolColorClass(record.category)}`} title={`${record.type} (${record.category})`}>{getAttendanceSymbol(record.type, record.category)}</span>}
                            </td>
                          );
                        })}
                        <td className="border-l border-gray-300 p-2 text-center text-xs">
                          {records.length > 0 ? (
                            <div className="flex flex-col gap-0.5">
                              {ATTENDANCE_TYPES.map(type => summary[type.type] > 0 && (
                                <span key={type.type} className="flex justify-between px-1"><span>{type.label}</span><span className="font-bold">{summary[type.type]}</span></span>
                              ))}
                            </div>
                          ) : <span className="text-gray-300">-</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {createPortal(<section className="attendance-print-sheet" aria-hidden="true">
        <div className="neis-print-page neis-print-first-page">
          <div className="neis-print-date">{printDateLabel}</div>
          <h1 className="neis-print-title">{month + 1}월 출석부</h1>
          <div className="neis-print-class-info">
            <span>{settings.schoolYear || year}학년도 {settings.grade}학년 {settings.class}반</span>
            <span>{teacherName}</span>
          </div>

          <table className="neis-monthly-grid">
            <thead>
              <tr>
                <th className="neis-number-column">번호</th>
                <th className="neis-name-column">성명</th>
                {printDays.map(day => {
                  const dayOfWeek = new Date(year, month, day).getDay();
                  return (
                    <th key={day}>
                      <span>{day}</span>
                      <span>{['일', '월', '화', '수', '목', '금', '토'][dayOfWeek]}</span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {sortedStudents.map(student => {
                const { recordsByDay } = getStudentMonthData(student);
                return (
                  <tr key={student.id}>
                    <td>{student.number}</td>
                    <td className="neis-student-name">{student.name.hangul}</td>
                    {printDays.map(day => {
                      const record = recordsByDay.get(day);
                      return <td key={day}>{record ? ATTENDANCE_SYMBOLS[record.type][record.category] : ''}</td>;
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>

          <table className="neis-statistics-table">
            <thead>
              <tr><th colSpan={3}>월초재적</th><th colSpan={4}>출결상황</th><th colSpan={2}>이동</th><th colSpan={3}>월말재적</th><th rowSpan={2}>증감</th></tr>
              <tr><th>남</th><th>여</th><th>계</th><th>결석</th><th>지각</th><th>조퇴</th><th>결과</th><th>입급</th><th>출급</th><th>남</th><th>여</th><th>계</th></tr>
            </thead>
            <tbody>
              <tr><td>{maleCount}</td><td>{femaleCount}</td><td>{sortedStudents.length}</td><td>{monthlyTotals['결석']}</td><td>{monthlyTotals['지각']}</td><td>{monthlyTotals['조퇴']}</td><td>{monthlyTotals['결과']}</td><td>0</td><td>0</td><td>{maleCount}</td><td>{femaleCount}</td><td>{sortedStudents.length}</td><td>0</td></tr>
            </tbody>
          </table>

          <div className="neis-first-detail-block"><NeisDetailTable rows={firstPageDetailRows} /></div>
          <div className="neis-print-footer"><strong>{settings.school}</strong><span>{settings.school} / {printDateLabel} / {teacherName}</span></div>
        </div>

        {continuationDetailPages.map((pageRows, pageIndex) => (
          <div key={pageIndex} className="neis-print-page neis-print-continuation-page">
            <div className="neis-print-date">{printDateLabel}</div>
            <NeisDetailTable rows={pageRows} />
            <div className="neis-print-footer"><strong>{settings.school}</strong><span>{settings.school} / {printDateLabel} / {teacherName}</span></div>
          </div>
        ))}
      </section>, document.body)}
    </>
  );
};

export default AttendanceOverview;
