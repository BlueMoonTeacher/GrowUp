
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

/** 급식·탭 옆 날짜 표시용 (로컬 기준 YYYY-MM-DD) */
const getDashboardTodayString = () => new Date().toLocaleDateString('en-CA');

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
                        className={`px-2.5 py-1 rounded-md text-xs font-bold transition-colors duration-200 ${sortOrder === order
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
                    className={`w-full text-left p-2.5 rounded-lg transition-all duration-200 flex items-center space-x-3 ${selectedStudentId === student.id
                            ? 'bg-primary text-primary-content shadow-md'
                            : 'hover:bg-secondary hover:text-secondary-content text-base-content-secondary'
                        }`}
                >
                    <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center shadow-sm text-lg ${selectedStudentId === student.id ? 'bg-primary-content text-primary' : 'bg-secondary text-secondary-content border border-base-300/30'
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
                                className={`flex items-center gap-3 p-2 rounded-xl transition-colors ${selectedStudent?.id === student.id
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
        <div className="grid h-full min-h-0 min-w-0 grid-cols-1 gap-3 md:grid-cols-12 md:gap-3 lg:gap-4">
            {/* Left Column: Student List - Hidden in Overview/Planner Mode AND Hidden on Mobile (replaced by dropdown) */}
            {!isFullWidthMode && (
                <div className="hidden min-h-0 min-w-0 flex-col gap-3 overflow-hidden md:flex md:col-span-3 lg:col-span-2">
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
            <div className={`${isFullWidthMode ? 'md:col-span-12' : 'md:col-span-9 lg:col-span-10'} flex h-full min-h-0 min-w-0 flex-col overflow-hidden`}>

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

                    {/* 2. Tab Navigation (+ 생활기록 탭일 때만 태블릿 이상에서 급식 기준일) */}
                    <div className="flex w-full flex-wrap items-center justify-between gap-2 px-1 md:flex-nowrap md:gap-3">
                        <div className="flex min-w-0 w-full flex-1 items-center space-x-1 rounded-xl border border-base-300/50 bg-white/70 p-1 shadow-sm backdrop-blur-sm md:w-fit md:flex-initial">
                            <button
                                onClick={() => setActiveTab('growth')}
                                className={`flex-1 md:flex-none justify-center px-0 md:px-5 py-2 rounded-lg text-[11px] md:text-sm font-bold transition-all duration-200 flex items-center gap-2 ${activeTab === 'growth'
                                        ? 'bg-white text-primary shadow-sm ring-1 ring-base-200'
                                        : 'text-base-content-secondary hover:bg-white/50'
                                    }`}
                            >
                                생활기록
                            </button>
                            <button
                                onClick={() => setActiveTab('attendance')}
                                className={`flex-1 md:flex-none justify-center px-0 md:px-5 py-2 rounded-lg text-[11px] md:text-sm font-bold transition-all duration-200 flex items-center gap-2 ${activeTab === 'attendance'
                                        ? 'bg-white text-primary shadow-sm ring-1 ring-base-200'
                                        : 'text-base-content-secondary hover:bg-white/50'
                                    }`}
                            >
                                출결관리
                            </button>
                            <button
                                onClick={() => setActiveTab('evaluation')}
                                className={`flex-1 md:flex-none justify-center px-0 md:px-5 py-2 rounded-lg text-[11px] md:text-sm font-bold transition-all duration-200 flex items-center gap-2 ${activeTab === 'evaluation'
                                        ? 'bg-white text-primary shadow-sm ring-1 ring-base-200'
                                        : 'text-base-content-secondary hover:bg-white/50'
                                    }`}
                            >
                                학생평가
                            </button>
                            <button
                                onClick={() => setActiveTab('planner')}
                                className={`flex-1 md:flex-none justify-center px-0 md:px-5 py-2 rounded-lg text-[11px] md:text-sm font-bold transition-all duration-200 flex items-center gap-2 ${activeTab === 'planner'
                                        ? 'bg-white text-primary shadow-sm ring-1 ring-base-200'
                                        : 'text-base-content-secondary hover:bg-white/50'
                                    }`}
                            >
                                수업계획
                            </button>
                            <button
                                onClick={() => setActiveTab('schedule')}
                                className={`flex-1 md:flex-none justify-center px-0 md:px-5 py-2 rounded-lg text-[11px] md:text-sm font-bold transition-all duration-200 flex items-center gap-2 ${activeTab === 'schedule'
                                        ? 'bg-white text-primary shadow-sm ring-1 ring-base-200'
                                        : 'text-base-content-secondary hover:bg-white/50'
                                    }`}
                            >
                                일정관리
                            </button>
                        </div>

                        <div className="flex shrink-0 items-center gap-2 md:ml-auto">
                        {activeTab === 'growth' && (
                            <time
                                dateTime={getDashboardTodayString()}
                                className="hidden rounded-full border border-primary/20 bg-primary px-3 py-1.5 text-sm font-bold text-primary-content shadow-sm md:inline-block whitespace-nowrap"
                                title="오늘 급식 기준일"
                            >
                                {getDashboardTodayString()}
                            </time>
                        )}

                        {/* Attendance Sub-Tabs */}
                        {activeTab === 'attendance' && (
                            <div className="flex shrink-0 items-center space-x-1 rounded-lg border border-base-300/50 bg-white/70 p-1 shadow-sm">
                                <button
                                    onClick={() => setAttendanceViewMode('individual')}
                                    className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all whitespace-nowrap ${attendanceViewMode === 'individual'
                                            ? 'bg-primary text-primary-content shadow-sm'
                                            : 'text-base-content-secondary hover:bg-white/50'
                                        }`}
                                >
                                    개별
                                </button>
                                <button
                                    onClick={() => setAttendanceViewMode('overview')}
                                    className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all whitespace-nowrap ${attendanceViewMode === 'overview'
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
                </div>

                <div className="relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden md:overflow-hidden">
                    {/* Growth: 모바일은 예전처럼 자연 높이+pb-20 / PC(md+)만 그리드 행 1fr로 열 높이 통일 */}
                    {activeTab === 'growth' && (
                        <div className="grid min-h-0 min-w-0 grid-cols-1 gap-2 pb-20 max-md:h-auto max-md:auto-rows-auto max-md:overflow-visible md:h-full md:min-h-0 md:auto-rows-[minmax(0,1fr)] md:grid-cols-2 md:gap-3 md:overflow-hidden md:pb-0 lg:grid-cols-[5fr_5fr_3fr] lg:gap-3">
                            {/* Column 1: Detail (+ Lunch on Tablet) */}
                            <div className="order-1 flex min-h-0 min-w-0 flex-col gap-3 max-md:h-auto max-md:overflow-visible md:h-full md:min-h-0 md:overflow-hidden md:gap-4">
                                {/* Student Detail — PC: md:min-h-0+flex-1로 행 높이까지 전달 */}
                                <div className={`max-md:flex-none max-md:overflow-visible md:min-h-0 md:flex-1 md:overflow-y-auto custom-scrollbar md:pb-24 ${selectedStudent ? '' : 'flex min-h-0 flex-col'}`}>
                                    {selectedStudent ? (
                                        <>
                                            <div className="md:hidden mb-2">
                                                <button
                                                    onClick={() => setIsMobileDetailOpen(!isMobileDetailOpen)}
                                                    className="w-full bg-white border border-base-300 p-2.5 rounded-xl font-bold text-base-content flex items-center justify-between shadow-sm hover:bg-base-50 transition-all"
                                                >
                                                    <div className="flex items-center gap-2">
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
                                        <div className="flex min-h-[10rem] max-md:flex-none flex-col items-center justify-center rounded-xl border border-base-300/60 bg-base-100 p-8 shadow-lg md:flex-1 md:min-h-0">
                                            <h3 className="text-lg font-semibold text-base-content text-center mt-4">학생을 선택해주세요</h3>
                                            <p className="text-base-content-secondary mt-1 text-sm text-center hidden lg:block">목록에서 학생을 선택하면 상세 정보가 표시됩니다.</p>
                                        </div>
                                    )}
                                </div>

                                {/* Lunch Menu (Visible here only on Tablet 'md' but hidden on 'lg') */}
                                <div className="hidden h-[300px] min-h-0 min-w-0 shrink-0 overflow-hidden rounded-xl md:block lg:hidden">
                                    <LunchMenu settings={settings} />
                                </div>
                            </div>

                            {/* Column 2: Behavior Log (Center on PC, Right on Tablet) */}
                            <div className="order-2 min-h-0 min-w-0 max-md:h-auto max-md:overflow-visible md:h-full md:min-h-0 md:overflow-hidden">
                                {selectedStudent ? (
                                    <BehaviorLog
                                        student={selectedStudent}
                                        onAddRecord={(record) => onAddBehaviorRecord(selectedStudent.id, record)}
                                        onDeleteRecord={(recordId) => onDeleteBehaviorRecord(selectedStudent.id, recordId)}
                                        onUpdateStudent={onUpdateStudent}
                                    />
                                ) : (
                                    <div className="flex h-full min-h-[10rem] flex-col items-center justify-center rounded-xl border border-base-300/60 bg-base-100 p-8 shadow-lg md:min-h-0">
                                        <p className="text-base-content-secondary mt-4 font-medium">행동 기록을 보려면 학생을 선택하세요.</p>
                                    </div>
                                )}
                            </div>

                            {/* Column 3: Lunch (Far Right on PC, Moved to Col 1 on Tablet) */}
                            <div className="order-3 min-h-0 min-w-0 shrink-0 max-md:h-auto max-md:overflow-visible rounded-xl md:hidden md:overflow-hidden lg:block lg:h-full">
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
                                        <h3 className="text-lg font-semibold text-base-content mt-4">학생을 선택해주세요</h3>
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
