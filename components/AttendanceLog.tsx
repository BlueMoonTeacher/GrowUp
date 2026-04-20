
import React, { useState, useEffect, useMemo } from 'react';
import { Student, AttendanceRecord, AttendanceType, AttendanceCategory } from '../types';
import { getAttendanceSymbol, ATTENDANCE_TYPES, CATEGORIES } from '../utils/attendanceUtils';
import { AppSettings } from '../App';
import { useModal } from '../context/ModalContext';

interface AttendanceLogProps {
  student: Student;
  onUpdateStudent: (student: Student) => Promise<void>;
  settings: AppSettings;
}

const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();
const AUTHORIZED_SUB_TYPES = ['교외체험학습', '법정감염병', '대회참가', '경조사', '기타'];

const AttendanceLog = ({ student, onUpdateStudent, settings }: AttendanceLogProps): React.ReactElement => {
  const { showAlert, showConfirm } = useModal();
  const [currentDate, setCurrentDate] = useState(new Date());
  // Changed to Set for multi-selection
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set());
  
  // Selection Logic for Shift+Drag (Range Selection)
  const [dragStartDay, setDragStartDay] = useState<number | null>(null);
  const [dragEndDay, setDragEndDay] = useState<number | null>(null);
  
  // Form State
  const [formType, setFormType] = useState<AttendanceType>('결석');
  const [formCategory, setFormCategory] = useState<AttendanceCategory>('질병');
  const [authorizedSubCategory, setAuthorizedSubCategory] = useState<string>('교외체험학습');
  const [formNote, setFormNote] = useState('');
  const [formDocs, setFormDocs] = useState<{name: string, submitted: boolean}[]>([]);

  // Mobile Calendar Toggle State
  const [isMobileCalendarOpen, setIsMobileCalendarOpen] = useState(true);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Reset selection when student changes
  useEffect(() => {
    setSelectedDates(new Set());
    setDragStartDay(null);
    setDragEndDay(null);
    setIsMobileCalendarOpen(true); // Always open calendar when student changes
  }, [student.id]);

  const getDateStr = (day: number) => `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  // Global mouseup listener to commit drag selection
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (dragStartDay !== null && dragEndDay !== null) {
        const start = Math.min(dragStartDay, dragEndDay);
        const end = Math.max(dragStartDay, dragEndDay);
        
        setSelectedDates(prev => {
          const newSet = new Set<string>(prev);
          for (let i = start; i <= end; i++) {
            newSet.add(getDateStr(i));
          }
          return newSet;
        });
      }
      setDragStartDay(null);
      setDragEndDay(null);
    };

    if (dragStartDay !== null) {
      window.addEventListener('mouseup', handleGlobalMouseUp);
    }

    return () => {
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [dragStartDay, dragEndDay, year, month]);

  const suggestDocuments = (category: AttendanceCategory, subCategory: string) => {
      if (category === '질병') {
          return [{ name: '결석계(담임확인서)', submitted: false }];
      }
      if (category === '인정') {
          if (subCategory === '교외체험학습') {
               return [
                  { name: '체험학습 신청서', submitted: false },
                  { name: '체험학습 보고서', submitted: false }
              ];
          } else if (subCategory === '법정감염병') {
              return [{ name: '진료확인서', submitted: false }];
          } else {
              return [{ name: '출결인정서류', submitted: false }];
          }
      }
      return [];
  };

  const recordsMap = useMemo(() => {
      const map: Record<string, AttendanceRecord> = {};
      (student.attendanceRecords || []).forEach(r => {
          map[r.date] = r;
      });
      return map;
  }, [student.attendanceRecords]);

  const handlePrevMonth = () => {
      setCurrentDate(new Date(year, month - 1, 1));
      setSelectedDates(new Set()); // Clear selection on month change
  };

  const handleNextMonth = () => {
      setCurrentDate(new Date(year, month + 1, 1));
      setSelectedDates(new Set()); // Clear selection on month change
  };

  // Helper: Add or remove date to selection, and populate form if it's the first selection
  const selectDate = (dateStr: string, keepExisting: boolean = true) => {
      // On mobile, collapse calendar when a date is selected
      if (window.innerWidth < 1024) {
          setIsMobileCalendarOpen(false);
      }

      setSelectedDates(prev => {
          const newSet = keepExisting ? new Set(prev) : new Set<string>();
          
          // If we are selecting a date (not deselecting) and it wasn't selected before
          if (!newSet.has(dateStr)) {
             newSet.add(dateStr);
             
             // If this became the ONLY selected date (or first in this batch), load data
             if (newSet.size === 1) {
                 const existing = recordsMap[dateStr];
                 if (existing) {
                      setFormType(existing.type);
                      setFormCategory(existing.category);
                      setFormNote(existing.note);
                      setFormDocs(existing.documents || []);

                      if (existing.category === '인정') {
                         const docNames = existing.documents?.map(d => d.name) || [];
                         if (docNames.some(n => n.includes('체험학습'))) {
                             setAuthorizedSubCategory('교외체험학습');
                         } else if (docNames.some(n => n.includes('진료확인서'))) {
                             setAuthorizedSubCategory('법정감염병');
                         } else if (docNames.some(n => n.includes('대회'))) {
                             setAuthorizedSubCategory('대회참가');
                         } else if (docNames.some(n => n.includes('경조사'))) {
                             setAuthorizedSubCategory('경조사');
                         } else {
                             setAuthorizedSubCategory('기타');
                         }
                      } else {
                          setAuthorizedSubCategory('교외체험학습'); 
                      }
                 } else {
                      // Reset form defaults for new entry
                      setFormType('결석');
                      setFormCategory('질병');
                      setAuthorizedSubCategory('교외체험학습');
                      setFormNote('');
                      setFormDocs(suggestDocuments('질병', '교외체험학습'));
                 }
             }
          } else if (keepExisting) {
              // Toggle off if clicking an already selected date (only in single click mode)
              newSet.delete(dateStr);
          }
          return newSet;
      });
  };

  const handleMouseDown = (day: number, e: React.MouseEvent) => {
      if (e.shiftKey) {
          e.preventDefault(); // Prevent text selection during drag
          setDragStartDay(day);
          setDragEndDay(day);
      } else {
          // Standard Click (Toggle)
          selectDate(getDateStr(day), true);
      }
  };

  const handleMouseEnter = (day: number) => {
      if (dragStartDay !== null) {
          setDragEndDay(day);
      }
  };

  const handleSave = async () => {
      if (selectedDates.size === 0) return;

      const datesToUpdate: string[] = Array.from(selectedDates);
      
      // 1. Filter out existing records for these dates to prevent duplicates
      let updatedRecords = (student.attendanceRecords || []).filter(r => !selectedDates.has(r.date));

      // 2. Create new records for all selected dates
      const newRecords: AttendanceRecord[] = datesToUpdate.map(date => ({
          id: recordsMap[date]?.id || Math.random().toString(36).substr(2, 9),
          date: date,
          type: formType,
          category: formCategory,
          note: formNote,
          documents: formDocs
      }));
      
      updatedRecords = [...updatedRecords, ...newRecords];

      await onUpdateStudent({ ...student, attendanceRecords: updatedRecords });
      await showAlert(`${selectedDates.size}건의 출결 기록이 저장되었습니다.`);
  };

  const handleDelete = async () => {
      if (selectedDates.size === 0) return;
      
      const confirmed = await showConfirm(`선택한 ${selectedDates.size}개의 날짜에 대한 출결 기록을 삭제하시겠습니까?`);
      if (!confirmed) return;

      const updatedRecords = (student.attendanceRecords || []).filter(r => !selectedDates.has(r.date));
      await onUpdateStudent({ ...student, attendanceRecords: updatedRecords });
      
      setSelectedDates(new Set()); // Clear selection after delete
  };

  const handleCategoryChange = (cat: AttendanceCategory) => {
      setFormCategory(cat);
      
      let sub = authorizedSubCategory;
      if (cat === '인정') {
          sub = '교외체험학습'; // Default
          setAuthorizedSubCategory(sub);
      }
      setFormDocs(suggestDocuments(cat, sub));
  };

  const handleSubCategoryChange = (sub: string) => {
      setAuthorizedSubCategory(sub);
      setFormDocs(suggestDocuments('인정', sub));
  };

  const toggleDoc = (index: number) => {
      const newDocs = [...formDocs];
      newDocs[index].submitted = !newDocs[index].submitted;
      setFormDocs(newDocs);
  };

  // Calendar Rendering Logic
  const daysInMonth = getDaysInMonth(year, month);
  const startDay = getFirstDayOfMonth(year, month);
  const days = [];
  for (let i = 0; i < startDay; i++) days.push(null);
  for (let i = 1; i <= daysInMonth; i++) days.push(i);

  // Stats Calculation
  const { annualStats, monthlyStats } = useMemo(() => {
      const annual = { '결석': 0, '지각': 0, '조퇴': 0, '결과': 0 };
      const monthly = { '결석': 0, '지각': 0, '조퇴': 0, '결과': 0 };
      
      const schoolYearStr = settings.schoolYear || String(new Date().getFullYear());
      const schoolYear = parseInt(schoolYearStr, 10);
      const startOfYear = new Date(schoolYear, 2, 1); 
      const endOfYear = new Date(schoolYear + 1, 1, 29); 

      (student.attendanceRecords || []).forEach(r => {
          const rDate = new Date(r.date);
          
          if (!isNaN(rDate.getTime()) && rDate >= startOfYear && rDate <= endOfYear) {
             if (annual[r.type] !== undefined) annual[r.type]++;
          }

          if (!isNaN(rDate.getTime()) && rDate.getFullYear() === year && rDate.getMonth() === month) {
             if (monthly[r.type] !== undefined) monthly[r.type]++;
          }
      });
      return { annualStats: annual, monthlyStats: monthly };
  }, [student.attendanceRecords, settings.schoolYear, year, month]);


  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full min-h-0">
        {/* Left: Calendar & Stats */}
        {/* iPad/Mobile Fix: Added pb-40 to ensure content isn't cut off */}
        <div className={`lg:col-span-7 flex flex-col gap-4 overflow-y-auto custom-scrollbar pb-40 transition-all duration-300 min-h-0 ${!isMobileCalendarOpen ? 'hidden lg:flex' : 'flex h-full'}`}>
            {/* Stats Bar */}
            <div className="flex flex-col gap-3 shrink-0">
                {/* Annual Stats */}
                <div className="bg-base-100 p-3 rounded-xl shadow-sm border border-base-300/80 flex items-center justify-between">
                    <div className="flex flex-col items-center justify-center px-4 border-r border-base-300">
                         <span className="text-[10px] font-bold text-base-content-secondary uppercase tracking-wider">School Year</span>
                         <span className="text-lg font-bold text-primary">{settings.schoolYear || year}학년도 누계</span>
                    </div>
                    <div className="flex-1 flex justify-around items-center px-2">
                        {ATTENDANCE_TYPES.map(t => (
                            <div key={`annual-${t.type}`} className="flex flex-col items-center">
                                <span className="text-xs text-base-content-secondary mb-0.5">{t.label}</span>
                                <span className="text-base font-bold text-base-content">{annualStats[t.type]}</span>
                            </div>
                        ))}
                    </div>
                </div>
                
                {/* Monthly Stats */}
                <div className="bg-white p-3 rounded-xl shadow-sm border border-primary/20 flex items-center justify-between relative overflow-hidden">
                     <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary"></div>
                     <div className="flex flex-col items-center justify-center px-4 border-r border-base-300 min-w-[120px]">
                         <span className="text-[10px] font-bold text-base-content-secondary uppercase tracking-wider">Monthly</span>
                         <span className="text-lg font-bold text-base-content">{month + 1}월 현황</span>
                    </div>
                     <div className="flex-1 flex justify-around items-center px-2">
                        {ATTENDANCE_TYPES.map(t => (
                            <div key={`monthly-${t.type}`} className="flex flex-col items-center">
                                <span className="text-xs text-base-content-secondary mb-0.5">{t.label}</span>
                                <span className="text-xl font-bold text-primary">{monthlyStats[t.type]}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Calendar — max-lg: 단일열에서 flex-1·auto-rows-fr가 높이를 압축해 격자가 카드 밖으로 탈출함 → 내용 높이로 확장 */}
            <div className="flex flex-col rounded-xl border border-base-300/60 bg-base-100 p-5 shadow-lg max-lg:shrink-0 max-lg:flex-none lg:min-h-[300px] lg:flex-1">
                <div className="flex justify-between items-center mb-6">
                    <button onClick={handlePrevMonth} className="p-2 hover:bg-base-200 rounded-full transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-base-content-secondary" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                    </button>
                    <h3 className="text-xl font-bold text-base-content">{year}년 {month + 1}월</h3>
                    <button onClick={handleNextMonth} className="p-2 hover:bg-base-200 rounded-full transition-colors">
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-base-content-secondary" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg>
                    </button>
                </div>
                
                <div className="grid grid-cols-7 gap-2 mb-2">
                    {['일', '월', '화', '수', '목', '금', '토'].map((d, i) => (
                        <div key={d} className={`text-center text-xs font-bold ${i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-base-content-secondary'}`}>
                            {d}
                        </div>
                    ))}
                </div>
                
                <div className="grid grid-cols-7 gap-2 select-none max-lg:flex-none lg:flex-1 lg:auto-rows-fr">
                    {days.map((day, i) => {
                        if (!day) return <div key={`empty-${i}`} className="bg-transparent"></div>;
                        
                        const dateStr = getDateStr(day);
                        const record = recordsMap[dateStr];
                        
                        // Drag Range Logic
                        const isInDragRange = dragStartDay !== null && dragEndDay !== null && day >= Math.min(dragStartDay, dragEndDay) && day <= Math.max(dragStartDay, dragEndDay);
                        const isSelected = selectedDates.has(dateStr);
                        const isHighlighted = isSelected || isInDragRange;
                        
                        return (
                            <div 
                                key={day} 
                                onMouseDown={(e) => handleMouseDown(day, e)}
                                onMouseEnter={() => handleMouseEnter(day)}
                                className={`relative p-1 rounded-lg border transition-all flex flex-col items-center justify-start h-full min-h-[50px] sm:min-h-[60px] cursor-pointer
                                    ${isHighlighted ? 'border-primary ring-2 ring-primary ring-offset-1 bg-white z-10' : 'border-base-200 hover:border-primary/50 bg-white'}
                                    ${isInDragRange && !isSelected ? 'bg-primary/10' : ''}
                                `}
                            >
                                {isSelected && (
                                    <div className="absolute top-1 right-1 w-2 h-2 bg-primary rounded-full"></div>
                                )}
                                <span className={`text-xs font-medium mb-1 self-start ml-1 ${isHighlighted ? 'text-primary font-bold' : 'text-base-content-secondary'}`}>{day}</span>
                                {record && (
                                    <div className="flex flex-col items-center w-full mt-0.5">
                                        <span className="text-sm leading-none filter drop-shadow-sm" title={`${record.type} - ${record.category}`}>
                                            {getAttendanceSymbol(record.type, record.category)}
                                        </span>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>

        {/* Right: Input Form - iPad Fix: Added massive padding-bottom (pb-32) */}
        <div className={`lg:col-span-5 bg-white rounded-xl shadow-lg border border-base-300/60 p-6 flex flex-col h-full overflow-y-auto custom-scrollbar pb-32 transition-all duration-300 min-h-0 ${isMobileCalendarOpen ? 'hidden lg:flex' : 'flex'}`}>
            
            {/* Mobile Header: Back to Calendar */}
            <div className="lg:hidden mb-4 pb-2 border-b border-base-200">
                <button 
                    onClick={() => setIsMobileCalendarOpen(true)}
                    className="w-full flex items-center justify-between text-left p-2 rounded-lg hover:bg-base-50 active:bg-base-100 transition-colors"
                >
                    <div className="flex items-center gap-2">
                        <span className="text-2xl">🗓️</span>
                        <div>
                            <span className="text-xs text-base-content-secondary font-bold block">날짜 선택</span>
                            <h3 className="text-lg font-bold text-base-content leading-none">
                                {year}년 {month + 1}월
                            </h3>
                        </div>
                    </div>
                    <div className="flex items-center text-primary font-bold text-sm">
                        <span>달력 열기</span>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 ml-1" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                    </div>
                </button>
            </div>

            {selectedDates.size === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-base-content-secondary opacity-60">
                     <span className="text-5xl mb-4">📅</span>
                     <p className="text-lg font-medium">날짜를 선택하여 출결을 입력하세요.</p>
                     <p className="text-sm mt-1">Shift 키를 누르고 드래그하여 여러 날짜를 선택할 수 있습니다.</p>
                </div>
            ) : (
                <div className="space-y-6">
                    {/* Selection Header */}
                    <div className="flex flex-col gap-2 pb-4 border-b border-base-200">
                        <div className="flex justify-between items-center">
                             <div className="flex items-center gap-2">
                                <h3 className="text-xl font-bold text-base-content">
                                    {selectedDates.size > 1 ? `${selectedDates.size}일 선택됨` : `${Array.from(selectedDates)[0]} 출결 기록`}
                                </h3>
                                {selectedDates.size > 1 && (
                                    <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-bold">일괄 편집</span>
                                )}
                             </div>
                             <button 
                                onClick={() => {
                                    setSelectedDates(new Set());
                                    setIsMobileCalendarOpen(true);
                                }}
                                className="text-xs bg-base-200 hover:bg-base-300 text-base-content-secondary px-3 py-1.5 rounded-lg transition-colors"
                            >
                                선택 해제
                            </button>
                        </div>
                        {selectedDates.size > 1 && (
                            <p className="text-xs text-base-content-secondary truncate">
                                {Array.from(selectedDates).sort().join(', ')}
                            </p>
                        )}
                        {/* Only show Delete if records exist for selected dates */}
                        {Array.from(selectedDates).some(d => recordsMap[d]) && (
                            <div className="flex justify-end mt-1">
                                <button 
                                    onClick={handleDelete} 
                                    className="text-xs text-red-600 hover:bg-red-50 px-2 py-1 rounded transition-colors flex items-center gap-1"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                                    </svg>
                                    선택된 기록 삭제
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Type Selection */}
                    <div>
                        <label className="block text-sm font-bold text-base-content-secondary mb-3">유형 선택</label>
                        <div className="grid grid-cols-4 gap-2">
                            {ATTENDANCE_TYPES.map(t => (
                                <button
                                    key={t.type}
                                    onClick={() => setFormType(t.type)}
                                    className={`py-3 rounded-lg border flex flex-col items-center gap-1.5 transition-all
                                        ${formType === t.type 
                                            ? 'bg-primary text-primary-content border-primary shadow-md ring-2 ring-primary ring-offset-1' 
                                            : 'bg-white border-base-300 text-base-content hover:bg-base-50'
                                        }
                                    `}
                                >
                                    <span className="text-lg font-bold">{t.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Category Selection */}
                    <div>
                        <label className="block text-sm font-bold text-base-content-secondary mb-3">사유 구분</label>
                        <div className="flex flex-wrap gap-2">
                            {CATEGORIES.map(c => (
                                <button
                                    key={c.category}
                                    onClick={() => handleCategoryChange(c.category)}
                                    className={`px-4 py-2.5 rounded-xl text-sm font-bold border transition-all
                                        ${formCategory === c.category 
                                            ? `ring-2 ring-offset-1 shadow-sm ${c.color}` 
                                            : 'bg-white border-base-300 text-base-content-secondary hover:bg-base-50'
                                        }
                                        ${formCategory === c.category ? 'ring-primary/20' : ''}
                                    `}
                                >
                                    <div className="flex items-center gap-2">
                                        <span className="text-base">{getAttendanceSymbol(formType, c.category)}</span>
                                        <span>{c.label}</span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Sub Category for Authorized Absence */}
                    {formCategory === '인정' && (
                        <div className="mt-1 p-4 bg-green-50 rounded-xl border border-green-100">
                            <label className="block text-sm font-bold text-green-800 mb-3">인정 결석 사유 상세</label>
                            <div className="flex flex-wrap gap-2">
                                {AUTHORIZED_SUB_TYPES.map(sub => (
                                    <button
                                        key={sub}
                                        onClick={() => handleSubCategoryChange(sub)}
                                        className={`px-4 py-2 rounded-lg text-sm font-bold border transition-all shadow-sm
                                            ${authorizedSubCategory === sub 
                                                ? 'bg-green-600 text-white border-green-600 shadow-md' 
                                                : 'bg-white text-green-700 border-green-200 hover:bg-green-100'
                                            }
                                        `}
                                    >
                                        {sub}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Note */}
                    <div>
                        <label className="block text-sm font-bold text-base-content-secondary mb-2">상세 사유</label>
                        <input 
                            type="text" 
                            value={formNote}
                            onChange={(e) => setFormNote(e.target.value)}
                            placeholder={formCategory === '인정' ? "예: A형 독감, 코로나, 가족체험학습" : "예: 감기, 늦잠 등"}
                            className="w-full p-4 border border-base-300 bg-white rounded-xl focus:ring-2 focus:ring-primary/50 focus:border-primary text-lg text-base-content placeholder-base-content-secondary/50 shadow-sm transition-all"
                        />
                    </div>

                    {/* Document Checklist */}
                    <div className="bg-base-100 p-4 rounded-xl border border-base-300 shadow-inner">
                         <div className="flex justify-between items-center mb-3">
                            <label className="text-sm font-bold text-base-content">제출 서류 관리</label>
                            {formCategory === '질병' && (
                                <button 
                                    onClick={() => {
                                        const hasCert = formDocs.some(d => d.name === '진료확인서');
                                        if (hasCert) {
                                            setFormDocs([{ name: '결석계(담임확인서)', submitted: false }]);
                                        } else {
                                            setFormDocs([{ name: '진료확인서', submitted: false }]);
                                        }
                                    }}
                                    className="text-xs text-primary font-bold hover:underline bg-primary/5 px-2 py-1 rounded"
                                >
                                    {formDocs.some(d => d.name === '진료확인서') ? '3일 미만 (결석계)' : '3일 이상 (진료확인서)'}
                                </button>
                            )}
                         </div>
                         
                         {formDocs.length > 0 ? (
                             <div className="space-y-2">
                                 {formDocs.map((doc, idx) => (
                                     <div key={idx} onClick={() => toggleDoc(idx)} className="flex items-center gap-3 p-3 bg-white rounded-lg border border-base-300 cursor-pointer hover:border-primary/50 hover:bg-base-50 transition-all group">
                                         <div className={`w-6 h-6 rounded-md flex items-center justify-center border transition-colors ${doc.submitted ? 'bg-primary border-primary' : 'border-base-300 bg-white group-hover:border-primary'}`}>
                                             {doc.submitted && <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                                         </div>
                                         <span className={`text-sm font-medium ${doc.submitted ? 'text-base-content-secondary line-through decoration-base-300' : 'text-base-content'}`}>
                                             {doc.name}
                                         </span>
                                         {doc.submitted && <span className="ml-auto text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">제출완료</span>}
                                     </div>
                                 ))}
                             </div>
                         ) : (
                             <div className="text-xs text-base-content-secondary text-center py-4 bg-base-200/30 rounded-lg border border-dashed border-base-300">
                                 필요한 증빙 서류가 없습니다.
                             </div>
                         )}
                    </div>

                    <div className="pt-2">
                        <button 
                            onClick={handleSave}
                            className="w-full bg-primary text-primary-content font-bold py-3.5 rounded-xl shadow-lg hover:bg-primary-focus hover:shadow-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                            저장하기
                        </button>
                    </div>
                </div>
            )}
        </div>
    </div>
  );
};

export default AttendanceLog;
