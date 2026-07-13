import React, { useMemo, useState } from 'react';
import {
  STUDENT_TRAIT_GROUPS,
  STUDENT_TRAIT_OPTIONS,
  StudentTraitOption,
  StudentTraitTone,
} from '../constants/studentTraits';

interface StudentTraitsModalProps {
  initialTraits: string[];
  onClose: () => void;
  onSave: (traits: string[]) => void;
}

const toneLabels: Record<StudentTraitTone | 'all', string> = {
  all: '전체',
  positive: '강점',
  support: '지원 필요',
  neutral: '일반',
};

const toneClasses: Record<StudentTraitTone, string> = {
  positive: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  support: 'border-rose-200 bg-rose-50 text-rose-700',
  neutral: 'border-slate-200 bg-slate-50 text-slate-700',
};

const Chip = ({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-bold transition-colors ${
      active
        ? 'border-indigo-400 bg-indigo-50 text-indigo-700'
        : 'border-base-300 bg-white text-base-content-secondary hover:border-indigo-200 hover:bg-indigo-50/70 hover:text-indigo-700'
    }`}
  >
    {children}
  </button>
);

const StudentTraitsModal = ({ initialTraits, onClose, onSave }: StudentTraitsModalProps): React.ReactElement => {
  const [selectedTraits, setSelectedTraits] = useState<string[]>(initialTraits);
  const [group, setGroup] = useState<string>('전체');
  const [tone, setTone] = useState<StudentTraitTone | 'all'>('all');
  const [query, setQuery] = useState('');

  const filteredOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return STUDENT_TRAIT_OPTIONS.filter(option => {
      if (group !== '전체' && option.group !== group) return false;
      if (tone !== 'all' && option.tone !== tone) return false;
      if (!normalizedQuery) return true;
      return `${option.group} ${option.label}`.toLowerCase().includes(normalizedQuery);
    });
  }, [group, tone, query]);

  const toggleTrait = (option: StudentTraitOption) => {
    setSelectedTraits(prev => (
      prev.includes(option.label)
        ? prev.filter(item => item !== option.label)
        : [...prev, option.label]
    ));
  };

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm" onClick={(e) => { e.stopPropagation(); onClose(); }}>
      <div
        className="flex h-[82vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-base-300 bg-base-100 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-base-300 bg-indigo-50/60 px-5 py-4">
          <div>
            <h2 className="text-lg font-extrabold text-base-content">학생 특성 설정</h2>
            <p className="mt-1 text-xs font-medium text-base-content-secondary">
              행동발달 기록이 적을 때 초안 생성에 참고할 대표 특성을 선택하세요.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-base-content-secondary transition-colors hover:bg-white hover:text-base-content"
            aria-label="학생 특성 설정 닫기"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        <div className="shrink-0 border-b border-base-200 bg-white px-5 py-3">
          <div className="flex flex-col gap-3">
            <input
              type="search"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="검색 · 예: 배려, 집중, 과제, 발표, 감정"
              className="w-full rounded-lg border border-base-300 bg-base-100 px-3 py-2 text-sm text-base-content shadow-sm outline-none transition-colors focus:border-indigo-300 focus:bg-white focus:ring-2 focus:ring-indigo-100"
            />
            <div className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar">
              <Chip active={group === '전체'} onClick={() => setGroup('전체')}>전체 특성</Chip>
              {STUDENT_TRAIT_GROUPS.map(item => (
                <Chip key={item} active={group === item} onClick={() => setGroup(item)}>
                  {item}
                </Chip>
              ))}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex gap-2">
                {(Object.keys(toneLabels) as Array<StudentTraitTone | 'all'>).map(item => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setTone(item)}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-bold transition-colors ${
                      tone === item
                        ? 'border-indigo-400 bg-indigo-600 text-white'
                        : 'border-base-300 bg-white text-base-content-secondary hover:bg-base-200'
                    }`}
                  >
                    {toneLabels[item]}
                  </button>
                ))}
              </div>
              <span className="rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-xs font-extrabold text-indigo-700">
                선택 {selectedTraits.length}개
              </span>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto bg-base-50 p-5 custom-scrollbar">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {filteredOptions.map(option => {
              const active = selectedTraits.includes(option.label);
              return (
                <button
                  key={option.label}
                  type="button"
                  onClick={() => toggleTrait(option)}
                  className={`rounded-lg border p-3 text-left shadow-sm transition-all active:scale-[0.99] ${
                    active
                      ? 'border-indigo-300 bg-indigo-50 ring-2 ring-indigo-100'
                      : 'border-base-300 bg-white hover:border-indigo-200 hover:shadow-md'
                  }`}
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className={`rounded-md border px-2 py-0.5 text-[11px] font-bold ${toneClasses[option.tone]}`}>
                      {toneLabels[option.tone]}
                    </span>
                    {active && (
                      <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-bold text-white">
                        선택됨
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-extrabold text-base-content">{option.label}</p>
                  <p className="mt-1 text-xs font-semibold text-base-content-secondary">{option.group}</p>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-base-300 bg-white px-5 py-3">
          <button
            type="button"
            onClick={() => setSelectedTraits([])}
            className="rounded-lg border border-base-300 bg-base-100 px-3 py-2 text-xs font-bold text-base-content-secondary transition-colors hover:bg-base-200"
          >
            선택 해제
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg bg-base-200 px-4 py-2 text-sm font-bold text-base-content transition-colors hover:bg-base-300"
            >
              취소
            </button>
            <button
              type="button"
              onClick={() => onSave(selectedTraits)}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition-colors hover:bg-indigo-700"
            >
              저장
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentTraitsModal;
