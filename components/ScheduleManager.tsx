
import React, { useState, useEffect, useMemo } from 'react';
import { firestore, auth } from '../firebase';
import { ScheduleEvent, ScheduleSettings, ScheduleCategoryDef, ChecklistItem, ChecklistType, ChecklistCompletion } from '../types';
import { useModal } from '../context/ModalContext';
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
}

const ITEMS_PREVIEW_COUNT = 4;

const ChecklistSection = ({ title, dateLabel, type, items, onAdd, onComplete, onDelete, colorTheme }: ChecklistSectionProps) => {
    const [newItemText, setNewItemText] = useState('');
    const [isExpanded, setIsExpanded] = useState(false);

    const hasMoreItems = items.length > ITEMS_PREVIEW_COUNT;
    const currentItems = isExpanded || !hasMoreItems ? items : items.slice(0, ITEMS_PREVIEW_COUNT);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (newItemText.trim()) {
            onAdd(type, newItemText.trim());
            setNewItemText('');
            // Automatically expand when adding new items if it exceeds the preview count
            if (!isExpanded && items.length >= ITEMS_PREVIEW_COUNT) {
                setIsExpanded(true);
            }
        }
    };

    return (
        <div className={`${colorTheme.bg} rounded-xl p-4 border ${colorTheme.border} shadow-sm flex flex-col transition-all duration-300`}>
            {/* Header with Expand/Collapse Toggle */}
            <div className="flex items-center justify-between mb-3 shrink-0 min-h-8">
                <div className="flex flex-col gap-0.5 min-w-0">
                    <div className="flex items-center gap-2">
                        <span className="text-lg shrink-0">{colorTheme.icon}</span>
                        <h3 className={`font-bold ${colorTheme.title} leading-tight`}>{title}</h3>
                    </div>
                    <p className="text-[11px] sm:text-xs font-semibold text-gray-600 pl-7 leading-tight">{dateLabel}</p>
                </div>

                {/* Expand/Collapse Toggle - Only show if items exceed preview count */}
                {hasMoreItems && (
                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold transition-all border
                            ${isExpanded
                                ? `bg-white ${colorTheme.title} ${colorTheme.border} shadow-sm`
                                : `bg-white/60 text-gray-500 border-transparent hover:bg-white hover:text-gray-700`
                            }
                        `}
                    >
                        <span>{isExpanded ? '접기' : `+${items.length - ITEMS_PREVIEW_COUNT} 더보기`}</span>
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

            {/* Items List - Dynamic Height */}
            <div className={`overflow-y-hidden transition-all duration-300 ease-in-out ${isExpanded ? 'max-h-[800px]' : 'max-h-[250px]'} space-y-1 mb-3`}>
                {currentItems.length > 0 ? (
                    currentItems.map(item => (
                        <div
                            key={item.id}
                            className="group flex items-start gap-2 text-sm animate-[fadeIn_0.2s_ease-out] p-1.5 rounded-lg hover:bg-white/80 hover:shadow-sm transition-all"
                        >
                            <button
                                type="button"
                                title="완료하면 목록에서 숨겨지고 완료 기록에 남습니다"
                                onClick={() => onComplete(item)}
                                className="mt-0.5 w-4 h-4 rounded border flex items-center justify-center transition-colors shrink-0 bg-white border-gray-300 hover:border-red-400 hover:bg-red-50"
                            />
                            <span className="flex-1 break-words leading-tight text-gray-700 font-medium">
                                {item.content}
                            </span>
                            <button
                                onClick={() => onDelete(item.id)}
                                className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-opacity"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                </svg>
                            </button>
                        </div>
                    ))
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
                        <div>
                            <label className="block text-xs font-bold text-base-content-secondary mb-1.5">시간</label>
                            <input
                                type="time"
                                value={time}
                                onChange={(e) => setTime(e.target.value)}
                                className="w-full p-2.5 bg-white border border-base-300 rounded-lg text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-base-content-secondary mb-1.5">장소</label>
                            <input
                                type="text"
                                value={location}
                                onChange={(e) => setLocation(e.target.value)}
                                className="w-full p-2.5 bg-white border border-base-300 rounded-lg text-sm"
                            />
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


const ScheduleManager = (): React.ReactElement => {
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
    const [editingId, setEditingId] = useState<string | null>(null);

    // Form Data
    const [formData, setFormData] = useState<Omit<ScheduleEvent, 'id'>>({
        date: getTodayString(),
        title: '',
        category: '업무',
        isCompleted: false,
        location: '',
        time: '14:00', // Default time
        memo: ''
    });

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

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

    const handleSaveEvent = async () => {
        const user = auth.currentUser;
        if (!user) return;

        if (!formData.title.trim()) {
            await showAlert("일정 내용을 입력해주세요.");
            return;
        }

        try {
            if (editingId) {
                await firestore.collection('users').doc(user.uid).collection('schedules').doc(editingId).update(formData);
                setEvents(prev => prev.map(e => e.id === editingId ? { ...formData, id: editingId } : e));
            } else {
                const docRef = await firestore.collection('users').doc(user.uid).collection('schedules').add(formData);
                setEvents(prev => [...prev, { ...formData, id: docRef.id }]);
            }
            setIsEventModalOpen(false);
            resetForm();
        } catch (error) {
            console.error("Error saving schedule:", error);
            await showAlert("저장 중 오류가 발생했습니다.");
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
        if (event) {
            setEditingId(event.id);
            setFormData({
                date: event.date,
                title: event.title,
                category: event.category,
                isCompleted: event.isCompleted,
                location: event.location,
                time: event.time,
                memo: event.memo
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

    const resetForm = () => {
        setFormData({
            date: getTodayString(),
            title: '',
            category: settings.categories[0]?.label || '업무',
            isCompleted: false,
            location: '',
            time: '14:00',
            memo: ''
        });
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

    // --- Checklist Handlers ---
    const handleAddChecklist = async (type: ChecklistType, content: string) => {
        const user = auth.currentUser;
        if (!user) return;

        const newItem: Omit<ChecklistItem, 'id'> = {
            type,
            content,
            isChecked: false,
            createdAt: Date.now()
        };

        try {
            const docRef = await firestore.collection('users').doc(user.uid).collection('checklists').add(newItem);
            setChecklists(prev => [...prev, { ...newItem, id: docRef.id }]);
        } catch (error) {
            console.error("Error adding checklist:", error);
        }
    };

    const isChecklistDoneThisPeriod = (item: ChecklistItem) => {
        const pk = getPeriodKeyForType(item.type);
        return checklistCompletions.some(c => c.checklistItemId === item.id && c.periodKey === pk);
    };

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
        <div className="h-full flex flex-col md:flex-row gap-6 overflow-y-auto md:overflow-hidden custom-scrollbar">
            {/* Left: Calendar (LG: 70%) */}
            <div className="bg-base-100 rounded-xl shadow-lg border border-base-300/60 flex flex-col overflow-hidden relative md:flex-[7] min-h-0 shrink-0">
                {/* Header */}
                <div className="p-3 sm:p-4 border-b border-base-300 flex flex-col sm:flex-row justify-between items-center bg-base-50 shrink-0 gap-3 sm:gap-0">
                    {/* Left Group */}
                    <div className="flex items-center justify-between w-full sm:w-auto sm:justify-start gap-2 sm:gap-4">
                        <h2 className="text-lg sm:text-xl font-bold text-base-content flex items-center gap-2 shrink-0">
                            <span className="hidden xs:inline sm:inline">일정 관리</span>
                        </h2>

                        <div className="flex items-center gap-2">
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
                    </div>

                    {/* Right Group (Buttons) */}
                    <div className="flex gap-2 w-full sm:w-auto justify-end">
                        <button
                            onClick={() => setIsSettingsModalOpen(true)}
                            className="bg-white text-base-content-secondary px-3 py-2 rounded-lg font-bold border border-base-300 shadow-sm hover:bg-base-50 transition-all text-xs flex items-center justify-center gap-1 shrink-0"
                            title="일정 설정"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                            </svg>
                        </button>
                        <button
                            type="button"
                            onClick={() => setScheduleMainView('calendar')}
                            className={`px-3 py-2 rounded-lg font-bold border shadow-sm transition-all text-xs shrink-0 ${scheduleMainView === 'calendar'
                                ? 'bg-primary text-primary-content border-primary'
                                : 'bg-white text-base-content-secondary border-base-300 hover:bg-base-50'
                                }`}
                        >
                            캘린더
                        </button>
                        <button
                            type="button"
                            onClick={() => setScheduleMainView('checklistLog')}
                            className={`px-3 py-2 rounded-lg font-bold border shadow-sm transition-all text-xs shrink-0 ${scheduleMainView === 'checklistLog'
                                ? 'bg-primary text-primary-content border-primary'
                                : 'bg-white text-base-content-secondary border-base-300 hover:bg-base-50'
                                }`}
                            title="체크리스트 완료 기록 · 복원"
                        >
                            완료 기록
                        </button>
                        <button
                            onClick={() => setIsRecurringModalOpen(true)}
                            className="bg-white text-primary border border-primary/20 px-3 py-2 rounded-lg font-bold shadow-sm hover:bg-primary/5 transition-all text-xs flex items-center justify-center gap-1.5 shrink-0"
                            title="고정 일정(반복) 추가"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            <span className="hidden sm:inline">고정 일정</span>
                        </button>
                        <button
                            onClick={() => openEventModal(getTodayString())}
                            className="bg-primary text-primary-content px-4 py-2 rounded-lg font-bold shadow-sm hover:bg-primary-focus transition-all text-sm flex items-center justify-center gap-2 flex-1 sm:flex-none"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                            </svg>
                            <span className="whitespace-nowrap">일정 추가</span>
                        </button>
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
                                                            {event.time}
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

            {/* Right: Checklists (LG: 30%) - iPad Fix: Added pb-32 */}
            <div className="md:flex-[3] flex flex-col gap-4 md:overflow-y-auto custom-scrollbar md:h-full h-auto pb-32 md:pb-0 min-h-0 shrink-0">
                {/* Daily */}
                <div className="shrink-0">
                    <ChecklistSection
                        title="일일 체크리스트"
                        dateLabel={formatDateKoreanFull(new Date())}
                        type="daily"
                        items={checklists.filter(c => c.type === 'daily' && !isChecklistDoneThisPeriod(c))}
                        onAdd={handleAddChecklist}
                        onComplete={handleCompleteChecklist}
                        onDelete={handleDeleteChecklist}
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
                <div className="shrink-0">
                    <ChecklistSection
                        title="주간 실천계획"
                        dateLabel={formatWeekRangeKorean(new Date())}
                        type="weekly"
                        items={checklists.filter(c => c.type === 'weekly' && !isChecklistDoneThisPeriod(c))}
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
                <div className="shrink-0">
                    <ChecklistSection
                        title="월간 실천계획"
                        dateLabel={formatMonthKorean(new Date())}
                        type="monthly"
                        items={checklists.filter(c => c.type === 'monthly' && !isChecklistDoneThisPeriod(c))}
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
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setIsEventModalOpen(false)}>
                    {/* ... (Existing Modal Content) ... */}
                    <div
                        className="bg-white rounded-xl shadow-2xl w-full max-w-lg border border-base-300"
                        onClick={e => e.stopPropagation()}
                        onKeyDown={handleEventModalKeyDown}
                    >
                        <div className="p-6">
                            <div className="flex justify-between items-start mb-6">
                                <h3 className="text-xl font-bold text-base-content">
                                    {editingId ? '일정 수정' : '새 일정 등록'}
                                </h3>
                                <button onClick={() => setIsEventModalOpen(false)} className="text-base-content-secondary hover:text-base-content">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>

                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
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
                                        <label className="block text-xs font-bold text-base-content-secondary mb-1.5">시간</label>
                                        <input
                                            type="time"
                                            value={formData.time}
                                            onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                                            className="w-full p-2.5 bg-white border border-base-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary text-sm text-base-content shadow-sm"
                                        />
                                    </div>
                                </div>

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
                                    <label className="block text-xs font-bold text-base-content-secondary mb-1.5">메모</label>
                                    <textarea
                                        value={formData.memo}
                                        onChange={(e) => setFormData({ ...formData, memo: e.target.value })}
                                        placeholder="자세한 내용을 입력하세요..."
                                        rows={3}
                                        className="w-full p-2.5 bg-white border border-base-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary text-sm text-base-content shadow-sm resize-none placeholder-base-300/70"
                                    />
                                </div>
                            </div>

                            <div className="flex justify-between items-center mt-8 pt-4 border-t border-base-200">
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
                                        onClick={() => setIsEventModalOpen(false)}
                                        className="px-4 py-2 bg-base-200 text-base-content-secondary font-bold rounded-lg hover:bg-base-300 transition-colors text-sm"
                                    >
                                        취소
                                    </button>
                                    <button
                                        onClick={handleSaveEvent}
                                        className="px-6 py-2 bg-primary text-primary-content font-bold rounded-lg shadow-md hover:bg-primary-focus hover:shadow-lg transition-all text-sm"
                                    >
                                        {editingId ? '수정하기 (Enter)' : '등록하기 (Enter)'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
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
