
export interface Guardian {
  relationship: string;
  name: string;
  phone: string;
}

export interface Sibling {
  relationship: string;
  name: string;
  attendsSameSchool: boolean;
  gradeClass: string;
}

export interface AfterSchoolActivity {
  name: string;
  subject: string;
  schedule: string;
}

export interface BehaviorRecord {
  id: string;
  date: string; // YYYY-MM-DD
  period: string;
  content: string;
  timestamp: number;
}

export interface MonthlyTrend {
  month: string; // YYYY-MM format
  negativeIntensity: number; // 0-10 scale
  positiveFrequency: number; // count
  keyword: string; // Representative keyword for the month
}

export interface AnalysisResult {
  keywords: string[];
  summary: string;
  trends: MonthlyTrend[];
  report: string;
  advice: {
    title: string;
    content: string;
  }[];
  lastUpdated: string; // ISO Date string
}

export type AttendanceType = '결석' | '지각' | '조퇴' | '결과';
export type AttendanceCategory = '질병' | '미인정' | '기타' | '인정'; // 인정 includes 체험학습

export interface AttendanceRecord {
  id: string;
  date: string; // YYYY-MM-DD
  type: AttendanceType;
  category: AttendanceCategory;
  note: string; // Specific reason e.g. "감기", "가족여행"
  documents: {
    name: string;
    submitted: boolean;
  }[];
}

export type TeacherMode = 'general' | 'specialist' | 'native' | 'sports';

export interface PeriodPlan {
  period: number;
  subject: string;
  topic: string;
  materialLink: string;
  isSpecialist?: boolean; // Deprecated but kept for backward compatibility, use teacherMode
  teacherMode?: TeacherMode; // 'general'(담임), 'specialist'(전담), 'native'(원어민), 'sports'(스강)
  teacherMemo?: string; // 전담/원어민/스강 시간 전달사항/메모
  disabled?: boolean; // 해당 교시 없음 (수업 삭제)
}

export interface ClassPlan {
  date: string; // YYYY-MM-DD
  periods: PeriodPlan[];
  note?: string;
}

export interface SubjectSetting {
    name: string;
    color: string;
}

export interface BasicSchedule {
    // Key is the day of week number (0-6, though usually 1-5 used)
    [key: string]: {
        periods: PeriodPlan[]; // Updated to use PeriodPlan to store isSpecialist flag
    } | SubjectSetting[] | any; // Allow subjectSettings to be stored here
    
    subjectSettings?: SubjectSetting[]; // Optional field to store custom subjects/colors
}

// User-defined Schedule Category definition
export interface ScheduleCategoryDef {
    id: string;
    label: string;
    colorClass: string; // Tailwind class string (e.g., 'bg-blue-100 text-blue-800 border-blue-200')
}

export interface ScheduleViewOptions {
    showTime: boolean;
    showLocation: boolean;
}

export interface ScheduleSettings {
    categories: ScheduleCategoryDef[];
    viewOptions: ScheduleViewOptions;
}

export interface ScheduleEvent {
  id: string;
  date: string; // YYYY-MM-DD
  title: string; // 할 일 (Content)
  category: string; // Now a string to support custom categories (matches ScheduleCategoryDef.label or id)
  isCompleted: boolean; // 체크 여부
  location: string; // 장소
  time: string; // 시간
  memo: string; // 긴 메모
}

// Checklist Types
export type ChecklistType = 'daily' | 'weekly' | 'monthly';

export interface ChecklistItem {
  id: string;
  type: ChecklistType;
  content: string;
  isChecked: boolean;
  createdAt: number;
}

export interface Student {
  id: string;
  schoolYear?: string; // 학년도 (e.g. "2025")
  school: string;
  grade: string;
  class: string;
  number: string;
  gender: string;
  name: {
    hangul: string;
    hanja: string;
  };
  dob: string;
  phone: {
    home: string;
    mobile: string;
  };
  address: string;
  specialNeeds: boolean;
  family: {
    guardians: Guardian[];
    isMulticultural: boolean;
    nationality: {
      father: string;
      mother: string;
    };
    siblings: Sibling[];
  };
  afterSchool: {
    activities: AfterSchoolActivity[];
    likes: string;
    dislikes: string;
  };
  learningStatus: string;
  healthStatus: string;
  parentRequests: string;
  behaviorRecords?: BehaviorRecord[];
  attendanceRecords?: AttendanceRecord[];
  analysisResult?: AnalysisResult;
  semester1Opinion?: string; // 1학기 행동 특성 및 종합의견
}

// --- Evaluation Types ---

export interface Assessment {
  id: string;
  schoolYear: string;
  semester: string; // "1" or "2"
  subject: string; // e.g. "국어", "수학"
  domain: string; // 영역 e.g. "쓰기", "수와 연산"
  achievementStandard: string; // 성취기준 e.g. "[6국01-02] 의견을 제시하고..."
  evaluationElement: string; // 평가요소 e.g. "의견을 조정하며 토의하기"
  timing?: string; // 평가 시기 e.g. "3월", "4월", "수시"
  criteria: {
    high: string; // 잘함 기준
    middle: string; // 보통 기준
    low: string; // 노력요함 기준
  };
  isExcluded?: boolean; // 입력 제외 여부 (전담 등)
  createdAt: number;
}

export type EvaluationLevel = 'high' | 'middle' | 'low' | 'none';

export interface EvaluationRecord {
  id: string;
  assessmentId: string;
  studentId: string;
  level: EvaluationLevel;
  schoolYear: string;
  updatedAt: number;
}

// --- Notice Types ---
export interface Notice {
  id: string;
  title: string;
  content: string;
  authorUid: string; // To check ownership
  createdAt: number;
  updatedAt?: number;
}

export interface NoticeComment {
  id: string;
  noticeId: string;
  authorName: string;
  authorUid: string;
  content: string;
  createdAt: number;
}
