
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
        <div className="flex h-auto min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border border-base-300/60 bg-base-100 shadow-lg max-md:overflow-visible md:h-full md:overflow-hidden">
            {/* 급식 기준일은 상단 탭 줄(생활기록) 오른쪽에서 표시 — 카드에서는 제목만 */}
            <div className="shrink-0 border-b border-base-300/60 bg-white p-3 sm:p-4">
                <h2 className="flex items-center gap-2 text-base font-extrabold leading-tight text-primary sm:text-lg">
                    <span className="shrink-0 text-xl sm:text-2xl" aria-hidden>🍱</span>
                    <span className="min-w-0 [word-break:keep-all]">오늘의 식단</span>
                </h2>
            </div>

            <div className="max-md:flex-none max-md:overflow-visible max-md:pb-4 min-h-0 flex-1 overflow-x-hidden overflow-y-auto pb-24 custom-scrollbar sm:pb-8 md:pb-6">
                {/* Today's Lunch Section */}
                <div className="min-w-0 border-b border-base-300/60 bg-white p-3 sm:p-5">
                    {isTodayLoading ? <LoadingSpinner /> : !todayMeal ? (
                        <NoDataMessage emoji="" message="급식 정보가 없습니다." />
                    ) : (
                        <div className="space-y-3">
                            <div className="rounded-xl border border-emerald-400/70 bg-emerald-100 p-1 shadow-sm ring-1 ring-emerald-300/50">
                                <div className="flex flex-col items-center justify-center gap-0.5 rounded-lg border border-emerald-500/40 bg-emerald-200/90 px-3 py-2 leading-none">
                                    <span className="text-[11px] font-bold leading-none text-emerald-900">총 칼로리</span>
                                    <span className="text-xl font-black leading-none tracking-tight text-emerald-950 sm:text-2xl">{todayMeal.CAL_INFO}</span>
                                </div>
                            </div>
                            <div className="flex min-w-0 flex-wrap justify-center gap-2 py-1">
                                {todayMenuItems.map((item, i) => (
                                    <span key={i} className={`shrink-0 whitespace-nowrap rounded-lg border-2 px-2.5 py-1.5 text-center text-xs font-bold shadow-sm sm:px-3 sm:text-sm ${item.classes}`}>
                                        {item.name}
                                    </span>
                                ))}
                            </div>
                            <div className="space-y-1 pt-1 text-xs text-base-content-secondary">
                                <p className="mb-1 text-center text-xs font-bold leading-tight text-base-content/80">영양 정보 상세</p>
                                <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 rounded-lg border border-base-200 bg-base-50 px-2.5 py-2 text-[11px] leading-tight sm:gap-y-px sm:px-3 sm:py-2.5 sm:text-xs">
                                    {nutritionItems.map(item => {
                                        const isHighlighted = HIGHLIGHT_NUTRIENTS.has(item.label);
                                        return (
                                            <div
                                                key={item.label}
                                                className={`flex min-w-0 items-baseline justify-between gap-1.5 leading-tight ${isHighlighted ? 'font-bold' : ''}`}
                                            >
                                                <span className={`min-w-0 shrink text-left opacity-80 [word-break:keep-all] ${isHighlighted ? 'text-primary' : ''}`}>{item.label}</span>
                                                <span className={`shrink-0 whitespace-nowrap tabular-nums ${isHighlighted ? 'text-primary' : ''}`}>{item.value}</span>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Other Day's Lunch Section */}
                <div className="bg-base-50/50 p-3 max-md:pb-2 md:p-4">
                    <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-base-content-secondary opacity-80 md:mb-3">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                        다른 날짜 급식 보기
                    </h3>

                    <div className="mb-2 flex items-center gap-1 opacity-80 transition-opacity hover:opacity-100 max-md:mb-2 md:mb-4">
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
                        <div className="flex min-w-0 flex-wrap justify-center gap-1.5">
                            {selectedMenuItems.map((item, index) => (
                                <span key={index} className={`shrink-0 whitespace-nowrap rounded-md border px-2 py-1.5 text-center text-xs font-semibold ${item.classes}`}>
                                    {item.name}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default LunchMenu;
