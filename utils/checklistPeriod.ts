import type { ChecklistType } from '../types';

/** YYYY-MM-DD (로컬) */
export function toYmd(d: Date): string {
    return d.toLocaleDateString('en-CA');
}

/** 예: 2026년 3월 18일 수요일 */
export function formatDateKoreanFull(d: Date): string {
    return d.toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'long',
    });
}

export function getDailyPeriodKey(d = new Date()): string {
    return toYmd(d);
}

/** 일요일 시작 주간 (캘린더 헤더와 동일) */
export function getWeekRangeSunday(d = new Date()): { start: Date; end: Date; periodKey: string } {
    const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    start.setDate(start.getDate() - start.getDay());
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    return { start, end, periodKey: toYmd(start) };
}

/** 예: 2026년 3월 16일 ~ 22일 (월이 바뀌면 ~ 4월 1일 형태) */
export function formatWeekRangeKorean(d = new Date()): string {
    const { start, end } = getWeekRangeSunday(d);
    const y = start.getFullYear();
    const sm = start.getMonth() + 1;
    const sd = start.getDate();
    const em = end.getMonth() + 1;
    const ed = end.getDate();
    if (start.getMonth() === end.getMonth()) {
        return `${y}년 ${sm}월 ${sd}일 ~ ${ed}일`;
    }
    return `${y}년 ${sm}월 ${sd}일 ~ ${em}월 ${ed}일`;
}

export function getMonthlyPeriodKey(d = new Date()): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function formatMonthKorean(d = new Date()): string {
    return `${d.getFullYear()}년 ${d.getMonth() + 1}월`;
}

export function getPeriodKeyForType(type: ChecklistType, d = new Date()): string {
    switch (type) {
        case 'daily':
            return getDailyPeriodKey(d);
        case 'weekly':
            return getWeekRangeSunday(d).periodKey;
        case 'monthly':
            return getMonthlyPeriodKey(d);
        default:
            return getDailyPeriodKey(d);
    }
}

/** 완료 기록 표시용 (periodKey + type → 한글) */
export function formatCompletionPeriodKorean(type: ChecklistType, periodKey: string): string {
    if (type === 'daily') {
        const [yy, mm, dd] = periodKey.split('-').map(Number);
        if (!yy || !mm || !dd) return periodKey;
        return formatDateKoreanFull(new Date(yy, mm - 1, dd));
    }
    if (type === 'weekly') {
        const [yy, mm, dd] = periodKey.split('-').map(Number);
        if (!yy || !mm || !dd) return periodKey;
        return formatWeekRangeKorean(new Date(yy, mm - 1, dd));
    }
    if (type === 'monthly') {
        const [y, m] = periodKey.split('-');
        if (!y || !m) return periodKey;
        return `${y}년 ${parseInt(m, 10)}월`;
    }
    return periodKey;
}

export function typeLabelKo(type: ChecklistType): string {
    switch (type) {
        case 'daily':
            return '일일';
        case 'weekly':
            return '주간';
        case 'monthly':
            return '월간';
        default:
            return type;
    }
}
