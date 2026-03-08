
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { firestore, auth } from '../firebase';
import { ClassPlan, PeriodPlan, BasicSchedule, SubjectSetting, TeacherMode } from '../types';
import { useModal } from '../context/ModalContext';

const PERIODS = [1, 2, 3, 4, 5, 6];
const DAYS_OF_WEEK = ['일', '월', '화', '수', '목', '금', '토'];
// Days for the timetable (Mon-Fri)
const SCHOOL_DAYS = [1, 2, 3, 4, 5]; 

// Default Subjects including 1-2 grades
const DEFAULT_SUBJECTS: SubjectSetting[] = [
    { name: '국어', color: 'bg-red-100 text-red-800 border-red-200' },
    { name: '수학', color: 'bg-blue-100 text-blue-800 border-blue-200' },
    { name: '사회', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
    { name: '과학', color: 'bg-green-100 text-green-800 border-green-200' },
    { name: '영어', color: 'bg-purple-100 text-purple-800 border-purple-200' },
    { name: '음악', color: 'bg-pink-100 text-pink-800 border-pink-200' },
    { name: '미술', color: 'bg-orange-100 text-orange-800 border-orange-200' },
    { name: '체육', color: 'bg-teal-100 text-teal-800 border-teal-200' },
    { name: '실과', color: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
    { name: '도덕', color: 'bg-gray-100 text-gray-800 border-gray-200' },
    { name: '창체', color: 'bg-lime-100 text-lime-800 border-lime-200' },
    { name: '안전', color: 'bg-amber-100 text-amber-800 border-amber-200' },
    // 1-2학년 과목 추가
    { name: '바생', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
    { name: '슬생', color: 'bg-cyan-100 text-cyan-800 border-cyan-200' },
    { name: '즐생', color: 'bg-rose-100 text-rose-800 border-rose-200' },
];

// Expanded Color Palette for User Customization
const COLOR_PALETTE = [
    { name: 'Red', class: 'bg-red-100 text-red-800 border-red-200', code: '#fee2e2' },
    { name: 'Orange', class: 'bg-orange-100 text-orange-800 border-orange-200', code: '#ffedd5' },
    { name: 'Amber', class: 'bg-amber-100 text-amber-800 border-amber-200', code: '#fef3c7' },
    { name: 'Yellow', class: 'bg-yellow-100 text-yellow-800 border-yellow-200', code: '#fef9c3' },
    { name: 'Lime', class: 'bg-lime-100 text-lime-800 border-lime-200', code: '#ecfccb' },
    { name: 'Green', class: 'bg-green-100 text-green-800 border-green-200', code: '#dcfce7' },
    { name: 'Emerald', class: 'bg-emerald-100 text-emerald-800 border-emerald-200', code: '#d1fae5' },
    { name: 'Teal', class: 'bg-teal-100 text-teal-800 border-teal-200', code: '#ccfbf1' },
    { name: 'Cyan', class: 'bg-cyan-100 text-cyan-800 border-cyan-200', code: '#cffafe' },
    { name: 'Sky', class: 'bg-sky-100 text-sky-800 border-sky-200', code: '#e0f2fe' },
    { name: 'Blue', class: 'bg-blue-100 text-blue-800 border-blue-200', code: '#dbeafe' },
    { name: 'Indigo', class: 'bg-indigo-100 text-indigo-800 border-indigo-200', code: '#e0e7ff' },
    { name: 'Violet', class: 'bg-violet-100 text-violet-800 border-violet-200', code: '#ede9fe' },
    { name: 'Purple', class: 'bg-purple-100 text-purple-800 border-purple-200', code: '#f3e8ff' },
    { name: 'Fuchsia', class: 'bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200', code: '#fae8ff' },
    { name: 'Pink', class: 'bg-pink-100 text-pink-800 border-pink-200', code: '#fce7f3' },
    { name: 'Rose', class: 'bg-rose-100 text-rose-800 border-rose-200', code: '#ffe4e6' },
    { name: 'Slate', class: 'bg-slate-100 text-slate-800 border-slate-200', code: '#f1f5f9' },
    { name: 'White', class: 'bg-white text-gray-800 border-gray-200', code: '#ffffff' },
];

const getTodayString = () => new Date().toLocaleDateString('en-CA');

const BasicScheduleModal = ({ initialSchedule, onSave, onClose }: { initialSchedule: BasicSchedule, onSave: (s: BasicSchedule) => Promise<void>, onClose: () => void }) => {
    const [schedule, setSchedule] = useState<BasicSchedule>(JSON.parse(JSON.stringify(initialSchedule)));
    const [subjects, setSubjects] = useState<SubjectSetting[]>(initialSchedule.subjectSettings || DEFAULT_SUBJECTS);
    const [draggedSubject, setDraggedSubject] = useState<string | null>(null);
    
    // New Subject State
    const [newSubjectName, setNewSubjectName] = useState('');
    const [isColorPickerOpen, setIsColorPickerOpen] = useState<string | null>(null);

    // Calculate Statistics
    const statistics = useMemo(() => {
        const stats: Record<string, number> = {};
        let totalHours = 0;
        let specialistHours = 0;

        SCHOOL_DAYS.forEach(day => {
            const dayStr = String(day);
            const periods = schedule[dayStr]?.periods || [];
            periods.forEach(p => {
                if (p.subject && !p.disabled) {
                    stats[p.subject] = (stats[p.subject] || 0) + 1;
                    totalHours++;
                    
                    // 전담만 담임 시수에서 제외
                    if (p.teacherMode === 'specialist' || p.isSpecialist) {
                        specialistHours++;
                    }
                    // 원어민(native)과 스강(sports)은 담임 시수에 포함 (제외하지 않음)
                }
            });
        });

        return {
            subjectCounts: stats,
            totalHours,
            specialistHours,
            homeroomHours: totalHours - specialistHours
        };
    }, [schedule]);

    // Click outside to close color picker
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (!(e.target as HTMLElement).closest('.color-picker-container')) {
                setIsColorPickerOpen(null);
            }
        };
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, []);

    const getSubjectColor = (subjectName: string) => {
        const found = subjects.find(s => s.name === subjectName);
        return found ? found.color : 'bg-white border-base-300 text-base-content';
    };

    const handleDragStart = (subjectName: string) => {
        setDraggedSubject(subjectName);
    };

    const handleDrop = (day: string, period: number) => {
        if (!draggedSubject) return;

        setSchedule(prev => {
            const newSchedule = { ...prev };
            if (!newSchedule[day]) {
                newSchedule[day] = { periods: [] };
            }
            if (!newSchedule[day].periods) {
                 newSchedule[day].periods = [];
            }
            
            let periodIndex = newSchedule[day].periods.findIndex((p: PeriodPlan) => p.period === period);
            
            if (periodIndex === -1) {
                const newPeriod: PeriodPlan = {
                     period, 
                     subject: draggedSubject, 
                     topic: '', 
                     materialLink: '', 
                     isSpecialist: false,
                     teacherMode: 'general',
                     disabled: false
                };
                newSchedule[day].periods.push(newPeriod);
            } else {
                newSchedule[day].periods[periodIndex] = {
                    ...newSchedule[day].periods[periodIndex],
                    subject: draggedSubject,
                    teacherMode: 'general', // Reset mode on new drop
                    isSpecialist: false,
                    disabled: false
                };
            }
            return newSchedule;
        });
        setDraggedSubject(null);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };

    const cycleTeacherMode = (day: string, period: number, subject: string) => {
        setSchedule(prev => {
            const newSchedule = { ...prev };
            const periods = newSchedule[day]?.periods;
            if (periods) {
                const idx = periods.findIndex((p: PeriodPlan) => p.period === period);
                if (idx !== -1) {
                    const currentMode = periods[idx].teacherMode || 'general';
                    let nextMode: TeacherMode = 'general';

                    if (subject === '영어') {
                        // 일반 -> 전담 -> 원어민 -> 일반
                        if (currentMode === 'general') nextMode = 'specialist';
                        else if (currentMode === 'specialist') nextMode = 'native';
                        else nextMode = 'general';
                    } else if (subject === '체육') {
                        // 일반 -> 전담 -> 스강 -> 일반
                        if (currentMode === 'general') nextMode = 'specialist';
                        else if (currentMode === 'specialist') nextMode = 'sports';
                        else nextMode = 'general';
                    } else {
                        // 일반 -> 전담 -> 일반
                        if (currentMode === 'general') nextMode = 'specialist';
                        else nextMode = 'general';
                    }

                    periods[idx] = { 
                        ...periods[idx], 
                        teacherMode: nextMode,
                        isSpecialist: nextMode === 'specialist' // Sync legacy flag
                    };
                }
            }
            return newSchedule;
        });
    };

    const removeSubject = (day: string, period: number) => {
        setSchedule(prev => {
            const newSchedule = { ...prev };
            const periods = newSchedule[day]?.periods;
            if (periods) {
                newSchedule[day].periods = periods.filter((p: PeriodPlan) => p.period !== period);
            }
            return newSchedule;
        });
    };

    const getPeriodData = (day: string, period: number) => {
        return schedule[day]?.periods?.find((p: PeriodPlan) => p.period === period);
    };

    const handleAddSubject = () => {
        if (!newSubjectName.trim()) return;
        if (subjects.some(s => s.name === newSubjectName.trim())) {
            alert('이미 존재하는 과목입니다.');
            return;
        }
        const newSub: SubjectSetting = {
            name: newSubjectName.trim(),
            color: 'bg-white text-base-content border-gray-300'
        };
        setSubjects([...subjects, newSub]);
        setNewSubjectName('');
    };

    const handleDeleteSubject = (name: string) => {
        if (confirm(`'${name}' 과목을 목록에서 삭제하시겠습니까?`)) {
            setSubjects(subjects.filter(s => s.name !== name));
        }
    };

    const handleColorChange = (subjectName: string, colorClass: string) => {
        setSubjects(prev => prev.map(s => s.name === subjectName ? { ...s, color: colorClass } : s));
        setIsColorPickerOpen(null);
    };

    const handleSave = () => {
        const scheduleToSave = {
            ...schedule,
            subjectSettings: subjects
        };
        onSave(scheduleToSave);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
            handleSave();
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
             <div 
                className="bg-base-100 rounded-xl shadow-2xl w-full max-w-[1400px] h-[95vh] flex flex-col border border-base-300" 
                onClick={e => e.stopPropagation()}
                onKeyDown={handleKeyDown}
            >
                <div className="p-4 border-b border-base-200 bg-base-50 flex justify-between items-center rounded-t-xl shrink-0">
                    <h3 className="text-xl font-bold text-base-content flex items-center gap-2">
                        기초 시간표 설정
                    </h3>
                    <div className="text-sm text-base-content-secondary">
                        왼쪽 과목을 드래그하여 시간표에 놓고, 클릭하여 전담/원어민/스강 여부를 설정하세요.
                    </div>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-800">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
                
                <div className="flex-1 flex overflow-hidden">
                    {/* Left: Subjects Palette */}
                    <div className="w-56 bg-base-50 border-r-4 border-base-200 p-4 overflow-y-auto custom-scrollbar shrink-0 flex flex-col gap-4 shadow-inner">
                        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 pb-2">
                            <h4 className="font-bold text-base-content mb-2 text-sm flex items-center gap-1">
                                과목 목록 및 색상
                            </h4>
                            {subjects.map((subj) => (
                                <div key={subj.name} className="flex items-center gap-2 group relative">
                                    <div className="color-picker-container relative">
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); setIsColorPickerOpen(isColorPickerOpen === subj.name ? null : subj.name); }}
                                            className={`w-6 h-6 rounded-full border-2 border-white shadow-sm cursor-pointer hover:scale-110 transition-transform ${subj.color.split(' ')[0]}`}
                                            title="색상 변경"
                                        ></button>
                                        
                                        {isColorPickerOpen === subj.name && (
                                            <div className="absolute top-8 left-0 z-50 bg-white p-2 rounded-xl shadow-xl border border-gray-200 grid grid-cols-5 gap-1 w-48 animate-[fadeIn_0.1s_ease-out]">
                                                {COLOR_PALETTE.map((pal) => (
                                                    <button
                                                        key={pal.name}
                                                        className={`w-6 h-6 rounded-full border border-gray-100 hover:scale-125 transition-transform ${pal.class.split(' ')[0]}`}
                                                        style={{ backgroundColor: pal.code }}
                                                        onClick={() => handleColorChange(subj.name, pal.class)}
                                                        title={pal.name}
                                                    />
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    <div
                                        draggable
                                        onDragStart={() => handleDragStart(subj.name)}
                                        className={`
                                            flex-1 p-2.5 rounded-lg border font-bold text-center cursor-grab active:cursor-grabbing shadow-sm hover:shadow-md transition-all text-sm
                                            ${subj.color}
                                        `}
                                    >
                                        {subj.name}
                                    </div>

                                    <button 
                                        onClick={() => handleDeleteSubject(subj.name)}
                                        className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-1"
                                        title="과목 삭제"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414 1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                        </svg>
                                    </button>
                                </div>
                            ))}
                        </div>

                        <div className="pt-3 border-t border-gray-200">
                            <label className="text-xs font-bold text-gray-500 mb-1 block">새 과목 추가</label>
                            <div className="flex gap-1">
                                <input 
                                    type="text" 
                                    value={newSubjectName}
                                    onChange={(e) => setNewSubjectName(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === 'Enter') handleAddSubject(); }}
                                    className="flex-1 p-2 border border-base-300 rounded-md text-sm focus:ring-2 focus:ring-primary focus:border-primary"
                                    placeholder="과목명"
                                />
                                <button 
                                    onClick={handleAddSubject}
                                    className="bg-base-200 hover:bg-base-300 text-base-content p-2 rounded-md transition-colors"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Center: Timetable Grid */}
                    <div className="flex-1 overflow-auto custom-scrollbar p-6 bg-slate-50 relative flex flex-col">
                        <div className="min-w-[600px] flex flex-col h-full bg-white shadow-sm border border-slate-300">
                            {/* Header */}
                            <div className="grid grid-cols-6 border-b-2 border-slate-300 bg-slate-100">
                                <div className="text-center font-bold text-gray-500 py-3 border-r border-slate-300">교시</div>
                                {SCHOOL_DAYS.map((dayIdx, idx) => (
                                    <div key={dayIdx} className={`text-center font-bold text-lg py-3 border-slate-300 text-gray-700 ${idx !== SCHOOL_DAYS.length -1 ? 'border-r' : ''}`}>
                                        {DAYS_OF_WEEK[dayIdx]}요일
                                    </div>
                                ))}
                            </div>

                            {/* Body */}
                            <div className="flex-1 grid grid-cols-6 grid-rows-6">
                                {PERIODS.map((period, pIdx) => (
                                    <React.Fragment key={period}>
                                        <div className={`flex items-center justify-center font-bold text-gray-500 bg-white border-r border-slate-300 ${pIdx !== PERIODS.length -1 ? 'border-b border-slate-200' : ''}`}>
                                            {period}교시
                                        </div>

                                        {SCHOOL_DAYS.map((dayIdx, dIdx) => {
                                            const dayStr = String(dayIdx);
                                            const plan = getPeriodData(dayStr, period);
                                            const hasSubject = plan && plan.subject;
                                            const colorClass = hasSubject ? getSubjectColor(plan.subject) : 'bg-white';
                                            const teacherMode = plan?.teacherMode || 'general';

                                            return (
                                                <div
                                                    key={`${dayIdx}-${period}`}
                                                    onDrop={() => handleDrop(dayStr, period)}
                                                    onDragOver={handleDragOver}
                                                    className={`
                                                        relative flex flex-col items-center justify-center p-1 transition-all group
                                                        ${colorClass}
                                                        ${!hasSubject ? 'hover:bg-primary/5' : 'cursor-pointer hover:brightness-95'}
                                                        ${dIdx !== SCHOOL_DAYS.length - 1 ? 'border-r border-slate-200' : ''}
                                                        ${pIdx !== PERIODS.length - 1 ? 'border-b border-slate-200' : ''}
                                                    `}
                                                    onClick={() => hasSubject && cycleTeacherMode(dayStr, period, plan.subject)}
                                                    title={hasSubject ? "클릭하여 모드 변경 (일반/전담/원어민/스강)" : ""}
                                                >
                                                    {hasSubject ? (
                                                        <>
                                                            <span className="font-extrabold text-lg drop-shadow-sm select-none">{plan.subject}</span>
                                                            
                                                            {/* Controls Overlay (Delete) */}
                                                            <div className="absolute top-1 right-1 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                <button 
                                                                    onClick={(e) => { e.stopPropagation(); removeSubject(dayStr, period); }}
                                                                    className="bg-white/80 hover:bg-red-100 text-red-500 p-1 rounded shadow-sm"
                                                                    title="삭제"
                                                                >
                                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                                                                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414 1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                                                    </svg>
                                                                </button>
                                                            </div>

                                                            {/* Mode Badge */}
                                                            {teacherMode !== 'general' && (
                                                                <div className="absolute bottom-1 right-1 pointer-events-none">
                                                                    {teacherMode === 'specialist' && (
                                                                        <span className="text-[10px] bg-purple-600 text-white px-1.5 py-0.5 rounded font-bold shadow-sm opacity-90">전담</span>
                                                                    )}
                                                                    {teacherMode === 'native' && (
                                                                        <span className="text-[10px] bg-indigo-600 text-white px-1.5 py-0.5 rounded font-bold shadow-sm opacity-90">원어민</span>
                                                                    )}
                                                                    {teacherMode === 'sports' && (
                                                                        <span className="text-[10px] bg-cyan-600 text-white px-1.5 py-0.5 rounded font-bold shadow-sm opacity-90">스강</span>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </>
                                                    ) : (
                                                        <span className="text-gray-200 font-bold text-3xl select-none group-hover:text-primary/30">+</span>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </React.Fragment>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Right: Statistics Panel */}
                    <div className="w-64 bg-base-50 border-l-4 border-base-200 p-4 overflow-y-auto custom-scrollbar shrink-0 shadow-inner flex flex-col gap-6">
                        {/* Summary */}
                        <div className="bg-white p-4 rounded-xl border border-base-200 shadow-sm">
                            <h4 className="font-bold text-base-content mb-3 border-b pb-2">주당 수업 시수 요약</h4>
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-600">총 수업 시수</span>
                                    <span className="font-bold text-base-content">{statistics.totalHours}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-600">전담 수업 시수</span>
                                    <span className="font-bold text-purple-600">{statistics.specialistHours}</span>
                                </div>
                                <div className="border-t pt-2 mt-2 flex justify-between items-center bg-green-50 p-2 rounded -mx-2">
                                    <span className="text-green-800 font-bold">담임 수업 시수</span>
                                    <span className="font-extrabold text-green-700 text-lg">{statistics.homeroomHours}</span>
                                </div>
                                <p className="text-[10px] text-gray-400 mt-1 leading-tight text-right">
                                    * 원어민/스포츠강사는 담임 시수에 포함됩니다.
                                </p>
                            </div>
                        </div>

                        {/* Detail Table */}
                        <div className="flex-1">
                            <h4 className="font-bold text-base-content mb-2 text-sm">과목별 주당 시수</h4>
                            <div className="border border-base-300 rounded-lg overflow-hidden bg-white shadow-sm">
                                <table className="w-full text-sm">
                                    <thead className="bg-base-100 text-gray-500 font-bold border-b border-base-200">
                                        <tr>
                                            <th className="py-2 px-3 text-left">과목</th>
                                            <th className="py-2 px-3 text-right">시수</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-base-100">
                                        {Object.entries(statistics.subjectCounts)
                                            // Fix: Explicitly cast to number to resolve TypeScript arithmetic operation error
                                            .sort(([, a], [, b]) => (b as number) - (a as number))
                                            .map(([subject, count]) => (
                                            <tr key={subject} className="hover:bg-base-50">
                                                <td className="py-2 px-3 font-medium text-gray-700">{subject}</td>
                                                <td className="py-2 px-3 text-right font-bold text-gray-900">{count}</td>
                                            </tr>
                                        ))}
                                        {Object.keys(statistics.subjectCounts).length === 0 && (
                                            <tr>
                                                <td colSpan={2} className="py-4 text-center text-gray-400 text-xs">수업이 없습니다.</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-4 border-t border-base-200 bg-base-50 rounded-b-xl flex justify-between items-center shrink-0">
                    <p className="text-xs text-base-content-secondary">
                        * 시간표의 과목을 클릭하여 <strong>전담, 원어민(영어), 스강(체육)</strong> 모드를 변경할 수 있습니다.
                    </p>
                    <div className="flex gap-3">
                        <button onClick={onClose} className="px-5 py-2.5 rounded-lg font-bold text-gray-600 hover:bg-gray-200 transition-colors">
                            취소
                        </button>
                        <button 
                            onClick={() => handleSave()}
                            className="px-6 py-2.5 rounded-lg font-bold text-white bg-primary hover:bg-primary-focus shadow-md transition-all"
                        >
                            저장하기 (Enter)
                        </button>
                    </div>
                </div>
             </div>
        </div>
    );
};

const ClassPlanner = (): React.ReactElement => {
  const { showAlert } = useModal();
  const [selectedDate, setSelectedDate] = useState(getTodayString());
  const [loading, setLoading] = useState(false);
  const [plans, setPlans] = useState<PeriodPlan[]>([]);
  const [calendarDate, setCalendarDate] = useState(new Date());
  
  // Basic Schedule State
  const [basicSchedule, setBasicSchedule] = useState<BasicSchedule>({});
  const [isBasicScheduleModalOpen, setIsBasicScheduleModalOpen] = useState(false);

  const currentSubjects = basicSchedule.subjectSettings || DEFAULT_SUBJECTS;

  const getSubjectColor = (subjectName: string) => {
      const found = currentSubjects.find(s => s.name === subjectName);
      return found ? found.color : 'bg-white border-base-300 text-base-content';
  };

  const [isMobileCalendarOpen, setIsMobileCalendarOpen] = useState(true);

  const getEmptyPlans = (): PeriodPlan[] => {
    return PERIODS.map(p => ({
      period: p,
      subject: '',
      topic: '',
      materialLink: '',
      isSpecialist: false,
      teacherMode: 'general',
      teacherMemo: '',
      disabled: false
    }));
  };

  useEffect(() => {
      const fetchBasicSchedule = async () => {
          const user = auth.currentUser;
          if (!user) return;
          try {
              const docRef = firestore.collection('users').doc(user.uid).collection('appData').doc('basicSchedule');
              const doc = await docRef.get();
              if (doc.exists) {
                  setBasicSchedule(doc.data() as BasicSchedule);
              }
          } catch (e) {
              console.error("Error loading basic schedule", e);
          }
      };
      fetchBasicSchedule();
  }, []);

  useEffect(() => {
    fetchPlan(selectedDate);
  }, [selectedDate, basicSchedule]);

  const fetchPlan = async (dateStr: string) => {
    const user = auth.currentUser;
    if (!user) return;

    setLoading(true);
    try {
      const docRef = firestore.collection('users').doc(user.uid).collection('classPlans').doc(dateStr);
      const doc = await docRef.get();

      if (doc.exists) {
        const data = doc.data() as ClassPlan;
        const mergedPlans = getEmptyPlans().map(defaultPlan => {
            const existing = data.periods.find(p => p.period === defaultPlan.period);
            if (existing) {
                // Backward compatibility for isSpecialist
                if (existing.isSpecialist && !existing.teacherMode) {
                    existing.teacherMode = 'specialist';
                }
                return { ...defaultPlan, ...existing };
            }
            return defaultPlan;
        });
        setPlans(mergedPlans);
      } else {
        const dayOfWeek = new Date(dateStr).getDay();
        const daySchedule = basicSchedule[String(dayOfWeek)];
        
        let initialPlans = getEmptyPlans();
        
        if (daySchedule && daySchedule.periods) {
            initialPlans = initialPlans.map(p => {
                const basicPeriod = (daySchedule.periods as PeriodPlan[]).find(bp => bp.period === p.period);
                if (basicPeriod) {
                    return {
                        ...p,
                        subject: basicPeriod.subject,
                        teacherMode: basicPeriod.teacherMode || (basicPeriod.isSpecialist ? 'specialist' : 'general'),
                        isSpecialist: basicPeriod.isSpecialist || false,
                        disabled: basicPeriod.disabled || false
                    };
                }
                return p;
            });
        }
        setPlans(initialPlans);
      }
    } catch (error) {
      console.error("Error fetching class plan:", error);
      await showAlert("수업 계획을 불러오는 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    const user = auth.currentUser;
    if (!user) return;

    setLoading(true);
    try {
      const docRef = firestore.collection('users').doc(user.uid).collection('classPlans').doc(selectedDate);
      const planData: ClassPlan = {
        date: selectedDate,
        periods: plans
      };
      
      await docRef.set(planData, { merge: true });
      await showAlert("수업 계획이 저장되었습니다.");
    } catch (error) {
      console.error("Error saving class plan:", error);
      await showAlert("저장 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveBasicSchedule = async (newSchedule: BasicSchedule) => {
      const user = auth.currentUser;
      if (!user) return;
      try {
          const docRef = firestore.collection('users').doc(user.uid).collection('appData').doc('basicSchedule');
          await docRef.set(newSchedule);
          setBasicSchedule(newSchedule);
          setIsBasicScheduleModalOpen(false);
          await showAlert("기초 시간표와 과목 설정이 저장되었습니다.\n새로운 날짜 선택 시 적용됩니다.");
      } catch (e) {
          console.error(e);
          await showAlert("기초 시간표 저장 중 오류가 발생했습니다.");
      }
  };

  const updatePlan = (index: number, field: keyof PeriodPlan, value: any) => {
    setPlans(prev => {
      const newPlans = [...prev];
      if (field === 'teacherMode') {
          // Sync legacy flag
          newPlans[index] = { 
              ...newPlans[index], 
              teacherMode: value,
              isSpecialist: value === 'specialist'
          };
      } else {
          newPlans[index] = { ...newPlans[index], [field]: value };
      }
      return newPlans;
    });
  };

  const handleOpenLink = (url: string) => {
    if (!url) return;
    let targetUrl = url;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        targetUrl = 'https://' + url;
    }
    window.open(targetUrl, '_blank');
  };

  const handleDateSelect = (dateStr: string) => {
      setSelectedDate(dateStr);
      if (window.innerWidth < 1024) {
          setIsMobileCalendarOpen(false);
      }
  };

  const year = calendarDate.getFullYear();
  const month = calendarDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startDay = new Date(year, month, 1).getDay();
  const days = [];
  for (let i = 0; i < startDay; i++) days.push(null);
  for (let i = 1; i <= daysInMonth; i++) days.push(i);

  const handlePrevMonth = () => setCalendarDate(new Date(year, month - 1, 1));
  const handleNextMonth = () => setCalendarDate(new Date(year, month + 1, 1));
  
  const getDateStr = (day: number) => `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  const currentDayOfWeek = new Date(selectedDate).getDay();
  const isWeekend = currentDayOfWeek === 0 || currentDayOfWeek === 6;

  return (
    <div className="h-full flex flex-col md:flex-row gap-6 overflow-hidden">
      <div className={`flex-1 overflow-hidden bg-base-100 rounded-xl shadow-lg border border-base-300/60 order-2 md:order-1 transition-all duration-300 min-h-0 ${isMobileCalendarOpen ? 'hidden md:flex flex-col' : 'flex flex-col'}`}>
        <div className="p-4 border-b border-base-300 bg-base-50 flex flex-wrap justify-between items-center shrink-0 gap-2">
            
            <button 
                onClick={() => setIsMobileCalendarOpen(true)}
                className="md:hidden flex items-center gap-2 text-base-content hover:bg-base-200 p-2 rounded-lg -ml-2"
            >
                <span className="text-2xl">🗓️</span>
                <div className="text-left">
                    <div className="text-xs text-base-content-secondary">날짜 선택</div>
                    <div className="text-sm font-bold">{selectedDate}</div>
                </div>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
            </button>

            <div className="flex items-center gap-3 hidden md:flex">
                 <span className="text-2xl">🎒</span>
                 <div>
                    <h2 className="text-lg font-bold text-base-content flex items-center gap-2">
                        수업 계획
                        {isWeekend && <span className="text-xs text-red-500 bg-red-50 px-2 py-0.5 rounded-full border border-red-100">주말</span>}
                    </h2>
                    <p className={`text-xs font-medium ${currentDayOfWeek === 0 ? 'text-red-500' : currentDayOfWeek === 6 ? 'text-blue-500' : 'text-base-content-secondary'}`}>
                        {selectedDate} ({DAYS_OF_WEEK[currentDayOfWeek]})
                    </p>
                 </div>
            </div>
            <div className="flex gap-2 w-full md:w-auto justify-end">
                <button
                    onClick={() => setIsBasicScheduleModalOpen(true)}
                    className="bg-white text-base-content-secondary border border-base-300 px-3 py-2 rounded-lg font-bold shadow-sm hover:bg-base-50 transition-all text-xs flex items-center gap-1 whitespace-nowrap"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    기초 시간표
                </button>
                <button 
                    onClick={handleSave}
                    disabled={loading}
                    className="bg-primary text-primary-content px-4 py-2 rounded-lg font-bold shadow-sm hover:bg-primary-focus transition-all text-sm flex items-center gap-2 disabled:opacity-50 whitespace-nowrap"
                >
                    {loading ? (
                        <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                    ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                    )}
                    저장하기
                </button>
            </div>
        </div>
        
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4 bg-base-50/30 pb-32">
            {isWeekend && (
                <div className="bg-orange-50 border border-orange-100 rounded-xl p-4 text-center mb-4">
                    <p className="text-orange-800 font-bold text-sm">오늘은 수업이 없는 주말입니다 🎈</p>
                    <p className="text-orange-600 text-xs mt-1">하지만 필요하다면 기록을 남길 수 있어요.</p>
                </div>
            )}
            
            {plans.map((plan, index) => {
                if (plan.disabled) {
                    return (
                        <div 
                            key={plan.period} 
                            onClick={() => updatePlan(index, 'disabled', false)}
                            className="group flex items-center justify-center p-4 rounded-xl border-2 border-dashed border-base-300 bg-base-100/50 hover:border-primary/50 hover:bg-primary/5 transition-all cursor-pointer h-20"
                        >
                            <div className="flex items-center gap-2 text-base-content-secondary group-hover:text-primary font-bold transition-colors">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110 2h3V6a1 1 0 011-1z" clipRule="evenodd" />
                                </svg>
                                <span>{plan.period}교시 수업 추가</span>
                            </div>
                        </div>
                    );
                }
                
                const subjectColorClass = getSubjectColor(plan.subject);
                const teacherMode = plan.teacherMode || (plan.isSpecialist ? 'specialist' : 'general');
                
                // 전담, 원어민, 스강은 모두 'Specialist View' (메모 모드)를 사용하지만
                // 배지는 다르게 표시함
                const isSpecialistView = teacherMode !== 'general';

                return (
                <div 
                    key={plan.period} 
                    className={`flex flex-col sm:flex-row gap-3 p-4 rounded-xl border shadow-sm hover:shadow-md transition-all group relative
                        ${isSpecialistView ? 'bg-purple-50 border-purple-200 ring-1 ring-purple-100' : 'bg-white border-base-300'}
                    `}
                >
                    <button 
                        onClick={() => updatePlan(index, 'disabled', true)}
                        className="absolute top-2 right-2 text-base-content-secondary/40 hover:text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-all opacity-0 group-hover:opacity-100 z-10"
                        title={`${plan.period}교시 삭제`}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                    </button>

                    <div className="w-full sm:w-20 flex sm:flex-col items-center sm:justify-center gap-2 sm:gap-0 shrink-0 border-b sm:border-b-0 sm:border-r border-base-200 pb-2 sm:pb-0 pr-0 sm:pr-4 relative">
                        <span className={`text-xs font-bold px-2 py-1 rounded-md border
                            ${isSpecialistView ? 'bg-purple-100 text-purple-700 border-purple-200 shadow-sm' : 'bg-secondary text-secondary-content border-green-100'}
                        `}>
                            {plan.period}교시
                        </span>
                        {teacherMode === 'specialist' && <span className="text-[10px] bg-purple-600 text-white px-1.5 py-0.5 rounded mt-1 font-bold shadow-sm">전담</span>}
                        {teacherMode === 'native' && <span className="text-[10px] bg-indigo-600 text-white px-1.5 py-0.5 rounded mt-1 font-bold shadow-sm">원어민</span>}
                        {teacherMode === 'sports' && <span className="text-[10px] bg-cyan-600 text-white px-1.5 py-0.5 rounded mt-1 font-bold shadow-sm">스강</span>}
                    </div>
                    
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                        <div className="md:col-span-2 relative">
                            <label className="block text-xs font-bold text-base-content-secondary mb-1.5">과목</label>
                            <div className="relative">
                                <select 
                                    value={plan.subject}
                                    onChange={(e) => updatePlan(index, 'subject', e.target.value)}
                                    className={`w-full p-2.5 pr-8 appearance-none border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all text-sm font-bold text-center shadow-sm cursor-pointer
                                        ${plan.subject ? subjectColorClass : 'bg-white border-base-300 text-base-content'}
                                    `}
                                >
                                    <option value="" className="bg-white text-base-content">선택</option>
                                    {currentSubjects.map(s => (
                                        <option key={s.name} value={s.name} className="bg-white text-base-content font-bold">
                                            {s.name}
                                        </option>
                                    ))}
                                    {plan.subject && !currentSubjects.some(s => s.name === plan.subject) && (
                                        <option value={plan.subject} className="bg-white text-base-content">{plan.subject}</option>
                                    )}
                                </select>
                                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-base-content-secondary">
                                    <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                                </div>
                            </div>
                        </div>

                        {isSpecialistView ? (
                             <div className="md:col-span-10">
                                <label className="block text-xs font-bold text-purple-700 mb-1.5 flex items-center gap-1">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                                        <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-2 0 1 1 0 112 0zm-1.657 4.243a1 1 0 01-1.414 1.414l-.707-.707a1 1 0 011.414-1.414l.707.707zM11 18a1 1 0 01-2 0v-1a1 1 0 012 0v1zM5.757 15.657a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414l-.707.707zM4 10a1 1 0 01-2 0 1 1 0 112 0zM5.757 4.343a1 1 0 011.414 1.414l-.707.707a1 1 0 01-1.414-1.414l.707-.707z" />
                                    </svg>
                                    전달사항 (준비물/알림)
                                </label>
                                <input 
                                    type="text" 
                                    value={plan.teacherMemo || ''}
                                    onChange={(e) => updatePlan(index, 'teacherMemo', e.target.value)}
                                    placeholder="학생들에게 전달할 내용이나 메모를 입력하세요 (예: 준비물, 체육복)"
                                    className="w-full p-2.5 bg-purple-50/50 border border-purple-200 rounded-lg focus:ring-2 focus:ring-purple-400 focus:border-purple-400 transition-all text-sm text-purple-900 placeholder-purple-300 shadow-sm"
                                />
                            </div>
                        ) : (
                            <>
                                <div className="md:col-span-6">
                                    <label className="block text-xs font-bold text-base-content-secondary mb-1.5">학습 주제</label>
                                    <input 
                                        type="text" 
                                        value={plan.topic}
                                        onChange={(e) => updatePlan(index, 'topic', e.target.value)}
                                        placeholder="오늘 배울 내용을 입력하세요"
                                        className="w-full p-2.5 bg-white border border-base-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all text-sm text-base-content placeholder-base-300 shadow-sm"
                                    />
                                </div>

                                <div className="md:col-span-4">
                                    <label className="block text-xs font-bold text-base-content-secondary mb-1.5">수업 자료 (링크)</label>
                                    <div className="flex gap-1.5">
                                        <input 
                                            type="text" 
                                            value={plan.materialLink}
                                            onChange={(e) => updatePlan(index, 'materialLink', e.target.value)}
                                            placeholder="https://"
                                            className="w-full p-2.5 bg-white border border-base-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all text-sm text-blue-600 placeholder-base-300 shadow-sm"
                                        />
                                        {plan.materialLink && (
                                            <button 
                                                onClick={() => handleOpenLink(plan.materialLink)}
                                                className="bg-base-100 hover:bg-base-200 text-primary p-2.5 rounded-lg border border-base-300 transition-colors shadow-sm"
                                                title="링크 열기"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                                </svg>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </>
                        )}
                        
                        <div className="md:col-span-12 flex justify-end gap-3 text-xs">
                            <label className="flex items-center gap-1 cursor-pointer">
                                <input 
                                    type="radio" 
                                    name={`mode-${index}`}
                                    checked={teacherMode === 'general'} 
                                    onChange={() => updatePlan(index, 'teacherMode', 'general')}
                                    className="radio radio-xs radio-primary"
                                />
                                <span>담임</span>
                            </label>
                            <label className="flex items-center gap-1 cursor-pointer">
                                <input 
                                    type="radio" 
                                    name={`mode-${index}`}
                                    checked={teacherMode === 'specialist'} 
                                    onChange={() => updatePlan(index, 'teacherMode', 'specialist')}
                                    className="radio radio-xs radio-secondary"
                                />
                                <span>전담</span>
                            </label>
                            {plan.subject === '영어' && (
                                <label className="flex items-center gap-1 cursor-pointer">
                                    <input 
                                        type="radio" 
                                        name={`mode-${index}`}
                                        checked={teacherMode === 'native'} 
                                        onChange={() => updatePlan(index, 'teacherMode', 'native')}
                                        className="radio radio-xs radio-accent"
                                    />
                                    <span>원어민</span>
                                </label>
                            )}
                            {plan.subject === '체육' && (
                                <label className="flex items-center gap-1 cursor-pointer">
                                    <input 
                                        type="radio" 
                                        name={`mode-${index}`}
                                        checked={teacherMode === 'sports'} 
                                        onChange={() => updatePlan(index, 'teacherMode', 'sports')}
                                        className="radio radio-xs radio-info"
                                    />
                                    <span>스강</span>
                                </label>
                            )}
                        </div>
                    </div>
                </div>
            )})}
        </div>
      </div>

      <div className={`md:w-64 lg:w-80 shrink-0 flex flex-col bg-white rounded-xl shadow-lg border border-base-300/60 order-1 md:order-2 md:h-full transition-all duration-300 min-h-0 ${!isMobileCalendarOpen ? 'hidden md:flex' : 'flex'}`}>
        <div className="p-4 border-b border-base-200 bg-base-50 rounded-t-xl">
             <h3 className="font-bold text-base-content flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-base-content-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                날짜 선택
             </h3>
        </div>
        <div className="p-4">
            <div className="flex justify-between items-center mb-4">
                <button onClick={handlePrevMonth} className="p-1 hover:bg-base-100 rounded-full"><svg className="w-5 h-5 text-base-content-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg></button>
                <span className="font-bold text-base-content text-sm">{year}년 {month + 1}월</span>
                <button onClick={handleNextMonth} className="p-1 hover:bg-base-100 rounded-full"><svg className="w-5 h-5 text-base-content-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg></button>
            </div>
            
            <div className="grid grid-cols-7 gap-1 mb-2 text-center text-xs font-bold text-base-content-secondary">
                <div className="text-red-500">일</div>
                <div>월</div><div>화</div><div>수</div><div>목</div><div>금</div>
                <div className="text-blue-500">토</div>
            </div>
            
            <div className="grid grid-cols-7 gap-1">
                {days.map((day, i) => {
                    if (!day) return <div key={`empty-${i}`}></div>;
                    
                    const dateStr = getDateStr(day);
                    const isSelected = dateStr === selectedDate;
                    const isToday = dateStr === getTodayString();
                    const date = new Date(year, month, day);
                    const dayOfWeek = date.getDay();
                    const isSun = dayOfWeek === 0;
                    const isSat = dayOfWeek === 6;

                    return (
                        <button
                            key={day}
                            onClick={() => handleDateSelect(dateStr)}
                            className={`
                                h-8 w-8 mx-auto rounded-full flex items-center justify-center text-xs font-bold transition-all
                                ${isSelected 
                                    ? 'bg-primary text-primary-content shadow-md scale-110' 
                                    : 'hover:bg-base-200 text-base-content'
                                }
                                ${isToday && !isSelected ? 'ring-1 ring-primary text-primary' : ''}
                                ${!isSelected && isSun ? 'text-red-500' : ''}
                                ${!isSelected && isSat ? 'text-blue-500' : ''}
                            `}
                        >
                            {day}
                        </button>
                    );
                })}
            </div>
        </div>
        <div className="p-4 border-t border-base-200 bg-base-50/50 rounded-b-xl flex-1 flex items-end">
            <p className="text-xs text-base-content-secondary leading-relaxed w-full">
                💡 <span className="font-bold text-primary">기초 시간표</span>를 설정하면 날짜 선택 시 자동으로 과목이 채워집니다.
            </p>
        </div>
      </div>

      {isBasicScheduleModalOpen && (
          <BasicScheduleModal 
             initialSchedule={basicSchedule} 
             onSave={handleSaveBasicSchedule}
             onClose={() => setIsBasicScheduleModalOpen(false)} 
          />
      )}
    </div>
  );
};

export default ClassPlanner;
