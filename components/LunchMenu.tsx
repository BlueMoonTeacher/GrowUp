
import React, { useState, useEffect } from 'react';
import { AppSettings } from '../App';
import { getMealInfo, MealInfo } from '../services/neisService';

interface LunchMenuProps {
  settings: AppSettings;
}

// Global cache to store fetched meal data
const MENU_CACHE: Record<string, MealInfo | null> = {};

const getTodayString = () => new Date().toLocaleDateString('en-CA');

const getNextSchoolDayString = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dayOfWeek = tomorrow.getDay();
    if (dayOfWeek === 6) { // Saturday -> Monday
        tomorrow.setDate(tomorrow.getDate() + 2);
    } else if (dayOfWeek === 0) { // Sunday -> Monday
        tomorrow.setDate(tomorrow.getDate() + 1);
    }
    return tomorrow.toLocaleDateString('en-CA');
};

const adjustDate = (dateStr: string, days: number): string => {
    const date = new Date(dateStr);
    date.setDate(date.getDate() + days);
    return date.toLocaleDateString('en-CA');
}

const cleanMenuItems = (ddishNm: string | undefined): string[] => {
    if (!ddishNm) return [];
    
    // 1. Remove [Meal Type] like [중식]
    // 2. Remove asterisks or specific keywords like "완제"
    let cleanedString = ddishNm.replace(/\[.*?\]/g, '').replace(/\*|완제/g, '');

    return cleanedString
        .split('<br/>')
        .map(item => {
            return item
                // Remove content inside parentheses e.g., (백리-초), (국내산)
                .replace(/\s*\(.*?\)/g, '') 
                // Remove allergy numbers (digits and dots at the end or standalone)
                .replace(/[0-9\.]+$/g, '') 
                // Remove specific artifact 'h' at the end
                .replace(/h$/i, '')
                // Remove any remaining digits if mixed
                .replace(/[0-9.]/g, '')
                .trim();
        })
        .filter(item => item.length > 0);
};


const parseNutritionInfo = (ntrInfo: string | undefined): { label: string; value: string }[] => {
    if (!ntrInfo) return [];
    return ntrInfo.split('<br/>').map(info => {
        const parts = info.split(' : ');
        return { label: parts[0]?.trim(), value: parts[1]?.trim() };
    }).filter(item => item.label && item.value);
};

const HIGHLIGHT_NUTRIENTS = new Set(['탄수화물(g)', '단백질(g)', '지방(g)']);

const LoadingSpinner = () => (
    <div className="flex items-center justify-center p-4">
        <svg className="animate-spin h-6 w-6 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
    </div>
);

const NoDataMessage = ({ emoji, message }: { emoji: string, message: string }) => (
    <div className="text-center text-sm text-base-content-secondary p-4 flex flex-col items-center justify-center">
        {emoji && <p className="text-2xl mb-2">{emoji}</p>}
        <p>{message}</p>
    </div>
);

const LunchMenu = ({ settings }: LunchMenuProps): React.ReactElement => {
    const [todayMeal, setTodayMeal] = useState<MealInfo | null>(null);
    const [isTodayLoading, setIsTodayLoading] = useState(true);

    const [selectedDate, setSelectedDate] = useState(getNextSchoolDayString);
    const [selectedMeal, setSelectedMeal] = useState<MealInfo | null>(null);
    const [isSelectedLoading, setIsSelectedLoading] = useState(false);

    // Helper function to check cache or fetch
    const getMeal = async (
        atptCode: string, 
        schoolCode: string, 
        date: string, 
        setLoading: (loading: boolean) => void, 
        setMeal: (meal: MealInfo | null) => void
    ) => {
        const cacheKey = `${atptCode}-${schoolCode}-${date}`;
        
        // 1. Check Cache
        if (MENU_CACHE[cacheKey] !== undefined) {
            setMeal(MENU_CACHE[cacheKey]);
            setLoading(false);
            return;
        }

        // 2. Fetch if not in cache
        setLoading(true);
        setMeal(null);
        try {
            const data = await getMealInfo(atptCode, schoolCode, date);
            let meal: MealInfo | null = null;
            if (data && data.length > 0) {
                meal = data.find(m => m.DDISH_NM.includes('[중식]')) || data[0];
            }
            // Save to cache (including null if no data)
            MENU_CACHE[cacheKey] = meal;
            setMeal(meal);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const { atptOfcdcScCode, sdSchulCode } = settings;
        if (!atptOfcdcScCode || !sdSchulCode) return;
        
        getMeal(atptOfcdcScCode, sdSchulCode, getTodayString(), setIsTodayLoading, setTodayMeal);
    }, [settings]);

    useEffect(() => {
        const { atptOfcdcScCode, sdSchulCode } = settings;
        if (!atptOfcdcScCode || !sdSchulCode) return;

        getMeal(atptOfcdcScCode, sdSchulCode, selectedDate, setIsSelectedLoading, setSelectedMeal);
    }, [settings, selectedDate]);

    const todayMenuItems = cleanMenuItems(todayMeal?.DDISH_NM);
    const nutritionItems = parseNutritionInfo(todayMeal?.NTR_INFO);
    const selectedMenuItems = cleanMenuItems(selectedMeal?.DDISH_NM);
    
    const DateNavController = () => (
        <div className="flex items-center gap-1">
            <button onClick={() => setSelectedDate(prev => adjustDate(prev, -1))} className="p-2 rounded-md hover:bg-base-200 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full p-1.5 text-sm border border-base-300 bg-base-100 rounded-md focus:ring-primary focus:border-primary shadow-sm text-center"
            />
            <button onClick={() => setSelectedDate(prev => adjustDate(prev, 1))} className="p-2 rounded-md hover:bg-base-200 transition-colors">
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </button>
        </div>
    );

    return (
        <div className="bg-base-100 rounded-xl shadow-lg border border-base-300/60 h-full flex flex-col">
            <div className="flex items-center space-x-2 p-4 border-b border-base-300/60">
                <h2 className="text-lg font-bold text-base-content">급식 메뉴</h2>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar pb-10">
                {/* Today's Lunch Section */}
                <div className="p-4 border-b border-base-300/60">
                    <h3 className="font-bold text-base-content mb-3 flex items-center justify-between">
                        <span>오늘의 급식</span>
                        <span className="text-xs font-normal text-base-content-secondary">{getTodayString()}</span>
                    </h3>
                    {isTodayLoading ? <LoadingSpinner /> : !todayMeal ? (
                        <NoDataMessage emoji="" message="급식 정보가 없습니다." />
                    ) : (
                        <div className="space-y-3">
                             <div className="bg-secondary/60 flex items-baseline justify-center gap-x-2 p-2 rounded-lg border border-green-200/50">
                                <span className="text-sm font-semibold text-secondary-content">총 칼로리</span>
                                <span className="text-xl font-bold text-primary">{todayMeal.CAL_INFO}</span>
                            </div>
                            <div className="flex flex-wrap gap-1.5 justify-center">
                                {todayMenuItems.map((item, i) => <span key={i} className="text-xs font-medium bg-base-200/80 text-base-content px-2 py-1 rounded-md border border-base-300/70">{item}</span>)}
                            </div>
                            <div className="text-xs text-base-content-secondary pt-2 space-y-1">
                                <p className="font-bold mb-1 text-center">영양 정보</p>
                                <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                                {nutritionItems.map(item => {
                                    const isHighlighted = HIGHLIGHT_NUTRIENTS.has(item.label);
                                    return (
                                        <div key={item.label} className={`flex justify-between ${isHighlighted ? 'font-bold' : ''}`}>
                                            <span className={`opacity-80 ${isHighlighted ? 'text-primary' : ''}`}>{item.label}</span>
                                            <span className={isHighlighted ? 'text-primary' : ''}>{item.value}</span>
                                        </div>
                                    )
                                })}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Other Day's Lunch Section */}
                <div className="p-4">
                    <h3 className="font-bold text-base-content mb-3">다른 날짜 급식 보기</h3>
                    <DateNavController />
                     {isSelectedLoading ? <LoadingSpinner /> : !selectedMeal ? (
                         <NoDataMessage emoji="" message="선택한 날짜의 급식 정보가 없습니다."/>
                     ) : (
                        <div className="mt-3 space-y-2">
                             {selectedMenuItems.map((item, index) => (
                                <div key={index} className="text-center text-sm font-medium text-base-content bg-base-200/50 p-2 rounded-lg border border-base-300/70">
                                    {item}
                                </div>
                            ))}
                        </div>
                     )}
                </div>
            </div>
        </div>
    );
};

export default LunchMenu;
