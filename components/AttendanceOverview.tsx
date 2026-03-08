import React, { useState, useMemo } from 'react';
import { Student, AttendanceType } from '../types';
import { getAttendanceSymbol, ATTENDANCE_TYPES } from '../utils/attendanceUtils';

interface AttendanceOverviewProps {
  students: Student[];
  onSelectStudent: (student: Student) => void;
}

const AttendanceOverview = ({ students, onSelectStudent }: AttendanceOverviewProps): React.ReactElement => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showMissingDocs, setShowMissingDocs] = useState(false);
  
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  
  // Sort students by number
  const sortedStudents = useMemo(() => {
      return [...students].sort((a, b) => {
          const numA = parseInt(a.number, 10) || Infinity;
          const numB = parseInt(b.number, 10) || Infinity;
          return numA - numB;
      });
  }, [students]);

  // Calculate Monthly Totals for Header
  const monthlyTotals = useMemo(() => {
      const totals: Record<string, number> = { '결석': 0, '지각': 0, '조퇴': 0, '결과': 0 };
      students.forEach(student => {
          (student.attendanceRecords || []).forEach(r => {
              const rDate = new Date(r.date);
              if (rDate.getFullYear() === year && rDate.getMonth() === month) {
                 if (totals[r.type] !== undefined) totals[r.type]++;
              }
          });
      });
      return totals;
  }, [students, year, month]);

  const handlePrevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const handleNextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  // Calculate Missing Documents for Current Month
  const missingDocsList = useMemo(() => {
      const list: { student: Student, date: string, type: string, category: string, docName: string }[] = [];
      sortedStudents.forEach(student => {
          (student.attendanceRecords || []).forEach(r => {
              const rDate = new Date(r.date);
              if (rDate.getFullYear() === year && rDate.getMonth() === month) {
                  if (r.documents && r.documents.length > 0) {
                      r.documents.forEach(doc => {
                          if (!doc.submitted) {
                              list.push({
                                  student,
                                  date: r.date,
                                  type: r.type,
                                  category: r.category,
                                  docName: doc.name
                              });
                          }
                      });
                  }
              }
          });
      });
      return list.sort((a, b) => a.date.localeCompare(b.date));
  }, [sortedStudents, year, month]);

  return (
    <div className="bg-white rounded-xl shadow-lg border border-base-300/60 flex flex-col h-full overflow-hidden relative min-h-0">
      {/* Header */}
      <div className="p-4 border-b border-base-300 flex flex-wrap justify-between items-center bg-base-50 gap-3">
         <div className="flex items-center gap-4">
            <h2 className="text-lg font-bold text-base-content flex items-center gap-2">
                <span className="text-2xl">📊</span> 월별 출결 현황
            </h2>
            <div className="flex items-center gap-2 bg-white px-3 py-1 rounded-lg border border-base-300 shadow-sm">
                <button onClick={handlePrevMonth} className="p-1 hover:bg-base-100 rounded-full"><svg className="w-5 h-5 text-base-content-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg></button>
                <span className="font-bold text-base-content w-24 text-center">{year}년 {month + 1}월</span>
                <button onClick={handleNextMonth} className="p-1 hover:bg-base-100 rounded-full"><svg className="w-5 h-5 text-base-content-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg></button>
            </div>
         </div>
         <div className="flex items-center gap-4">
             <button 
                onClick={() => setShowMissingDocs(!showMissingDocs)}
                className={`text-sm font-bold px-3 py-1.5 rounded-lg border shadow-sm transition-all flex items-center gap-2 ${showMissingDocs ? 'bg-primary text-primary-content border-primary' : 'bg-white text-base-content border-base-300 hover:bg-base-50'}`}
             >
                 <span>📑</span>
                 미제출 서류 {missingDocsList.length > 0 && <span className="bg-red-500 text-white text-xs px-1.5 rounded-full">{missingDocsList.length}</span>}
             </button>
             <div className="text-xs text-base-content-secondary flex gap-3 hidden sm:flex items-center border-l border-base-300 pl-4">
                 {ATTENDANCE_TYPES.map(t => (
                     <div key={t.type} className="flex items-center gap-1.5 bg-base-100 px-2 py-1 rounded-md border border-base-200">
                         <span className="font-bold text-base-content">{t.label}</span>
                         <span className="font-extrabold text-primary">{monthlyTotals[t.type]}</span>
                     </div>
                 ))}
             </div>
         </div>
      </div>

      {/* Main Content Area - iPad Fix: Added pb-20 to allow table to scroll up completely */}
      <div className="flex-1 overflow-hidden relative">
          {showMissingDocs ? (
              <div className="absolute inset-0 bg-base-50 z-20 overflow-y-auto custom-scrollbar p-4 pb-20">
                  <div className="max-w-3xl mx-auto">
                      <h3 className="text-lg font-bold text-base-content mb-4 flex items-center gap-2">
                          <span className="text-red-500">⚠️</span> {month+1}월 미제출 증빙서류 목록
                      </h3>
                      {missingDocsList.length > 0 ? (
                          <div className="grid grid-cols-1 gap-3">
                              {missingDocsList.map((item, idx) => (
                                  <div key={idx} className="bg-white p-4 rounded-xl shadow-sm border border-base-300 flex justify-between items-center hover:shadow-md transition-shadow">
                                      <div className="flex items-center gap-4">
                                          <div className="w-10 h-10 rounded-full bg-base-200 flex items-center justify-center font-bold text-base-content">
                                              {item.student.number}
                                          </div>
                                          <div>
                                              <div className="font-bold text-base-content">{item.student.name.hangul}</div>
                                              <div className="text-xs text-base-content-secondary">{item.date} · {item.type} ({item.category})</div>
                                          </div>
                                      </div>
                                      <div className="text-red-500 font-bold text-sm bg-red-50 px-2 py-1 rounded border border-red-100">
                                          {item.docName}
                                      </div>
                                  </div>
                              ))}
                          </div>
                      ) : (
                          <div className="text-center py-8 text-base-content-secondary">
                              <span className="text-4xl block mb-2">✅</span>
                              <p>미제출된 증빙서류가 없습니다.</p>
                          </div>
                      )}
                  </div>
              </div>
          ) : (
              <div className="h-full overflow-auto custom-scrollbar pb-20">
                <table className="w-full text-sm border-collapse">
                    <thead className="bg-base-100 sticky top-0 z-10 shadow-sm text-base-content">
                        <tr>
                            <th className="p-2 border-b w-16 text-center bg-base-100 z-20 sticky left-0 border-r">번호</th>
                            <th className="p-2 border-b w-20 text-center bg-base-100 z-20 sticky left-16 border-r">이름</th>
                            {days.map(d => {
                                const date = new Date(year, month, d);
                                const dayOfWeek = date.getDay(); // 0 Sun, 6 Sat
                                const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                                return (
                                    <th key={d} className={`p-1 border-b min-w-[2rem] text-center font-normal border-r border-base-200 ${isWeekend ? 'bg-base-200/50' : ''}`}>
                                        <div className={`text-xs ${dayOfWeek === 0 ? 'text-red-500' : dayOfWeek === 6 ? 'text-blue-500' : ''}`}>{d}</div>
                                    </th>
                                );
                            })}
                            <th className="p-2 border-b w-24 text-center bg-base-100">요약</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sortedStudents.map(student => {
                            const summary: Record<string, number> = { '결석': 0, '지각': 0, '조퇴': 0, '결과': 0 };
                            const studentRecords: Record<string, any> = {};
                            (student.attendanceRecords || []).forEach(r => {
                                const rDate = new Date(r.date);
                                if (rDate.getFullYear() === year && rDate.getMonth() === month) {
                                    const day = rDate.getDate();
                                    studentRecords[day] = r;
                                    if (summary[r.type] !== undefined) summary[r.type]++;
                                }
                            });
                            
                            const hasAttendance = Object.values(summary).some(v => v > 0);

                            return (
                                <tr key={student.id} className="hover:bg-base-50 transition-colors border-b border-base-100">
                                    <td className="p-2 text-center font-bold text-gray-500 bg-white sticky left-0 z-10 border-r">{student.number}</td>
                                    <td 
                                       className="p-2 text-center font-bold text-gray-900 bg-white sticky left-16 z-10 border-r cursor-pointer hover:text-primary hover:underline"
                                       onClick={() => onSelectStudent(student)}
                                    >
                                        {student.name.hangul}
                                    </td>
                                    {days.map(d => {
                                        const record = studentRecords[d];
                                        const date = new Date(year, month, d);
                                        const dayOfWeek = date.getDay();
                                        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                                        
                                        return (
                                            <td key={d} className={`p-1 text-center border-r border-base-200 ${isWeekend ? 'bg-base-200/30' : ''}`}>
                                                {record ? (
                                                    <span className="text-sm cursor-help" title={`${record.type} (${record.category})`}>
                                                        {getAttendanceSymbol(record.type, record.category)}
                                                    </span>
                                                ) : ''}
                                            </td>
                                        );
                                    })}
                                    <td className="p-2 text-center text-xs">
                                        {hasAttendance ? (
                                            <div className="flex flex-col gap-0.5">
                                                {ATTENDANCE_TYPES.map(t => summary[t.type] > 0 && (
                                                    <span key={t.type} className="flex justify-between px-1">
                                                        <span>{t.label}</span>
                                                        <span className="font-bold">{summary[t.type]}</span>
                                                    </span>
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
  );
};

export default AttendanceOverview;