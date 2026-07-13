import React, { useMemo, useState } from 'react';
import { BehaviorObservationType } from '../types';
import {
  BEHAVIOR_HELPER_CATEGORIES,
  BEHAVIOR_HELPER_SCENES,
  BEHAVIOR_HELPER_TRAIT_GROUPS,
  BEHAVIOR_RECORD_EXAMPLES,
  BehaviorRecordExample,
  getBehaviorExampleTraitGroups,
} from '../constants/behaviorRecordHelper';

interface BehaviorRecordHelperModalProps {
  onClose: () => void;
  onApply: (example: BehaviorRecordExample) => void;
}

const typeLabels: Record<BehaviorObservationType | 'all', string> = {
  all: '전체',
  positive: '긍정 관찰',
  neutral: '일반 관찰',
  guidance: '지도 필요',
};

const typeClasses: Record<BehaviorObservationType, string> = {
  positive: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  neutral: 'border-slate-200 bg-slate-50 text-slate-700',
  guidance: 'border-rose-200 bg-rose-50 text-rose-700',
};

const ChipButton = ({
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

const BehaviorRecordHelperModal = ({ onClose, onApply }: BehaviorRecordHelperModalProps): React.ReactElement => {
  const [category, setCategory] = useState<string>('전체');
  const [scene, setScene] = useState<string>('전체');
  const [traitGroup, setTraitGroup] = useState<string>('전체');
  const [type, setType] = useState<BehaviorObservationType | 'all'>('all');
  const [query, setQuery] = useState('');

  const filteredExamples = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return BEHAVIOR_RECORD_EXAMPLES.filter(example => {
      const exampleTraitGroups = getBehaviorExampleTraitGroups(example);
      if (category !== '전체' && example.category !== category) return false;
      if (scene !== '전체' && example.scene !== scene) return false;
      if (traitGroup !== '전체' && !exampleTraitGroups.includes(traitGroup)) return false;
      if (type !== 'all' && example.observationType !== type) return false;
      if (!normalizedQuery) return true;
      const searchable = [
        example.title,
        example.category,
        example.scene,
        example.context,
        example.content,
        example.followUp,
        example.traits.join(' '),
        exampleTraitGroups.join(' '),
      ].join(' ').toLowerCase();
      return searchable.includes(normalizedQuery);
    });
  }, [category, scene, traitGroup, type, query]);

  const resetFilters = () => {
    setCategory('전체');
    setScene('전체');
    setTraitGroup('전체');
    setType('all');
    setQuery('');
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="flex h-[88vh] w-full max-w-[96rem] flex-col overflow-hidden rounded-2xl border border-base-300 bg-base-100 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-base-300 bg-indigo-50/60 px-5 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-indigo-200 bg-white text-indigo-700">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" />
                  <path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" />
                </svg>
              </span>
              <h2 className="text-lg font-extrabold text-base-content">행발기록 도우미</h2>
            </div>
            <p className="mt-1 text-xs font-medium text-base-content-secondary">
              예시 기록을 고른 뒤 학생에게 맞게 수정해서 등록하세요.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-base-content-secondary transition-colors hover:bg-white hover:text-base-content"
            aria-label="행발기록 도우미 닫기"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        <div className="shrink-0 border-b border-base-200 bg-white px-5 py-3">
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-1 gap-2 md:grid-cols-[minmax(0,1fr)_auto]">
              <input
                type="search"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="검색 · 예: 발표, 배려, 집중, 감정 조절, 준비물"
                className="w-full rounded-lg border border-base-300 bg-base-100 px-3 py-2 text-sm text-base-content shadow-sm outline-none transition-colors focus:border-indigo-300 focus:bg-white focus:ring-2 focus:ring-indigo-100"
              />
              <button
                type="button"
                onClick={resetFilters}
                className="rounded-lg border border-base-300 bg-base-100 px-3 py-2 text-xs font-bold text-base-content-secondary transition-colors hover:bg-base-200"
              >
                초기화
              </button>
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar">
              <ChipButton active={category === '전체'} onClick={() => setCategory('전체')}>전체 분류</ChipButton>
              {BEHAVIOR_HELPER_CATEGORIES.map(item => (
                <ChipButton key={item} active={category === item} onClick={() => setCategory(item)}>
                  {item}
                </ChipButton>
              ))}
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar">
              <ChipButton active={scene === '전체'} onClick={() => setScene('전체')}>전체 장면</ChipButton>
              {BEHAVIOR_HELPER_SCENES.map(item => (
                <ChipButton key={item} active={scene === item} onClick={() => setScene(item)}>
                  {item}
                </ChipButton>
              ))}
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar">
              <ChipButton active={traitGroup === '전체'} onClick={() => setTraitGroup('전체')}>전체 특성</ChipButton>
              {BEHAVIOR_HELPER_TRAIT_GROUPS.map(item => (
                <ChipButton key={item} active={traitGroup === item} onClick={() => setTraitGroup(item)}>
                  {item}
                </ChipButton>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex gap-2">
                {(Object.keys(typeLabels) as Array<BehaviorObservationType | 'all'>).map(item => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setType(item)}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-bold transition-colors ${
                      type === item
                        ? 'border-indigo-400 bg-indigo-600 text-white'
                        : 'border-base-300 bg-white text-base-content-secondary hover:bg-base-200'
                    }`}
                  >
                    {typeLabels[item]}
                  </button>
                ))}
              </div>
              <span className="rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-xs font-extrabold text-indigo-700">
                {filteredExamples.length} / {BEHAVIOR_RECORD_EXAMPLES.length}개
              </span>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto bg-base-50 p-5 custom-scrollbar">
          {filteredExamples.length > 0 ? (
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 2xl:grid-cols-3">
              {filteredExamples.map(example => {
                const exampleTraitGroups = getBehaviorExampleTraitGroups(example);
                return (
                  <button
                    key={example.id}
                    type="button"
                    onClick={() => onApply(example)}
                    className="group flex h-full flex-col rounded-lg border border-base-300 bg-white p-4 text-left shadow-sm transition-all hover:border-indigo-200 hover:shadow-md active:scale-[0.99]"
                  >
                    <div className="mb-2 flex flex-wrap items-center gap-1.5">
                      <span className={`rounded-md border px-2 py-0.5 text-[11px] font-bold ${typeClasses[example.observationType]}`}>
                        {typeLabels[example.observationType]}
                      </span>
                      <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-[11px] font-bold text-indigo-700">
                        {example.category}
                      </span>
                      <span className="rounded-md bg-base-200 px-2 py-0.5 text-[11px] font-bold text-base-content-secondary">
                        {example.scene}
                      </span>
                    </div>
                    <h3 className="text-sm font-extrabold text-base-content">{example.title}</h3>
                    <p className="mt-2 text-xs font-semibold text-base-content-secondary">상황 · {example.context}</p>
                    <p className="mt-1 text-sm leading-relaxed text-base-content">{example.content}</p>
                    <p className="mt-2 border-t border-base-200 pt-2 text-xs leading-relaxed text-base-content-secondary">
                      지도·후속 · {example.followUp}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {exampleTraitGroups.map(item => (
                        <span key={item} className="rounded-full bg-base-200 px-2 py-0.5 text-[11px] font-semibold text-base-content-secondary">
                          {item}
                        </span>
                      ))}
                    </div>
                    <span className="mt-3 text-xs font-extrabold text-indigo-600 opacity-0 transition-opacity group-hover:opacity-100">
                      입력칸에 넣기
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="flex h-full min-h-[12rem] flex-col items-center justify-center text-center text-base-content-secondary">
              <p className="text-sm font-bold">조건에 맞는 예시 기록이 없습니다.</p>
              <p className="mt-1 text-xs">검색어나 선택한 분류를 줄여보세요.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BehaviorRecordHelperModal;
