
import React, { useState, useEffect, useMemo } from 'react';
import { Student, AnalysisResult, MonthlyTrend, BehaviorAnalysisMode } from '../types';
import { analyzeBehaviorRecords, softenBehaviorReport } from '../services/geminiService';
import { useModal } from '../context/ModalContext';
import { AppSettings } from '../App';
import { getUtf8ByteLength } from '../utils/behaviorUtils';
import StudentTraitsModal from './StudentTraitsModal';
import { findStudentTraitOption } from '../constants/studentTraits';

interface AnalysisModalProps {
  student: Student;
  onClose: () => void;
  onSaveAnalysis: (result: AnalysisResult) => Promise<void>;
  onUpdateStudent: (student: Student) => Promise<void>;
  settings?: AppSettings;
}

// Helper for generating smooth cubic bezier path
const getSplinePath = (points: {x: number, y: number}[]) => {
    if (points.length === 0) return '';
    if (points.length === 1) return '';
    
    let d = `M ${points[0].x} ${points[0].y}`;
    
    for (let i = 0; i < points.length - 1; i++) {
        const p0 = points[Math.max(i - 1, 0)];
        const p1 = points[i];
        const p2 = points[i + 1];
        const p3 = points[Math.min(i + 2, points.length - 1)];
        
        const cp1x = p1.x + (p2.x - p0.x) / 6;
        const cp1y = p1.y + (p2.y - p0.y) / 6;
        
        const cp2x = p2.x - (p3.x - p1.x) / 6;
        const cp2y = p2.y - (p3.y - p1.y) / 6;
        
        d += ` C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${p2.x} ${p2.y}`;
    }
    return d;
};

// 학기 기준 정렬 (3월 -> ... -> 12월 -> 1월 -> 2월)
const sortMonthsByAcademicYear = (a: string, b: string) => {
    // a, b format: "YYYY-MM"
    const getMonthIndex = (dateStr: string) => {
        const m = parseInt(dateStr.split('-')[1], 10);
        // 3월=0, 4월=1, ... 12월=9, 1월=10, 2월=11
        return (m + 9) % 12;
    };
    
    const idxA = getMonthIndex(a);
    const idxB = getMonthIndex(b);
    
    if (idxA !== idxB) return idxA - idxB;
    return a.localeCompare(b); // 같은 달이면 연도순
};

const formatAnalysisTag = (tag: string): string => tag.replace(/^#+\s*/, '').trim();


// SVG Graph Component
const TrendChart = ({ data }: { data: MonthlyTrend[] }) => {
    if (!data || data.length === 0) return null;

    // Sort data by Academic Year (Start from March)
    const sortedData = [...data].sort((a, b) => sortMonthsByAcademicYear(a.month, b.month));
    
    const width = 320;
    const height = 160;
    const paddingX = 30;
    const paddingY = 25;
    
    const graphWidth = width - (paddingX * 2);
    const graphHeight = height - (paddingY * 2);
    
    const maxValue = 10;
    
    const slotWidth = sortedData.length > 1 ? graphWidth / (sortedData.length - 1) : 0;
    
    // Coordinate calculation
    // If single point, center it. If multiple, distribute evenly.
    const getX = (index: number) => {
        if (sortedData.length === 1) return width / 2;
        return paddingX + (index * slotWidth);
    };
    
    // We need percentage based left position for the HTML overlay labels to match SVG elements
    const getXPct = (index: number) => (getX(index) / width) * 100;
    
    const getY = (value: number) => (height - paddingY) - ((value / maxValue) * graphHeight);
    const getYPct = (value: number) => ((getY(value)) / height) * 100;

    const barWidth = 20;

    // Calculate Points for Line
    const points = sortedData.map((d, i) => ({
        x: getX(i),
        y: getY(Math.min(d.negativeIntensity, 10))
    }));
    
    let curvePath = '';

    if (points.length > 1) {
        curvePath = getSplinePath(points);
    } 

    return (
        <div className="w-full h-full flex flex-col select-none relative">
            {/* Graph Container */}
            <div className="flex-1 relative w-full min-h-0 mt-4">
                {/* The SVG Graph (Background/Lines/Bars) */}
                <svg viewBox={`0 0 ${width} ${height}`} className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
                    
                    {/* Horizontal Grid Lines */}
                    {[0, 2.5, 5, 7.5, 10].map((val) => (
                        <line
                            key={`grid-${val}`}
                            x1={0}
                            y1={getY(val)}
                            x2={width}
                            y2={getY(val)}
                            stroke="#e5e7eb"
                            strokeWidth="1"
                            strokeDasharray="3 3"
                        />
                    ))}

                    {/* Positive Frequency Bars */}
                    {sortedData.map((d, i) => {
                        const barHeight = Math.max(0, (height - paddingY) - getY(Math.min(d.positiveFrequency, 10)));
                        return (
                            <rect 
                                key={`bar-${i}`}
                                x={getX(i) - barWidth / 2}
                                y={getY(Math.min(d.positiveFrequency, 10))}
                                width={barWidth}
                                height={barHeight}
                                fill="#a7f3d0" 
                                rx="2"
                            />
                        );
                    })}

                    {/* Negative Intensity Line (Only if > 1 point) */}
                    {curvePath && (
                        <path 
                            d={curvePath} 
                            fill="none" 
                            stroke="#f87171" 
                            strokeWidth="2.5" 
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                    )}
                </svg>
                
                {/* HTML Overlay for Text & Points (Prevents Distortion) */}
                <div className="absolute inset-0 pointer-events-none">
                    
                    {/* Data Points (HTML Circles to maintain aspect ratio) */}
                    {sortedData.map((d, i) => (
                        <div
                            key={`point-${i}`}
                            className="absolute w-[7px] h-[7px] bg-white border-2 border-red-400 rounded-full z-10"
                            style={{
                                left: `${getXPct(i)}%`,
                                top: `${getYPct(Math.min(d.negativeIntensity, 10))}%`,
                                transform: 'translate(-50%, -50%)'
                            }}
                        />
                    ))}

                    {/* Data Value Labels (Above Points) */}
                    {sortedData.map((d, i) => (
                         <div 
                            key={`val-${i}`}
                            className="absolute text-[10px] font-bold text-red-500 text-center z-20"
                            style={{ 
                                left: `${getXPct(i)}%`, 
                                top: `${getYPct(Math.min(d.negativeIntensity, 10))}%`,
                                transform: 'translate(-50%, -180%)'
                            }}
                        >
                            {d.negativeIntensity}
                        </div>
                    ))}

                    {/* X-Axis Labels (Months) - Made BOLDER */}
                    {sortedData.map((d, i) => (
                        <div 
                            key={`xlabel-${i}`}
                            className="absolute text-xs font-extrabold text-gray-800 text-center"
                            style={{ 
                                left: `${getXPct(i)}%`, 
                                bottom: '5px', 
                                transform: 'translateX(-50%)' 
                            }}
                        >
                            {d.month.split('-')[1]}월
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};


const AnalysisModal = ({ student, onClose, onSaveAnalysis, onUpdateStudent, settings }: AnalysisModalProps): React.ReactElement => {
  const { showAlert } = useModal();
  const initialMode: BehaviorAnalysisMode = student.analysisResult?.mode || 'semester1';
  const [loading, setLoading] = useState(false);
  const [analysisMode, setAnalysisMode] = useState<BehaviorAnalysisMode>(initialMode);
  const [result, setResult] = useState<AnalysisResult | null>(
    student.behaviorAnalysisResults?.[initialMode] || student.analysisResult || null
  );
  const [error, setError] = useState<string | null>(null);
  const [selectedStudentTraits, setSelectedStudentTraits] = useState<string[]>(student.studentTraits || []);
  const [isTraitsModalOpen, setIsTraitsModalOpen] = useState(false);
  
  // State for editable report
  const [editableReport, setEditableReport] = useState('');
  const [isSavingReport, setIsSavingReport] = useState(false);
  const [isSofteningReport, setIsSofteningReport] = useState(false);
  const [reportHistory, setReportHistory] = useState<string[]>([]);
  const [reportHistoryIndex, setReportHistoryIndex] = useState(-1);

  const canUndoReport = reportHistoryIndex > 0;
  const canRedoReport = reportHistoryIndex >= 0 && reportHistoryIndex < reportHistory.length - 1;
  const reportByteCount = useMemo(() => getUtf8ByteLength(editableReport), [editableReport]);
  const traitToneClass = (trait: string) => {
      const tone = findStudentTraitOption(trait)?.tone;
      if (tone === 'support') return 'border-rose-200 bg-rose-50 text-rose-700';
      if (tone === 'positive') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
      return 'border-slate-200 bg-slate-50 text-slate-700';
  };

  const resetReportHistory = (report: string) => {
      setEditableReport(report);
      setReportHistory(report ? [report] : []);
      setReportHistoryIndex(report ? 0 : -1);
  };

  const commitReportHistory = (report: string) => {
      setEditableReport(report);
      const current = reportHistoryIndex >= 0 ? reportHistory[reportHistoryIndex] : '';
      if (current === report) return;
      const nextHistory = [...reportHistory.slice(0, reportHistoryIndex + 1), report].slice(-30);
      setReportHistory(nextHistory);
      setReportHistoryIndex(nextHistory.length - 1);
  };

  const handleUndoReport = () => {
      if (!canUndoReport) return;
      const nextIndex = reportHistoryIndex - 1;
      setReportHistoryIndex(nextIndex);
      setEditableReport(reportHistory[nextIndex] || '');
  };

  const handleRedoReport = () => {
      if (!canRedoReport) return;
      const nextIndex = reportHistoryIndex + 1;
      setReportHistoryIndex(nextIndex);
      setEditableReport(reportHistory[nextIndex] || '');
  };

  // Handle ESC key to close
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
            onClose();
        }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  // Auto-analyze if no result exists
  useEffect(() => {
    if (!student.analysisResult && !loading && !result && !error) {
      handleAnalyze();
    }
  }, []);

  // Sync editable report when result changes
  useEffect(() => {
    if (result) {
        resetReportHistory(result.report);
    } else {
        resetReportHistory('');
    }
  }, [result]);

  useEffect(() => {
    setSelectedStudentTraits(student.studentTraits || []);
  }, [student.id, student.studentTraits]);

  // 1. 입력된 기록이 있는 달(Month) 추출
  const validMonths = useMemo(() => {
      const months = new Set<string>();
      (student.behaviorRecords || []).forEach(r => {
          if (r.date && r.date.length >= 7) {
              months.add(r.date.substring(0, 7)); // YYYY-MM
          }
      });
      return months;
  }, [student.behaviorRecords]);

  // 2. 그래프 데이터 가공: 입력된 달이 아니면 점수를 0으로 강제 설정
  const chartData = useMemo(() => {
      if (!result?.trends) return [];
      
      return result.trends.map(t => {
          // AI가 생성한 데이터의 달이 실제 기록에 존재하면 그대로 사용
          if (validMonths.has(t.month)) {
              return t;
          }
          // 기록이 없는 달은 0점으로 처리 (hallucination 방지)
          return {
              ...t,
              negativeIntensity: 0,
              positiveFrequency: 0
          };
      });
  }, [result, validMonths]);

  const handleAnalyze = async () => {
    if ((!student.behaviorRecords || student.behaviorRecords.length === 0) && selectedStudentTraits.length === 0) {
        setError("분석할 행동 기록 또는 학생 특성이 필요합니다.");
        return;
    }

    setLoading(true);
    setError(null);
    try {
      const analysisData = await analyzeBehaviorRecords(
          student.name.hangul, 
          student.behaviorRecords || [], 
          analysisMode,
          settings?.geminiApiKey,
          settings?.geminiModel,
          selectedStudentTraits
      );
      setResult(analysisData);
      await onSaveAnalysis(analysisData);
    } catch (err) {
      console.error(err);
      setError("분석 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveStudentTraits = async (traits: string[]) => {
      setSelectedStudentTraits(traits);
      setIsTraitsModalOpen(false);
      try {
          await onUpdateStudent({ ...student, studentTraits: traits });
          await showAlert("학생 특성이 저장되었습니다.");
      } catch (e) {
          console.error(e);
          await showAlert("학생 특성 저장 중 오류가 발생했습니다.");
      }
  };

  const handleModeChange = (mode: BehaviorAnalysisMode) => {
    setAnalysisMode(mode);
    setError(null);
    const stored = student.behaviorAnalysisResults?.[mode]
      || (student.analysisResult?.mode === mode ? student.analysisResult : null);
    setResult(stored || null);
    resetReportHistory(stored?.report || '');
  };

  const handleSaveReport = async () => {
      if (!result) return;
      setIsSavingReport(true);
      try {
          const updatedResult = { ...result, report: editableReport };
          setResult(updatedResult);
          await onSaveAnalysis(updatedResult);
          await showAlert("수정된 내용이 저장되었습니다.");
      } catch (e) {
          console.error(e);
          await showAlert("저장 중 오류가 발생했습니다.");
      } finally {
          setIsSavingReport(false);
      }
  };

  const handleSoftenReport = async () => {
      if (!result || !editableReport.trim()) return;
      setIsSofteningReport(true);
      try {
          const softenedReport = await softenBehaviorReport(
              student.name.hangul,
              student.behaviorRecords || [],
              editableReport,
              result.mode || analysisMode,
              settings?.geminiApiKey,
              settings?.geminiModel
          );
          commitReportHistory(softenedReport);
          await showAlert("초안을 순화했습니다. 내용을 검토한 뒤 저장해 주세요.");
      } catch (e) {
          console.error(e);
          await showAlert("초안 순화 중 오류가 발생했습니다.");
      } finally {
          setIsSofteningReport(false);
      }
  };

  const handleCopyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      showAlert("내용이 클립보드에 복사되었습니다.");
    });
  };

  const draftWarnings = useMemo(() => {
    if (!editableReport.trim()) return [];
    const warnings: string[] = [];
    if (/\r|\n/.test(editableReport)) warnings.push('줄바꿈이 포함되어 있음');
    if (!editableReport.trim().endsWith('.')) warnings.push('마침표로 끝나지 않음');
    if (editableReport.includes(student.name.hangul)) warnings.push('학생 이름이 포함되어 있음');
    const restrictedTerms = ['레고', '엔트리', '유튜브', '줌', '굿네이버스', '커리어넷', '공인어학시험', '자격증', '장학생'];
    const foundTerms = restrictedTerms.filter(term => editableReport.includes(term));
    if (foundTerms.length) warnings.push(`기재 제한 표현 확인: ${foundTerms.join(', ')}`);
    return warnings;
  }, [editableReport, student.name.hangul]);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[120] p-4" onClick={onClose}>
      <div className="bg-base-100 rounded-2xl shadow-2xl w-full max-w-[90vw] h-[90vh] flex flex-col overflow-hidden border border-base-300" onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-base-300 flex justify-between items-center bg-gradient-to-r from-base-100 to-base-200 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="bg-primary/10 p-2 rounded-lg text-2xl">✨</div>
            <div>
              <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-base-content">AI 행동 발달 분석 및 기록 초안</h2>
                  {result && (
                    <span className="text-[10px] bg-base-200 px-2 py-0.5 rounded-full text-base-content-secondary border border-base-300">
                        최근 분석: {new Date(result.lastUpdated).toLocaleDateString()}
                    </span>
                  )}
              </div>
              <p className="text-xs text-base-content-secondary font-medium mt-0.5">
                  {student.grade}학년 {student.class}반 {student.name.hangul} 학생
              </p>
              <div className="mt-2 flex rounded-lg border border-base-300 bg-white p-0.5 w-fit">
                <button type="button" onClick={() => handleModeChange('semester1')} title="3월부터 8월까지의 기록만 분석" className={`rounded-md px-2.5 py-1 text-[11px] font-bold ${analysisMode === 'semester1' ? 'bg-primary text-white' : 'text-base-content-secondary hover:bg-base-100'}`}>1학기용 · 3~8월</button>
                <button type="button" onClick={() => handleModeChange('yearEnd')} title="학년도 전체 누적 기록을 분석" className={`rounded-md px-2.5 py-1 text-[11px] font-bold ${analysisMode === 'yearEnd' ? 'bg-primary text-white' : 'text-base-content-secondary hover:bg-base-100'}`}>학년말용 · 전체</button>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setIsTraitsModalOpen(true)}
                  className="rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-[11px] font-bold text-indigo-700 transition-colors hover:bg-indigo-100"
                  title="초안 생성에 참고할 학생 특성 설정"
                >
                  학생 특성 {selectedStudentTraits.length}개
                </button>
                {selectedStudentTraits.slice(0, 3).map(trait => (
                  <span key={trait} className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${traitToneClass(trait)}`}>
                    {trait}
                  </span>
                ))}
                {selectedStudentTraits.length > 3 && (
                  <span className="rounded-full bg-base-200 px-2 py-0.5 text-[10px] font-bold text-base-content-secondary">
                    +{selectedStudentTraits.length - 3}
                  </span>
                )}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="text-base-content-secondary hover:text-base-content p-2 rounded-full hover:bg-base-200 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-hidden bg-base-50 relative">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full space-y-6 absolute inset-0 z-10 bg-base-50">
              <div className="relative w-20 h-20">
                 <div className="absolute top-0 left-0 w-full h-full border-4 border-primary/20 rounded-full"></div>
                 <div className="absolute top-0 left-0 w-full h-full border-4 border-primary rounded-full animate-spin border-t-transparent"></div>
                 <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-2xl">🌱</div>
              </div>
              <div className="text-center">
                  <p className="text-xl font-bold text-base-content animate-pulse">Gemini가 기록을 분석하고 있습니다</p>
                  <p className="text-sm text-base-content-secondary mt-2">{analysisMode === 'semester1' ? '1학기' : '학년말'} 행동특성 및 종합의견 초안을 작성 중입니다...</p>
              </div>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-full space-y-4 text-center p-8">
                <span className="text-5xl mb-2">⚠️</span>
                <p className="text-lg font-bold text-base-content">{error}</p>
                <p className="text-sm text-base-content-secondary max-w-md">네트워크 문제이거나 기록 내용이 부족할 수 있습니다.</p>
                <button onClick={handleAnalyze} className="btn bg-primary text-primary-content px-6 py-2.5 rounded-lg hover:bg-primary-focus font-bold shadow-md mt-4 text-sm">다시 시도</button>
            </div>
          ) : result ? (
            <div className="h-full p-5 overflow-hidden">
                {/* Grid Layout Changed: Left (4 cols) - Center (4 cols) - Right (4 cols) for better spacing */}
                <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 h-full">
                    
                    {/* LEFT COLUMN (4/12): Visuals & Data -> Increased Width */}
                    <div className="xl:col-span-4 flex flex-col h-full gap-3 overflow-hidden">
                         {/* 1. Keywords */}
                         <div className="bg-white p-3 rounded-xl shadow-sm border border-base-200 shrink-0">
                            <h3 className="text-xs font-bold text-base-content-secondary uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M17.707 9.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-7-7A.997.997 0 012 10V5a3 3 0 013-3h5c.256 0 .512.098.707.293l7 7zM5 6a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                                </svg>
                                AI 분석 태그
                            </h3>
                            <div className="flex flex-wrap gap-1.5">
                                {(result.keywords || []).slice(0, 6).map((tag, idx) => (
                                    <span key={idx} className="px-2 py-0.5 bg-secondary/60 text-secondary-content rounded-md text-[11px] font-bold border border-green-100/50 hover:bg-secondary transition-colors cursor-default">
                                    #{formatAnalysisTag(tag)}
                                    </span>
                                ))}
                            </div>
                        </div>

                        {/* Student Traits */}
                        <div className="bg-white p-3 rounded-xl shadow-sm border border-indigo-100 shrink-0">
                            <div className="mb-2 flex items-center justify-between gap-2">
                                <h3 className="text-xs font-bold text-indigo-800 uppercase tracking-wider flex items-center gap-1.5">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81H7.03a1 1 0 00.95-.69l1.07-3.292z" />
                                    </svg>
                                    학생 특성
                                </h3>
                                <button
                                    type="button"
                                    onClick={() => setIsTraitsModalOpen(true)}
                                    className="rounded-md border border-indigo-200 bg-indigo-50 px-2 py-1 text-[11px] font-bold text-indigo-700 hover:bg-indigo-100"
                                >
                                    설정
                                </button>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                                {selectedStudentTraits.length > 0 ? selectedStudentTraits.slice(0, 8).map(trait => (
                                    <span key={trait} className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${traitToneClass(trait)}`}>
                                        {trait}
                                    </span>
                                )) : (
                                    <span className="text-[11px] font-medium text-base-content-secondary">
                                        선택된 학생 특성이 없습니다.
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* 2. Trends Graph */}
                        <div className="bg-white p-3 rounded-xl shadow-sm border border-base-200 flex-1 min-h-0 flex flex-col">
                            <h3 className="text-xs font-bold text-base-content-secondary uppercase tracking-wider flex items-center gap-1.5 mb-1 shrink-0">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                    <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
                                </svg>
                                행동 발달 추이 (3월~2월)
                            </h3>
                            <TrendChart data={chartData} />
                        </div>
                        
                        {/* 3. Summary */}
                        <div className="bg-yellow-50/60 rounded-xl border border-yellow-100 text-base-content shadow-sm flex-1 min-h-0 flex flex-col overflow-hidden">
                            <div className="px-3 py-2 bg-yellow-50/80 shrink-0 border-b border-yellow-100/50 flex justify-between items-center">
                                <h4 className="font-bold text-amber-900 flex items-center gap-1.5 text-xs">
                                    <span>💡</span> 요약
                                </h4>
                            </div>
                            <div className="p-3 overflow-y-auto custom-scrollbar flex-1">
                                <p className="text-[11px] text-base-content/90 whitespace-pre-wrap leading-relaxed">
                                    {result.summary}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* CENTER COLUMN (4/12): Editable Report -> Decreased Width */}
                    <div className="xl:col-span-4 flex flex-col h-[500px] xl:h-full overflow-hidden">
                         <div className="bg-white rounded-xl shadow-sm border border-blue-200 flex-1 flex flex-col overflow-hidden h-full ring-4 ring-blue-50">
                            <div className="px-4 py-3 border-b border-blue-100 bg-blue-50/50 flex justify-between items-center gap-3 shrink-0">
                                <div className="min-w-0 flex flex-col gap-1">
                                    <h3 className="text-xs font-bold text-blue-800 uppercase tracking-wider flex items-center gap-1.5">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                                        </svg>
                                        <span className="truncate">{result.mode === 'yearEnd' ? '학년말' : '1학기'} 기록 초안</span>
                                    </h3>
                                    <span
                                        className="w-fit rounded-md border border-blue-200 bg-white px-2.5 py-1 text-sm font-extrabold tabular-nums text-blue-700 shadow-sm"
                                        title="NEIS 표시와 같은 UTF-8 바이트 수"
                                    >
                                        {reportByteCount.toLocaleString()} Byte
                                    </span>
                                </div>
                                <div className="flex flex-wrap justify-end gap-1.5">
                                    <button
                                        onClick={handleUndoReport}
                                        disabled={!canUndoReport || isSavingReport || isSofteningReport}
                                        title="이전 초안으로 되돌리기"
                                        aria-label="이전 초안으로 되돌리기"
                                        className="h-8 w-8 shrink-0 rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition-all hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 flex items-center justify-center"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M7.707 3.293a1 1 0 010 1.414L5.414 7H11a6 6 0 016 6 1 1 0 11-2 0 4 4 0 00-4-4H5.414l2.293 2.293a1 1 0 11-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                                        </svg>
                                    </button>
                                    <button
                                        onClick={handleRedoReport}
                                        disabled={!canRedoReport || isSavingReport || isSofteningReport}
                                        title="되돌린 초안 다시 앞으로가기"
                                        aria-label="되돌린 초안 다시 앞으로가기"
                                        className="h-8 w-8 shrink-0 rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition-all hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 flex items-center justify-center"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M12.293 3.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 11-1.414-1.414L14.586 9H9a4 4 0 00-4 4 1 1 0 11-2 0 6 6 0 016-6h5.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
                                        </svg>
                                    </button>
                                    <button
                                        onClick={handleSoftenReport}
                                        disabled={isSofteningReport || isSavingReport || !editableReport.trim()}
                                        title="현재 초안을 긍정적 변화 가능성 중심 문장으로 순화"
                                        className="text-xs bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-lg border border-emerald-200 hover:bg-emerald-100 hover:border-emerald-300 font-semibold flex items-center gap-1.5 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {isSofteningReport ? (
                                            <svg className="animate-spin h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                        ) : (
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                                                <path d="M11.983 1.907a1 1 0 00-1.966 0l-.33 1.842a5 5 0 01-4.036 4.036l-1.842.33a1 1 0 000 1.966l1.842.33a5 5 0 014.036 4.036l.33 1.842a1 1 0 001.966 0l.33-1.842a5 5 0 014.036-4.036l1.842-.33a1 1 0 000-1.966l-1.842-.33a5 5 0 01-4.036-4.036l-.33-1.842z" />
                                            </svg>
                                        )}
                                        순화
                                    </button>
                                    <button 
                                        onClick={handleSaveReport}
                                        disabled={isSavingReport || isSofteningReport || editableReport === result.report}
                                        className={`text-xs px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all shadow-sm border ${
                                            editableReport !== result.report
                                            ? 'bg-primary text-primary-content border-primary hover:bg-primary-focus'
                                            : 'bg-base-100 text-base-content-secondary border-base-200 opacity-70 cursor-not-allowed'
                                        }`}
                                    >
                                        {isSavingReport ? (
                                            <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                        ) : (
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                                                <path d="M7.707 10.293a1 1 0 10-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 11.586V6h5a2 2 0 012 2v7a2 2 0 01-2 2H4a2 2 0 01-2-2V8a2 2 0 012-2h5v5.586l-1.293-1.293zM9 4a1 1 0 012 0v2H9V4z" />
                                            </svg>
                                        )}
                                        저장
                                    </button>
                                    <button 
                                        onClick={() => handleCopyToClipboard(editableReport)}
                                        className="text-xs bg-white text-blue-600 px-3 py-1.5 rounded-lg border border-blue-200 hover:bg-blue-50 hover:border-blue-300 font-semibold flex items-center gap-1.5 transition-all shadow-sm"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                                            <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
                                            <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
                                        </svg>
                                        복사
                                    </button>
                                </div>
                            </div>
                            
                            <textarea 
                                className="flex-1 p-5 bg-white resize-none focus:outline-none text-base text-slate-800 leading-loose font-medium custom-scrollbar"
                                value={editableReport}
                                onChange={(e) => setEditableReport(e.target.value)}
                                onBlur={() => commitReportHistory(editableReport)}
                                placeholder="분석된 내용이 여기에 표시됩니다. 직접 수정할 수 있습니다."
                            />
                            
                            <div className="p-2.5 bg-amber-50 border-t border-amber-200 text-xs text-amber-800 flex items-start gap-1.5 shrink-0">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                                </svg>
                                <span>
                                    AI가 생성한 참고용 초안입니다. 직접 관찰한 기록 및 2026 기재 지침과 대조하고, 교사가 검토·수정한 뒤 NEIS에 활용하세요.
                                </span>
                            </div>
                            {draftWarnings.length > 0 && (
                              <div className="border-t border-rose-200 bg-rose-50 px-3 py-2 text-[11px] font-semibold text-rose-700 shrink-0">
                                확인 필요 · {draftWarnings.join(' · ')}
                              </div>
                            )}
                        </div>
                    </div>

                    {/* RIGHT COLUMN (4/12): Advice */}
                    <div className="xl:col-span-4 flex flex-col h-[500px] xl:h-full overflow-hidden">
                        <div className="bg-amber-50 rounded-xl shadow-sm border border-amber-100 h-full flex flex-col overflow-hidden">
                            <div className="p-4 border-b border-amber-100 bg-amber-50/80 shrink-0 sticky top-0">
                                <h3 className="text-xs font-bold text-amber-800 uppercase tracking-wider flex items-center gap-1.5">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                        <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-2 0 1 1 0 112 0zm-1.657 4.243a1 1 0 01-1.414 1.414l-.707-.707a1 1 0 011.414-1.414l.707.707zM11 18a1 1 0 01-2 0v-1a1 1 0 012 0v1zM5.757 15.657a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414l-.707.707zM4 10a1 1 0 01-2 0 1 1 0 112 0zM5.757 4.343a1 1 0 011.414 1.414l-.707.707a1 1 0 01-1.414-1.414l.707-.707z" />
                                    </svg>
                                    맞춤형 지도 조언
                                </h3>
                            </div>
                            
                            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 pt-2 space-y-4">
                                {result.advice && Array.isArray(result.advice) ? (
                                    result.advice.map((item, idx) => (
                                        <div key={idx} className="bg-white/80 rounded-lg p-4 border border-amber-200/50 shadow-sm hover:shadow-md transition-shadow">
                                            <div className="flex items-center gap-2 mb-2">
                                                <span className="bg-amber-100 text-amber-800 text-xs font-bold px-2 py-0.5 rounded-full">{idx + 1}</span>
                                                <h4 className="font-bold text-amber-900 text-sm leading-tight">{item.title}</h4>
                                            </div>
                                            <p className="text-amber-900/85 text-sm leading-relaxed whitespace-pre-wrap pl-1">{item.content}</p>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-sm text-amber-900 whitespace-pre-wrap">{JSON.stringify(result.advice)}</p>
                                )}
                            </div>
                        </div>
                    </div>

                </div>
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
              <div className="rounded-full bg-primary/10 p-4 text-3xl">✨</div>
              <div>
                <p className="font-bold text-base-content">저장된 {analysisMode === 'semester1' ? '1학기' : '학년말'} 초안이 없습니다.</p>
                <p className="mt-1 text-sm text-base-content-secondary">아래 생성 버튼을 눌러 현재 누가기록을 바탕으로 초안을 만드세요.</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-base-300 bg-base-100 flex justify-end items-center gap-3 shrink-0">
             {!loading && (
                <button 
                    onClick={handleAnalyze}
                    className="px-4 py-2 bg-base-200 text-base-content font-bold rounded-lg hover:bg-base-300 transition-colors text-sm flex items-center gap-2"
                >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    {analysisMode === 'semester1' ? '1학기 초안 생성' : '학년말 초안 생성'}
                </button>
            )}
            <button 
                onClick={onClose} 
                className="px-6 py-2 bg-primary text-primary-content font-bold rounded-lg hover:bg-primary-focus hover:shadow-lg transition-all text-sm"
            >
                닫기
            </button>
        </div>
      </div>
      {isTraitsModalOpen && (
        <StudentTraitsModal
          initialTraits={selectedStudentTraits}
          onClose={() => setIsTraitsModalOpen(false)}
          onSave={handleSaveStudentTraits}
        />
      )}
    </div>
  );
};

export default AnalysisModal;
