import { BehaviorObservationType, BehaviorRecord } from '../types';

export const inferObservationType = (text: string): BehaviorObservationType => {
  const normalized = text.replace(/\s+/g, ' ');
  const positiveExceptions = ['다툼을 중재', '갈등을 조정', '갈등을 해결', '포기하지 않음'];
  if (positiveExceptions.some(signal => normalized.includes(signal))) return 'positive';

  const guidanceSignals = [
    '다툼', '갈등', '방해', '폭력', '욕설', '거짓말', '거부', '공격', '분노', '소리 지름', '자리 이탈',
    '규칙 위반', '주의를 줌', '지도가 필요', '상담', '반복됨', '미제출', '산만', '충동', '따돌림',
    '어려움을 보임', '무시함', '불성실', '노력이 필요', '개선이 필요', '지속적인 지도',
    '과제를 하지 않음', '참여하지 않음', '집중하지 못함', '준비물을 가져오지 않음',
    '울었', '울음', '기분이 안 좋', '불안', '문제가 생김', '연락두절', '연락이 되지 않',
    '가출', '흡연', '담배', '라이터', '위험한', '무단', '손절', '결석'
  ];
  if (guidanceSignals.some(signal => normalized.includes(signal))) return 'guidance';

  const positiveSignals = [
    '배려', '도와줌', '협력', '성실', '책임', '적극', '칭찬', '양보', '경청', '노력', '개선', '성장',
    '참여함', '발표함', '정리함', '솔선', '존중', '친절'
  ];
  if (positiveSignals.some(signal => normalized.includes(signal))) return 'positive';
  return 'neutral';
};

export const resolveObservationType = (record: BehaviorRecord): BehaviorObservationType => (
  record.observationTypeSource === 'manual' && record.observationType
    ? record.observationType
    : inferObservationType(`${record.context || ''} ${record.content} ${record.followUp || ''}`)
);
