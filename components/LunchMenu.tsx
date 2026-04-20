
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
        .filter(item => item.length > 0 && item !== '우유');
};


const colorizeMealItems = (items: string[], isOtherDay: boolean) => {
    return items.map(item => {
        let classes = 'bg-base-100 border-base-200 text-base-content'; // 기본 색상

        const isRice = /밥(?!버거|도그)$/.test(item) || item.includes('볶음밥') || item.includes('덮밥');
        const isSoup = /(국|탕|찌개|전골|스프|짬뽕|우동|라멘)$/.test(item);
        const isKimchi = /(김치|깍두기|석박지|무생채|동치미|겉절이)$/.test(item);
        const isSideOrDessert = /나물|무침|무채|버무림|샐러드|채소|견과|잡채|단무지|피클|과일|사과|배|귤|오렌지|바나나|파인애플|포도|딸기|수박|우유|주스|쥬스|요구르트|요플레|음료|차|케이크|쿠키|츄러스|빵|아이스크림|젤리|푸딩|마카롱|김$|김가루|김자반/.test(item);

        if (isRice || isSoup || isSideOrDessert) {
            // 기본 색상 유지
        } else if (isKimchi) {
            // 다른 날짜는 기본 색상, 오늘은 연한 붉은 계열
            if (!isOtherDay) {
                classes = 'bg-red-50/70 border-red-100 text-red-500 font-medium';
            }
        } else {
            // 메인 반찬 추정 (나머지)
            classes = 'bg-amber-50 border-amber-300 text-amber-800 font-extrabold';
        }

        return { name: item, classes };
    });
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

    const todayMenuItems = colorizeMealItems(cleanMenuItems(todayMeal?.DDISH_NM), false);
    const nutritionItems = parseNutritionInfo(todayMeal?.NTR_INFO);
    const selectedMenuItems = colorizeMealItems(cleanMenuItems(selectedMeal?.DDISH_NM), true);

    return (
        <div className="bg-base-100 rounded-xl shadow-lg border border-base-300/60 h-full flex flex-col">
            {/* Header Merged: 오늘의 식단 + Date */}
            <div className="flex shrink-0 flex-col gap-2 border-b border-base-300/60 bg-white p-3 min-w-0 sm:flex-row sm:items-center sm:justify-between sm:p-4">
                <h2 className="flex min-w-0 items-center gap-2 text-lg font-extrabold text-primary sm:text-xl whitespace-nowrap">
                    <span className="shrink-0 text-2xl" aria-hidden>🍱</span>
                    <span className="truncate">오늘의 식단</span>
                </h2>
                <span className="shrink-0 self-start whitespace-nowrap rounded-full bg-primary px-3 py-1.5 text-center text-sm font-bold text-primary-content shadow-sm sm:self-auto">
                    {getTodayString()}
                </span>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar pb-24 sm:pb-8 md:pb-6">
                {/* Today's Lunch Section */}
                <div className="p-4 sm:p-5 border-b border-base-300/60 bg-white">
                    {isTodayLoading ? <LoadingSpinner /> : !todayMeal ? (
                        <NoDataMessage emoji="" message="급식 정보가 없습니다." />
                    ) : (
                        <div className="space-y-4">
                            <div className="bg-secondary/20 flex flex-col items-center justify-center gap-1 p-3 rounded-xl border border-secondary/30">
                                <span className="text-xs font-bold text-secondary-content/70">총 칼로리</span>
                                <span className="text-2xl font-black text-secondary-content">{todayMeal.CAL_INFO}</span>
                            </div>
                            <div className="-mx-1 min-w-0 overflow-x-auto py-1 custom-scrollbar">
                                <div className="flex w-max min-w-full flex-nowrap justify-center gap-2 px-1">
                                {todayMenuItems.map((item, i) => (
                                    <span key={i} className={`shrink-0 whitespace-nowrap rounded-lg border-2 px-3 py-1.5 text-sm font-bold shadow-sm ${item.classes}`}>
                                        {item.name}
                                    </span>
                                ))}
                                </div>
                            </div>
                            <div className="space-y-1 pt-2 text-xs text-base-content-secondary">
                                <p className="mb-2 text-center font-bold text-base-content/80">영양 정보 상세</p>
                                <div className="grid min-w-0 grid-cols-1 gap-2 rounded-lg border border-base-200 bg-base-50 p-3 sm:grid-cols-2 lg:grid-cols-2">
                                    {nutritionItems.map(item => {
                                        const isHighlighted = HIGHLIGHT_NUTRIENTS.has(item.label);
                                        return (
                                            <div
                                                key={item.label}
                                                className={`flex min-w-0 flex-col gap-0.5 rounded-md border border-base-200/80 bg-white/80 px-2 py-1.5 sm:border-0 sm:bg-white/60 ${isHighlighted ? 'font-bold' : ''}`}
                                            >
                                                <span className={`text-[11px] leading-snug opacity-80 [word-break:keep-all] sm:text-xs ${isHighlighted ? 'text-primary' : ''}`}>{item.label}</span>
                                                <span className={`text-sm font-semibold tabular-nums sm:text-sm ${isHighlighted ? 'text-primary' : ''}`}>{item.value}</span>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Other Day's Lunch Section */}
                <div className="p-4 bg-base-50/50">
                    <h3 className="font-semibold text-base-content-secondary text-sm mb-3 flex items-center gap-2 opacity-80">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                        다른 날짜 급식 보기
                    </h3>

                    <div className="flex items-center gap-1 mb-4 opacity-80 hover:opacity-100 transition-opacity">
                        <button onClick={() => setSelectedDate(prev => adjustDate(prev, -1))} className="p-2 rounded-md hover:bg-base-200 transition-colors">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                        </button>
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="w-full p-1.5 text-xs font-medium border border-base-300 bg-white rounded-md focus:ring-primary focus:border-primary shadow-sm text-center"
                        />
                        <button onClick={() => setSelectedDate(prev => adjustDate(prev, 1))} className="p-2 rounded-md hover:bg-base-200 transition-colors">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                        </button>
                    </div>

                    {isSelectedLoading ? <LoadingSpinner /> : !selectedMeal ? (
                        <NoDataMessage emoji="" message="선택한 날짜의 급식 정보가 없습니다." />
                    ) : (
                        <div className="-mx-1 min-w-0 overflow-x-auto custom-scrollbar">
                            <div className="flex w-max min-w-full flex-nowrap justify-center gap-1.5 px-1">
                            {selectedMenuItems.map((item, index) => (
                                <span key={index} className={`shrink-0 whitespace-nowrap rounded-md border px-2.5 py-1.5 text-center text-xs font-semibold ${item.classes}`}>
                                    {item.name}
                                </span>
                            ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default LunchMenu;
