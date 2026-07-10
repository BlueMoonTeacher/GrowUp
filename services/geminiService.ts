
import { GoogleGenAI, Type } from "@google/genai";
import { Student, BehaviorRecord, AnalysisResult, Assessment, BehaviorAnalysisMode } from "../types";
import { normalizeGeminiModel } from "../constants/geminiModels";
import { resolveObservationType } from "../utils/behaviorUtils";

export interface ExtractedScheduleDraft {
    date: string;
    time: string;
    endTime: string;
    title: string;
    category: string;
    location: string;
    memo: string;
    confidence?: string;
    needsReview?: boolean;
}

// Helper to initialize AI client with dynamic key
function getAiClient(apiKey?: string) {
    const resolvedApiKey = apiKey?.trim() || process.env.GEMINI_API_KEY || 'proxy-managed';

    if (!resolvedApiKey || resolvedApiKey.trim() === '') {
        throw new Error("Gemini API 키가 설정되지 않았습니다. 로그인 후 우측 상단의 '설정' 메뉴에서 직접 발급받은 API 키를 입력해주세요.");
    }
    return new GoogleGenAI({ apiKey: resolvedApiKey });
}

// Helper to convert a File object to a GoogleGenAI.Part object.
async function fileToGenerativePart(file: File) {
    const base64EncodedDataPromise = new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
        reader.readAsDataURL(file);
    });
    return {
        inlineData: { data: await base64EncodedDataPromise, mimeType: file.type },
    };
}

const studentSchema = {
    type: Type.OBJECT,
    properties: {
        school: { type: Type.STRING, description: "학교 이름" },
        grade: { type: Type.STRING, description: "학년" },
        class: { type: Type.STRING, description: "반" },
        number: { type: Type.STRING, description: "번호" },
        gender: { type: Type.STRING, description: "성별 (남 또는 여)" },
        name: {
            type: Type.OBJECT,
            properties: {
                hangul: { type: Type.STRING, description: "학생 이름 (한글)" },
                hanja: { type: Type.STRING, description: "학생 이름 (한자, 없으면 빈 문자열)" },
            },
        },
        dob: { type: Type.STRING, description: "생년월일 (YYYY-MM-DD 형식)" },
        phone: {
            type: Type.OBJECT,
            properties: {
                home: { type: Type.STRING, description: "집 전화번호" },
                mobile: { type: Type.STRING, description: "학생 휴대폰 번호" },
            },
        },
        address: { type: Type.STRING, description: "현 주소" },
        specialNeeds: { type: Type.BOOLEAN, description: "특수교육대상 여부" },
        family: {
            type: Type.OBJECT,
            properties: {
                guardians: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            relationship: { type: Type.STRING, description: "보호자 관계 (예: 부, 모)" },
                            name: { type: Type.STRING, description: "보호자 이름" },
                            phone: { type: Type.STRING, description: "보호자 휴대폰 번호" },
                        },
                    },
                },
                isMulticultural: { type: Type.BOOLEAN, description: "다문화 가정 여부" },
                nationality: {
                    type: Type.OBJECT,
                    properties: {
                        father: { type: Type.STRING, description: "부의 국적" },
                        mother: { type: Type.STRING, description: "모의 국적" },
                    },
                },
                siblings: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            relationship: { type: Type.STRING, description: "형제자매 관계 (예: 오빠, 누나, 형, 동생)" },
                            name: { type: Type.STRING, description: "형제자매 이름" },
                            attendsSameSchool: { type: Type.BOOLEAN, description: "본교 재학 여부" },
                            gradeClass: { type: Type.STRING, description: "형제자매의 학년 반" },
                        },
                    },
                },
            },
        },
        afterSchool: {
            type: Type.OBJECT,
            properties: {
                activities: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            name: { type: Type.STRING, description: "학원 또는 방과 후 활동 이름" },
                            subject: { type: Type.STRING, description: "과목" },
                            schedule: { type: Type.STRING, description: "다니는 요일 및 시간" },
                        },
                    },
                },
                likes: { type: Type.STRING, description: "학생이 좋아하는 것" },
                dislikes: { type: Type.STRING, description: "학생이 싫어하는 것" },
            },
        },
        learningStatus: { type: Type.STRING, description: "학습 상태 및 가정학습 도움 관련 내용" },
        healthStatus: { type: Type.STRING, description: "건강 상태, 특이체질, 질병, 급식 관련 등" },
        parentRequests: { type: Type.STRING, description: "학부모 요청사항" },
    },
};

const multiStudentSchema = {
    type: Type.ARRAY,
    items: studentSchema,
};

// 스키마 정의: 행동 분석 결과
const analysisSchema = {
    type: Type.OBJECT,
    properties: {
        keywords: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "행동 특성을 나타내는 핵심 키워드 3~5개 (예: #책임감, #배려심)"
        },
        summary: {
            type: Type.STRING,
            description: "1학기 내용과 수시 기록을 아우르는 1년 전체의 행동 발달 흐름 요약 (3~5문장)"
        },
        trends: {
            type: Type.ARRAY,
            description: "월별 행동 변화 데이터 (시각화용)",
            items: {
                type: Type.OBJECT,
                properties: {
                    month: { type: Type.STRING, description: "YYYY-MM 형식" },
                    negativeIntensity: { type: Type.NUMBER, description: "해당 월의 문제 행동 강도나 빈도를 0(없음)에서 10(매우 심각) 사이의 점수로 정량화. 심각한 문제행동이 없으면 낮게 책정." },
                    positiveFrequency: { type: Type.NUMBER, description: "해당 월의 긍정적 행동 및 전반적인 발달 수준을 0~10점 척도로 평가 (10점이 매우 우수/모범적). 기록의 빈도가 적더라도 내용이 훌륭하면 높은 점수 부여." },
                    keyword: { type: Type.STRING, description: "해당 월을 대표하는 짧은 키워드 (예: 갈등조정, 수업방해)" }
                }
            }
        },
        report: {
            type: Type.STRING,
            description: "교사가 검토·수정할 학교생활기록부 '행동특성 및 종합의견' 초안. 요청된 학기 모드와 분량을 따름."
        },
        advice: {
            type: Type.ARRAY,
            description: "교사를 위한 맞춤형 지도 조언 목록 (내년 담임에게 전달 가능한 팁 포함)",
            items: {
                type: Type.OBJECT,
                properties: {
                    title: { type: Type.STRING, description: "조언의 핵심 주제" },
                    content: { type: Type.STRING, description: "구체적인 실천 방안 및 상세 설명" }
                }
            }
        }
    }
};

const softenedReportSchema = {
    type: Type.OBJECT,
    properties: {
        report: {
            type: Type.STRING,
            description: "순화된 학교생활기록부 행동특성 및 종합의견 초안. 줄바꿈 없이 한 문단으로 작성."
        }
    }
};

// 스키마 정의: 평가 계획 추출
const assessmentPlanSchema = {
    type: Type.ARRAY,
    items: {
        type: Type.OBJECT,
        properties: {
            subject: { type: Type.STRING, description: "교과 (예: 국어, 수학, 사회, 과학, 영어 등). 표의 셀이 병합되어 비어있다면 바로 윗 행의 교과명을 상속받아야 함." },
            semester: { type: Type.STRING, description: "학기 (문서 제목의 '1학기' 또는 '2학기' 텍스트를 통해 1 또는 2로 추출)" },
            domain: { type: Type.STRING, description: "평가 영역. 표에 '단원'과 '영역' 열이 모두 있으면 반드시 '영역' 열의 값만 사용 (예: 문학, 듣기·말하기, 평화 통일을 위한 노력, 민주화와 산업화)" },
            timing: { type: Type.STRING, description: "평가 시기 (예: 4월, 5월, 3~7월, 수시 등). 시기, 기간, 월 등의 컬럼에서 추출." },
            achievementStandard: { type: Type.STRING, description: "성취기준 코드 및 내용 (예: [6국01-02] 의견을 제시하고...)" },
            evaluationElement: { type: Type.STRING, description: "평가요소 (구체적인 활동 내용)" },
            criteria: {
                type: Type.OBJECT,
                properties: {
                    high: { type: Type.STRING, description: "평가기준 '잘함' 내용" },
                    middle: { type: Type.STRING, description: "평가기준 '보통' 내용" },
                    low: { type: Type.STRING, description: "평가기준 '노력요함' 내용" },
                }
            }
        }
    }
};

const getTargetBehaviorRecords = (records: BehaviorRecord[], mode: BehaviorAnalysisMode) => (
    mode === 'semester1'
        ? records.filter(record => {
            const month = Number(record.date.slice(5, 7));
            return month >= 3 && month <= 8;
        })
        : records
);

const formatBehaviorRecordsForPrompt = (records: BehaviorRecord[], mode: BehaviorAnalysisMode) => (
    [...getTargetBehaviorRecords(records, mode)]
        .sort((a, b) => a.date.localeCompare(b.date))
        .map(r => {
            const resolvedType = resolveObservationType(r);
            const type = resolvedType === 'positive' ? '긍정 행동' : resolvedType === 'guidance' ? '지도 필요' : '일반 관찰';
            return [
                `[${r.date} ${r.period} / ${type}]`,
                r.context ? `관찰 상황: ${r.context}` : '',
                `구체적 행동: ${r.content}`,
                r.followUp ? `지도 및 후속 변화: ${r.followUp}` : ''
            ].filter(Boolean).join(' ');
        })
        .join("\n")
);

const scheduleDraftSchema = {
    type: Type.ARRAY,
    items: {
        type: Type.OBJECT,
        properties: {
            date: { type: Type.STRING, description: "일정 날짜. YYYY-MM-DD 형식. 날짜가 불확실하면 기준 날짜를 넣고 needsReview를 true로 표시" },
            time: { type: Type.STRING, description: "일정 시작시간. HH:mm 형식. 명확한 시간이 없으면 빈 문자열" },
            endTime: { type: Type.STRING, description: "일정 종료시간. HH:mm 형식. 시간 범위가 없으면 빈 문자열" },
            title: { type: Type.STRING, description: "캘린더에 표시할 짧은 일정 제목" },
            category: { type: Type.STRING, description: "제공된 분류 중 가장 가까운 분류명" },
            location: { type: Type.STRING, description: "장소. 없으면 빈 문자열" },
            memo: { type: Type.STRING, description: "캡처 내용 중 사용자가 나중에 참고하면 좋을 핵심 안내, 준비물, 제출처, 링크 설명, 유의사항 등을 간결하게 정리" },
            confidence: { type: Type.STRING, description: "high, medium, low 중 하나" },
            needsReview: { type: Type.BOOLEAN, description: "날짜, 시간, 제목 등 주요 정보가 불확실하면 true" },
        }
    }
};


export async function extractStudentInfoFromFile(file: File, apiKey?: string, model?: string): Promise<Omit<Student, 'id'>[]> {
    const ai = getAiClient(apiKey);
    const selectedModel = normalizeGeminiModel(model);

    const imagePart = await fileToGenerativePart(file);

    const prompt = `다음은 여러 학생의 정보가 포함될 수 있는 학생 기초 조사서 파일입니다. 파일에 있는 모든 학생의 정보를 추출하여, 제공된 스키마에 따라 각 학생을 객체로 하는 JSON 배열을 생성해주세요. 모든 필드를 채우려고 노력하되, 이미지에 정보가 없는 필드는 빈 문자열("")이나 적절한 기본값(예: 불리언의 경우 false, 빈 배열 [])으로 남겨두세요. 날짜 형식은 YYYY-MM-DD를 따라야 합니다.`;

    try {
        const response = await ai.models.generateContent({
            model: selectedModel,
            contents: { parts: [imagePart, { text: prompt }] },
            config: {
                responseMimeType: 'application/json',
                responseSchema: multiStudentSchema,
            },
        });

        const text = response.text;
        const studentData = JSON.parse(text);

        // Ensure the result is always an array
        if (Array.isArray(studentData)) {
            return studentData as Omit<Student, 'id'>[];
        } else if (typeof studentData === 'object' && studentData !== null) {
            // If Gemini returns a single object instead of an array with one object
            return [studentData as Omit<Student, 'id'>];
        }

        return []; // Return empty array if parsing fails or result is not an object/array
    } catch (error) {
        console.error("Error processing file with Gemini API:", error);
        throw error;
    }
}

export async function analyzeBehaviorRecords(
    studentName: string,
    records: BehaviorRecord[],
    mode: BehaviorAnalysisMode = 'semester1',
    apiKey?: string,
    model?: string
): Promise<AnalysisResult> {
    if (!records || records.length === 0) {
        throw new Error("분석할 기록이 없습니다.");
    }

    const ai = getAiClient(apiKey);
    const selectedModel = normalizeGeminiModel(model);

    const recordsText = formatBehaviorRecordsForPrompt(records, mode);

    if (!recordsText) {
        throw new Error(mode === 'semester1' ? '1학기에 해당하는 행동 기록이 없습니다.' : '분석할 행동 기록이 없습니다.');
    }

    const modeTitle = mode === 'semester1' ? '1학기 행동특성 및 종합의견 초안' : '학년말 행동특성 및 종합의견 초안';
    const sourceDescription = mode === 'semester1'
        ? '3월부터 8월까지의 수시 관찰 기록만을 근거로 1학기 내용을 작성'
        : '3월부터 다음 해 2월까지의 연간 수시 관찰 기록 전체를 근거로 학년말 내용을 작성';
    const lengthGuide = mode === 'semester1' ? '4~6문장, 공백 포함 400~600자 내외' : '5~7문장, 공백 포함 500~700자 내외';

    const prompt = `
    당신은 대한민국 초등학교 생활기록부 작성 전문가입니다. 
    제공된 **'2026학년도 학교생활기록부 기재요령'**을 준수하여 다음 학생의 **${modeTitle}**을 작성하세요.

    [학생 이름]: ${studentName}
    
    [수시 관찰 기록 (누가기록)]:
    ${recordsText}

    [작성 목표]
    - ${sourceDescription}하십시오.
    - AI 결과는 교사가 검토하고 수정할 초안이며, 관찰 기록에 없는 사실은 만들지 마십시오.
    - 단순 나열보다 반복적으로 관찰된 특성과 구체적인 행동 근거가 연결되도록 작성하십시오.

    [분석 및 작성 원칙 - **필수 준수**]
    1. **이름 언급 금지 (매우 중요):** 문장의 주어로 학생의 이름을 절대 사용하지 마십시오. 바로 "수업 시간에는...", "평소...", "친구들과..." 등으로 문장을 시작하십시오.
    2. **분량 조절:** ${lengthGuide}로 작성하십시오.
    3. **직접 관찰 근거:** 성격을 단정하거나 심리 상태를 추측하지 말고, 기록된 상황과 행동을 구체적으로 서술하십시오.
    4. **지도 필요 기록 보존:** '지도 필요' 기록을 임의로 삭제하거나 긍정적으로 왜곡하지 마십시오. 반복되거나 중요한 행동은 관찰 사실 중심으로 포함하되 낙인찍는 표현을 사용하지 마십시오.
    5. **변화의 사실성:** 지도 후 변화가 기록에 있을 때만 변화를 서술하고, 기록되지 않은 반성·노력·성장 가능성을 만들어내지 마십시오.
    6. **문체와 서식:** 모든 문장은 '~함.', '~임.', '~보임.' 등의 명사형 어미와 마침표로 끝내고, 줄바꿈 없이 온점 뒤 한 칸을 띄워 이어 쓰십시오.
    7. **기재 제한:** 학생 이름, 공인어학시험, 교내외 대회·수상, 장학생, 자격증, 상호명·기관명 및 사교육 유발 표현을 포함하지 마십시오. 한글을 우선 사용하고 불필요한 특수문자를 쓰지 마십시오.

    [좋은 예시 스타일]
    "자신의 생각과 감정을 솔직하고 분명하게 표현하며, 교사의 설명을 주의 깊게 듣고 빠르게 이해하여 수업 내용에 잘 따라옴. 특히 모둠 활동에서 친구들의 의견을 경청하고 조율하는 역할을 자처하여 원만한 합의를 이끌어내는 리더십을 보임. (중략 ... 구체적 사례 포함) ... 점차 안정된 학습 태도를 형성해가고 있어 다음 학년에서의 성장이 더욱 기대됨."
    `;

    try {
        const response = await ai.models.generateContent({
            model: selectedModel,
            contents: { parts: [{ text: prompt }] },
            config: {
                responseMimeType: 'application/json',
                responseSchema: analysisSchema,
            },
        });

        const text = response.text;
        if (!text) {
            throw new Error("AI 응답이 비어있습니다.");
        }
        const result = JSON.parse(text) as AnalysisResult;

        // Add timestamp if missing
        return {
            ...result,
            lastUpdated: new Date().toISOString(),
            mode
        };
    } catch (error) {
        console.error("Error analyzing behavior records:", error);
        throw error;
    }
}

export async function softenBehaviorReport(
    studentName: string,
    records: BehaviorRecord[],
    draftReport: string,
    mode: BehaviorAnalysisMode = 'semester1',
    apiKey?: string,
    model?: string
): Promise<string> {
    if (!draftReport.trim()) {
        throw new Error("순화할 초안이 없습니다.");
    }

    const recordsText = formatBehaviorRecordsForPrompt(records || [], mode);
    if (!recordsText) {
        throw new Error(mode === 'semester1' ? '1학기에 해당하는 행동 기록이 없습니다.' : '분석할 행동 기록이 없습니다.');
    }

    const ai = getAiClient(apiKey);
    const selectedModel = normalizeGeminiModel(model);
    const modeTitle = mode === 'semester1' ? '1학기 행동특성 및 종합의견 초안' : '학년말 행동특성 및 종합의견 초안';
    const lengthGuide = mode === 'semester1' ? '4~6문장, 공백 포함 400~600자 내외' : '5~7문장, 공백 포함 500~700자 내외';

    const prompt = `
    당신은 대한민국 초등학교 생활기록부 작성 전문가입니다.
    아래의 수시 관찰 기록과 기존 ${modeTitle}을 바탕으로, 교사가 검토할 수 있는 순화 초안으로 다시 작성하세요.

    [학생 이름]: ${studentName}

    [수시 관찰 기록]:
    ${recordsText}

    [기존 초안]:
    ${draftReport}

    [순화 목표]
    - 부정적 낙인 표현을 줄이고, 관찰 가능한 사실과 지도 후 변화 가능성이 드러나도록 표현하십시오.
    - 문제 행동 자체를 삭제하거나 숨기지 말고, 필요한 지도 영역을 "현재 보완이 필요한 점", "지도 속에서 형성해 가는 태도"처럼 교육적 문장으로 전환하십시오.
    - 원 기록과 기존 초안에 없는 반성, 사과, 개선, 성장, 장점, 가정 배경, 심리 상태를 새로 만들지 마십시오.

    [작성 원칙 - 필수 준수]
    1. 학생 이름을 문장에 포함하지 마십시오.
    2. ${lengthGuide}로 작성하십시오.
    3. 모든 문장은 '~함.', '~임.', '~보임.', '~필요함.', '~기대됨.' 등의 학교생활기록부 문체로 끝맺으십시오.
    4. 줄바꿈 없이 한 문단으로 작성하고, 온점 뒤에는 한 칸을 띄우십시오.
    5. "문제아", "반항적", "게으름", "고집이 셈", "잘못", "변명", "책임감 없음"처럼 낙인 또는 단정으로 읽히는 표현을 피하십시오.
    6. 관찰 사실은 완전히 긍정으로 왜곡하지 말고, "규칙 준수와 기본 생활 습관을 안정적으로 형성하기 위한 지속적인 지도가 필요함."처럼 변화 가능성과 지도 방향이 보이게 쓰십시오.
    7. 공인어학시험, 교내외 대회·수상, 장학생, 자격증, 상호명·기관명과 사교육 유발 표현을 포함하지 마십시오.
    8. 생성 과정이나 설명 없이 순화된 초안 본문만 report에 담으십시오.
    `;

    try {
        const response = await ai.models.generateContent({
            model: selectedModel,
            contents: { parts: [{ text: prompt }] },
            config: {
                responseMimeType: 'application/json',
                responseSchema: softenedReportSchema,
            },
        });

        const parsed = JSON.parse(response.text || "{}");
        const report = typeof parsed.report === 'string' ? parsed.report.trim() : '';
        if (!report) {
            throw new Error("AI 응답이 비어있습니다.");
        }
        return report;
    } catch (error) {
        console.error("Error softening behavior report:", error);
        throw error;
    }
}

export async function extractAssessmentPlanFromFile(file: File, apiKey?: string, model?: string): Promise<Omit<Assessment, 'id' | 'createdAt' | 'schoolYear'>[]> {
    const ai = getAiClient(apiKey);
    const selectedModel = normalizeGeminiModel(model);

    const imagePart = await fileToGenerativePart(file);

    const prompt = `
        다음은 초등학교 평가 계획 문서(이미지 또는 PDF)입니다. 
        이 문서를 분석하여 평가 계획 목록을 JSON 배열로 반환해주세요.
        
        **중요 처리 규칙 (반드시 준수):**
        1. **셀 병합(Merged Cells) 처리**: 
           - '교과' 열이 세로로 병합되어 있어 첫 번째 행에만 교과명(예: 국어)이 있고 아래 행들은 비어있는 경우가 많습니다.
           - 이 경우, **반드시 바로 위 행의 '교과' 값을 그대로 상속받아 채우세요.** 교과가 비어있는 행이 없도록 하세요.
           
        2. **학기(Semester) 추출**: 
           - 문서의 상단 제목(예: "2025학년도 5학년 2학기 수행평가 계획")을 확인하여 '1'학기인지 '2'학기인지 파악하고 'semester' 필드에 "1" 또는 "2"를 넣으세요.
           - 제목에 학기 정보가 없다면 '시기' 열을 보고 추론하세요 (3~7월: 1학기, 8~12월: 2학기).
        
        3. **올해 평가 계획 표 형식 처리**:
           - 표가 '교과 / 성취기준 / 단원 / 영역 / 평가요소 / ①수업 방법, ②평가 방법, ③수업·평가 연계의 주안점 / 평가기준 / 시기' 형태라면 각 열의 제목을 기준으로 읽으세요.
           - domain은 반드시 '영역' 열의 값을 사용하세요. '단원' 열의 값(예: "1. 평화 통일을 위한 노력, 민주화와 산업화")을 domain으로 넣지 마세요.
           - 영역명이 여러 줄로 나뉘어 보이면 자연스러운 한글 띄어쓰기로 복원하세요. 단어 중간에서 줄이 바뀐 경우에는 불필요한 공백을 넣지 마세요.
           - evaluationElement는 '평가요소' 열의 값을 사용하고, 수업 방법/평가 방법/주안점 내용과 섞지 마세요.
        
        4. **데이터 추출**: 각 행마다 다음 항목을 추출하세요.
           - subject: 교과 (병합된 경우 위 행 값 상속)
           - semester: 학기 (문서 제목 기준)
           - domain: 평가 영역 (단원명이나 영역 컬럼, 예: 읽기, 쓰기)
           - timing: 평가 시기 (예: 4월, 5월, 11월 4주 등)
           - achievementStandard: 성취기준 코드 및 내용 (예: [6국01-02] ...)
           - evaluationElement: 평가요소 (구체적인 활동 내용)
           - criteria: 3단계 평가 기준 (잘함, 보통, 노력요함)
    `;

    try {
        const response = await ai.models.generateContent({
            model: selectedModel,
            contents: { parts: [imagePart, { text: prompt }] },
            config: {
                responseMimeType: 'application/json',
                responseSchema: assessmentPlanSchema,
            },
        });

        const text = response.text;
        const data = JSON.parse(text);

        if (Array.isArray(data)) {
            return data;
        } else if (typeof data === 'object' && data !== null) {
            return [data];
        }
        return [];
    } catch (error) {
        console.error("Error extracting assessment plan:", error);
        throw error;
    }
}

export async function extractScheduleEventsFromImage(
    file: File,
    categories: string[],
    referenceDate: string,
    apiKey?: string,
    model?: string
): Promise<ExtractedScheduleDraft[]> {
    const ai = getAiClient(apiKey);
    const selectedModel = normalizeGeminiModel(model);
    const imagePart = await fileToGenerativePart(file);
    const availableCategories = categories.length ? categories : ['업무'];
    const defaultCategory = availableCategories[0] || '업무';

    const prompt = `
        다음 이미지는 메신저 안내, 학교 공문, 알림장, 업무 안내 등을 캡처한 것입니다.
        이미지에서 캘린더에 등록할 수 있는 실제 일정 후보를 추출하여 JSON 배열로 반환하세요.

        [기준 날짜]
        - 오늘 또는 사용자가 보고 있는 기준 날짜: ${referenceDate}
        - 연도가 이미지에 없고 월/일만 있다면 기준 날짜와 같은 연도로 해석하세요.

        [사용 가능한 분류]
        ${availableCategories.join(', ')}

        [추출 규칙]
        1. AI가 바로 저장하는 용도가 아니라 사용자가 검토할 초안입니다. 불확실한 정보는 needsReview=true로 표시하세요.
        2. 날짜가 명확하지 않으면 date에는 기준 날짜(${referenceDate})를 넣고 needsReview=true로 표시하세요.
        3. 시간이 명확하지 않으면 time은 빈 문자열("")로 두세요. 추측으로 시간을 만들지 마세요.
           - "18:00~22:00", "18:00-22:00"처럼 시간 범위가 있으면 time에는 시작시간 "18:00", endTime에는 종료시간 "22:00"을 넣으세요.
           - 시작시간만 있으면 time에만 넣고 endTime은 빈 문자열("")로 두세요.
        4. title은 캘린더 칸에 보일 짧은 제목으로 작성하세요.
        5. memo에는 "캡처 내용에서 추출됨" 같은 출처 문구를 쓰지 말고, 캡처 내용 중 보관하면 좋은 핵심 안내만 정리하세요.
        6. 반복 일정이나 고정 일정 추론은 하지 마세요. 반복처럼 보여도 명확히 보이는 날짜별 후보만 반환하세요.
        7. 일정으로 볼 수 있는 날짜/마감/행사/제출/회의/연수/준비 항목이 없으면 빈 배열을 반환하세요.
        8. category는 반드시 사용 가능한 분류 중 하나로 선택하세요. 애매하면 "${defaultCategory}"를 사용하세요.
        9. date는 YYYY-MM-DD, time과 endTime은 HH:mm 형식을 지키세요.
    `;

    try {
        const response = await ai.models.generateContent({
            model: selectedModel,
            contents: { parts: [imagePart, { text: prompt }] },
            config: {
                responseMimeType: 'application/json',
                responseSchema: scheduleDraftSchema,
            },
        });

        const parsed = JSON.parse(response.text || '[]');
        const rows = Array.isArray(parsed) ? parsed : (parsed ? [parsed] : []);
        return rows
            .map((row: Partial<ExtractedScheduleDraft>) => {
                const category = row.category && availableCategories.includes(row.category)
                    ? row.category
                    : defaultCategory;
                const date = typeof row.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(row.date)
                    ? row.date
                    : referenceDate;
                const rawTime = typeof row.time === 'string' ? row.time.trim() : '';
                const rawEndTime = typeof row.endTime === 'string' ? row.endTime.trim() : '';
                const rangeMatch = rawTime.match(/^(\d{2}:\d{2})\s*(?:~|〜|–|—|-)\s*(\d{2}:\d{2})$/);
                const isValidTime = (value: string) => {
                    const match = value.match(/^(\d{2}):(\d{2})$/);
                    return Boolean(match && Number(match[1]) < 24 && Number(match[2]) < 60);
                };
                const time = rangeMatch
                    ? (isValidTime(rangeMatch[1]) ? rangeMatch[1] : '')
                    : (isValidTime(rawTime) ? rawTime : '');
                const endTimeCandidate = rangeMatch ? rangeMatch[2] : rawEndTime;
                const endTime = isValidTime(endTimeCandidate) && time && endTimeCandidate > time
                    ? endTimeCandidate
                    : '';
                const invalidTimeRange = Boolean(endTimeCandidate && !endTime);
                return {
                    date,
                    time,
                    endTime,
                    title: (row.title || '').trim(),
                    category,
                    location: (row.location || '').trim(),
                    memo: (row.memo || '').trim(),
                    confidence: row.confidence || 'medium',
                    needsReview: Boolean(row.needsReview || invalidTimeRange || date === referenceDate && row.date !== referenceDate),
                };
            })
            .filter((row: ExtractedScheduleDraft) => row.title.length > 0);
    } catch (error) {
        console.error("Error extracting schedule from image:", error);
        throw new Error("캡처 이미지에서 일정을 분석하지 못했습니다.");
    }
}

export async function generateSubjectComment(
    studentName: string,
    subject: string,
    evaluations: { element: string; level: string; criteriaDetail: string }[],
    sentenceCount: number = 2,
    apiKey?: string,
    model?: string
): Promise<string> {
    const ai = getAiClient(apiKey);
    const selectedModel = normalizeGeminiModel(model);

    if (!evaluations || evaluations.length === 0) {
        return "평가 결과가 없어 생성할 수 없습니다.";
    }

    // Construct the context string from evaluations
    const evalDetails = evaluations.map(e => {
        // Handle 'none' level or generic missing
        const levelText = e.level === 'high' ? '잘함' : e.level === 'middle' ? '보통' : e.level === 'low' ? '노력요함' : '미실시';
        return `- ${e.element}: 평가결과 '${levelText}' (평가기준: ${e.criteriaDetail})`;
    }).join('\n');

    // Randomize the sentence structure style to prevent repetitive starts
    const styles = [
        "유형 A: 활동 과정과 수행 노력을 먼저 서술하고 결과를 잇는 방식 (예: '~활동에 적극 참여하여 ~를 수행함')",
        "유형 B: 성취한 결과나 능력을 먼저 강조하는 방식 (예: '정확하게 ~를 구하는 능력이 뛰어나며')",
        "유형 C: 구체적인 학습 상황이나 장면을 묘사하며 시작하는 방식 (예: '도형을 직접 조작하며 성질을 탐구하고')",
        "유형 D: 학생의 학습 태도나 참여 방식을 먼저 언급하는 방식 (예: '끈기 있게 문제를 해결하려 노력하며')"
    ];
    const randomStyle = styles[Math.floor(Math.random() * styles.length)];

    const prompt = `
        당신은 초등학교 교사입니다. 학생의 교과별 평가 결과(수행평가)를 바탕으로 2026학년도 학교생활기록부 '교과학습발달상황'의 '성취수준 및 특기사항' 교사용 검토 초안을 작성해주세요.

        [학생 정보]
        - 이름: ${studentName}
        - 교과: ${subject}

        [평가 데이터]
        ${evalDetails || "평가 데이터 없음"}

        [작성 원칙 - **필수 준수**]
        1. **데이터 기반 작성:** 위 [평가 데이터]에 나열된 항목 중, 평가 결과가 '잘함', '보통', '노력요함'인 항목만을 근거로 작성하세요. '미실시'인 항목은 절대 언급하지 마세요.
        2. **교과명/학생명 언급 금지:** 문장 내에서 교과명(${subject})이나 학생의 이름을 절대 포함하지 마세요. (예: "${subject} 시간에는" -> "수업 활동에서", "${studentName}은" -> 생략)
        3. **천편일률적인 시작 금지 (매우 중요):** 
           - **모든 학생의 문장이 똑같은 단어(예: 평가요소 명칭)로 시작해서는 안 됩니다.**
           - 이번 생성에서는 다음 스타일을 반드시 따르세요: **${randomStyle}**
           - '점대칭도형의 성질을...', '직육면체의 부피를...' 처럼 주제어로 문장을 시작하는 것을 피하고, 동사나 부사로 문장을 시작해 보세요.
        4. **성취 수준별 기술:**
           - '잘함': 해당 영역의 성취 기준을 우수하게 도달했음을 구체적으로 묘사하세요.
           - '보통': 평가기준에 근거하여 현재 확인된 성취수준을 구체적으로 기술하세요.
           - '노력요함': 평가기준에서 확인된 수행 수준을 사실 중심으로 기술하세요. 평가 데이터에 없는 노력, 변화, 조언 이행 또는 성장 가능성을 만들어내지 마세요.
        5. **문체:** 모든 문장을 '~함.', '~임.', '~보임.', '~있음.', '~할 수 있음.' 등 명사형 종결어미와 마침표로 끝맺으세요.
        6. **분량:** ${sentenceCount}문장 내외로 자연스럽게 연결된 하나의 문단으로 작성하세요.
        7. **서식:** 줄바꿈 없이 온점 뒤 한 칸을 띄운 줄글로 작성하고, 마크다운이나 불필요한 특수기호를 사용하지 마세요.
        8. **기재 제한:** 공인어학시험, 교내외 대회·수상, 장학생, 자격증, 상호명·기관명과 사교육 유발 표현을 포함하지 마세요.
        9. **불필요한 텍스트 금지:** 생성 과정, 사고 과정, 초안 설명 등을 출력하지 말고 교사가 검토할 초안 본문만 출력하세요.
    `;

    try {
        const response = await ai.models.generateContent({
            model: selectedModel,
            contents: { parts: [{ text: prompt }] },
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        comment: {
                            type: Type.STRING,
                            description: "생활기록부에 입력할 완성된 줄글(Plain Text). 사고 과정이나 부연 설명 없이 결과물만 포함할 것."
                        }
                    }
                }
            }
        });

        const json = JSON.parse(response.text || "{}");
        return json.comment?.trim() || "생성된 내용이 없습니다.";
    } catch (error) {
        console.error("Error generating subject comment:", error);
        throw new Error("AI 생성 중 오류가 발생했습니다.");
    }
}
