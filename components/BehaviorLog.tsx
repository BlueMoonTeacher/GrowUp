
import React, { useState, useEffect, useMemo } from 'react';
import { BehaviorRecord, Student, AnalysisResult } from '../types';
import AnalysisModal from './AnalysisModal';
import { useModal } from '../context/ModalContext';
import { AppSettings } from '../App';

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
  const [filterMonth, setFilterMonth] = useState<string>('all');
  const [isAnalysisModalOpen, setIsAnalysisModalOpen] = useState(false);

  // 1st Semester Opinion State
  const [sem1Opinion, setSem1Opinion] = useState(student.semester1Opinion || '');
  const [isSem1Open, setIsSem1Open] = useState(false);
  const [isSavingSem1, setIsSavingSem1] = useState(false);

  // Editing State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<{date: string, period: string, content: string} | null>(null);

  // Reset form and filter when student changes
  useEffect(() => {
    setDate(getTodayString());
    setPeriod('일반');
    setContent('');
    setFilterMonth('all');
    setIsAnalysisModalOpen(false);
    setEditingId(null);
    setEditData(null);
    // Sync 1st semester opinion
    setSem1Opinion(student.semester1Opinion || '');
    setIsSem1Open(false);
  }, [student.id, student.semester1Opinion]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    onAddRecord({
      date,
      period,
      content: content.trim(),
      timestamp: Date.now(),
    });
    setContent('');
  };

  const handleSaveSem1Opinion = async () => {
      setIsSavingSem1(true);
      try {
          await onUpdateStudent({
              ...student,
              semester1Opinion: sem1Opinion
          });
          showToast("1학기 종합의견이 저장되었습니다.");
      } catch (e) {
          console.error(e);
          showToast("저장 중 오류가 발생했습니다.");
      } finally {
          setIsSavingSem1(false);
      }
  };

  const handleSaveAnalysis = async (result: AnalysisResult) => {
      const updatedStudent = {
          ...student,
          analysisResult: result
      };
      await onUpdateStudent(updatedStudent);
  };

  // --- Edit Handlers ---
  const handleStartEdit = (record: BehaviorRecord) => {
      setEditingId(record.id);
      setEditData({
          date: record.date,
          period: record.period,
          content: record.content
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
                  content: editData.content
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

  return (
    <div className="bg-base-100 rounded-xl shadow-lg border border-base-300/60 p-4 h-full flex flex-col relative">
      {/* 1st Semester Opinion Section (Accordion) */}
      <div className="mb-4 border border-base-300 rounded-lg overflow-hidden bg-base-50/50">
          <button 
            onClick={() => setIsSem1Open(!isSem1Open)}
            className="w-full px-4 py-2.5 flex items-center justify-between text-sm font-bold text-base-content hover:bg-base-100 transition-colors"
          >
              <div className="flex items-center gap-2">
                  <span className="text-primary">📑</span>
                  <span>1학기 행동 특성 및 종합의견</span>
                  {student.semester1Opinion && <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">작성됨</span>}
              </div>
              <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 transition-transform duration-200 ${isSem1Open ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
          </button>
          
          {isSem1Open && (
              <div className="p-3 border-t border-base-300 bg-white animate-[fadeIn_0.2s_ease-out]">
                  <textarea 
                      value={sem1Opinion}
                      onChange={(e) => setSem1Opinion(e.target.value)}
                      placeholder="1학기 생활기록부 내용을 입력하세요. 이 내용은 AI 분석 시 수시 기록과 함께 종합되어 1년 전체 의견 작성에 활용됩니다."
                      className="w-full p-3 border border-base-300 rounded-lg text-sm min-h-[100px] focus:ring-primary focus:border-primary resize-y mb-2 bg-white text-gray-900"
                  />
                  <div className="flex justify-end">
                      <button 
                        onClick={handleSaveSem1Opinion}
                        disabled={isSavingSem1 || sem1Opinion === (student.semester1Opinion || '')}
                        className="px-4 py-1.5 bg-base-200 hover:bg-primary hover:text-white text-base-content-secondary text-xs font-bold rounded-lg transition-all flex items-center gap-1 disabled:opacity-50 disabled:hover:bg-base-200 disabled:hover:text-base-content-secondary"
                      >
                          {isSavingSem1 ? <span className="loading loading-spinner loading-xs"></span> : '저장'}
                      </button>
                  </div>
              </div>
          )}
      </div>

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <span className="text-2xl" role="img" aria-label="memo">📝</span>
          <h2 className="text-lg font-bold text-base-content">행동 발달 기록</h2>
        </div>
        <div className="flex items-center space-x-2">
            <span className="text-xs text-base-content-secondary bg-base-200 px-2.5 py-1 rounded-full font-semibold border border-base-300/70">
                {filterMonth === 'all' ? '총' : formatMonthLabel(filterMonth)} {filteredRecords.length}건
            </span>
            <button
                onClick={() => setIsAnalysisModalOpen(true)}
                className="flex items-center space-x-1 bg-gradient-to-r from-primary to-primary-focus text-primary-content px-3 py-1.5 rounded-full text-xs font-bold shadow-md hover:shadow-lg transition-all active:scale-95"
                title="1학기 의견과 수시 기록을 바탕으로 최종 리포트 작성"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5 2a1 1 0 011 1v1h1a1 1 0 010 2H6v1a1 1 0 01-2 0V6H3a1 1 0 010-2h1V3a1 1 0 011-1zm0 5a1 1 0 011 1v1h1a1 1 0 010 2H6v1a1 1 0 01-2 0v-1H3a1 1 0 010-2h1v-1a1 1 0 011-1zm5-5a1 1 0 011 1v1h1a1 1 0 010 2H6v1a1 1 0 01-2 0V6H9a1 1 0 010-2h1V3a1 1 0 011-1z" clipRule="evenodd" />
                    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                </svg>
                <span>AI 종합 분석</span>
            </button>
        </div>
      </div>

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="bg-base-100 p-3 rounded-lg border border-base-300/70 mb-4 space-y-3">
        <div className="flex space-x-2">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={`${inputClass} w-1/3`}
            required
          />
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className={`${inputClass} w-2/3`}
          >
            {PERIODS.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
        <div>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={`${student.name.hangul} 학생의 행동 특성이나 관찰 내용을 기록하세요...`}
            className={`${inputClass} h-20 resize-none`}
            required
          />
          <div className="flex justify-end mt-2">
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
          <div className="flex items-center space-x-2 mb-3 overflow-x-auto custom-scrollbar pb-1">
            <button
                onClick={() => setFilterMonth('all')}
                className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors border ${filterMonth === 'all' ? 'bg-primary text-primary-content border-primary' : 'bg-base-200 text-base-content-secondary border-transparent hover:bg-base-300'}`}
            >
                전체
            </button>
            {availableMonths.map(month => (
                <button
                    key={month}
                    onClick={() => setFilterMonth(month)}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors border ${filterMonth === month ? 'bg-primary text-primary-content border-primary' : 'bg-base-200 text-base-content-secondary border-transparent hover:bg-base-300'}`}
                >
                    {formatMonthLabel(month)}
                </button>
            ))}
        </div>
      )}

      {/* Records List */}
      <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-3 pb-24">
        {filteredRecords.length > 0 ? (
          filteredRecords.map((record) => (
            <div 
                key={record.id} 
                onClick={() => {
                    if (editingId === record.id) return;
                    navigator.clipboard.writeText(record.content);
                    showToast("내용이 복사되었습니다.");
                }}
                className={`bg-base-100 p-3 rounded-lg border shadow-sm transition-all group relative ${editingId === record.id ? 'border-primary ring-1 ring-primary' : 'border-base-300 hover:shadow-md cursor-pointer active:scale-[0.99] active:bg-base-200'}`}
                title={editingId === record.id ? '' : "클릭하여 복사"}
            >
               {editingId === record.id && editData ? (
                   // Edit Mode
                   <div className="space-y-2 animate-[fadeIn_0.2s_ease-out]">
                       <div className="flex gap-2">
                           <input 
                                type="date" 
                                value={editData.date} 
                                onChange={(e) => setEditData({...editData, date: e.target.value})}
                                className={`${inputClass} w-1/3 text-xs`}
                           />
                           <select
                                value={editData.period}
                                onChange={(e) => setEditData({...editData, period: e.target.value})}
                                className={`${inputClass} w-2/3 text-xs`}
                           >
                                {PERIODS.map((p) => (
                                <option key={p} value={p}>{p}</option>
                                ))}
                           </select>
                       </div>
                       <textarea 
                            value={editData.content}
                            onChange={(e) => setEditData({...editData, content: e.target.value})}
                            className={`${inputClass} min-h-[5rem] resize-none`}
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
                                    className="text-base-300 hover:text-primary hover:bg-primary/10 p-1 rounded transition-colors"
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
                                    className="text-base-300 hover:text-red-500 hover:bg-red-50 p-1 rounded transition-colors"
                                    title="삭제"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                        <p className="text-sm text-base-content whitespace-pre-wrap leading-relaxed pointer-events-none">
                            {record.content}
                        </p>
                   </>
               )}
            </div>
          ))
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-base-content-secondary space-y-2 opacity-60">
            <span className="text-4xl">🍃</span>
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
    </div>
  );
};

export default BehaviorLog;
