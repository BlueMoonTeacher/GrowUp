
export interface School {
    ATPT_OFCDC_SC_CODE: string; // 시도교육청코드
    SD_SCHUL_CODE: string;      // 표준학교코드
    SCHUL_NM: string;           // 학교명
    LCTN_SC_NM: string;         // 소재지명
}

export interface MealInfo {
    DDISH_NM: string; // 메뉴
    CAL_INFO: string; // 칼로리
    NTR_INFO: string; // 영양정보
}

const BASE_URL = 'https://open.neis.go.kr/hub';
const API_KEY = '6eabe979cc9640708ac6e96b3be5ccf8';

async function fetchNeisApi<T>(endpoint: string, params: Record<string, string>): Promise<T | null> {
    const url = new URL(`${BASE_URL}/${endpoint}`);
    url.search = new URLSearchParams({
        Type: 'json',
        pIndex: '1',
        pSize: '100', // Increased size to get more results for school search
        KEY: API_KEY,
        ...params
    }).toString();

    try {
        const response = await fetch(url.toString());
        if (!response.ok) {
            console.error(`NEIS API error for ${endpoint}: ${response.statusText}`);
            return null;
        }
        const data = await response.json();
        const resultKey = Object.keys(data)[0]; 

        if (!data[resultKey]) {
            // This case can happen for meal info on days with no meals, which is not an error
             if (data.RESULT && data.RESULT.CODE === 'INFO-200') {
                return null; // No data found, which is a valid response.
             }
             console.log(`NEIS API: No data found or error.`, data.RESULT?.MESSAGE);
             return null;
        }
        
        if (data[resultKey] && data[resultKey][0].head[1].RESULT.CODE === 'INFO-000') {
            return data[resultKey][1].row as T;
        } else {
             console.log(`NEIS API: No data found or error.`, data[resultKey]?.[0]?.head[1]?.RESULT.MESSAGE);
            return null;
        }
    } catch (error) {
        console.error('Error fetching from NEIS API:', error);
        return null;
    }
}


export const searchSchool = async (atptCode: string, schoolName: string): Promise<School[] | null> => {
    if (!atptCode || !schoolName) return null;
    return fetchNeisApi<School[]>('schoolInfo', {
        ATPT_OFCDC_SC_CODE: atptCode,
        SCHUL_NM: schoolName
    });
};

export const getMealInfo = async (atptCode: string, schoolCode: string, date: string): Promise<MealInfo[] | null> => {
    if (!atptCode || !schoolCode) return null;
    return fetchNeisApi<MealInfo[]>('mealServiceDietInfo', {
        ATPT_OFCDC_SC_CODE: atptCode,
        SD_SCHUL_CODE: schoolCode,
        MLSV_YMD: date.replace(/-/g, '')
    });
};
