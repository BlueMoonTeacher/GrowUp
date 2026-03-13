
import { GoogleGenAI, Type } from "@google/genai";
import { Student, BehaviorRecord, AnalysisResult, Assessment } from "../types";

// Default Configuration
const DEFAULT_MODEL = 'gemini-2.5-pro';

// Helper to initialize AI client with dynamic key
function getAiClient(apiKey?: string) {
    if (!apiKey || apiKey.trim() === '') {
        throw new Error("Gemini API 키가 설정되지 않았습니다. 로그인 후 우측 상단의 '설정' 메뉴에서 직접 발급받은 API 키를 입력해주세요.");
    }
    return new GoogleGenAI({ apiKey });
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
            description: "학교생활기록부 '행동특성 및 종합의견' 최종 기재용 완성글. 5~7문장 내외로 작성."
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

// 스키마 정의: 평가 계획 추출
const assessmentPlanSchema = {
    type: Type.ARRAY,
    items: {
        type: Type.OBJECT,
        properties: {
            subject: { type: Type.STRING, description: "교과 (예: 국어, 수학, 사회, 과학, 영어 등). 표의 셀이 병합되어 비어있다면 바로 윗 행의 교과명을 상속받아야 함." },
            semester: { type: Type.STRING, description: "학기 (문서 제목의 '1학기' 또는 '2학기' 텍스트를 통해 1 또는 2로 추출)" },
            domain: { type: Type.STRING, description: "평가 영역 (단원명이나 영역 컬럼, 예: 읽기, 쓰기)" },
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


export async function extractStudentInfoFromFile(file: File, apiKey?: string, model?: string): Promise<Omit<Student, 'id'>[]> {
    const ai = getAiClient(apiKey);
    const selectedModel = model || DEFAULT_MODEL;

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
    semester1Opinion?: string,
    apiKey?: string,
    model?: string
): Promise<AnalysisResult> {
    if (!records || records.length === 0) {
        throw new Error("분석할 기록이 없습니다.");
    }

    const ai = getAiClient(apiKey);
    const selectedModel = model || DEFAULT_MODEL;

    // 기록 데이터를 텍스트로 변환
    const recordsText = records
        .sort((a, b) => a.date.localeCompare(b.date))
        .map(r => `[${r.date} ${r.period}] ${r.content}`)
        .join("\n");

    const prompt = `
    당신은 대한민국 초등학교 생활기록부 작성 전문가입니다. 
    제공된 **'2025학년도 학교생활기록부 기재요령'**을 철저히 준수하여, 다음 학생의 1학기 의견과 수시 관찰 기록을 종합하여 **'학년말 최종 행동특성 및 종합의견'**을 작성하세요.

    [학생 이름]: ${studentName}
    
    [1학기 행동 특성 및 종합의견 (기존 작성됨)]:
    ${semester1Opinion ? semester1Opinion : "작성된 1학기 내용 없음."}

    [수시 관찰 기록 (누가기록)]:
    ${recordsText}

    [작성 목표]
    1학기 의견과 수시 관찰 기록을 종합하여 학생의 1년간의 핵심적인 성장과 특성을 **구체적인 사례를 곁들여** 기술하십시오.
    단순한 나열보다는 학생의 변화와 성장이 잘 드러나도록 작성해야 합니다.

    [분석 및 작성 원칙 - **필수 준수**]
    1. **이름 언급 금지 (매우 중요):** 문장의 주어로 학생의 이름을 절대 사용하지 마십시오. 바로 "수업 시간에는...", "평소...", "친구들과..." 등으로 문장을 시작하십시오.
    2. **분량 조절:** **5~7문장** 내외로 작성하며, 전체 길이는 **공백 포함 500~700자** 정도로 작성하십시오. 내용이 너무 짧거나 지나치게 길지 않도록 적절히 조절하십시오.
    3. **구체적 서술:** 단순히 "착함", "성실함"이라고 쓰지 말고, 어떤 상황에서 어떻게 행동했는지 구체적인 에피소드를 근거로 서술하십시오.
    4. **긍정적 변화 중심:** 단점은 가급적 배제하거나, 이를 극복하기 위한 노력과 성장 가능성으로 바꾸어 기술하십시오.
    5. **문체:** '~함.', '~임.', '~보임.' 등 명사형 종결어미로 끝맺으십시오.

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
            lastUpdated: new Date().toISOString()
        };
    } catch (error) {
        console.error("Error analyzing behavior records:", error);
        throw error;
    }
}

export async function extractAssessmentPlanFromFile(file: File, apiKey?: string, model?: string): Promise<Omit<Assessment, 'id' | 'createdAt' | 'schoolYear'>[]> {
    const ai = getAiClient(apiKey);
    const selectedModel = model || DEFAULT_MODEL;

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
        
        3. **데이터 추출**: 각 행마다 다음 항목을 추출하세요.
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

export async function generateSubjectComment(
    studentName: string,
    subject: string,
    evaluations: { element: string; level: string; criteriaDetail: string }[],
    sentenceCount: number = 2,
    apiKey?: string,
    model?: string
): Promise<string> {
    const ai = getAiClient(apiKey);
    const selectedModel = model || DEFAULT_MODEL;

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
        당신은 초등학교 교사입니다. 학생의 교과별 평가 결과(수행평가)를 바탕으로 학교생활기록부 '교과학습발달상황'의 '세부능력 및 특기사항'을 작성해주세요.

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
           - '보통': 해당 영역을 무난하게 수행했음을 기술하고, 긍정적인 발전 가능성을 덧붙이세요.
           - '노력요함': 교사의 조언이나 학생의 노력하는 모습을 포함하여 긍정적인 성장 가능성을 중심으로 기술하세요. (부정적 서술 지양)
        5. **문체:** '~함', '~임', '~보임', '~있음', '~할 수 있음' 등 명사형 종결어미로 끝맺으세요.
        6. **분량:** ${sentenceCount}문장 내외로 자연스럽게 연결된 하나의 문단으로 작성하세요.
        7. **서식:** 마크다운이나 특수기호를 사용하지 말고 줄글(Plain Text)로만 작성하세요. 
        8. **불필요한 텍스트 금지:** 생성 과정, 사고 과정, 초안 설명 등을 절대 출력하지 마세요. 오직 생활기록부에 입력할 문장만 출력하세요.
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
