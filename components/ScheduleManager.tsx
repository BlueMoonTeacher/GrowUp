
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { firestore, auth, storage } from '../firebase';
import { ScheduleEvent, ScheduleSettings, ScheduleCategoryDef, ChecklistItem, ChecklistType, ChecklistCompletion, ScheduleAttachment } from '../types';
import { useModal } from '../context/ModalContext';
import type { AppSettings } from '../App';
import { extractScheduleEventsFromImage } from '../services/geminiService';
import type { ExtractedScheduleDraft } from '../services/geminiService';
import {
    formatDateKoreanFull,
    formatWeekRangeKorean,
    formatMonthKorean,
    getPeriodKeyForType,
    formatCompletionPeriodKorean,
    typeLabelKo,
} from '../utils/checklistPeriod';

// Default categories if user hasn't set any
const DEFAULT_CATEGORIES: ScheduleCategoryDef[] = [
    { id: 'cat_1', label: '업무', colorClass: 'bg-blue-100 text-blue-800 border-blue-200' },
    { id: 'cat_2', label: '수업', colorClass: 'bg-green-100 text-green-800 border-green-200' },
    { id: 'cat_3', label: '행사', colorClass: 'bg-orange-100 text-orange-800 border-orange-200' },
    { id: 'cat_4', label: '개인', colorClass: 'bg-purple-100 text-purple-800 border-purple-200' },
    { id: 'cat_5', label: '기타', colorClass: 'bg-gray-100 text-gray-800 border-gray-200' },
];

const DEFAULT_SETTINGS: ScheduleSettings = {
    categories: DEFAULT_CATEGORIES,
    viewOptions: {
        showTime: true,
        showLocation: false,
    }
};

// Available color palettes for custom categories
const COLOR_PALETTE = [
    { name: 'Blue', class: 'bg-blue-100 text-blue-800 border-blue-200' },
    { name: 'Green', class: 'bg-green-100 text-green-800 border-green-200' },
    { name: 'Red', class: 'bg-red-100 text-red-800 border-red-200' },
    { name: 'Orange', class: 'bg-orange-100 text-orange-800 border-orange-200' },
    { name: 'Yellow', class: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
    { name: 'Purple', class: 'bg-purple-100 text-purple-800 border-purple-200' },
    { name: 'Pink', class: 'bg-pink-100 text-pink-800 border-pink-200' },
    { name: 'Indigo', class: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
    { name: 'Teal', class: 'bg-teal-100 text-teal-800 border-teal-200' },
    { name: 'Cyan', class: 'bg-cyan-100 text-cyan-800 border-cyan-200' },
    { name: 'Lime', class: 'bg-lime-100 text-lime-800 border-lime-200' },
    { name: 'Slate', class: 'bg-slate-100 text-slate-800 border-slate-200' },
];

const getTodayString = () => new Date().toLocaleDateString('en-CA');

// --- Checklist Component ---
const ITEMS_PREVIEW_COUNT: Record<ChecklistType, number> = {
    daily: 8,
    weekly: 7,
    monthly: 7,
};

const getEventTimeLabel = (event: Pick<ScheduleEvent, 'time' | 'endTime'>) => {
    if (!event.time) return '';
    return event.endTime ? `${event.time}–${event.endTime}` : event.time;
};

interface PendingScheduleImage {
    id: string;
    file: File;
    previewUrl: string;
}

interface ScheduleImagePreview {
    url: string;
    name: string;
}

const DAILY_RANK_VISIBLE_KEY = 'growup-daily-checklist-show-rank';

const sortDailyChecklistItems = (list: ChecklistItem[]): ChecklistItem[] => {
    return [...list].sort((a, b) => {
        const ao = a.sortOrder;
        const bo = b.sortOrder;
        if (ao != null && bo != null) return ao - bo;
        if (ao != null && bo == null) return -1;
        if (ao == null && bo != null) return 1;
        return a.createdAt - b.createdAt;
    });
};

/** 일일 체크리스트 순위 뱃지: 1·2·3위는 눈에 띄게 구분 */
const dailyRankBadgeClass = (rank: number): string => {
    if (rank === 1) {
        return 'border-amber-500 bg-gradient-to-b from-amber-200 to-amber-300 text-amber-950 shadow-sm ring-1 ring-amber-400/70';
    }
    if (rank === 2) {
        return 'border-slate-400 bg-gradient-to-b from-slate-200 to-slate-300 text-slate-900 shadow-sm ring-1 ring-slate-300/90';
    }
    if (rank === 3) {
        return 'border-orange-600 bg-gradient-to-b from-orange-200 to-orange-300 text-orange-950 shadow-sm ring-1 ring-orange-500/45';
    }
    return 'border-rose-200/80 bg-white/90 text-rose-900/90';
};

interface ChecklistSectionProps {
    title: string;
    dateLabel: string;
    type: ChecklistType;
    items: ChecklistItem[];
    onAdd: (type: ChecklistType, content: string) => void;
    onComplete: (item: ChecklistItem) => void;
    onDelete: (id: string) => void;
    colorTheme: {
        bg: string;
        border: string;
        title: string;
        icon: string;
        accent: string;
    };
    /** 일일 체크리스트: 순서 저장·드래그·순위 표시 */
    dailyOrdering?: {
        onReorder: (orderedIds: string[]) => void;
    };
}

const ChecklistSection = ({ title, dateLabel, type, items, onAdd, onComplete, onDelete, colorTheme, dailyOrdering }: ChecklistSectionProps) => {
    const [newItemText, setNewItemText] = useState('');
    const [isExpanded, setIsExpanded] = useState(false);
    const [dragIndex, setDragIndex] = useState<number | null>(null);
    const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
    const [showRankNumbers, setShowRankNumbers] = useState(() => {
        try {
            return localStorage.getItem(DAILY_RANK_VISIBLE_KEY) !== 'false';
        } catch {
            return true;
        }
    });

    useEffect(() => {
        try {
            localStorage.setItem(DAILY_RANK_VISIBLE_KEY, String(showRankNumbers));
        } catch { /* ignore */ }
    }, [showRankNumbers]);

    const enableDailyOrder = type === 'daily' && !!dailyOrdering?.onReorder;

    const sortedItems = useMemo(() => {
        if (enableDailyOrder) return sortDailyChecklistItems(items);
        return items;
    }, [items, enableDailyOrder]);

    const previewCount = ITEMS_PREVIEW_COUNT[type];
    const hasMoreItems = sortedItems.length > previewCount;
    const currentItems = isExpanded || !hasMoreItems ? sortedItems : sortedItems.slice(0, previewCount);

    const applyReorder = useCallback((from: number, to: number) => {
        if (!dailyOrdering?.onReorder || from === to) return;
        const full = [...sortedItems];
        const boundedTo = Math.max(0, Math.min(full.length - 1, to));
        const [removed] = full.splice(from, 1);
        full.splice(boundedTo, 0, removed);
        dailyOrdering.onReorder(full.map(i => i.id));
    }, [sortedItems, dailyOrdering]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (newItemText.trim()) {
            onAdd(type, newItemText.trim());
            setNewItemText('');
            // Automatically expand when adding new items if it exceeds the preview count
            if (!isExpanded && sortedItems.length >= previewCount) {
                setIsExpanded(true);
            }
        }
    };

    return (
        <div className={`${colorTheme.bg} schedule-checklist-card h-full rounded-xl p-4 border ${colorTheme.border} shadow-sm flex flex-col transition-all duration-300`}>
            {/* Header with Expand/Collapse Toggle */}
            <div className="flex items-start justify-between gap-2 mb-3 shrink-0 min-h-8">
                <div className="flex flex-col gap-0.5 min-w-0">
                    <div className="flex items-center gap-2">
                        <span className="text-lg shrink-0">{colorTheme.icon}</span>
                        <h3 className={`font-bold ${colorTheme.title} leading-tight`}>{title}</h3>
                    </div>
                    <p className="text-[11px] sm:text-xs font-semibold text-gray-600 pl-7 leading-tight">{dateLabel}</p>
                </div>

                <div className="flex flex-col items-end gap-1.5 shrink-0">
                    {enableDailyOrder && sortedItems.length > 0 && (
                        <label className="flex cursor-pointer items-center gap-1.5 rounded-full border border-white/80 bg-white/70 px-2 py-0.5 text-[10px] font-bold text-gray-600 shadow-sm hover:bg-white">
                            <input
                                type="checkbox"
                                className="checkbox checkbox-xs rounded border-gray-300"
                                checked={showRankNumbers}
                                onChange={e => setShowRankNumbers(e.target.checked)}
                            />
                            <span className="whitespace-nowrap">순위 표시</span>
                        </label>
                    )}
                    {/* Expand/Collapse Toggle - Only show if items exceed preview count */}
                    {hasMoreItems && (
                        <button
                            type="button"
                            onClick={() => setIsExpanded(!isExpanded)}
                            className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold transition-all border
                                ${isExpanded
                                    ? `bg-white ${colorTheme.title} ${colorTheme.border} shadow-sm`
                                    : `bg-white/60 text-gray-500 border-transparent hover:bg-white hover:text-gray-700`
                                }
                            `}
                        >
                            <span>{isExpanded ? '접기' : `+${sortedItems.length - previewCount} 더보기`}</span>
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className={`h-3 w-3 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}
                                viewBox="0 0 20 20"
                                fill="currentColor"
                            >
                                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                        </button>
                    )}
                </div>
            </div>

            {/* Items List - Dynamic Height */}
            <div className={`schedule-checklist-list min-h-[15rem] overflow-y-auto custom-scrollbar transition-all duration-300 ease-in-out ${isExpanded ? 'max-h-[800px]' : 'max-h-[19rem]'} space-y-1 mb-3 pr-0.5`}>
                {currentItems.length > 0 ? (
                    currentItems.map(item => {
                        const globalIndex = sortedItems.findIndex(x => x.id === item.id);
                        const isDragging = enableDailyOrder && dragIndex === globalIndex;
                        const isOver = enableDailyOrder && dragOverIndex === globalIndex;
                        return (
                            <div
                                key={item.id}
                                onDragOver={e => {
                                    if (!enableDailyOrder || dragIndex === null) return;
                                    e.preventDefault();
                                    e.dataTransfer.dropEffect = 'move';
                                    setDragOverIndex(globalIndex);
                                }}
                                onDrop={e => {
                                    e.preventDefault();
                                    if (!enableDailyOrder) return;
                                    const raw = e.dataTransfer.getData('text/plain');
                                    let from: number | null = dragIndex;
                                    if (raw !== '') {
                                        const parsed = parseInt(raw, 10);
                                        if (!Number.isNaN(parsed)) from = parsed;
                                    }
                                    setDragOverIndex(null);
                                    setDragIndex(null);
                                    if (from === null) return;
                                    applyReorder(from, globalIndex);
                                }}
                                className={`group flex items-center gap-1.5 text-sm animate-[fadeIn_0.2s_ease-out] p-1.5 rounded-lg hover:bg-white/80 hover:shadow-sm transition-all
                                    ${isDragging ? 'opacity-50' : ''}
                                    ${isOver && dragIndex !== globalIndex ? 'ring-1 ring-red-300/80 bg-white/90' : ''}
                                `}
                            >
                                {enableDailyOrder && showRankNumbers && (
                                    <span
                                        className={`flex h-6 min-w-[1.35rem] shrink-0 items-center justify-center rounded-md border text-[11px] font-extrabold tabular-nums ${dailyRankBadgeClass(globalIndex + 1)}`}
                                    >
                                        {globalIndex + 1}
                                    </span>
                                )}
                                <button
                                    type="button"
                                    title="완료하면 목록에서 숨겨지고 완료 기록에 남습니다"
                                    onClick={() => onComplete(item)}
                                    className="h-4 w-4 shrink-0 rounded border flex items-center justify-center transition-colors bg-white border-gray-300 hover:border-red-400 hover:bg-red-50"
                                />
                                <span className="min-w-0 flex-1 break-words leading-tight text-gray-700 font-medium">
                                    {item.content}
                                </span>
                                {enableDailyOrder && (
                                    <span
                                        draggable
                                        onDragStart={e => {
                                            setDragIndex(globalIndex);
                                            e.dataTransfer.effectAllowed = 'move';
                                            e.dataTransfer.setData('text/plain', String(globalIndex));
                                        }}
                                        onDragEnd={() => {
                                            setDragIndex(null);
                                            setDragOverIndex(null);
                                        }}
                                        className="shrink-0 cursor-grab touch-none select-none text-gray-400 hover:text-gray-600 active:cursor-grabbing"
                                        title="드래그하여 순서 변경"
                                        aria-label="순서 바꾸기(드래그)"
                                    >
                                        <svg className="h-5 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                                            <circle cx="9" cy="8" r="1.35" />
                                            <circle cx="15" cy="8" r="1.35" />
                                            <circle cx="9" cy="12" r="1.35" />
                                            <circle cx="15" cy="12" r="1.35" />
                                            <circle cx="9" cy="16" r="1.35" />
                                            <circle cx="15" cy="16" r="1.35" />
                                        </svg>
                                    </span>
                                )}
                                <button
                                    type="button"
                                    onClick={() => onDelete(item.id)}
                                    className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-opacity"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                    </svg>
                                </button>
                            </div>
                        );
                    })
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-gray-400 italic text-xs">
                        <p>등록된 할 일이 없습니다</p>
                    </div>
                )}
            </div>

            <form onSubmit={handleSubmit} className="shrink-0 mt-auto">
                <input
                    type="text"
                    value={newItemText}
                    onChange={(e) => setNewItemText(e.target.value)}
                    placeholder="항목 추가..."
                    className="w-full text-sm p-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-1 focus:ring-gray-400 bg-white/50 focus:bg-white transition-all placeholder-gray-400"
                />
            </form>
        </div>
    );
};

const SettingsModal = ({ currentSettings, onSave, onClose }: { currentSettings: ScheduleSettings, onSave: (s: ScheduleSettings) => Promise<void>, onClose: () => void }) => {
    const [settings, setSettings] = useState<ScheduleSettings>(JSON.parse(JSON.stringify(currentSettings)));

    const handleLabelChange = (index: number, val: string) => {
        const newCats = [...settings.categories];
        newCats[index].label = val;
        setSettings({ ...settings, categories: newCats });
    };

    const handleColorChange = (index: number, val: string) => {
        const newCats = [...settings.categories];
        newCats[index].colorClass = val;
        setSettings({ ...settings, categories: newCats });
    };

    const handleDeleteCategory = (index: number) => {
        const newCats = settings.categories.filter((_, i) => i !== index);
        setSettings({ ...settings, categories: newCats });
    };

    const handleAddCategory = () => {
        const newId = Math.random().toString(36).substr(2, 9);
        const newCat: ScheduleCategoryDef = {
            id: newId,
            label: '새 분류',
            colorClass: COLOR_PALETTE[0].class
        };
        setSettings({ ...settings, categories: [...settings.categories, newCat] });
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
            onSave(settings);
        }
    };

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
            <div
                className="bg-white rounded-xl shadow-2xl w-full max-w-lg border border-base-300 max-h-[90vh] flex flex-col"
                onClick={e => e.stopPropagation()}
                onKeyDown={handleKeyDown}
            >
                <div className="p-4 border-b border-base-200 bg-base-50 flex justify-between items-center rounded-t-xl shrink-0">
                    <h3 className="text-xl font-bold text-base-content flex items-center gap-2">
                        일정 설정
                    </h3>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-800">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                <div className="p-6 overflow-y-auto custom-scrollbar">
                    <div className="mb-6">
                        <label className="block text-sm font-bold text-gray-700 mb-3">분류(Category) 관리</label>
                        <div className="space-y-3">
                            {settings.categories.map((cat, index) => (
                                <div key={cat.id} className="flex items-center gap-2">
                                    <input
                                        type="text"
                                        value={cat.label}
                                        onChange={(e) => handleLabelChange(index, e.target.value)}
                                        className="flex-1 p-2 border border-base-300 rounded text-sm bg-white text-gray-900 focus:ring-primary focus:border-primary"
                                        placeholder="분류명"
                                    />
                                    <select
                                        value={cat.colorClass}
                                        onChange={(e) => handleColorChange(index, e.target.value)}
                                        className={`w-32 p-2 border border-base-300 rounded text-sm cursor-pointer ${cat.colorClass}`}
                                    >
                                        {COLOR_PALETTE.map(c => (
                                            <option key={c.name} value={c.class} className="bg-white text-gray-800">
                                                {c.name}
                                            </option>
                                        ))}
                                    </select>
                                    <button
                                        onClick={() => handleDeleteCategory(index)}
                                        className="p-2 text-gray-400 hover:text-red-500 rounded hover:bg-red-50"
                                        disabled={settings.categories.length <= 1}
                                        title="삭제"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                                        </svg>
                                    </button>
                                </div>
                            ))}
                        </div>
                        <button
                            onClick={handleAddCategory}
                            className="mt-3 text-sm font-bold text-primary hover:text-primary-focus flex items-center gap-1"
                        >
                            + 새 분류 추가
                        </button>
                    </div>

                    <div className="pt-4 border-t border-base-200">
                        <label className="block text-sm font-bold text-gray-700 mb-3">보기 설정</label>
                        <div className="space-y-3">
                            <label className="flex items-center justify-between p-3 bg-base-50 rounded-lg border border-base-200 cursor-pointer hover:bg-base-100 transition-colors">
                                <span className="text-sm font-bold text-gray-700">달력에 시간 표시</span>
                                <div className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={settings.viewOptions.showTime}
                                        onChange={(e) => setSettings({ ...settings, viewOptions: { ...settings.viewOptions, showTime: e.target.checked } })}
                                        className="sr-only peer"
                                    />
                                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                                </div>
                            </label>

                            <label className="flex items-center justify-between p-3 bg-base-50 rounded-lg border border-base-200 cursor-pointer hover:bg-base-100 transition-colors">
                                <span className="text-sm font-bold text-gray-700">달력에 장소 표시</span>
                                <div className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={settings.viewOptions.showLocation}
                                        onChange={(e) => setSettings({ ...settings, viewOptions: { ...settings.viewOptions, showLocation: e.target.checked } })}
                                        className="sr-only peer"
                                    />
                                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                                </div>
                            </label>
                        </div>
                    </div>
                </div>

                <div className="p-4 border-t border-base-200 bg-base-50 rounded-b-xl flex justify-end gap-3 shrink-0">
                    <button onClick={onClose} className="px-5 py-2 rounded-lg font-bold text-gray-600 hover:bg-gray-200 transition-colors">
                        취소
                    </button>
                    <button
                        onClick={() => onSave(settings)}
                        className="px-6 py-2 rounded-lg font-bold text-white bg-primary hover:bg-primary-focus shadow-md transition-all"
                    >
                        저장하기 (Enter)
                    </button>
                </div>
            </div>
        </div>
    );
};

// --- Recurring Event Modal ---
interface RecurringEventModalProps {
    categories: ScheduleCategoryDef[];
    onSave: (events: Omit<ScheduleEvent, 'id'>[]) => Promise<void>;
    onClose: () => void;
}

const RecurringEventModal = ({ categories, onSave, onClose }: RecurringEventModalProps) => {
    const [title, setTitle] = useState('');
    const [category, setCategory] = useState(categories[0]?.label || '업무');
    const [location, setLocation] = useState('');
    const [time, setTime] = useState('14:00');
    const [hasEndTime, setHasEndTime] = useState(false);
    const [endTime, setEndTime] = useState('15:00');
    const [memo, setMemo] = useState('');

    const [startDate, setStartDate] = useState(getTodayString());
    const [endDate, setEndDate] = useState(getTodayString());

    const [recurrenceType, setRecurrenceType] = useState<'weekly' | 'monthly'>('weekly');
    const [selectedWeekDays, setSelectedWeekDays] = useState<boolean[]>([false, true, false, false, false, false, false]); // Sun to Sat
    const [selectedMonthDay, setSelectedMonthDay] = useState<number>(1);

    const [isSaving, setIsSaving] = useState(false);

    const weekDaysLabel = ['일', '월', '화', '수', '목', '금', '토'];

    const toggleWeekDay = (index: number) => {
        const newDays = [...selectedWeekDays];
        newDays[index] = !newDays[index];
        setSelectedWeekDays(newDays);
    };

    const handleGenerateAndSave = async () => {
        if (!title.trim()) {
            alert("일정 내용을 입력해주세요.");
            return;
        }
        if (new Date(startDate) > new Date(endDate)) {
            alert("종료일은 시작일보다 뒤여야 합니다.");
            return;
        }
        if (hasEndTime && (!time || !endTime || endTime <= time)) {
            alert("종료시간은 시작시간보다 뒤여야 합니다.");
            return;
        }

        setIsSaving(true);
        const eventsToCreate: Omit<ScheduleEvent, 'id'>[] = [];
        const current = new Date(startDate);
        const end = new Date(endDate);

        while (current <= end) {
            let shouldAdd = false;
            if (recurrenceType === 'weekly') {
                if (selectedWeekDays[current.getDay()]) {
                    shouldAdd = true;
                }
            } else {
                if (current.getDate() === selectedMonthDay) {
                    shouldAdd = true;
                }
            }

            if (shouldAdd) {
                eventsToCreate.push({
                    date: current.toLocaleDateString('en-CA'),
                    title,
                    category,
                    location,
                    time,
                    endTime: hasEndTime ? endTime : '',
                    memo,
                    isCompleted: false
                });
            }
            current.setDate(current.getDate() + 1);
        }

        if (eventsToCreate.length === 0) {
            alert("해당 기간 내에 조건에 맞는 날짜가 없습니다.");
            setIsSaving(false);
            return;
        }

        await onSave(eventsToCreate);
        setIsSaving(false);
        onClose();
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
            handleGenerateAndSave();
        }
    };

    return (
        <div className="fixed inset-0 z-[65] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
            <div
                className="bg-white rounded-xl shadow-2xl w-full max-w-lg border border-base-300 max-h-[90vh] flex flex-col"
                onClick={e => e.stopPropagation()}
                onKeyDown={handleKeyDown}
            >
                <div className="p-4 border-b border-base-200 bg-base-50 flex justify-between items-center rounded-t-xl shrink-0">
                    <h3 className="text-xl font-bold text-base-content flex items-center gap-2">
                        고정 일정(반복) 등록
                    </h3>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-800">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                <div className="p-6 overflow-y-auto custom-scrollbar space-y-5">
                    {/* Basic Info */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                            <label className="block text-xs font-bold text-base-content-secondary mb-1.5">할 일 (내용)</label>
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="반복되는 일정 내용"
                                className="w-full p-2.5 bg-white border border-base-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary text-sm font-bold"
                            />
                        </div>
                        <div className={hasEndTime ? '' : 'col-span-1'}>
                            <label className="block text-xs font-bold text-base-content-secondary mb-1.5">시작시간</label>
                            <input
                                type="time"
                                value={time}
                                onChange={(e) => setTime(e.target.value)}
                                className="w-full p-2.5 bg-white border border-base-300 rounded-lg text-sm"
                            />
                        </div>
                        <div>
                            {hasEndTime ? (
                                <>
                                    <label className="block text-xs font-bold text-base-content-secondary mb-1.5">종료시간</label>
                                    <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="w-full p-2.5 bg-white border border-base-300 rounded-lg text-sm" />
                                </>
                            ) : (
                                <label className="flex h-full min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-base-200 bg-base-50 px-3 text-xs font-bold text-base-content-secondary">
                                    <input type="checkbox" checked={hasEndTime} onChange={(e) => setHasEndTime(e.target.checked)} className="checkbox checkbox-sm" />
                                    종료시간도 입력
                                </label>
                            )}
                        </div>
                        {hasEndTime && (
                            <label className="col-span-2 flex cursor-pointer items-center gap-2 text-xs font-bold text-base-content-secondary">
                                <input type="checkbox" checked={hasEndTime} onChange={(e) => setHasEndTime(e.target.checked)} className="checkbox checkbox-sm" />
                                종료시간 사용
                            </label>
                        )}
                        <div className="col-span-2">
                            <label className="block text-xs font-bold text-base-content-secondary mb-1.5">장소</label>
                            <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} className="w-full p-2.5 bg-white border border-base-300 rounded-lg text-sm" />
                        </div>
                        <div className="col-span-2">
                            <label className="block text-xs font-bold text-base-content-secondary mb-1.5">분류</label>
                            <div className="flex flex-wrap gap-2">
                                {categories.map(cat => (
                                    <button
                                        key={cat.id}
                                        onClick={() => setCategory(cat.label)}
                                        className={`px-3 py-1.5 rounded-md text-xs font-bold border transition-all
                                            ${category === cat.label
                                                ? `${cat.colorClass} ring-2 ring-offset-1 ring-current shadow-sm`
                                                : 'bg-white border-base-300 text-base-content-secondary hover:bg-base-50'
                                            }
                                        `}
                                    >
                                        {cat.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="border-t border-base-200"></div>

                    {/* Period & Recurrence */}
                    <div>
                        <label className="block text-sm font-bold text-primary mb-3">기간 및 반복 설정</label>
                        <div className="grid grid-cols-2 gap-4 mb-4">
                            <div>
                                <label className="block text-xs font-bold text-base-content-secondary mb-1.5">시작일</label>
                                <input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className="w-full p-2.5 bg-white border border-base-300 rounded-lg text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-base-content-secondary mb-1.5">종료일</label>
                                <input
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    className="w-full p-2.5 bg-white border border-base-300 rounded-lg text-sm"
                                />
                            </div>
                        </div>

                        <div className="flex gap-4 mb-3">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="radio"
                                    name="recurrence"
                                    checked={recurrenceType === 'weekly'}
                                    onChange={() => setRecurrenceType('weekly')}
                                    className="radio radio-primary radio-sm"
                                />
                                <span className="text-sm font-bold">매주 (요일 선택)</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="radio"
                                    name="recurrence"
                                    checked={recurrenceType === 'monthly'}
                                    onChange={() => setRecurrenceType('monthly')}
                                    className="radio radio-primary radio-sm"
                                />
                                <span className="text-sm font-bold">매월 (일자 선택)</span>
                            </label>
                        </div>

                        <div className="bg-base-50 p-4 rounded-xl border border-base-200">
                            {recurrenceType === 'weekly' ? (
                                <div className="flex justify-between">
                                    {weekDaysLabel.map((day, idx) => (
                                        <button
                                            key={day}
                                            onClick={() => toggleWeekDay(idx)}
                                            className={`w-10 h-10 rounded-full text-sm font-bold transition-all shadow-sm
                                                ${selectedWeekDays[idx]
                                                    ? idx === 0 ? 'bg-red-500 text-white' : idx === 6 ? 'bg-blue-500 text-white' : 'bg-primary text-white'
                                                    : 'bg-white border border-base-300 text-gray-500 hover:bg-gray-100'
                                                }
                                            `}
                                        >
                                            {day}
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <div className="flex items-center gap-3">
                                    <span className="text-sm font-bold">매월</span>
                                    <input
                                        type="number"
                                        min="1"
                                        max="31"
                                        value={selectedMonthDay}
                                        onChange={(e) => setSelectedMonthDay(parseInt(e.target.value))}
                                        className="w-20 p-2 bg-white border border-base-300 rounded-lg text-center font-bold"
                                    />
                                    <span className="text-sm font-bold">일에 반복</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="p-4 border-t border-base-200 bg-base-50 rounded-b-xl flex justify-end gap-3 shrink-0">
                    <button onClick={onClose} className="px-5 py-2 rounded-lg font-bold text-gray-600 hover:bg-gray-200 transition-colors">
                        취소
                    </button>
                    <button
                        onClick={handleGenerateAndSave}
                        disabled={isSaving}
                        className="px-6 py-2 rounded-lg font-bold text-white bg-primary hover:bg-primary-focus shadow-md transition-all flex items-center gap-2"
                    >
                        {isSaving && <span className="loading loading-spinner loading-xs"></span>}
                        일괄 등록하기 (Enter)
                    </button>
                </div>
            </div>
        </div>
    );
};


const ScheduleManager = ({ appSettings }: { appSettings: AppSettings }): React.ReactElement => {
    const { showAlert, showConfirm } = useModal();
    const [currentDate, setCurrentDate] = useState(new Date());
    const [events, setEvents] = useState<ScheduleEvent[]>([]);
    const [settings, setSettings] = useState<ScheduleSettings>(DEFAULT_SETTINGS);
    const [loading, setLoading] = useState(false);

    // Checklist State
    const [checklists, setChecklists] = useState<ChecklistItem[]>([]);
    const [checklistCompletions, setChecklistCompletions] = useState<ChecklistCompletion[]>([]);
    const [scheduleMainView, setScheduleMainView] = useState<'calendar' | 'checklistLog'>('calendar');

    // UI States
    const [isEventModalOpen, setIsEventModalOpen] = useState(false);
    const [isRecurringModalOpen, setIsRecurringModalOpen] = useState(false);
    const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
    const [isAnalyzingCapture, setIsAnalyzingCapture] = useState(false);
    const [scheduleDrafts, setScheduleDrafts] = useState<ExtractedScheduleDraft[]>([]);
    const [captureMessage, setCaptureMessage] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [copyDateInput, setCopyDateInput] = useState('');
    const [copyDates, setCopyDates] = useState<string[]>([]);
    const [isCopySectionOpen, setIsCopySectionOpen] = useState(false);
    const [isCopying, setIsCopying] = useState(false);
    const [pendingScheduleImages, setPendingScheduleImages] = useState<PendingScheduleImage[]>([]);
    const [isSavingEvent, setIsSavingEvent] = useState(false);
    const [imagePreview, setImagePreview] = useState<ScheduleImagePreview | null>(null);

    // Form Data
    const [formData, setFormData] = useState<Omit<ScheduleEvent, 'id'>>({
        date: getTodayString(),
        title: '',
        category: '업무',
        isCompleted: false,
        location: '',
        time: '14:00', // Default time
        endTime: '',
        memo: '',
        attachments: [],
    });

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    useEffect(() => {
        if (!imagePreview) return;
        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setImagePreview(null);
        };
        window.addEventListener('keydown', handleEscape);
        return () => window.removeEventListener('keydown', handleEscape);
    }, [imagePreview]);

    // Fetch Events & Settings & Checklists
    useEffect(() => {
        const fetchData = async () => {
            const user = auth.currentUser;
            if (!user) return;

            setLoading(true);
            try {
                // Fetch Settings
                const settingsDoc = await firestore.collection('users').doc(user.uid).collection('appData').doc('scheduleSettings').get();
                if (settingsDoc.exists) {
                    setSettings(settingsDoc.data() as ScheduleSettings);
                }

                // Fetch Events
                const schedSnapshot = await firestore.collection('users').doc(user.uid).collection('schedules').get();
                const fetchedEvents = schedSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ScheduleEvent));
                setEvents(fetchedEvents);

                // Fetch Checklists
                const checkSnapshot = await firestore.collection('users').doc(user.uid).collection('checklists').orderBy('createdAt', 'asc').get();
                let fetchedChecklists = checkSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ChecklistItem));

                const legacyChecked = fetchedChecklists.filter(i => i.isChecked);
                if (legacyChecked.length > 0) {
                    const batch = firestore.batch();
                    legacyChecked.forEach(item => {
                        batch.update(
                            firestore.collection('users').doc(user.uid).collection('checklists').doc(item.id),
                            { isChecked: false }
                        );
                    });
                    await batch.commit();
                    fetchedChecklists = fetchedChecklists.map(i => ({ ...i, isChecked: false }));
                }
                setChecklists(fetchedChecklists);

                const compSnap = await firestore
                    .collection('users')
                    .doc(user.uid)
                    .collection('checklistCompletions')
                    .orderBy('completedAt', 'desc')
                    .limit(500)
                    .get();
                const fetchedComp: ChecklistCompletion[] = compSnap.docs.map(doc => {
                    const d = doc.data();
                    let at = Date.now();
                    if (d.completedAt && typeof d.completedAt.toMillis === 'function') {
                        at = d.completedAt.toMillis();
                    } else if (typeof d.completedAt === 'number') {
                        at = d.completedAt;
                    }
                    return {
                        id: doc.id,
                        checklistItemId: d.checklistItemId,
                        type: d.type as ChecklistType,
                        periodKey: d.periodKey,
                        contentSnapshot: d.contentSnapshot || '',
                        completedAt: at,
                    };
                });
                setChecklistCompletions(fetchedComp);

            } catch (error) {
                console.error("Error fetching schedule data:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const clearPendingScheduleImages = () => {
        setPendingScheduleImages(prev => {
            prev.forEach(image => URL.revokeObjectURL(image.previewUrl));
            return [];
        });
    };

    const closeEventModal = () => {
        setIsEventModalOpen(false);
        setImagePreview(null);
        clearPendingScheduleImages();
    };

    const uploadScheduleImages = async (userId: string, eventId: string, images: PendingScheduleImage[]): Promise<ScheduleAttachment[]> => {
        return Promise.all(images.map(async image => {
            const safeName = image.file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
            const path = `users/${userId}/scheduleAttachments/${eventId}/${Date.now()}-${image.id}-${safeName}`;
            const ref = storage.ref().child(path);
            await ref.put(image.file, { contentType: image.file.type || 'image/png' });
            return {
                name: image.file.name,
                url: await ref.getDownloadURL(),
                path,
                contentType: image.file.type || 'image/png',
            };
        }));
    };

    const handleSaveEvent = async () => {
        const user = auth.currentUser;
        if (!user || isSavingEvent) return;

        if (!formData.title.trim()) {
            await showAlert("일정 내용을 입력해주세요.");
            return;
        }
        if (formData.endTime && (!formData.time || formData.endTime <= formData.time)) {
            await showAlert("종료시간은 시작시간보다 뒤여야 합니다.");
            return;
        }

        setIsSavingEvent(true);
        try {
            const collectionRef = firestore.collection('users').doc(user.uid).collection('schedules');
            const docRef = editingId ? collectionRef.doc(editingId) : collectionRef.doc();
            const uploadedAttachments = pendingScheduleImages.length > 0
                ? await uploadScheduleImages(user.uid, docRef.id, pendingScheduleImages)
                : [];
            const eventData = {
                ...formData,
                endTime: formData.endTime || '',
                attachments: [...(formData.attachments || []), ...uploadedAttachments],
            };
            if (editingId) {
                await docRef.update(eventData);
                setEvents(prev => prev.map(e => e.id === editingId ? { ...eventData, id: editingId } : e));
            } else {
                await docRef.set(eventData);
                setEvents(prev => [...prev, { ...eventData, id: docRef.id }]);
            }
            setIsEventModalOpen(false);
            resetForm();
            setScheduleDrafts([]);
            setCaptureMessage('');
        } catch (error) {
            console.error("Error saving schedule:", error);
            await showAlert("저장 중 오류가 발생했습니다. 이미지 저장 권한과 네트워크를 확인해 주세요.");
        } finally {
            setIsSavingEvent(false);
        }
    };

    const handleSaveRecurringEvents = async (newEvents: Omit<ScheduleEvent, 'id'>[]) => {
        const user = auth.currentUser;
        if (!user) return;

        try {
            const batch = firestore.batch();
            const collectionRef = firestore.collection('users').doc(user.uid).collection('schedules');
            const createdEvents: ScheduleEvent[] = [];

            newEvents.forEach(evt => {
                const docRef = collectionRef.doc();
                batch.set(docRef, evt);
                createdEvents.push({ ...evt, id: docRef.id });
            });

            await batch.commit();
            setEvents(prev => [...prev, ...createdEvents]);
            await showAlert(`${newEvents.length}개의 고정 일정이 등록되었습니다.`);
        } catch (error) {
            console.error("Error saving recurring events:", error);
            await showAlert("고정 일정 저장 중 오류가 발생했습니다.");
        }
    };

    const handleDeleteEvent = async () => {
        if (!editingId) return;
        const user = auth.currentUser;
        if (!user) return;

        const confirmed = await showConfirm("이 일정을 삭제하시겠습니까?");
        if (!confirmed) return;

        try {
            await firestore.collection('users').doc(user.uid).collection('schedules').doc(editingId).delete();
            setEvents(prev => prev.filter(e => e.id !== editingId));
            setIsEventModalOpen(false);
            resetForm();
            setScheduleDrafts([]);
            setCaptureMessage('');
        } catch (error) {
            console.error("Error deleting schedule:", error);
            await showAlert("삭제 중 오류가 발생했습니다.");
        }
    };

    const handleSaveSettings = async (newSettings: ScheduleSettings) => {
        const user = auth.currentUser;
        if (!user) return;

        try {
            await firestore.collection('users').doc(user.uid).collection('appData').doc('scheduleSettings').set(newSettings);
            setSettings(newSettings);
            setIsSettingsModalOpen(false);

            // Check if current form category is still valid, if not reset to first available
            if (newSettings.categories.length > 0 && !newSettings.categories.find(c => c.label === formData.category)) {
                setFormData(prev => ({ ...prev, category: newSettings.categories[0].label }));
            }

        } catch (error) {
            console.error("Error saving settings:", error);
            await showAlert("설정 저장 중 오류가 발생했습니다.");
        }
    };

    const toggleCompletion = async (e: React.MouseEvent, event: ScheduleEvent) => {
        e.stopPropagation();
        const user = auth.currentUser;
        if (!user) return;

        const newStatus = !event.isCompleted;
        setEvents(prev => prev.map(ev => ev.id === event.id ? { ...ev, isCompleted: newStatus } : ev));

        try {
            await firestore.collection('users').doc(user.uid).collection('schedules').doc(event.id).update({
                isCompleted: newStatus
            });
        } catch (error) {
            console.error("Error toggling status:", error);
            setEvents(prev => prev.map(ev => ev.id === event.id ? { ...ev, isCompleted: !newStatus } : ev));
        }
    };

    const openEventModal = (dateStr?: string, event?: ScheduleEvent) => {
        clearPendingScheduleImages();
        setScheduleDrafts([]);
        setCaptureMessage('');
        setCopyDates([]);
        setCopyDateInput('');
        setIsCopySectionOpen(false);
        if (event) {
            setEditingId(event.id);
            setFormData({
                date: event.date,
                title: event.title,
                category: event.category,
                isCompleted: event.isCompleted,
                location: event.location,
                time: event.time,
                endTime: event.endTime || '',
                memo: event.memo,
                attachments: event.attachments || [],
            });
        } else {
            setEditingId(null);
            resetForm();
            if (dateStr) {
                setFormData(prev => ({ ...prev, date: dateStr, time: '14:00' }));
            }
        }
        setIsEventModalOpen(true);
    };

    const applyScheduleDraft = (draft: ExtractedScheduleDraft) => {
        setFormData(prev => ({
            ...prev,
            date: draft.date || prev.date,
            time: draft.time || '',
            endTime: draft.endTime || '',
            title: draft.title || prev.title,
            category: settings.categories.some(c => c.label === draft.category) ? draft.category : prev.category,
            location: draft.location || '',
            memo: draft.memo || '',
            isCompleted: false,
        }));
        setCaptureMessage(`"${draft.title}" 이렇게 등록할까요? 필요하면 아래에서 수정해 주세요.`);
    };

    const analyzeScheduleCapture = async (file: File) => {
        if (!file.type.startsWith('image/')) {
            await showAlert('이미지 캡처만 분석할 수 있습니다.');
            return;
        }
        setIsAnalyzingCapture(true);
        setCaptureMessage('');
        try {
            const drafts = await extractScheduleEventsFromImage(
                file,
                settings.categories.map(c => c.label),
                formData.date || getTodayString(),
                appSettings.geminiApiKey,
                appSettings.geminiModel
            );
            setScheduleDrafts(drafts);
            if (drafts.length === 0) {
                setCaptureMessage('캡처에서 등록할 만한 일정을 찾지 못했습니다.');
                return;
            }
            applyScheduleDraft(drafts[0]);
        } catch (error: any) {
            await showAlert(error.message || '캡처 분석 중 오류가 발생했습니다.');
        } finally {
            setIsAnalyzingCapture(false);
        }
    };

    const handleScheduleCapturePaste = (e: React.ClipboardEvent) => {
        if (editingId || isAnalyzingCapture) return;
        const imageItem = Array.from(e.clipboardData.items).find(item => item.type.startsWith('image/'));
        if (!imageItem) return;
        const file = imageItem.getAsFile();
        if (!file) return;
        e.preventDefault();
        analyzeScheduleCapture(file);
    };

    const handleMemoImagePaste = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
        const imageFiles = Array.from(e.clipboardData.items)
            .filter(item => item.type.startsWith('image/'))
            .map(item => item.getAsFile())
            .filter((file): file is File => Boolean(file));
        if (imageFiles.length === 0) return;

        e.preventDefault();
        e.stopPropagation();
        const availableSlots = 3 - (formData.attachments?.length || 0) - pendingScheduleImages.length;
        if (availableSlots <= 0) {
            await showAlert('캡처 이미지는 일정 하나에 최대 3장까지 첨부할 수 있습니다.');
            return;
        }
        const accepted = imageFiles.slice(0, availableSlots);
        const oversized = accepted.find(file => file.size > 8 * 1024 * 1024);
        if (oversized) {
            await showAlert('이미지 한 장의 크기는 8MB 이하여야 합니다.');
            return;
        }
        setPendingScheduleImages(prev => [
            ...prev,
            ...accepted.map((file, index) => ({
                id: `${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`,
                file,
                previewUrl: URL.createObjectURL(file),
            })),
        ]);
    };

    const resetForm = () => {
        setFormData({
            date: getTodayString(),
            title: '',
            category: settings.categories[0]?.label || '업무',
            isCompleted: false,
            location: '',
            time: '14:00',
            endTime: '',
            memo: '',
            attachments: [],
        });
        setCopyDates([]);
        setCopyDateInput('');
        clearPendingScheduleImages();
    };

    const addCopyDate = () => {
        if (!copyDateInput || copyDateInput === formData.date || copyDates.includes(copyDateInput)) return;
        if (copyDates.length >= 20) return;
        setCopyDates(prev => [...prev, copyDateInput].sort());
        setCopyDateInput('');
    };

    const handleCopyEvent = async () => {
        const user = auth.currentUser;
        if (!user || !editingId || copyDates.length === 0 || isCopying) return;
        if (pendingScheduleImages.length > 0) {
            await showAlert('붙여넣은 이미지는 먼저 아래의 수정하기로 저장한 뒤 일정을 복사해 주세요.');
            return;
        }
        if (!formData.title.trim()) {
            await showAlert('일정 내용을 입력해주세요.');
            return;
        }
        if (formData.endTime && (!formData.time || formData.endTime <= formData.time)) {
            await showAlert('종료시간은 시작시간보다 뒤여야 합니다.');
            return;
        }

        setIsCopying(true);
        try {
            const eventData = {
                ...formData,
                endTime: formData.endTime || '',
            };
            const collectionRef = firestore.collection('users').doc(user.uid).collection('schedules');
            const batch = firestore.batch();
            const copiedEvents: ScheduleEvent[] = [];
            copyDates.forEach(date => {
                const docRef = collectionRef.doc();
                const copied = { ...eventData, date, isCompleted: false };
                batch.set(docRef, copied);
                copiedEvents.push({ ...copied, id: docRef.id });
            });
            await batch.commit();
            setEvents(prev => [...prev, ...copiedEvents]);
            const copiedCount = copyDates.length;
            setCopyDates([]);
            setCopyDateInput('');
            await showAlert(`${copiedCount}개 날짜로 일정을 복사했습니다.`);
        } catch (error) {
            console.error('Error copying schedule:', error);
            await showAlert('일정 복사 중 오류가 발생했습니다.');
        } finally {
            setIsCopying(false);
        }
    };

    const handlePrevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
    const handleNextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
    const goToToday = () => setCurrentDate(new Date());

    // Generate Calendar Grid with Prev/Next Month padding
    const calendarDays = useMemo(() => {
        const firstDayOfMonth = new Date(year, month, 1);
        const lastDayOfMonth = new Date(year, month + 1, 0);

        const startDayOfWeek = firstDayOfMonth.getDay(); // 0 (Sun) to 6 (Sat)
        const daysInMonth = lastDayOfMonth.getDate();

        const days = [];

        // Previous Month Padding
        const prevMonthLastDate = new Date(year, month, 0).getDate();
        for (let i = startDayOfWeek - 1; i >= 0; i--) {
            const date = new Date(year, month - 1, prevMonthLastDate - i);
            days.push({
                dateObj: date,
                dateStr: date.toLocaleDateString('en-CA'),
                day: date.getDate(),
                isCurrentMonth: false
            });
        }

        // Current Month
        for (let i = 1; i <= daysInMonth; i++) {
            const date = new Date(year, month, i);
            days.push({
                dateObj: date,
                dateStr: date.toLocaleDateString('en-CA'),
                day: i,
                isCurrentMonth: true
            });
        }

        // Next Month Padding (Fill to 42 days - 6 weeks)
        const remainingCells = 42 - days.length;
        for (let i = 1; i <= remainingCells; i++) {
            const date = new Date(year, month + 1, i);
            days.push({
                dateObj: date,
                dateStr: date.toLocaleDateString('en-CA'),
                day: i,
                isCurrentMonth: false
            });
        }

        return days;
    }, [year, month]);

    const getCategoryColor = (catLabel: string) => {
        const cat = settings.categories.find(c => c.label === catLabel);
        return cat?.colorClass || 'bg-gray-100 text-gray-800 border-gray-200';
    };

    /** 모바일 전용: 오늘 날짜 일정 목록(캘린더 셀 밖에서 읽기 쉽게) */
    const todayScheduleEvents = useMemo(() => {
        const todayStr = getTodayString();
        const list = events.filter(e => e.date === todayStr);
        list.sort((a, b) => {
            if (a.isCompleted !== b.isCompleted) return a.isCompleted ? 1 : -1;
            return (a.time || '').localeCompare(b.time || '');
        });
        return list;
    }, [events]);

    // --- Checklist Handlers ---
    const handleAddChecklist = async (type: ChecklistType, content: string) => {
        const user = auth.currentUser;
        if (!user) return;

        const dailyMaxSort =
            type === 'daily'
                ? checklists.filter(c => c.type === 'daily').reduce((m, i) => Math.max(m, i.sortOrder ?? -1), -1)
                : -1;

        const newItem: Omit<ChecklistItem, 'id'> = {
            type,
            content,
            isChecked: false,
            createdAt: Date.now(),
            ...(type === 'daily' ? { sortOrder: dailyMaxSort + 1 } : {}),
        };

        try {
            const docRef = await firestore.collection('users').doc(user.uid).collection('checklists').add(newItem);
            setChecklists(prev => [...prev, { ...newItem, id: docRef.id }]);
        } catch (error) {
            console.error("Error adding checklist:", error);
        }
    };

    const handleReorderDailyChecklist = async (orderedIds: string[]) => {
        const user = auth.currentUser;
        if (!user) return;

        const orderMap = new Map(orderedIds.map((id, index) => [id, index]));
        const prevSnapshot = checklists;

        setChecklists(p =>
            p.map(item => {
                if (item.type !== 'daily' || !orderMap.has(item.id)) return item;
                return { ...item, sortOrder: orderMap.get(item.id)! };
            })
        );

        try {
            const batch = firestore.batch();
            const colRef = firestore.collection('users').doc(user.uid).collection('checklists');
            orderedIds.forEach((id, index) => {
                batch.update(colRef.doc(id), { sortOrder: index });
            });
            await batch.commit();
        } catch (error) {
            console.error('Error reordering daily checklist:', error);
            setChecklists(prevSnapshot);
            await showAlert('순서 저장에 실패했습니다. 네트워크를 확인해 주세요.');
        }
    };

    /** 완료 기록에 해당 항목이 남아 있으면 사이드바에서 숨김. 복원 시에만 다시 표시 (날짜가 바뀌어도 자동으로 목록에 되돌아오지 않음) */
    const isChecklistSuppressedByCompletion = (item: ChecklistItem) =>
        checklistCompletions.some(c => c.checklistItemId === item.id);

    const handleCompleteChecklist = async (item: ChecklistItem) => {
        const user = auth.currentUser;
        if (!user) return;
        const periodKey = getPeriodKeyForType(item.type);
        const docId = `${item.id}_${periodKey}`;
        if (checklistCompletions.some(c => c.id === docId)) return;

        const newRow: ChecklistCompletion = {
            id: docId,
            checklistItemId: item.id,
            type: item.type,
            periodKey,
            contentSnapshot: item.content,
            completedAt: Date.now(),
        };
        setChecklistCompletions(prev => [newRow, ...prev]);

        try {
            await firestore.collection('users').doc(user.uid).collection('checklistCompletions').doc(docId).set({
                checklistItemId: item.id,
                type: item.type,
                periodKey,
                contentSnapshot: item.content,
                completedAt: Date.now(),
            });
        } catch (error) {
            console.error('Error saving checklist completion:', error);
            setChecklistCompletions(prev => prev.filter(c => c.id !== docId));
            await showAlert('완료 기록 저장에 실패했습니다. 네트워크를 확인해 주세요.');
        }
    };

    const handleRestoreChecklistCompletion = async (row: ChecklistCompletion) => {
        const user = auth.currentUser;
        if (!user) return;
        const ok = await showConfirm('이 항목을 다시 할 일 목록에 되돌릴까요?');
        if (!ok) return;
        setChecklistCompletions(prev => prev.filter(c => c.id !== row.id));
        try {
            await firestore.collection('users').doc(user.uid).collection('checklistCompletions').doc(row.id).delete();
        } catch (error) {
            console.error('Error restoring checklist:', error);
            setChecklistCompletions(prev => [row, ...prev].sort((a, b) => b.completedAt - a.completedAt));
            await showAlert('복원에 실패했습니다.');
        }
    };

    const handleDeleteChecklist = async (id: string) => {
        const user = auth.currentUser;
        if (!user) return;

        const confirmed = await showConfirm("이 항목을 삭제하시겠습니까?");
        if (!confirmed) return;

        try {
            await firestore.collection('users').doc(user.uid).collection('checklists').doc(id).delete();
            setChecklists(prev => prev.filter(item => item.id !== id));
        } catch (error) {
            console.error("Error deleting checklist:", error);
        }
    };

    // Event Modal Keyboard Handler
    const handleEventModalKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
            // Check if focus is in textarea to prevent premature submission
            const activeElement = document.activeElement;
            if (activeElement && activeElement.tagName === 'TEXTAREA') return;
            handleSaveEvent();
        }
    };

    return (
        <div className="h-full flex flex-col gap-6 overflow-y-auto custom-scrollbar xl:flex-row xl:overflow-hidden">
            {/* Left: Calendar (LG: 70%) — 모바일 order-1 */}
            <div className="relative order-1 flex h-[72dvh] min-h-[520px] max-h-[900px] shrink-0 flex-col overflow-hidden rounded-xl border border-base-300/60 bg-base-100 shadow-lg xl:order-none xl:h-auto xl:max-h-none xl:min-h-0 xl:flex-[7]">
                {/* Header */}
                <div className="p-3 sm:p-4 border-b border-base-300 flex flex-wrap items-center justify-between bg-base-50 shrink-0 gap-2">
                    {/* Left Group */}
                    <div className="flex min-w-0 items-center justify-between gap-2 sm:gap-4">
                        <h2 className="text-lg sm:text-xl font-bold text-base-content flex items-center gap-2 shrink-0">
                            <span className="hidden xs:inline sm:inline">일정 관리</span>
                        </h2>
                    </div>

                    <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
                        <div className="flex min-w-0 items-center gap-2">
                            <div className="flex items-center gap-1 bg-white px-2 py-1 rounded-lg border border-base-300 shadow-sm">
                                <button onClick={handlePrevMonth} className="p-1 hover:bg-base-100 rounded-full text-base-content-secondary">
                                    <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                                </button>
                                <span className="font-bold text-base-content w-[4.5rem] sm:w-28 text-center text-sm sm:text-lg whitespace-nowrap leading-none pt-0.5">{year}년 {month + 1}월</span>
                                <button onClick={handleNextMonth} className="p-1 hover:bg-base-100 rounded-full text-base-content-secondary">
                                    <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                                </button>
                            </div>
                            <button onClick={goToToday} className="px-2 py-1.5 text-xs font-bold bg-white border border-base-300 rounded-md hover:bg-base-100 transition-colors whitespace-nowrap">
                                오늘
                            </button>
                        </div>

                        {/* Right Group (Buttons) */}
                        <div className="flex flex-wrap justify-end gap-1.5">
                        <button
                            onClick={() => setIsSettingsModalOpen(true)}
                            className="bg-white text-base-content-secondary px-2.5 py-1.5 rounded-lg font-bold border border-base-300 shadow-sm hover:bg-base-50 transition-all text-[11px] flex items-center justify-center gap-1 min-w-0"
                            title="일정 설정"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                            </svg>
                            <span className="xl:hidden">설정</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setScheduleMainView('calendar')}
                            className={`px-2.5 py-1.5 rounded-lg font-bold border shadow-sm transition-all text-[11px] min-w-0 ${scheduleMainView === 'calendar'
                                ? 'bg-primary text-primary-content border-primary'
                                : 'bg-white text-base-content-secondary border-base-300 hover:bg-base-50'
                                }`}
                        >
                            캘린더
                        </button>
                        <button
                            type="button"
                            onClick={() => setScheduleMainView('checklistLog')}
                            className={`px-2.5 py-1.5 rounded-lg font-bold border shadow-sm transition-all text-[11px] min-w-0 ${scheduleMainView === 'checklistLog'
                                ? 'bg-primary text-primary-content border-primary'
                                : 'bg-white text-base-content-secondary border-base-300 hover:bg-base-50'
                                }`}
                            title="체크리스트 완료 기록 · 복원"
                        >
                            완료 기록
                        </button>
                        <button
                            onClick={() => setIsRecurringModalOpen(true)}
                            className="bg-white text-primary border border-primary/20 px-2.5 py-1.5 rounded-lg font-bold shadow-sm hover:bg-primary/5 transition-all text-[11px] flex items-center justify-center gap-1.5 min-w-0"
                            title="고정 일정(반복) 추가"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            <span>고정 일정</span>
                        </button>
                        <button
                            onClick={() => openEventModal(getTodayString())}
                            className="bg-primary text-primary-content px-3 py-1.5 rounded-lg font-bold shadow-sm hover:bg-primary-focus transition-all text-xs flex items-center justify-center gap-2 min-w-0"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                            </svg>
                            <span className="whitespace-nowrap">일정 추가</span>
                        </button>
                        </div>
                    </div>
                </div>

                {/* Calendar Grid OR 체크리스트 완료 기록 */}
                <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col bg-base-100 min-h-0 relative">
                    {scheduleMainView === 'checklistLog' ? (
                        <div className="p-3 sm:p-4 flex flex-col gap-3 min-h-0 flex-1">
                            <p className="text-sm text-base-content-secondary">
                                체크한 항목은 <strong className="text-base-content">완료 시각</strong>과 함께 저장됩니다. 잘못 체크했으면 <strong>복원</strong>으로 다시 할 일 목록에 올릴 수 있어요.
                            </p>
                            <div className="overflow-x-auto rounded-xl border border-base-300 bg-white shadow-sm flex-1 min-h-[200px]">
                                <table className="w-full text-sm border-collapse min-w-[640px]">
                                    <thead className="bg-base-200 sticky top-0 z-10 border-b border-base-300">
                                        <tr className="text-xs sm:text-sm">
                                            <th className="whitespace-nowrap text-left p-2 font-bold">완료 시각</th>
                                            <th className="whitespace-nowrap text-left p-2 font-bold">기간</th>
                                            <th className="whitespace-nowrap text-left p-2 font-bold">구분</th>
                                            <th className="text-left p-2 font-bold">내용</th>
                                            <th className="w-20 text-center p-2 font-bold">복원</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {checklistCompletions.length === 0 ? (
                                            <tr>
                                                <td colSpan={5} className="text-center text-base-content-secondary py-12 italic p-4">
                                                    아직 완료 기록이 없습니다. 체크리스트에서 항목을 체크해 보세요.
                                                </td>
                                            </tr>
                                        ) : (
                                            checklistCompletions.map(row => (
                                                <tr key={row.id} className="hover:bg-base-50 border-b border-base-200">
                                                    <td className="whitespace-nowrap text-xs sm:text-sm align-top p-2">
                                                        {new Date(row.completedAt).toLocaleString('ko-KR', {
                                                            year: 'numeric',
                                                            month: 'long',
                                                            day: 'numeric',
                                                            hour: '2-digit',
                                                            minute: '2-digit',
                                                        })}
                                                    </td>
                                                    <td className="text-xs sm:text-sm align-top min-w-[8rem] p-2">
                                                        {formatCompletionPeriodKorean(row.type, row.periodKey)}
                                                    </td>
                                                    <td className="whitespace-nowrap align-top p-2">{typeLabelKo(row.type)}</td>
                                                    <td className="align-top break-words max-w-[12rem] sm:max-w-md p-2">{row.contentSnapshot}</td>
                                                    <td className="text-center align-top p-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRestoreChecklistCompletion(row)}
                                                            className="text-primary font-bold text-xs px-2 py-1 rounded-lg hover:bg-primary/10"
                                                        >
                                                            복원
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ) : (
                        <>
                    <section className="border-b border-base-300 bg-base-50/80 px-3 py-3">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                            <h3 className="text-xs font-bold text-base-content">
                                오늘 일정 <span className="font-semibold text-base-content-secondary">· {formatDateKoreanFull(new Date())}</span>
                            </h3>
                            {todayScheduleEvents.length === 0 ? (
                                <p className="text-xs font-semibold text-base-content-secondary">예정된 일정이 없습니다.</p>
                            ) : (
                                <div className="grid min-w-0 flex-1 grid-cols-1 gap-1.5 sm:grid-cols-2 xl:grid-cols-3">
                                    {todayScheduleEvents.slice(0, 4).map(event => (
                                        <button
                                            key={event.id}
                                            type="button"
                                            onClick={() => openEventModal(getTodayString(), event)}
                                            className={`max-w-full rounded-lg border px-2.5 py-1.5 text-left text-xs shadow-sm transition-opacity hover:opacity-90 ${getCategoryColor(event.category)} ${event.isCompleted ? 'opacity-60 line-through' : ''}`}
                                            title={event.title}
                                        >
                                            <span className="block truncate font-extrabold">{event.title}</span>
                                            {(settings.viewOptions.showLocation && event.location) || event.memo || event.time ? (
                                                <span className="mt-0.5 flex min-w-0 items-center justify-between gap-2 text-[10px] font-semibold opacity-75">
                                                    <span className="min-w-0 truncate">
                                                        {settings.viewOptions.showLocation && event.location ? event.location : event.memo}
                                                    </span>
                                                    {event.time && (
                                                        <span className="shrink-0 font-mono font-black tabular-nums">{getEventTimeLabel(event)}</span>
                                                    )}
                                                </span>
                                            ) : null}
                                        </button>
                                    ))}
                                    {todayScheduleEvents.length > 4 && (
                                        <span className="rounded-lg bg-white px-2.5 py-1 text-xs font-bold text-base-content-secondary border border-base-300">
                                            +{todayScheduleEvents.length - 4}
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>
                    </section>
                    {/* Day Headers - z-40 to stay above day cells (which can have z-20) */}
                    <div className="grid grid-cols-7 border-b border-base-300 bg-base-50/90 backdrop-blur-sm sticky top-0 z-[40]">
                        {['일', '월', '화', '수', '목', '금', '토'].map((d, i) => (
                            <div key={d} className={`p-2 text-center text-xs font-bold ${i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-base-content-secondary'}`}>
                                {d}
                            </div>
                        ))}
                    </div>

                    {/* Days Grid */}
                    <div className="grid grid-cols-7 auto-rows-fr flex-1 bg-base-200 gap-px border-b border-base-300">
                        {calendarDays.map((cell, i) => {
                            const dateStr = cell.dateStr;
                            const isToday = dateStr === getTodayString();
                            const dayEvents = events.filter(e => e.date === dateStr);
                            const dayOfWeek = cell.dateObj.getDay();
                            const isSunday = dayOfWeek === 0;
                            const isSaturday = dayOfWeek === 6;

                            dayEvents.sort((a, b) => {
                                if (a.isCompleted !== b.isCompleted) return a.isCompleted ? 1 : -1;
                                return (a.time || '').localeCompare(b.time || '');
                            });

                            return (
                                <div
                                    key={i}
                                    onClick={() => openEventModal(dateStr)}
                                    className={`bg-white p-2 min-h-[80px] hover:bg-base-50 transition-colors cursor-pointer group flex flex-col gap-1 relative
                                        ${!cell.isCurrentMonth ? 'bg-base-50/50' : ''}
                                        ${isToday ? 'ring-2 ring-primary ring-inset z-20' : ''}
                                    `}
                                >
                                    <span className={`text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full mb-1
                                        ${isToday
                                            ? 'bg-primary text-primary-content font-extrabold'
                                            : `${!cell.isCurrentMonth ? 'opacity-40' : ''} ${isSunday ? 'text-red-500' : isSaturday ? 'text-blue-500' : 'text-base-content-secondary'}`
                                        }
                                    `}>
                                        {cell.day}
                                    </span>

                                    {dayEvents.map(event => (
                                        <div
                                            key={event.id}
                                            onClick={(e) => { e.stopPropagation(); openEventModal(dateStr, event); }}
                                            className={`px-2 py-0.5 rounded text-[10px] border flex flex-col gap-0.5 shadow-sm transition-all hover:scale-[1.02] hover:shadow-md
                                                ${getCategoryColor(event.category)}
                                                ${event.isCompleted ? 'opacity-50 grayscale decoration-slate-400' : ''}
                                                ${!cell.isCurrentMonth ? 'opacity-40' : ''}
                                            `}
                                        >
                                            <div className="flex flex-col gap-0.5">
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    {settings.viewOptions.showTime && event.time && (
                                                        <span className="text-[10px] font-extrabold opacity-90 shrink-0 bg-white/40 px-1 rounded">
                                                            {getEventTimeLabel(event)}
                                                        </span>
                                                    )}
                                                    <span className={`truncate font-semibold flex-1 ${event.isCompleted ? 'line-through' : ''}`}>
                                                        {event.title}
                                                    </span>
                                                </div>
                                                {settings.viewOptions.showLocation && event.location && (
                                                    <div className="text-[9px] flex items-center gap-0.5 opacity-80 truncate">
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-2.5 w-2.5" viewBox="0 0 20 20" fill="currentColor">
                                                            <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                                                        </svg>
                                                        {event.location}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            );
                        })}
                    </div>
                        </>
                    )}
                </div>
            </div>

            {/* 모바일만: 캘린더 밖에서도 오늘 일정 확인 */}
            {scheduleMainView === 'calendar' && (
                <section
                    className="order-2 hidden shrink-0 flex-col gap-2 border-b border-base-300 bg-base-50 px-3 py-3"
                    aria-label="오늘 일정 요약"
                >
                    <h3 className="text-xs font-bold text-base-content">
                        오늘 일정 <span className="font-semibold text-base-content-secondary">· {formatDateKoreanFull(new Date())}</span>
                    </h3>
                    {todayScheduleEvents.length === 0 ? (
                        <p className="text-sm leading-snug text-base-content-secondary">
                            예정된 일정이 없습니다. 위 캘린더에서 날짜를 눌러 추가할 수 있어요.
                        </p>
                    ) : (
                        <ul className="flex flex-col gap-2">
                            {todayScheduleEvents.map(event => (
                                <li key={event.id}>
                                    <button
                                        type="button"
                                        onClick={() => openEventModal(getTodayString(), event)}
                                        className={`w-full rounded-lg border px-3 py-2 text-left text-sm shadow-sm transition-opacity hover:opacity-95 ${getCategoryColor(event.category)} ${event.isCompleted ? 'opacity-60 line-through' : ''}`}
                                    >
                                        <div className="flex items-start gap-2">
                                            {settings.viewOptions.showTime && event.time && (
                                                <span className="shrink-0 font-mono text-xs font-extrabold opacity-90">{getEventTimeLabel(event)}</span>
                                            )}
                                            <span className="min-w-0 flex-1 break-words font-semibold">{event.title}</span>
                                        </div>
                                        {settings.viewOptions.showLocation && event.location && (
                                            <p className="mt-1 text-xs opacity-80">{event.location}</p>
                                        )}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
            )}

            {/* Right: Checklists (LG: 30%) - iPad Fix: Added pb-32 — 모바일 order-3 */}
            <div className="schedule-checklist-grid order-3 grid h-auto min-h-0 shrink-0 grid-cols-1 gap-4 pb-32 custom-scrollbar max-md:w-full md:grid-cols-3 md:pb-20 xl:order-none xl:flex xl:h-full xl:flex-[3] xl:flex-col xl:overflow-y-auto xl:pb-0">
                {/* Daily */}
                <div className="min-w-0 shrink-0">
                    <ChecklistSection
                        title="일일 체크리스트"
                        dateLabel={formatDateKoreanFull(new Date())}
                        type="daily"
                        items={checklists.filter(c => c.type === 'daily' && !isChecklistSuppressedByCompletion(c))}
                        onAdd={handleAddChecklist}
                        onComplete={handleCompleteChecklist}
                        onDelete={handleDeleteChecklist}
                        dailyOrdering={{ onReorder: handleReorderDailyChecklist }}
                        colorTheme={{
                            bg: 'bg-red-50',
                            border: 'border-red-100',
                            title: 'text-red-800',
                            icon: '❤️',
                            accent: 'red-500'
                        }}
                    />
                </div>
                {/* Weekly */}
                <div className="min-w-0 shrink-0">
                    <ChecklistSection
                        title="주간 실천계획"
                        dateLabel={formatWeekRangeKorean(new Date())}
                        type="weekly"
                        items={checklists.filter(c => c.type === 'weekly' && !isChecklistSuppressedByCompletion(c))}
                        onAdd={handleAddChecklist}
                        onComplete={handleCompleteChecklist}
                        onDelete={handleDeleteChecklist}
                        colorTheme={{
                            bg: 'bg-fuchsia-50',
                            border: 'border-fuchsia-100',
                            title: 'text-fuchsia-800',
                            icon: '💜',
                            accent: 'fuchsia-500'
                        }}
                    />
                </div>
                {/* Monthly */}
                <div className="min-w-0 shrink-0">
                    <ChecklistSection
                        title="월간 실천계획"
                        dateLabel={formatMonthKorean(new Date())}
                        type="monthly"
                        items={checklists.filter(c => c.type === 'monthly' && !isChecklistSuppressedByCompletion(c))}
                        onAdd={handleAddChecklist}
                        onComplete={handleCompleteChecklist}
                        onDelete={handleDeleteChecklist}
                        colorTheme={{
                            bg: 'bg-amber-50',
                            border: 'border-amber-100',
                            title: 'text-amber-800',
                            icon: '💛',
                            accent: 'amber-500'
                        }}
                    />
                </div>
            </div>

            {/* Modals ... */}
            {isEventModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-2 backdrop-blur-sm sm:p-4" onClick={closeEventModal}>
                    {/* ... (Existing Modal Content) ... */}
                    <div
                        className="flex max-h-[calc(100dvh-1rem)] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-base-300 bg-white shadow-2xl sm:max-h-[calc(100dvh-2rem)]"
                        onClick={e => e.stopPropagation()}
                        onPaste={handleScheduleCapturePaste}
                        onKeyDown={handleEventModalKeyDown}
                    >
                        <div className="shrink-0 border-b border-base-200 bg-white px-4 py-3 sm:px-6 sm:py-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-xl font-bold text-base-content">
                                    {editingId ? '일정 수정' : '새 일정 등록'}
                                </h3>
                                <button onClick={closeEventModal} className="text-base-content-secondary hover:text-base-content">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                        </div>

                        <div className="min-h-0 flex-1 overflow-y-auto p-4 custom-scrollbar sm:p-6">
                            <div className="space-y-4">
                                {!editingId && (
                                    <div
                                        tabIndex={0}
                                        className="rounded-xl border border-dashed border-primary/30 bg-primary/5 p-3 outline-none focus:ring-2 focus:ring-primary/30"
                                    >
                                        <div className="flex items-center justify-between gap-3">
                                            <div className="min-w-0">
                                                <p className="text-sm font-bold text-base-content">캡처 이미지 붙여넣기</p>
                                                <p className="text-xs leading-snug text-base-content-secondary">
                                                    윈도우 캡처 후 이 창에서 붙여넣으면 일정 후보를 분석합니다.
                                                </p>
                                            </div>
                                            {isAnalyzingCapture && (
                                                <svg className="h-5 w-5 animate-spin shrink-0 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                </svg>
                                            )}
                                        </div>
                                        {captureMessage && (
                                            <p className="mt-2 rounded-lg bg-white/70 px-3 py-2 text-xs font-semibold text-base-content-secondary">
                                                {captureMessage}
                                            </p>
                                        )}
                                        {scheduleDrafts.length > 1 && (
                                            <div className="mt-2 flex flex-wrap gap-2">
                                                {scheduleDrafts.map((draft, index) => (
                                                    <button
                                                        key={`${draft.date}-${draft.time}-${draft.endTime}-${draft.title}-${index}`}
                                                        type="button"
                                                        onClick={() => applyScheduleDraft(draft)}
                                                        className="rounded-lg border border-primary/20 bg-white px-2.5 py-1.5 text-left text-xs font-bold text-primary shadow-sm hover:bg-primary/10"
                                                        title={draft.needsReview ? '확인이 필요한 후보' : '일정 후보 적용'}
                                                    >
                                                        {draft.date} {draft.time && `${draft.time}${draft.endTime ? `–${draft.endTime}` : ''} `}{draft.title}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                                    <div>
                                        <label className="block text-xs font-bold text-base-content-secondary mb-1.5">날짜</label>
                                        <input
                                            type="date"
                                            value={formData.date}
                                            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                            className="w-full p-2.5 bg-white border border-base-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary text-sm text-base-content shadow-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-base-content-secondary mb-1.5">시작시간</label>
                                        <input
                                            type="time"
                                            value={formData.time}
                                            onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                                            className="w-full p-2.5 bg-white border border-base-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary text-sm text-base-content shadow-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-base-content-secondary mb-1.5">종료시간 <span className="font-medium text-base-content-secondary/70">(선택)</span></label>
                                        <input
                                            type="time"
                                            value={formData.endTime || ''}
                                            onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                                            className="w-full p-2.5 bg-white border border-base-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary text-sm text-base-content shadow-sm"
                                        />
                                    </div>
                                </div>

                                {editingId && (
                                    <div className={`overflow-hidden rounded-xl border transition-colors ${isCopySectionOpen ? 'border-primary/20 bg-primary/5' : 'border-base-200 bg-base-50'}`}>
                                        <button
                                            type="button"
                                            onClick={() => setIsCopySectionOpen(open => !open)}
                                            disabled={isCopying}
                                            className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left hover:bg-primary/5 disabled:cursor-wait"
                                            aria-expanded={isCopySectionOpen}
                                        >
                                            <span>
                                                <span className="block text-sm font-bold text-base-content">다른 날짜로 복사하기</span>
                                                {!isCopySectionOpen && <span className="block text-xs text-base-content-secondary">필요할 때 펼쳐서 사용하세요.</span>}
                                            </span>
                                            <svg className={`h-5 w-5 shrink-0 text-base-content-secondary transition-transform ${isCopySectionOpen ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                                            </svg>
                                        </button>
                                        {isCopySectionOpen && (
                                            <div className="border-t border-primary/10 px-3 pb-3 pt-3">
                                                <p className="mb-3 text-xs text-base-content-secondary">날짜를 하나씩 추가한 뒤, 복사하기를 눌러 한 번에 등록하세요.</p>
                                                <label className="mb-1.5 block text-xs font-bold text-base-content-secondary">복사할 날짜 추가</label>
                                                <div className="flex gap-2">
                                                    <input
                                                        type="date"
                                                        value={copyDateInput}
                                                        min="2000-01-01"
                                                        onChange={(e) => setCopyDateInput(e.target.value)}
                                                        onKeyDown={(e) => e.stopPropagation()}
                                                        className="min-w-0 flex-1 rounded-lg border border-base-300 bg-white p-2 text-sm"
                                                    />
                                                    <button type="button" onClick={addCopyDate} disabled={!copyDateInput || copyDateInput === formData.date || copyDates.length >= 20 || isCopying} className="shrink-0 rounded-lg border border-primary bg-white px-3 py-2 text-xs font-bold text-primary disabled:cursor-not-allowed disabled:opacity-40">
                                                        날짜 추가
                                                    </button>
                                                </div>
                                                {copyDates.length > 0 && (
                                                    <div className="mt-2 flex flex-wrap gap-1.5">
                                                        {copyDates.map(date => (
                                                            <button key={date} type="button" onClick={() => setCopyDates(prev => prev.filter(d => d !== date))} className="rounded-full border border-primary/20 bg-white px-2.5 py-1 text-xs font-bold text-primary hover:bg-red-50 hover:text-red-600" title="복사 날짜에서 제거">
                                                                {date} ×
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                                <button
                                                    type="button"
                                                    onClick={handleCopyEvent}
                                                    disabled={copyDates.length === 0 || isCopying}
                                                    className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2.5 text-sm font-bold text-primary-content shadow-sm hover:bg-primary-focus disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500"
                                                >
                                                    {isCopying && <span className="loading loading-spinner loading-xs" />}
                                                    {copyDates.length > 0 ? `선택한 ${copyDates.length}개 날짜로 복사하기` : '복사할 날짜를 추가해 주세요'}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}

                                <div>
                                    <label className="block text-xs font-bold text-base-content-secondary mb-1.5">분류</label>
                                    <div className="flex flex-wrap gap-2">
                                        {settings.categories.map(cat => (
                                            <button
                                                key={cat.id}
                                                onClick={() => setFormData({ ...formData, category: cat.label })}
                                                className={`px-3 py-1.5 rounded-md text-xs font-bold border transition-all
                                                    ${formData.category === cat.label
                                                        ? `${cat.colorClass} ring-2 ring-offset-1 ring-current shadow-sm`
                                                        : 'bg-white border-base-300 text-base-content-secondary hover:bg-base-50'
                                                    }
                                                `}
                                            >
                                                {cat.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-base-content-secondary mb-1.5">할 일 (내용)</label>
                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={() => setFormData({ ...formData, isCompleted: !formData.isCompleted })}
                                            className={`w-10 h-10 rounded-lg border flex items-center justify-center transition-colors shrink-0
                                                ${formData.isCompleted ? 'bg-primary border-primary text-primary-content' : 'bg-white border-base-300 hover:border-primary'}
                                            `}
                                            title="완료 여부 체크"
                                        >
                                            {formData.isCompleted && (
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                </svg>
                                            )}
                                        </button>
                                        <input
                                            type="text"
                                            value={formData.title}
                                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                            placeholder="일정 내용을 입력하세요"
                                            className="flex-1 p-2.5 bg-white border border-base-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary text-sm font-bold text-base-content shadow-sm placeholder-base-300/70"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-base-content-secondary mb-1.5">장소</label>
                                    <input
                                        type="text"
                                        value={formData.location}
                                        onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                                        placeholder="장소 (선택)"
                                        className="w-full p-2.5 bg-white border border-base-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary text-sm text-base-content shadow-sm placeholder-base-300/70"
                                    />
                                </div>

                                <div>
                                    <div className="mb-1.5 flex items-center justify-between gap-2">
                                        <label className="block text-xs font-bold text-base-content-secondary">메모</label>
                                        <span className="text-[10px] font-semibold text-primary">캡처 이미지를 여기에 붙여넣을 수 있어요 · 최대 3장</span>
                                    </div>
                                    <textarea
                                        value={formData.memo}
                                        onChange={(e) => setFormData({ ...formData, memo: e.target.value })}
                                        onPaste={handleMemoImagePaste}
                                        placeholder="자세한 내용을 입력하거나 캡처 이미지를 붙여넣으세요..."
                                        rows={3}
                                        className="w-full p-2.5 bg-white border border-dashed border-base-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary text-sm text-base-content shadow-sm resize-none placeholder-base-300/70"
                                    />
                                    {((formData.attachments?.length || 0) > 0 || pendingScheduleImages.length > 0) && (
                                        <div className="mt-2 grid grid-cols-3 gap-2">
                                            {(formData.attachments || []).map(attachment => (
                                                <div key={attachment.path} className="group relative overflow-hidden rounded-lg border border-base-300 bg-base-50 aspect-video">
                                                    <button
                                                        type="button"
                                                        onClick={() => setImagePreview({ url: attachment.url, name: attachment.name || '일정 첨부 이미지' })}
                                                        className="h-full w-full cursor-zoom-in"
                                                        title="이미지 크게 보기"
                                                    >
                                                        <img src={attachment.url} alt={attachment.name || '일정 첨부 이미지'} className="h-full w-full object-cover" />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setFormData(prev => ({ ...prev, attachments: (prev.attachments || []).filter(item => item.path !== attachment.path) }))}
                                                        className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/65 text-sm font-bold text-white opacity-80 hover:bg-red-600 hover:opacity-100"
                                                        title="첨부에서 제거"
                                                    >
                                                        ×
                                                    </button>
                                                </div>
                                            ))}
                                            {pendingScheduleImages.map(image => (
                                                <div key={image.id} className="group relative overflow-hidden rounded-lg border-2 border-primary/40 bg-primary/5 aspect-video">
                                                    <button
                                                        type="button"
                                                        onClick={() => setImagePreview({ url: image.previewUrl, name: image.file.name || '붙여넣은 캡처 이미지' })}
                                                        className="h-full w-full cursor-zoom-in"
                                                        title="이미지 크게 보기"
                                                    >
                                                        <img src={image.previewUrl} alt="붙여넣은 캡처 미리보기" className="h-full w-full object-cover" />
                                                    </button>
                                                    <span className="absolute bottom-1 left-1 rounded bg-primary px-1.5 py-0.5 text-[9px] font-bold text-white">저장 예정</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            URL.revokeObjectURL(image.previewUrl);
                                                            setPendingScheduleImages(prev => prev.filter(item => item.id !== image.id));
                                                        }}
                                                        className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/65 text-sm font-bold text-white opacity-80 hover:bg-red-600 hover:opacity-100"
                                                        title="첨부에서 제거"
                                                    >
                                                        ×
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                            <div className="flex shrink-0 items-center justify-between border-t border-base-200 bg-white px-4 py-3 sm:px-6 sm:py-4">
                                {editingId ? (
                                    <button
                                        onClick={handleDeleteEvent}
                                        className="text-red-500 hover:text-red-700 text-sm font-bold flex items-center gap-1 px-2 py-1 hover:bg-red-50 rounded-md transition-colors"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                                        </svg>
                                        삭제
                                    </button>
                                ) : <div></div>}
                                <div className="flex gap-2">
                                    <button
                                        onClick={closeEventModal}
                                        className="px-4 py-2 bg-base-200 text-base-content-secondary font-bold rounded-lg hover:bg-base-300 transition-colors text-sm"
                                    >
                                        취소
                                    </button>
                                    <button
                                        onClick={handleSaveEvent}
                                        disabled={isSavingEvent}
                                        className="flex items-center gap-2 px-6 py-2 bg-primary text-primary-content font-bold rounded-lg shadow-md hover:bg-primary-focus hover:shadow-lg transition-all text-sm disabled:cursor-wait disabled:opacity-60"
                                    >
                                        {isSavingEvent && <span className="loading loading-spinner loading-xs" />}
                                        {editingId ? '수정하기 (Enter)' : '등록하기 (Enter)'}
                                    </button>
                                </div>
                            </div>
                    </div>
                </div>
            )}

            {imagePreview && (
                <div
                    className="fixed inset-0 z-[120] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm sm:p-8"
                    onClick={() => setImagePreview(null)}
                    role="dialog"
                    aria-modal="true"
                    aria-label="첨부 이미지 크게 보기"
                >
                    <button
                        type="button"
                        onClick={() => setImagePreview(null)}
                        className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-3xl font-light text-white backdrop-blur transition-colors hover:bg-white/25 sm:right-6 sm:top-6"
                        aria-label="이미지 닫기"
                    >
                        ×
                    </button>
                    <img
                        src={imagePreview.url}
                        alt={imagePreview.name}
                        onClick={event => event.stopPropagation()}
                        className="max-h-[88dvh] max-w-[94vw] rounded-lg object-contain shadow-2xl"
                    />
                </div>
            )}

            {isSettingsModalOpen && (
                <SettingsModal
                    currentSettings={settings}
                    onSave={handleSaveSettings}
                    onClose={() => setIsSettingsModalOpen(false)}
                />
            )}

            {isRecurringModalOpen && (
                <RecurringEventModal
                    categories={settings.categories}
                    onSave={handleSaveRecurringEvents}
                    onClose={() => setIsRecurringModalOpen(false)}
                />
            )}
        </div>
    );
};

export default ScheduleManager;
