
import React, { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { BehaviorRecord, Student, AnalysisResult, BehaviorObservationType } from '../types';
import AnalysisModal from './AnalysisModal';
import BehaviorRecordHelperModal from './BehaviorRecordHelperModal';
import { useModal } from '../context/ModalContext';
import { AppSettings } from '../App';
import { inferObservationType, resolveObservationType } from '../utils/behaviorUtils';
import { BehaviorRecordExample } from '../constants/behaviorRecordHelper';

interface BehaviorLogProps {
  student: Student;
  onAddRecord: (record: Omit<BehaviorRecord, 'id'>) => void;
  onDeleteRecord: (recordId: string) => void;
  onUpdateStudent: (student: Student) => Promise<void>;
  settings?: AppSettings;
}

const PERIODS = [
  '일반',
  '아침활동',
  '1교시', '1교시 쉬는시간',
  '2교시', '2교시 쉬는시간',
  '3교시', '3교시 쉬는시간',
  '4교시', '4교시 쉬는시간',
  '점심시간',
  '5교시', '5교시 쉬는시간',
  '6교시', '6교시 쉬는시간',
  '방과후'
];

const OBSERVATION_TYPES = [
  { value: 'positive' as const, label: '긍정 행동', icon: '＋', activeClass: 'border-emerald-400 bg-emerald-50 text-emerald-700' },
  { value: 'neutral' as const, label: '일반 관찰', icon: '•', activeClass: 'border-slate-400 bg-slate-50 text-slate-700' },
  { value: 'guidance' as const, label: '지도 필요', icon: '!', activeClass: 'border-rose-400 bg-rose-50 text-rose-700' },
];

// Helper to get local date string in YYYY-MM-DD format
const getTodayString = () => {
  // Using 'en-CA' locale reliably provides the YYYY-MM-DD format.
  return new Date().toLocaleDateString('en-CA');
};

const BehaviorLog = ({ student, onAddRecord, onDeleteRecord, onUpdateStudent, settings }: BehaviorLogProps): React.ReactElement => {
  const { showConfirm, showToast } = useModal();
  const [date, setDate] = useState(getTodayString);
  const [period, setPeriod] = useState('일반');
  const [content, setContent] = useState('');
  const [context, setContext] = useState('');
  const [followUp, setFollowUp] = useState('');
  const [helperObservationType, setHelperObservationType] = useState<BehaviorObservationType | null>(null);
  const [filterMonth, setFilterMonth] = useState<string>('all');
  const [isAnalysisModalOpen, setIsAnalysisModalOpen] = useState(false);
  const [isHelperModalOpen, setIsHelperModalOpen] = useState(false);

  // Editing State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<{
    date: string;
    period: string;
    content: string;
    observationType: BehaviorObservationType;
    context: string;
    followUp: string;
  } | null>(null);

  // Reset form and filter when student changes
  useEffect(() => {
    setDate(getTodayString());
    setPeriod('일반');
    setContent('');
    setContext('');
    setFollowUp('');
    setHelperObservationType(null);
    setFilterMonth('all');
    setIsAnalysisModalOpen(false);
    setIsHelperModalOpen(false);
    setEditingId(null);
    setEditData(null);
  }, [student.id]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    const resolvedObservationType = helperObservationType || inferObservationType(`${context} ${content} ${followUp}`);

    onAddRecord({
      date,
      period,
      content: content.trim(),
      observationType: resolvedObservationType,
      observationTypeSource: helperObservationType ? 'manual' : 'auto',
      context: context.trim(),
      followUp: followUp.trim(),
      timestamp: Date.now(),
    });
    setContent('');
    setContext('');
    setFollowUp('');
    setHelperObservationType(null);
  };

  const handleSaveAnalysis = async (result: AnalysisResult) => {
      const mode = result.mode || 'semester1';
      const updatedStudent = {
          ...student,
          analysisResult: result,
          behaviorAnalysisResults: {
              ...(student.behaviorAnalysisResults || {}),
              [mode]: result
          }
      };
      await onUpdateStudent(updatedStudent);
  };

  const handleApplyHelperExample = (example: BehaviorRecordExample) => {
      setContext(example.context);
      setContent(example.content);
      setFollowUp(example.followUp);
      setHelperObservationType(example.observationType);
      setIsHelperModalOpen(false);
      showToast('예시 기록을 입력칸에 넣었습니다. 학생에게 맞게 수정해 주세요.');
  };

  const handleDownloadXls = () => {
      const records = [...(student.behaviorRecords || [])].sort((a, b) => {
          if (a.date !== b.date) return a.date.localeCompare(b.date);
          return a.timestamp - b.timestamp;
      });
      const rows = [['날짜별', '시간별', '구분', '관찰 상황', '구체적 행동', '지도 및 후속 변화']].concat(
          records.map((r) => [
            r.date,
            r.period,
            resolveObservationType(r) === 'positive' ? '긍정' : resolveObservationType(r) === 'guidance' ? '지도 필요' : '중립',
            r.context || '',
            r.content,
            r.followUp || ''
          ])
      );
      const ws = XLSX.utils.aoa_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      const sheetName = '행동발달누가기록';
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
      const fileName = `${student.name?.hangul || '학생'}_행동발달누가기록.xlsx`;
      XLSX.writeFile(wb, fileName);
      showToast('엑셀 파일이 다운로드되었습니다.');
  };

  // --- Edit Handlers ---
  const handleStartEdit = (record: BehaviorRecord) => {
      setEditingId(record.id);
      setEditData({
          date: record.date,
          period: record.period,
          content: record.content,
          observationType: resolveObservationType(record),
          context: record.context || '',
          followUp: record.followUp || ''
      });
  };

  const handleCancelEdit = () => {
      setEditingId(null);
      setEditData(null);
  };

  const handleSaveEdit = async () => {
      if (!editingId || !editData) return;
      if (!editData.content.trim()) {
          showToast("내용을 입력해주세요.");
          return;
      }

      const updatedRecords = (student.behaviorRecords || []).map(r => {
          if (r.id === editingId) {
              return {
                    ...r,
                    date: editData.date,
                    period: editData.period,
                    content: editData.content.trim(),
                    observationType: editData.observationType,
                    observationTypeSource: 'manual' as const,
                    context: editData.context.trim(),
                    followUp: editData.followUp.trim()
              };
          }
          return r;
      });

      await onUpdateStudent({ ...student, behaviorRecords: updatedRecords });
      setEditingId(null);
      setEditData(null);
      showToast("수정되었습니다.");
  };
  // ---------------------

  const availableMonths = useMemo(() => {
    const records = student.behaviorRecords || [];
    const months = new Set<string>();
    records.forEach(r => {
        if (r.date && r.date.length >= 7) {
            months.add(r.date.substring(0, 7)); // YYYY-MM
        }
    });
    return Array.from(months).sort().reverse();
  }, [student.behaviorRecords]);

  const filteredRecords = useMemo(() => {
    let records = [...(student.behaviorRecords || [])];
    if (filterMonth !== 'all') {
        records = records.filter(r => r.date.startsWith(filterMonth));
        // Sort ascending (oldest first) when filtered by month
        return records.sort((a, b) => {
            if (a.date !== b.date) return a.date.localeCompare(b.date);
            return a.timestamp - b.timestamp;
        });
    }
    // Sort descending (newest first) when showing all
    return records.sort((a, b) => {
        if (a.date !== b.date) return b.date.localeCompare(a.date);
        return b.timestamp - a.timestamp;
    });
  }, [student.behaviorRecords, filterMonth]);

  const formatMonthLabel = (yyyy_mm: string) => {
      const [y, m] = yyyy_mm.split('-');
      const currentYear = new Date().getFullYear().toString();
      if (y === currentYear) {
          return `${parseInt(m)}월`;
      }
      return `${y.slice(2)}년 ${parseInt(m)}월`;
  };

  const inputClass = "w-full p-2 text-sm border border-base-300 bg-base-200 rounded-md focus:ring-primary focus:border-primary shadow-sm focus:bg-base-100 transition-colors text-base-content";
  const helperObservationVisual = helperObservationType
    ? OBSERVATION_TYPES.find(type => type.value === helperObservationType)
    : null;

  return (
    <div className="relative flex max-md:h-auto max-md:overflow-visible flex-col overflow-hidden rounded-xl border border-base-300/60 bg-base-100 p-4 max-md:min-h-0 md:h-full md:min-h-0">
      {/* 모바일: 한 줄(제목·건수·AI), 다운로드 없음 / md+: 기존(다운로드 포함) */}
      <div className="mb-4 flex min-w-0 flex-row items-center justify-between gap-2 md:gap-3 lg:justify-between">
        <div className="flex min-w-0 flex-1 items-center gap-1.5 md:flex-initial md:gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 shrink-0 text-green-600 md:h-6 md:w-6" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
            <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
            <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
          </svg>
          <h2 className="min-w-0 max-md:truncate text-sm font-bold text-base-content md:text-base md:whitespace-nowrap lg:text-lg">행동 발달 기록</h2>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 md:gap-2">
            <button
                type="button"
                onClick={handleDownloadXls}
                className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-base-300 bg-base-200 text-base-content transition-colors hover:bg-base-300 md:flex"
                title="행동 발달 누가기록 엑셀 다운로드"
                aria-label="행동 발달 누가기록 엑셀 다운로드"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 shrink-0 text-green-600" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                    <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
            </button>
            <span className="shrink-0 whitespace-nowrap rounded-full border border-base-300/70 bg-base-200 px-2 py-0.5 text-[11px] font-semibold text-base-content-secondary md:px-2.5 md:py-1 md:text-xs">
                {filterMonth === 'all' ? '총' : formatMonthLabel(filterMonth)} {filteredRecords.length}건
            </span>
            <button
                type="button"
                onClick={() => setIsAnalysisModalOpen(true)}
                className="flex shrink-0 items-center rounded-full bg-gradient-to-r from-primary to-primary-focus px-2 py-1 text-[11px] font-bold text-primary-content shadow-md transition-all hover:shadow-lg active:scale-95 whitespace-nowrap md:px-3 md:py-1.5 md:text-xs"
                title="수시 관찰 기록을 바탕으로 1학기 또는 학년말 초안 작성"
            >
                <span className="md:hidden">AI 분석</span>
                <span className="hidden md:inline">AI 종합 분석</span>
            </button>
        </div>
      </div>

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="bg-base-100 p-3 rounded-lg border border-base-300/70 mb-4 space-y-3">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={inputClass}
            required
          />
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className={inputClass}
          >
            {PERIODS.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
        <p className="text-[11px] text-base-content-secondary">기록 내용에 따라 긍정 행동·일반 관찰·지도 필요 항목으로 자동 구분됩니다.</p>
        <input
          type="text"
          value={context}
          onChange={(e) => setContext(e.target.value)}
          placeholder="관찰 상황 (선택) · 예: 모둠 토의 중, 쉬는 시간에"
          className={inputClass}
        />
        <div>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={`${student.name.hangul} 학생에게서 직접 관찰한 구체적인 행동을 기록하세요...`}
            className={`${inputClass} h-20 resize-none`}
            required
          />
          <input
            type="text"
            value={followUp}
            onChange={(e) => setFollowUp(e.target.value)}
            placeholder="교사의 지도 또는 이후 변화 (선택)"
            className={`${inputClass} mt-2`}
          />
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setIsHelperModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-700 shadow-sm transition-colors hover:bg-indigo-100 hover:border-indigo-300 active:scale-95"
              title="예시 문장을 골라 행동발달 누가기록 입력을 돕습니다."
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                <path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" />
                <path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" />
              </svg>
              행발기록 도우미
            </button>
            {helperObservationVisual && (
              <span className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-bold ${helperObservationVisual.activeClass}`}>
                도우미 분류 · {helperObservationVisual.label}
                <button
                  type="button"
                  onClick={() => setHelperObservationType(null)}
                  className="ml-1 rounded-full px-1 text-[11px] opacity-70 hover:bg-white/70 hover:opacity-100"
                  title="도우미 분류를 해제하고 내용 기준 자동 분류 사용"
                  aria-label="도우미 분류 해제"
                >
                  ×
                </button>
              </span>
            )}
            </div>
            <button
              type="submit"
              className="bg-primary text-primary-content font-bold py-2 px-5 rounded-lg hover:bg-primary-focus shadow-sm transition-colors text-sm"
            >
              등록
            </button>
          </div>
        </div>
      </form>

      {/* Filter Buttons */}
      {availableMonths.length > 0 && (
          <div className="mb-3 flex flex-wrap items-center gap-2 md:flex-nowrap md:gap-2 md:overflow-x-auto md:pb-1 custom-scrollbar">
            <button
                type="button"
                onClick={() => setFilterMonth('all')}
                className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-bold whitespace-nowrap transition-colors ${filterMonth === 'all' ? 'border-primary bg-primary text-primary-content' : 'border-transparent bg-base-200 text-base-content-secondary hover:bg-base-300'}`}
            >
                전체
            </button>
            {availableMonths.map(month => (
                <button
                    type="button"
                    key={month}
                    onClick={() => setFilterMonth(month)}
                    className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-bold whitespace-nowrap transition-colors ${filterMonth === month ? 'border-primary bg-primary text-primary-content' : 'border-transparent bg-base-200 text-base-content-secondary hover:bg-base-300'}`}
                >
                    {formatMonthLabel(month)}
                </button>
            ))}
        </div>
      )}

      {/* Records List — PC만 카드 내부 스크롤, 모바일은 전체 높이에 펼침 */}
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-2 pb-10 custom-scrollbar max-md:flex-none max-md:overflow-visible md:pb-24">
        {filteredRecords.length > 0 ? (
          filteredRecords.map((record) => {
            const resolvedType = resolveObservationType(record);
            const visual = OBSERVATION_TYPES.find(type => type.value === resolvedType) || OBSERVATION_TYPES[1];
            const recordBorderClass = resolvedType === 'guidance'
              ? 'border-rose-300 bg-rose-50/30'
              : resolvedType === 'positive'
                ? 'border-emerald-200 bg-emerald-50/20'
                : 'border-base-300 bg-base-100';
            return (
            <div 
                key={record.id} 
                onClick={() => {
                    if (editingId === record.id) return;
                    navigator.clipboard.writeText(record.content);
                    showToast("내용이 복사되었습니다.");
                }}
                className={`p-3 rounded-lg border shadow-sm transition-all group relative ${editingId === record.id ? 'border-primary bg-white ring-1 ring-primary' : `${recordBorderClass} hover:shadow-md cursor-pointer active:scale-[0.99]`}`}
                title={editingId === record.id ? '' : "클릭하여 복사"}
            >
               {editingId === record.id && editData ? (
                   // Edit Mode
                   <div className="space-y-2 animate-[fadeIn_0.2s_ease-out]">
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                            <input
                                type="date" 
                                value={editData.date} 
                                onChange={(e) => setEditData({...editData, date: e.target.value})}
                                 className={`${inputClass} text-xs`}
                           />
                           <select
                                value={editData.period}
                                onChange={(e) => setEditData({...editData, period: e.target.value})}
                                className={`${inputClass} text-xs`}
                           >
                                {PERIODS.map((p) => (
                                <option key={p} value={p}>{p}</option>
                                ))}
                            </select>
                            <select
                                value={editData.observationType}
                                onChange={(e) => setEditData({...editData, observationType: e.target.value as BehaviorObservationType})}
                                className={`${inputClass} text-xs`}
                                title="자동 분류가 맞지 않을 때만 수정하세요."
                            >
                                {OBSERVATION_TYPES.map(type => <option key={type.value} value={type.value}>{type.label}</option>)}
                            </select>
                        </div>
                        <input
                            value={editData.context}
                            onChange={(e) => setEditData({...editData, context: e.target.value})}
                            placeholder="관찰 상황 (선택)"
                            className={`${inputClass} text-xs`}
                        />
                        <textarea
                            value={editData.content}
                            onChange={(e) => setEditData({...editData, content: e.target.value})}
                            className={`${inputClass} min-h-[5rem] resize-none`}
                        />
                        <input
                            value={editData.followUp}
                            onChange={(e) => setEditData({...editData, followUp: e.target.value})}
                            placeholder="교사의 지도 또는 이후 변화 (선택)"
                            className={`${inputClass} text-xs`}
                        />
                       <div className="flex justify-end gap-2">
                           <button onClick={(e) => { e.stopPropagation(); handleCancelEdit(); }} className="px-3 py-1.5 bg-base-200 hover:bg-base-300 text-xs font-bold rounded-lg text-base-content-secondary">취소</button>
                           <button onClick={(e) => { e.stopPropagation(); handleSaveEdit(); }} className="px-3 py-1.5 bg-primary hover:bg-primary-focus text-xs font-bold rounded-lg text-primary-content">저장</button>
                       </div>
                   </div>
               ) : (
                   // View Mode
                   <>
                        <div className="flex justify-between items-start mb-2 pointer-events-none">
                             <div className="flex flex-wrap items-center gap-2">
                                {resolvedType !== 'neutral' && (
                                  <span className={`px-2 py-0.5 text-xs font-bold rounded-md border ${visual.activeClass}`} title="기록 내용에 따라 자동 구분됨">
                                    {visual.icon} {visual.label}
                                  </span>
                                )}
                                <span 
                                    className="px-2 py-0.5 bg-base-200 text-base-content-secondary text-xs font-bold rounded-md border border-base-300 pointer-events-auto hover:bg-primary/10 hover:text-primary hover:border-primary transition-colors cursor-pointer"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleStartEdit(record);
                                    }}
                                    title="클릭하여 수정"
                                >
                                    {record.date}
                                </span>
                                <span className="px-2 py-0.5 bg-secondary text-secondary-content text-xs font-bold rounded-md border border-green-200/80">
                                    {record.period}
                                </span>
                            </div>
                            
                            <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-auto">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleStartEdit(record);
                                    }}
                                    className="text-green-600 hover:text-primary hover:bg-primary/15 p-1 rounded transition-colors"
                                    title="수정"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                        <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                                    </svg>
                                </button>
                                <button
                                    onClick={async (e) => {
                                        e.stopPropagation();
                                        const confirmed = await showConfirm('이 기록을 삭제하시겠습니까?');
                                        if(confirmed) {
                                            onDeleteRecord(record.id);
                                        }
                                    }}
                                    className="text-red-500 hover:text-red-600 hover:bg-red-50 p-1 rounded transition-colors"
                                    title="삭제"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                        {record.context && <p className="mb-1 text-xs font-semibold text-base-content-secondary pointer-events-none">상황 · {record.context}</p>}
                        <p className="text-sm text-base-content whitespace-pre-wrap leading-relaxed pointer-events-none">
                            {record.content}
                        </p>
                        {record.followUp && <p className="mt-2 border-t border-current/10 pt-2 text-xs text-base-content-secondary pointer-events-none">지도·후속 · {record.followUp}</p>}
                   </>
               )}
            </div>
            );
          })
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-base-content-secondary space-y-2 opacity-60">
            <p className="text-sm font-medium">
                {filterMonth === 'all' ? '아직 기록된 내용이 없습니다.' : '해당 월의 기록이 없습니다.'}
            </p>
          </div>
        )}
      </div>

      {isAnalysisModalOpen && (
          <AnalysisModal 
            student={student} 
            onClose={() => setIsAnalysisModalOpen(false)} 
            onSaveAnalysis={handleSaveAnalysis}
            settings={settings}
          />
      )}

      {isHelperModalOpen && (
          <BehaviorRecordHelperModal
            onClose={() => setIsHelperModalOpen(false)}
            onApply={handleApplyHelperExample}
          />
      )}
    </div>
  );
};

export default BehaviorLog;
