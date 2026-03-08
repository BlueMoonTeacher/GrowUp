
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { BehaviorRecord, Student } from '../types';
import StudentDetail from './StudentDetail';
import BehaviorLog from './BehaviorLog';
import { AppSettings } from '../App';
import LunchMenu from './LunchMenu';
import AttendanceLog from './AttendanceLog';
import AttendanceOverview from './AttendanceOverview';
import ClassPlanner from './ClassPlanner';
import ScheduleManager from './ScheduleManager';
import EvaluationManager from './EvaluationManager';

interface DashboardProps {
  students: Student[];
  selectedStudent: Student | null;
  onSelectStudent: (student: Student) => void;
  onEditStudent: (student: Student) => void;
  onDeleteStudent: (studentId: string) => void;
  onAddBehaviorRecord: (studentId: string, record: Omit<BehaviorRecord, 'id'>) => void;
  onDeleteBehaviorRecord: (studentId: string, recordId: string) => void;
  onUpdateStudent: (student: Student) => Promise<void>;
  settings: AppSettings;
}

const ICONS = ['🌱', '🌳', '🌸', '☀️', '💧', '🍃', '🌷', '🍁', '🍄', '🌻'];

type SortOrder = 'number' | 'name';
type DashboardTab = 'growth' | 'attendance' | 'planner' | 'schedule' | 'evaluation';
type AttendanceViewMode = 'individual' | 'overview';

interface StudentListProps {
    students: Student[];
    selectedStudentId: string | null;
    onSelectStudent: (student: Student) => void;
    sortOrder: SortOrder;
    onSortChange: (order: SortOrder) => void;
}

// PC/Tablet Sidebar List
const StudentList = ({ students, selectedStudentId, onSelectStudent, sortOrder, onSortChange }: StudentListProps): React.ReactElement => (
  <div className="bg-base-100 rounded-xl shadow-lg h-full flex flex-col p-4 border border-base-300/60 min-h-0">
    <div className="px-2 mb-2 shrink-0">
        <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-bold text-base-content">학생 목록</h2> 
            <span className="text-xs bg-secondary text-secondary-content px-2.5 py-1 rounded-full font-semibold">{students.length}명</span>
        </div>
        <div className="flex items-center justify-end space-x-1.5">
            {(['number', 'name'] as const).map(order => (
                 <button 
                    key={order}
                    onClick={() => onSortChange(order)}
                    className={`px-2.5 py-1 rounded-md text-xs font-bold transition-colors duration-200 ${
                        sortOrder === order 
                        ? 'bg-primary text-primary-content shadow-sm' 
                        : 'bg-base-200 text-base-content-secondary hover:bg-base-300'
                    }`}
                >
                    {order === 'number' ? '번호순' : '이름순'}
                </button>
            ))}
        </div>
    </div>
    {/* iPad Fix: Added massive padding-bottom (pb-32) to ensure last items can be scrolled up past the home bar */}
    <div className="space-y-1.5 overflow-y-auto overflow-x-hidden flex-1 custom-scrollbar pb-32">
      {students.map((student, index) => (
        <button
          key={student.id}
          onClick={() => onSelectStudent(student)}
          className={`w-full text-left p-2.5 rounded-lg transition-all duration-200 flex items-center space-x-3 ${
            selectedStudentId === student.id 
              ? 'bg-primary text-primary-content shadow-md' 
              : 'hover:bg-secondary hover:text-secondary-content text-base-content-secondary'
          }`}
        >
          <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center shadow-sm text-lg ${
              selectedStudentId === student.id ? 'bg-primary-content text-primary' : 'bg-secondary text-secondary-content border border-base-300/30'
          }`}>
            <span>{ICONS[index % ICONS.length]}</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className={`font-bold text-sm truncate ${selectedStudentId === student.id ? 'text-primary-content' : 'text-base-content'}`}>
                {student.name.hangul}
            </p>
            <p className={`text-xs truncate ${selectedStudentId === student.id ? 'text-green-100' : 'text-base-content-secondary'}`}>
                {student.number}번 {student.gender ? `· ${student.gender}` : ''}
            </p>
          </div>
        </button>
      ))}
      {students.length === 0 && (
          <div className="text-center py-8 text-base-content-secondary text-sm">
              학생 없음
          </div>
      )}
    </div>
  </div>
);

// Mobile Cute Dropdown Selector
const MobileStudentSelector = ({ students, selectedStudent, onSelectStudent }: { students: Student[], selectedStudent: Student | null, onSelectStudent: (s: Student) => void }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const selectedIndex = selectedStudent ? students.findIndex(s => s.id === selectedStudent.id) : -1;
    const displayIcon = selectedIndex !== -1 ? ICONS[selectedIndex % ICONS.length] : '🎓';

    return (
        <div className="relative w-full z-30" ref={dropdownRef}>
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className="w-full bg-white border border-base-300 shadow-sm rounded-2xl p-2 flex items-center justify-between transition-all active:scale-[0.99]"
            >
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-xl shadow-inner">
                        {displayIcon}
                    </div>
                    <div className="text-left">
                        {selectedStudent ? (
                            <>
                                <p className="text-xs text-base-content-secondary font-bold">{selectedStudent.number}번</p>
                                <p className="text-base font-bold text-base-content">{selectedStudent.name.hangul}</p>
                            </>
                        ) : (
                            <p className="text-sm font-bold text-base-content-secondary">학생을 선택해주세요</p>
                        )}
                    </div>
                </div>
                <div className={`p-2 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-base-content-secondary" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                </div>
            </button>

            {isOpen && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-xl border border-base-200 max-h-80 overflow-y-auto custom-scrollbar p-2 animate-[fadeIn_0.2s_ease-out] z-50 pb-20">
                    <div className="grid grid-cols-1 gap-1">
                        {students.map((student, idx) => (
                            <button
                                key={student.id}
                                onClick={() => {
                                    onSelectStudent(student);
                                    setIsOpen(false);
                                }}
                                className={`flex items-center gap-3 p-2 rounded-xl transition-colors ${
                                    selectedStudent?.id === student.id 
                                    ? 'bg-primary/10 text-primary' 
                                    : 'hover:bg-base-100 text-base-content'
                                }`}
                            >
                                <span className="text-lg w-8 text-center">{ICONS[idx % ICONS.length]}</span>
                                <div className="text-left flex-1">
                                    <span className={`text-sm font-bold mr-2 ${selectedStudent?.id === student.id ? 'text-primary' : 'text-base-content'}`}>
                                        {student.number}번
                                    </span>
                                    <span className={`text-sm ${selectedStudent?.id === student.id ? 'font-extrabold' : 'font-medium'}`}>
                                        {student.name.hangul}
                                    </span>
                                </div>
                                {selectedStudent?.id === student.id && (
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-primary" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}


const Dashboard = ({ students, selectedStudent, onSelectStudent, onEditStudent, onDeleteStudent, onAddBehaviorRecord, onDeleteBehaviorRecord, onUpdateStudent, settings }: DashboardProps): React.ReactElement => {
  const [sortOrder, setSortOrder] = useState<SortOrder>('number');
  const [activeTab, setActiveTab] = useState<DashboardTab>('growth');
  const [attendanceViewMode, setAttendanceViewMode] = useState<AttendanceViewMode>('individual');
  
  // Mobile only state for Student Detail Collapse
  const [isMobileDetailOpen, setIsMobileDetailOpen] = useState(false);

  const sortedStudents = useMemo(() => {
    return [...students].sort((a, b) => {
        if (sortOrder === 'number') {
            const numA = parseInt(a.number, 10) || Infinity;
            const numB = parseInt(b.number, 10) || Infinity;
            return numA - numB;
        }
        return a.name.hangul.localeCompare(b.name.hangul);
    });
  }, [students, sortOrder]);

  // Hide student list if in overview mode OR planner/schedule/evaluation mode
  const isFullWidthMode = (activeTab === 'attendance' && attendanceViewMode === 'overview') || 
                          activeTab === 'planner' || 
                          activeTab === 'schedule' ||
                          activeTab === 'evaluation';

  const isStudentSelectableTab = activeTab === 'growth' || (activeTab === 'attendance' && attendanceViewMode === 'individual');

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-4 lg:gap-6 h-full min-h-0">
      {/* Left Column: Student List - Hidden in Overview/Planner Mode AND Hidden on Mobile (replaced by dropdown) */}
      {!isFullWidthMode && (
        <div className="hidden md:flex md:col-span-3 lg:col-span-2 h-full overflow-hidden flex-col gap-4 min-h-0">
            <StudentList 
                students={sortedStudents} 
                selectedStudentId={selectedStudent?.id || null} 
                onSelectStudent={onSelectStudent}
                sortOrder={sortOrder}
                onSortChange={setSortOrder}
            />
        </div>
      )}

      {/* Right Column Area */}
      <div className={`${isFullWidthMode ? 'md:col-span-12' : 'md:col-span-9 lg:col-span-10'} h-full flex flex-col overflow-hidden min-h-0`}>
        
        {/* Mobile Sticky Header Area (Tabs + Student Selector) */}
        <div className="flex flex-col gap-2 mb-2 shrink-0 sticky top-0 z-20 bg-neutral/95 backdrop-blur-sm pt-1 pb-1 md:static md:bg-transparent md:p-0">
            
            {/* 1. Mobile Student Selector (Only visible on Mobile & relevant tabs) */}
            {isStudentSelectableTab && (
                <div className="md:hidden w-full px-1">
                    <MobileStudentSelector 
                        students={sortedStudents} 
                        selectedStudent={selectedStudent} 
                        onSelectStudent={onSelectStudent} 
                    />
                </div>
            )}

            {/* 2. Tab Navigation */}
            <div className="flex justify-between items-center w-full md:w-auto px-1">
                <div className="flex w-full md:w-fit items-center space-x-1 bg-white/70 p-1 rounded-xl border border-base-300/50 backdrop-blur-sm shadow-sm">
                    <button
                        onClick={() => setActiveTab('growth')}
                        className={`flex-1 md:flex-none justify-center px-0 md:px-5 py-2 rounded-lg text-[11px] md:text-sm font-bold transition-all duration-200 flex items-center gap-2 ${
                            activeTab === 'growth' 
                            ? 'bg-white text-primary shadow-sm ring-1 ring-base-200' 
                            : 'text-base-content-secondary hover:bg-white/50'
                        }`}
                    >
                        생활기록
                    </button>
                    <button
                        onClick={() => setActiveTab('attendance')}
                        className={`flex-1 md:flex-none justify-center px-0 md:px-5 py-2 rounded-lg text-[11px] md:text-sm font-bold transition-all duration-200 flex items-center gap-2 ${
                            activeTab === 'attendance' 
                            ? 'bg-white text-primary shadow-sm ring-1 ring-base-200' 
                            : 'text-base-content-secondary hover:bg-white/50'
                        }`}
                    >
                        출결관리
                    </button>
                     <button
                        onClick={() => setActiveTab('evaluation')}
                        className={`flex-1 md:flex-none justify-center px-0 md:px-5 py-2 rounded-lg text-[11px] md:text-sm font-bold transition-all duration-200 flex items-center gap-2 ${
                            activeTab === 'evaluation' 
                            ? 'bg-white text-primary shadow-sm ring-1 ring-base-200' 
                            : 'text-base-content-secondary hover:bg-white/50'
                        }`}
                    >
                        학생평가
                    </button>
                    <button
                        onClick={() => setActiveTab('planner')}
                        className={`flex-1 md:flex-none justify-center px-0 md:px-5 py-2 rounded-lg text-[11px] md:text-sm font-bold transition-all duration-200 flex items-center gap-2 ${
                            activeTab === 'planner' 
                            ? 'bg-white text-primary shadow-sm ring-1 ring-base-200' 
                            : 'text-base-content-secondary hover:bg-white/50'
                        }`}
                    >
                        수업계획
                    </button>
                    <button
                        onClick={() => setActiveTab('schedule')}
                        className={`flex-1 md:flex-none justify-center px-0 md:px-5 py-2 rounded-lg text-[11px] md:text-sm font-bold transition-all duration-200 flex items-center gap-2 ${
                            activeTab === 'schedule' 
                            ? 'bg-white text-primary shadow-sm ring-1 ring-base-200' 
                            : 'text-base-content-secondary hover:bg-white/50'
                        }`}
                    >
                        일정관리
                    </button>
                </div>

                {/* Attendance Sub-Tabs */}
                {activeTab === 'attendance' && (
                    <div className="flex items-center space-x-1 bg-white/70 p-1 rounded-lg border border-base-300/50 ml-2 shadow-sm shrink-0">
                         <button
                            onClick={() => setAttendanceViewMode('individual')}
                            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all whitespace-nowrap ${
                                attendanceViewMode === 'individual'
                                ? 'bg-primary text-primary-content shadow-sm'
                                : 'text-base-content-secondary hover:bg-white/50'
                            }`}
                         >
                             개별
                         </button>
                         <button
                            onClick={() => setAttendanceViewMode('overview')}
                            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all whitespace-nowrap ${
                                attendanceViewMode === 'overview'
                                ? 'bg-primary text-primary-content shadow-sm'
                                : 'text-base-content-secondary hover:bg-white/50'
                            }`}
                         >
                             전체
                         </button>
                    </div>
                )}
            </div>
        </div>

        <div className="flex-1 overflow-hidden min-h-0 relative">
            {/* Growth Record View */}
            {/* iPad Fix: Added pb-20 md:pb-24 to ensure content isn't cut off on tablets */}
            {activeTab === 'growth' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-[5fr_5fr_3fr] gap-4 lg:gap-6 h-full overflow-y-auto md:overflow-hidden pb-20 md:pb-0">
                    {/* Column 1: Detail (+ Lunch on Tablet) */}
                    <div className="flex flex-col gap-4 h-full overflow-hidden order-1 min-h-0">
                        {/* Student Detail */}
                        <div className={`flex-1 overflow-y-auto custom-scrollbar md:pb-24 ${selectedStudent ? '' : 'flex flex-col'}`}>
                            {selectedStudent ? (
                                <>
                                    <div className="md:hidden mb-2">
                                        <button 
                                            onClick={() => setIsMobileDetailOpen(!isMobileDetailOpen)}
                                            className="w-full bg-white border border-base-300 p-2.5 rounded-xl font-bold text-base-content flex items-center justify-between shadow-sm hover:bg-base-50 transition-all"
                                        >
                                            <div className="flex items-center gap-2">
                                                <span>👤</span>
                                                <span>기본 정보 {isMobileDetailOpen ? '접기' : '보기'}</span>
                                            </div>
                                            <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 transition-transform duration-300 ${isMobileDetailOpen ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor">
                                                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                                            </svg>
                                        </button>
                                    </div>
                                    <div className={`${!isMobileDetailOpen ? 'hidden' : 'block'} md:block transition-all duration-300 ease-in-out`}>
                                        <StudentDetail 
                                            student={selectedStudent} 
                                            onEdit={onEditStudent} 
                                            onDelete={onDeleteStudent}
                                        />
                                    </div>
                                </>
                            ) : (
                                <div className="h-40 md:h-full flex flex-col items-center justify-center bg-base-100 rounded-xl shadow-lg border border-base-300/60 p-8">
                                    <span className="text-4xl lg:text-6xl mb-4" role="img" aria-label="sprout">🌱</span>
                                    <h3 className="text-lg font-semibold text-base-content text-center">학생을 선택해주세요</h3>
                                    <p className="text-base-content-secondary mt-1 text-sm text-center hidden lg:block">목록에서 학생을 선택하면 상세 정보가 표시됩니다.</p>
                                </div>
                            )}
                        </div>

                        {/* Lunch Menu (Visible here only on Tablet 'md' but hidden on 'lg') */}
                        <div className="hidden md:block lg:hidden h-[300px] shrink-0">
                             <LunchMenu settings={settings} />
                        </div>
                    </div>

                    {/* Column 2: Behavior Log (Center on PC, Right on Tablet) */}
                    <div className="h-[500px] md:h-full overflow-hidden order-2 min-h-0">
                        {selectedStudent ? (
                        <BehaviorLog
                            student={selectedStudent} 
                            onAddRecord={(record) => onAddBehaviorRecord(selectedStudent.id, record)}
                            onDeleteRecord={(recordId) => onDeleteBehaviorRecord(selectedStudent.id, recordId)}
                            onUpdateStudent={onUpdateStudent}
                        />
                        ) : (
                        <div className="h-full bg-base-100 rounded-xl shadow-lg border border-base-300/60 flex flex-col items-center justify-center p-8">
                            <span className="text-4xl lg:text-5xl mb-4 text-base-content-secondary opacity-50" role="img" aria-label="memo">📝</span>
                            <p className="text-base-content-secondary font-medium">행동 기록을 보려면 학생을 선택하세요.</p>
                        </div>
                        )}
                    </div>

                    {/* Column 3: Lunch (Far Right on PC, Moved to Col 1 on Tablet) */}
                    {/* Mobile: h-auto min-h-[400px] to allow scrolling with the page */}
                    <div className="h-auto min-h-[400px] lg:h-full overflow-visible lg:overflow-hidden order-3 md:hidden lg:block min-h-0">
                        <LunchMenu settings={settings} />
                    </div>
                </div>
            )}

            {/* Attendance View */}
            {activeTab === 'attendance' && (
                <div className="h-full">
                     {attendanceViewMode === 'overview' ? (
                         <AttendanceOverview 
                            students={students} 
                            onSelectStudent={(student) => {
                                onSelectStudent(student);
                                setAttendanceViewMode('individual');
                            }} 
                        />
                     ) : (
                        selectedStudent ? (
                            <AttendanceLog student={selectedStudent} onUpdateStudent={onUpdateStudent} settings={settings} />
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center bg-base-100 rounded-xl shadow-lg border border-base-300/60 p-8">
                                <span className="text-6xl mb-4" role="img" aria-label="calendar">📅</span>
                                <h3 className="text-lg font-semibold text-base-content">학생을 선택해주세요</h3>
                                <p className="text-base-content-secondary mt-1">출결을 관리할 학생을 선택하세요.</p>
                            </div>
                        )
                     )}
                </div>
            )}
            
            {/* Evaluation View */}
            {activeTab === 'evaluation' && (
                <div className="h-full">
                    <EvaluationManager students={sortedStudents} settings={settings} />
                </div>
            )}

            {/* Planner View */}
            {activeTab === 'planner' && (
                <div className="h-full">
                    <ClassPlanner />
                </div>
            )}

            {/* Schedule View */}
            {activeTab === 'schedule' && (
                <div className="h-full">
                    <ScheduleManager />
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
