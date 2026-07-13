export type StudentTraitTone = 'positive' | 'support' | 'neutral';

export interface StudentTraitOption {
  group: string;
  label: string;
  tone: StudentTraitTone;
}

export const STUDENT_TRAIT_GROUPS = [
  '참여/집중',
  '과제',
  '관계',
  '경청/공감',
  '규칙',
  '감정',
  '표현',
  '자기관리',
  '공동체 의식',
] as const;

export const STUDENT_TRAIT_OPTIONS: StudentTraitOption[] = [
  { group: '참여/집중', label: '수업 참여 적극', tone: 'positive' },
  { group: '참여/집중', label: '질문으로 이해 확인', tone: 'positive' },
  { group: '참여/집중', label: '활동 참여가 점차 증가', tone: 'positive' },
  { group: '참여/집중', label: '집중 유지 어려움', tone: 'support' },
  { group: '참여/집중', label: '활동 시작에 안내 필요', tone: 'support' },
  { group: '과제', label: '과제 수행 성실', tone: 'positive' },
  { group: '과제', label: '끝까지 마무리하려 노력', tone: 'positive' },
  { group: '과제', label: '피드백을 반영해 수정', tone: 'positive' },
  { group: '과제', label: '과제 완성에 추가 안내 필요', tone: 'support' },
  { group: '과제', label: '쓰기 활동 부담', tone: 'support' },
  { group: '관계', label: '또래관계 원만', tone: 'positive' },
  { group: '관계', label: '친구에게 먼저 다가감', tone: 'positive' },
  { group: '관계', label: '협력 활동에 잘 참여', tone: 'positive' },
  { group: '관계', label: '갈등 후 대화 연습 필요', tone: 'support' },
  { group: '관계', label: '장난 조절 필요', tone: 'support' },
  { group: '경청/공감', label: '친구 의견 경청', tone: 'positive' },
  { group: '경청/공감', label: '친구를 배려함', tone: 'positive' },
  { group: '경청/공감', label: '상대 반응을 살핌', tone: 'positive' },
  { group: '경청/공감', label: '말 차례 기다리기 연습 필요', tone: 'support' },
  { group: '경청/공감', label: '주의 깊게 듣는 연습 필요', tone: 'support' },
  { group: '규칙', label: '규칙과 약속을 잘 지킴', tone: 'positive' },
  { group: '규칙', label: '차례를 기다림', tone: 'positive' },
  { group: '규칙', label: '안전하게 활동하려 함', tone: 'positive' },
  { group: '규칙', label: '규칙 확인 필요', tone: 'support' },
  { group: '규칙', label: '활동이 과열될 때 조절 필요', tone: 'support' },
  { group: '감정', label: '감정을 말로 표현하려 함', tone: 'positive' },
  { group: '감정', label: '실수 후 다시 시도', tone: 'positive' },
  { group: '감정', label: '자신감이 점차 향상', tone: 'positive' },
  { group: '감정', label: '감정 조절 연습 필요', tone: 'support' },
  { group: '감정', label: '예상 밖 상황에 불안감 있음', tone: 'support' },
  { group: '표현', label: '자신의 생각을 잘 표현', tone: 'positive' },
  { group: '표현', label: '발표 참여가 증가', tone: 'positive' },
  { group: '표현', label: '근거를 들어 말하려 함', tone: 'positive' },
  { group: '표현', label: '언어 표현에 지원 필요', tone: 'support' },
  { group: '표현', label: '발표 부담 있음', tone: 'support' },
  { group: '자기관리', label: '준비물을 잘 챙김', tone: 'positive' },
  { group: '자기관리', label: '정리정돈을 잘함', tone: 'positive' },
  { group: '자기관리', label: '시간 약속을 지키려 함', tone: 'positive' },
  { group: '자기관리', label: '물건 관리 지도 필요', tone: 'support' },
  { group: '자기관리', label: '활동 전 준비 확인 필요', tone: 'support' },
  { group: '공동체 의식', label: '학급 역할을 책임감 있게 수행', tone: 'positive' },
  { group: '공동체 의식', label: '공용 물건을 아껴 사용', tone: 'positive' },
  { group: '공동체 의식', label: '행사 질서를 잘 지킴', tone: 'positive' },
  { group: '공동체 의식', label: '공동 활동 역할 수행 연습 필요', tone: 'support' },
  { group: '공동체 의식', label: '학급 약속을 떠올리는 연습 필요', tone: 'support' },
];

export const findStudentTraitOption = (label: string): StudentTraitOption | undefined => (
  STUDENT_TRAIT_OPTIONS.find(option => option.label === label)
);
