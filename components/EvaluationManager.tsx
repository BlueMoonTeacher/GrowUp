
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { firestore, auth } from '../firebase';
import { Student, Assessment, EvaluationRecord, EvaluationLevel } from '../types';
import { AppSettings } from '../App';
import { useModal } from '../context/ModalContext';
import { extractAssessmentPlanFromFile, generateSubjectComment } from '../services/geminiService';

interface EvaluationManagerProps {
  students: Student[];
  settings: AppSettings;
}

type Tab = 'setup' | 'entry' | 'missing' | 'seteuk';

// --- Constants & Helpers ---

const SUBJECT_ORDER = ['국어', '수학', '사회', '과학', '음악', '미술', '도덕', '실과', '체육', '영어'];

const SUBJECT_COLORS: Record<string, string> = {
    '국어': 'bg-red-100 text-red-800 border-red-200',
    '수학': 'bg-blue-100 text-blue-800 border-blue-200',
    '사회': 'bg-yellow-100 text-yellow-800 border-yellow-200',
    '과학': 'bg-green-100 text-green-800 border-green-200',
    '영어': 'bg-purple-100 text-purple-800 border-purple-200',
    '음악': 'bg-pink-100 text-pink-800 border-pink-200',
    '미술': 'bg-orange-100 text-orange-800 border-orange-200',
    '체육': 'bg-teal-100 text-teal-800 border-teal-200',
    '실과': 'bg-indigo-100 text-indigo-800 border-indigo-200',
    '도덕': 'bg-gray-100 text-gray-800 border-gray-200',
    '창체': 'bg-lime-100 text-lime-800 border-lime-200',
    '안전': 'bg-amber-100 text-amber-800 border-amber-200',
};

const getSubjectColor = (subject: string, isActive: boolean = false) => {
    if (isActive) {
        return SUBJECT_COLORS[subject]?.replace('bg-', 'bg-').replace('text-', 'text-').replace('100', '500').replace('800', 'white') || 'bg-gray-600 text-white';
    }
    return SUBJECT_COLORS[subject] || 'bg-white border-base-300 text-base-content';
};

const sortSubjects = (a: string, b: string) => {
    const indexA = SUBJECT_ORDER.indexOf(a);
    const indexB = SUBJECT_ORDER.indexOf(b);

    if (indexA !== -1 && indexB !== -1) return indexA - indexB;
    if (indexA !== -1) return -1;
    if (indexB !== -1) return 1;
    
    return a.localeCompare(b);
};

const sortAssessments = (a: Assessment, b: Assessment) => {
    if (a.semester !== b.semester) return a.semester.localeCompare(b.semester);
    const subCompare = sortSubjects(a.subject, b.subject);
    if (subCompare !== 0) return subCompare;
    const getMonth = (timing: string) => {
        if (!timing) return 99;
        const match = timing.match(/(\d+)월/);
        return match ? parseInt(match[1]) : 99;
    };
    const timeA = getMonth(a.timing || '');
    const timeB = getMonth(b.timing || '');
    if (timeA !== timeB) {
        const normalize = (m: number) => m < 3 ? m + 12 : m;
        return normalize(timeA) - normalize(timeB);
    }
    return a.evaluationElement.localeCompare(b.evaluationElement);
};

const getCurrentSemester = () => {
    const month = new Date().getMonth() + 1; // 1-12
    // 3~8월: 1학기, 9~2월: 2학기
    return (month >= 3 && month <= 8) ? '1' : '2';
};

// --- Sub-Components ---

const AssessmentPreviewModal = ({ 
    previewData, 
    onClose, 
    onSave 
}: { 
    previewData: Omit<Assessment, 'id' | 'createdAt' | 'schoolYear'>[], 
    onClose: () => void, 
    onSave: (data: Omit<Assessment, 'id' | 'createdAt' | 'schoolYear'>[]) => Promise<void> 
}) => {
    const [editableData, setEditableData] = useState(previewData);
    const [isSaving, setIsSaving] = useState(false);

    const handleChange = (index: number, field: string, value: any) => {
        setEditableData(prev => {
            const newData = [...prev];
            newData[index] = { ...newData[index], [field]: value };
            return newData;
        });
    };

    const handleSave = async () => {
        setIsSaving(true);
        await onSave(editableData);
        setIsSaving(false);
    };

    const handleDeleteRow = (index: number) => {
        setEditableData(prev => prev.filter((_, i) => i !== index));
    };

    const inputClass = "w-full text-center bg-white text-gray-900 border border-gray-300 focus:outline-none focus:ring-1 focus:ring-primary rounded h-7 text-sm";

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
            if (editableData.length > 0 && !isSaving) {
                handleSave();
            }
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
            <div 
                className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col border border-base-300" 
                onClick={e => e.stopPropagation()}
                onKeyDown={handleKeyDown}
            >
                <div className="p-4 border-b border-base-200 bg-base-50 flex justify-between items-center rounded-t-xl">
                    <h3 className="text-xl font-bold text-base-content flex items-center gap-2">
                        <span>📋</span> 추출된 평가 계획 확인
                    </h3>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-800">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
                
                <div className="flex-1 overflow-auto custom-scrollbar p-4 bg-base-100">
                    <div className="alert bg-blue-50 border-blue-200 text-blue-800 text-sm mb-4">
                        💡 AI가 추출한 내용을 확인하세요. <strong>교과, 학기, 내용</strong>이 올바르지 않다면 직접 수정할 수 있습니다. <br/>
                        확인이 완료되면 우측 하단의 <strong>'저장하기'</strong> 버튼을 눌러주세요. (Enter)
                    </div>
                    <table className="w-full text-sm border-collapse">
                        <thead>
                            <tr className="bg-base-200 text-left text-gray-700 font-bold sticky top-0 z-10">
                                <th className="p-2 border w-12 text-center">학기</th>
                                <th className="p-2 border w-16 text-center">시기</th>
                                <th className="p-2 border w-24 text-center">교과</th>
                                <th className="p-2 border w-32 text-center">영역</th>
                                <th className="p-2 border">평가요소 / 성취기준</th>
                                <th className="p-2 border w-12 text-center">삭제</th>
                            </tr>
                        </thead>
                        <tbody>
                            {editableData.map((item, index) => (
                                <tr key={index} className="hover:bg-base-50">
                                    <td className="p-1 border bg-white">
                                        <input 
                                            value={item.semester} 
                                            onChange={e => handleChange(index, 'semester', e.target.value)} 
                                            className={`${inputClass} text-gray-900`}
                                        />
                                    </td>
                                    <td className="p-1 border bg-white">
                                        <input 
                                            value={item.timing || ''} 
                                            onChange={e => handleChange(index, 'timing', e.target.value)} 
                                            className={`${inputClass} text-gray-900`}
                                            placeholder="시기"
                                        />
                                    </td>
                                    <td className="p-1 border bg-white">
                                        <input 
                                            value={item.subject} 
                                            onChange={e => handleChange(index, 'subject', e.target.value)} 
                                            className={`${inputClass} text-gray-900`}
                                        />
                                    </td>
                                    <td className="p-1 border bg-white">
                                        <input 
                                            value={item.domain} 
                                            onChange={e => handleChange(index, 'domain', e.target.value)} 
                                            className={`${inputClass} text-gray-900`}
                                        />
                                    </td>
                                    <td className="p-1 border bg-white">
                                        <input 
                                            value={item.evaluationElement} 
                                            onChange={e => handleChange(index, 'evaluationElement', e.target.value)} 
                                            className="w-full bg-white text-gray-900 border border-gray-300 focus:outline-none focus:ring-1 focus:ring-primary rounded mb-1 px-2 py-1 font-bold"
                                            placeholder="평가요소"
                                        />
                                        <input 
                                            value={item.achievementStandard} 
                                            onChange={e => handleChange(index, 'achievementStandard', e.target.value)} 
                                            className="w-full bg-white text-gray-900 border border-gray-200 focus:outline-none focus:ring-1 focus:ring-primary rounded text-xs px-2 py-1"
                                            placeholder="성취기준"
                                        />
                                    </td>
                                    <td className="p-1 border text-center bg-white">
                                        <button onClick={() => handleDeleteRow(index)} className="text-red-500 hover:text-red-700">
                                            <svg className="w-5 h-5 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="p-4 border-t border-base-200 bg-base-50 rounded-b-xl flex justify-end gap-3">
                    <button onClick={onClose} className="px-5 py-2 rounded-lg font-bold text-gray-600 hover:bg-gray-200 transition-colors">
                        취소
                    </button>
                    <button 
                        onClick={handleSave} 
                        disabled={isSaving || editableData.length === 0}
                        className="px-6 py-2 rounded-lg font-bold text-white bg-primary hover:bg-primary-focus shadow-md transition-all flex items-center gap-2 disabled:opacity-50"
                    >
                        {isSaving ? <span className="loading loading-spinner loading-sm"></span> : null}
                        {editableData.length}건 저장하기 (Enter)
                    </button>
                </div>
            </div>
        </div>
    );
};

const AssessmentSetup = ({ 
    assessments, 
    onAdd, 
    onUpdate, 
    onDelete, 
    onDeleteSemester,
    schoolYear,
    settings
}: { 
    assessments: Assessment[], 
    onAdd: (a: any) => Promise<void>, 
    onUpdate: (id: string, a: any) => Promise<void>,
    onDelete: (id: string) => void, 
    onDeleteSemester: (semester: string) => Promise<void>,
    schoolYear: string,
    settings: AppSettings
}) => {
    const { showAlert } = useModal();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [processingProgress, setProcessingProgress] = useState(0);
    const [processingMessage, setProcessingMessage] = useState('');
    const [previewData, setPreviewData] = useState<Omit<Assessment, 'id' | 'createdAt' | 'schoolYear'>[]>([]);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const initialFormState = {
        semester: '2',
        subject: '국어',
        domain: '',
        achievementStandard: '',
        evaluationElement: '',
        timing: '',
        criteria: { high: '', middle: '', low: '' }
    };
    const [formData, setFormData] = useState(initialFormState);

    const sortedAssessments = useMemo(() => {
        return [...assessments].sort(sortAssessments);
    }, [assessments]);

    const handleSelectAssessment = (assessment: Assessment) => {
        setEditingId(assessment.id);
        setFormData({
            semester: assessment.semester,
            subject: assessment.subject,
            domain: assessment.domain,
            achievementStandard: assessment.achievementStandard,
            evaluationElement: assessment.evaluationElement,
            timing: assessment.timing || '',
            criteria: { ...assessment.criteria }
        });
    };

    const handleResetForm = () => {
        setEditingId(null);
        setFormData(initialFormState);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingId) {
                await onUpdate(editingId, { ...formData });
                await showAlert("평가 계획이 수정되었습니다.");
            } else {
                await onAdd({ ...formData, schoolYear, createdAt: Date.now() });
                await showAlert("평가 계획이 추가되었습니다.");
            }
            handleResetForm();
        } catch (e) {
            await showAlert("오류가 발생했습니다.");
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setIsProcessing(true);
        setProcessingProgress(0);
        setProcessingMessage("파일을 읽고 있습니다...");
        // Fake progress for UX
        const progressInterval = setInterval(() => {
            setProcessingProgress(prev => Math.min(prev + Math.random() * 10, 90));
        }, 200);
        
        try {
            const extractedPlans = await extractAssessmentPlanFromFile(
                file, 
                settings.geminiApiKey,
                settings.geminiModel
            );
            clearInterval(progressInterval);
            setProcessingProgress(100);
            if (extractedPlans.length === 0) {
                await showAlert("문서에서 평가 계획을 추출하지 못했습니다.");
                return;
            }
            setTimeout(() => {
                setPreviewData(extractedPlans);
                setIsPreviewOpen(true);
                setIsProcessing(false);
            }, 500);
        } catch (err) {
            console.error(err);
            clearInterval(progressInterval);
            setIsProcessing(false);
            await showAlert("파일 처리 중 오류가 발생했습니다.");
        } finally {
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    useEffect(() => {
        if (!isProcessing) return;
        if (processingProgress < 30) setProcessingMessage("AI 서버로 문서를 전송하고 있습니다...");
        else if (processingProgress < 70) setProcessingMessage("Gemini AI가 문서를 정밀 분석 중입니다...");
        else setProcessingMessage("평가 요소와 기준을 추출하여 구조화하고 있습니다...");
    }, [processingProgress, isProcessing]);

    const handleSavePreview = async (data: Omit<Assessment, 'id' | 'createdAt' | 'schoolYear'>[]) => {
        try {
            let addedCount = 0;
            for (const plan of data) {
                const sem = plan.semester ? plan.semester.replace(/[^1-2]/g, '') : formData.semester;
                await onAdd({
                    schoolYear,
                    semester: sem || '1',
                    subject: plan.subject || '미지정',
                    domain: plan.domain || '',
                    timing: plan.timing || '',
                    achievementStandard: plan.achievementStandard || '',
                    evaluationElement: plan.evaluationElement || '추출된 평가 요소',
                    criteria: {
                        high: plan.criteria?.high || '',
                        middle: plan.criteria?.middle || '',
                        low: plan.criteria?.low || ''
                    },
                    createdAt: Date.now()
                });
                addedCount++;
            }
            setIsPreviewOpen(false);
            setPreviewData([]);
            await showAlert(`${addedCount}건의 평가 계획이 저장되었습니다.`);
        } catch (e) {
            console.error(e);
            await showAlert("저장 중 오류가 발생했습니다.");
        }
    };

    const inputClass = "w-full p-2 rounded border border-base-300 bg-white text-gray-900 focus:ring-primary focus:border-primary placeholder-gray-400";

    return (
        <div className="h-full flex flex-col md:flex-row gap-4 p-4 overflow-y-auto lg:overflow-hidden pb-20 lg:pb-0">
            {isPreviewOpen && (
                <AssessmentPreviewModal 
                    previewData={previewData} 
                    onClose={() => setIsPreviewOpen(false)} 
                    onSave={handleSavePreview} 
                />
            )}
            
            <div className="flex-1 overflow-y-auto custom-scrollbar border border-base-300 rounded-xl relative bg-white flex flex-col min-h-[400px]">
                 {isProcessing && (
                    <div className="absolute inset-0 bg-black/60 z-50 flex flex-col items-center justify-center p-6 backdrop-blur-sm">
                        <div className="bg-white rounded-2xl p-8 max-w-sm w-full shadow-2xl flex flex-col items-center animate-[scaleIn_0.3s_ease-out]">
                            <h3 className="text-xl font-bold text-gray-800 mb-2">AI 분석 진행 중</h3>
                            <div className="w-full bg-gray-200 rounded-full h-2.5 mb-4 overflow-hidden">
                                <div className="bg-primary h-2.5 rounded-full transition-all duration-300 ease-out" style={{ width: `${processingProgress}%` }}></div>
                            </div>
                            <p className="text-sm text-gray-600 text-center font-medium min-h-[3rem] flex items-center justify-center">{processingMessage}</p>
                        </div>
                    </div>
                 )}
                 <div className="p-3 border-b border-base-200 bg-base-50 flex justify-between items-center shrink-0">
                     <span className="text-sm font-bold text-gray-500">등록된 계획 목록</span>
                     <div className="flex gap-2">
                        <button onClick={() => onDeleteSemester('1')} className="text-xs bg-white text-red-600 border border-red-200 hover:bg-red-50 px-2 py-1.5 rounded-lg font-bold flex items-center gap-1 transition-colors">1학기 초기화</button>
                        <button onClick={() => onDeleteSemester('2')} className="text-xs bg-white text-red-600 border border-red-200 hover:bg-red-50 px-2 py-1.5 rounded-lg font-bold flex items-center gap-1 transition-colors">2학기 초기화</button>
                     </div>
                 </div>
                 {/* iPad Fix: Added pb-40 */}
                 <div className="overflow-auto custom-scrollbar flex-1 pb-40">
                    <table className="w-full text-sm">
                        <thead className="bg-white sticky top-0 z-10 text-base-content-secondary shadow-sm">
                            <tr>
                                <th className="p-2 w-16 text-center border-b">학기</th>
                                <th className="p-2 w-20 text-center border-b">교과</th>
                                <th className="p-2 text-left border-b">평가요소 / 성취기준</th>
                                <th className="p-2 w-20 text-center border-b">입력 제외</th>
                                <th className="p-2 w-16 text-center border-b">작업</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-base-200">
                            {sortedAssessments.map(a => (
                                <tr 
                                    key={a.id} 
                                    className={`hover:bg-base-50 cursor-pointer transition-colors ${editingId === a.id ? 'bg-primary/5 border-l-4 border-l-primary' : ''} ${a.isExcluded ? 'opacity-60 bg-gray-50' : ''}`}
                                    onClick={() => handleSelectAssessment(a)}
                                >
                                    <td className="p-3 text-center">
                                        <span className="inline-block px-2 py-0.5 rounded bg-gray-100 text-gray-700 font-bold text-xs border border-gray-200 whitespace-nowrap badge-no-wrap">
                                            {a.semester}학기
                                        </span>
                                    </td>
                                    <td className="p-3 text-center">
                                        <span className={`inline-block px-2 py-0.5 rounded font-bold text-xs badge-no-wrap ${getSubjectColor(a.subject)}`}>
                                            {a.subject}
                                        </span>
                                        {a.timing && <div className="text-[10px] text-gray-500 mt-1 font-bold">{a.timing}</div>}
                                    </td>
                                    <td className="p-3">
                                        <div className="font-bold text-gray-800">{a.evaluationElement}</div>
                                        <div className="text-xs text-gray-500 mt-1">{a.achievementStandard}</div>
                                    </td>
                                    <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                                        <label className="cursor-pointer flex items-center justify-center group" title="전담 교사 담당 등으로 평가 입력 제외 시 체크">
                                            <input 
                                                type="checkbox" 
                                                checked={a.isExcluded || false} 
                                                onChange={(e) => onUpdate(a.id, { isExcluded: e.target.checked })}
                                                className="checkbox checkbox-sm checkbox-warning border-base-300" 
                                            />
                                        </label>
                                    </td>
                                    <td className="p-3 text-center">
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); onDelete(a.id); }} 
                                            className="text-red-500 hover:bg-red-50 p-1.5 rounded transition-colors"
                                            title="삭제"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {assessments.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-base-content-secondary">등록된 평가 계획이 없습니다.</td></tr>}
                        </tbody>
                    </table>
                 </div>
            </div>
            {/* iPad Fix: Added pb-32 to form container scroll */}
            <div className="w-full md:w-96 bg-base-50 p-4 rounded-xl border border-base-300 overflow-y-auto custom-scrollbar shadow-inner flex flex-col h-fit pb-32">
                {/* Form Content ... */}
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-lg flex items-center gap-2 text-base-content">
                        {editingId ? <span className="text-primary">✏️ 평가 계획 수정</span> : <span className="text-primary">+ 평가 계획 등록</span>}
                    </h3>
                    {!editingId && (
                        <>
                            <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept="image/*,application/pdf" />
                            <button type="button" onClick={() => fileInputRef.current?.click()} className="text-xs bg-white border border-base-300 hover:bg-base-100 px-3 py-1.5 rounded-lg font-bold flex items-center gap-1 shadow-sm text-gray-700">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                                PDF/이미지
                            </button>
                        </>
                    )}
                </div>
                <form onSubmit={handleSubmit} className="space-y-3 flex-1">
                    {/* ... Form inputs ... */}
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="block text-xs font-bold mb-1 text-gray-600">학기</label>
                            <select className={inputClass} value={formData.semester} onChange={e => setFormData({...formData, semester: e.target.value})}>
                                <option value="1">1학기</option>
                                <option value="2">2학기</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold mb-1 text-gray-600">교과</label>
                            <input className={inputClass} value={formData.subject} onChange={e => setFormData({...formData, subject: e.target.value})} placeholder="예: 국어" required />
                        </div>
                    </div>
                    {/* ... other inputs ... */}
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="block text-xs font-bold mb-1 text-gray-600">영역</label>
                            <input className={inputClass} value={formData.domain} onChange={e => setFormData({...formData, domain: e.target.value})} placeholder="예: 읽기" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold mb-1 text-gray-600">평가 시기</label>
                            <input className={inputClass} value={formData.timing} onChange={e => setFormData({...formData, timing: e.target.value})} placeholder="예: 4월" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold mb-1 text-gray-600">성취기준</label>
                        <input className={inputClass} value={formData.achievementStandard} onChange={e => setFormData({...formData, achievementStandard: e.target.value})} placeholder="예: [6국01-02] 의견을 제시하고..." required />
                    </div>
                    <div>
                        <label className="block text-xs font-bold mb-1 text-gray-600">평가요소</label>
                        <input className={`${inputClass} font-bold`} value={formData.evaluationElement} onChange={e => setFormData({...formData, evaluationElement: e.target.value})} placeholder="예: 토의 주제를 파악하고..." required />
                    </div>
                    <div className="bg-white p-3 rounded border border-base-200 space-y-2">
                        <label className="block text-xs font-bold text-center border-b pb-1 text-gray-700">평가 기준 (채점 가이드)</label>
                        <div>
                            <span className="text-xs font-bold text-green-600">잘함</span>
                            <textarea className={`${inputClass} border-green-100 text-sm`} rows={4} value={formData.criteria.high} onChange={e => setFormData({...formData, criteria: {...formData.criteria, high: e.target.value}})} placeholder="내용..." />
                        </div>
                        <div>
                            <span className="text-xs font-bold text-yellow-600">보통</span>
                            <textarea className={`${inputClass} border-yellow-100 text-sm`} rows={4} value={formData.criteria.middle} onChange={e => setFormData({...formData, criteria: {...formData.criteria, middle: e.target.value}})} placeholder="내용..." />
                        </div>
                        <div>
                            <span className="text-xs font-bold text-red-600">노력요함</span>
                            <textarea className={`${inputClass} border-red-100 text-sm`} rows={4} value={formData.criteria.low} onChange={e => setFormData({...formData, criteria: {...formData.criteria, low: e.target.value}})} placeholder="내용..." />
                        </div>
                    </div>
                    <div className="flex gap-2 pt-2">
                         {editingId && (
                            <button type="button" onClick={handleResetForm} className="flex-1 py-2 bg-base-300 text-base-content font-bold rounded shadow hover:bg-gray-400 text-sm">
                                취소 (새로 등록)
                            </button>
                        )}
                        <button type="submit" className="flex-1 py-2 bg-primary text-primary-content font-bold rounded shadow hover:bg-primary-focus text-sm">
                            {editingId ? '수정 저장' : '저장하기'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const EvaluationEntry = ({ 
    students, 
    assessments, 
    evaluations, 
    onSave 
}: { 
    students: Student[], 
    assessments: Assessment[], 
    evaluations: Record<string, Record<string, EvaluationRecord>>, 
    onSave: (aid: string, updates: { studentId: string, level: EvaluationLevel }[]) => Promise<void>
}) => {
    const { showConfirm } = useModal();
    const [selectedSemester, setSelectedSemester] = useState(getCurrentSemester()); 
    const [selectedSubject, setSelectedSubject] = useState<string>('');
    const [selectedDomain, setSelectedDomain] = useState<string>('');
    const [selectedAssessId, setSelectedAssessId] = useState<string>('');
    
    // Local Draft State
    const [unsavedChanges, setUnsavedChanges] = useState<Record<string, EvaluationLevel>>({});
    const [isSaving, setIsSaving] = useState(false);

    // Reset local changes when assessment changes
    useEffect(() => {
        setUnsavedChanges({});
    }, [selectedAssessId]);

    const hasChanges = Object.keys(unsavedChanges).length > 0;

    const semesterAssessments = useMemo(() => {
        return assessments.filter(a => a.semester === selectedSemester && !a.isExcluded);
    }, [assessments, selectedSemester]);
    
    const subjects = useMemo(() => Array.from(new Set(semesterAssessments.map(a => a.subject))).sort(sortSubjects), [semesterAssessments]);
    
    useEffect(() => {
        if (subjects.length > 0 && !subjects.includes(selectedSubject)) {
            setSelectedSubject(subjects[0]);
        }
    }, [subjects, selectedSubject]);

    const subjectAssessments = useMemo(() => semesterAssessments.filter(a => a.subject === selectedSubject), [semesterAssessments, selectedSubject]);
    
    const domains = useMemo(() => Array.from(new Set(subjectAssessments.map(a => a.domain || '영역 없음'))).sort(), [subjectAssessments]);
    
    useEffect(() => {
        if (domains.length > 0) {
             if (!domains.includes(selectedDomain)) {
                 setSelectedDomain(domains[0]);
             }
        } else {
            setSelectedDomain('');
        }
    }, [domains, selectedDomain]);

    const domainAssessments = useMemo(() => subjectAssessments.filter(a => (a.domain || '영역 없음') === selectedDomain), [subjectAssessments, selectedDomain]);

    useEffect(() => {
        if (domainAssessments.length > 0) {
             if (!domainAssessments.find(a => a.id === selectedAssessId)) {
                 setSelectedAssessId(domainAssessments[0].id);
             }
        } else {
            setSelectedAssessId('');
        }
    }, [domainAssessments, selectedAssessId]);


    const selectedAssessment = assessments.find(a => a.id === selectedAssessId);
    const currentEvaluations: Record<string, EvaluationRecord> = evaluations[String(selectedAssessId)] || {};

    // Helper to get current display level (draft or saved)
    const getLevel = (studentId: string): EvaluationLevel | undefined => {
        if (unsavedChanges[studentId] !== undefined) {
            // If explicitly 'none' in draft, return undefined or 'none' logic depending on display preference
            // Here 'none' means "Clear/Not Evaluated"
            return unsavedChanges[studentId];
        }
        return currentEvaluations[studentId]?.level;
    };

    const stats = useMemo(() => {
        let h = 0, m = 0, l = 0, n = 0;
        students.forEach(s => {
            const lvl = getLevel(s.id);
            if (lvl === 'high') h++;
            else if (lvl === 'middle') m++;
            else if (lvl === 'low') l++;
            else n++; // none or undefined
        });
        return { h, m, l, n, total: students.length, done: h+m+l };
    }, [currentEvaluations, unsavedChanges, students]);

    const handleLevelChange = (studentId: string, newLevel: EvaluationLevel) => {
        setUnsavedChanges(prev => {
            // Toggle logic: if clicking the same level as currently selected (draft or saved), clear it (set to 'none')
            const currentLevel = getLevel(studentId);
            if (currentLevel === newLevel && newLevel !== 'none') {
                return { ...prev, [studentId]: 'none' };
            }
            return { ...prev, [studentId]: newLevel };
        });
    };

    const handleBatchLocalUpdate = (level: EvaluationLevel) => {
        const changes: Record<string, EvaluationLevel> = {};
        students.forEach(s => {
            changes[s.id] = level;
        });
        setUnsavedChanges(prev => ({ ...prev, ...changes }));
    };

    const handleSaveClick = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        
        if (!selectedAssessId) return;
        setIsSaving(true);
        try {
            // Convert unsavedChanges map to array for parent handler
            const updates = Object.entries(unsavedChanges).map(([studentId, level]) => ({ 
                studentId, 
                level: level as EvaluationLevel 
            }));
            await onSave(selectedAssessId, updates);
            setUnsavedChanges({});
        } catch (e) {
            console.error(e);
        } finally {
            setIsSaving(false);
        }
    };

    const handleCancelChanges = () => {
        if (confirm("변경 사항을 취소하시겠습니까?")) {
            setUnsavedChanges({});
        }
    };

    return (
        <div className="h-full flex flex-col p-2 sm:p-4 gap-4 overflow-hidden relative">
            {/* Header: Selectors & SAVE BUTTON */}
            <div className="bg-base-50 p-4 rounded-xl border border-base-300 flex flex-col gap-3 shrink-0">
                {/* Row 1: Semesters & Subjects */}
                <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
                    <div className="flex items-center gap-4 overflow-x-auto custom-scrollbar w-full xl:w-auto pb-1 xl:pb-0">
                        <div className="flex bg-white rounded-lg p-1 border border-base-300 shadow-sm shrink-0">
                            {['1', '2'].map((sem) => (
                                <button
                                    key={sem}
                                    onClick={() => setSelectedSemester(sem)}
                                    className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${selectedSemester === sem ? 'bg-primary text-primary-content shadow-sm' : 'text-base-content-secondary hover:bg-base-50'}`}
                                >
                                    {sem}학기
                                </button>
                            ))}
                        </div>
                        <div className="w-px h-6 bg-gray-300 mx-2 hidden xl:block"></div>
                        <div className="flex gap-2 p-1.5">
                            {subjects.map(subj => (
                                <button
                                    key={subj}
                                    onClick={() => setSelectedSubject(subj)}
                                    className={`px-4 py-1.5 rounded-full text-sm font-bold border transition-all whitespace-nowrap shadow-sm
                                        ${selectedSubject === subj 
                                            ? `${getSubjectColor(subj, true)} transform scale-105 ring-2 ring-offset-1 ring-current`
                                            : `${getSubjectColor(subj, false)} hover:bg-gray-100 text-gray-600`
                                        }
                                    `}
                                >
                                    {subj}
                                </button>
                            ))}
                             {subjects.length === 0 && <span className="text-xs text-gray-400 py-2">등록된 평가 없음</span>}
                        </div>
                    </div>

                    {/* SAVE BUTTONS (Top Right) */}
                    <div className="flex items-center gap-2 shrink-0 ml-auto">
                        {hasChanges && (
                            <button
                                type="button"
                                onClick={handleCancelChanges}
                                className="px-4 py-2 rounded-lg font-bold text-gray-600 bg-white border border-gray-300 hover:bg-gray-100 text-sm transition-all"
                                disabled={isSaving}
                            >
                                취소
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={handleSaveClick}
                            disabled={!hasChanges || isSaving}
                            className={`px-6 py-2 rounded-lg font-bold text-white shadow-md transition-all text-sm flex items-center gap-2
                                ${hasChanges 
                                    ? 'bg-primary hover:bg-primary-focus cursor-pointer' 
                                    : 'bg-gray-300 cursor-not-allowed text-gray-500 opacity-50' 
                                }
                            `}
                        >
                            {isSaving ? <span className="loading loading-spinner loading-xs"></span> : null}
                            {hasChanges ? `${Object.keys(unsavedChanges).length}건 저장` : '저장'}
                        </button>
                    </div>
                </div>

                {/* Row 2: Domain & Assessment Selectors */}
                {subjects.length > 0 && (
                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="flex flex-col gap-1 w-full sm:w-1/4 min-w-[150px]">
                            <label className="text-xs font-bold text-gray-500 ml-1">영역</label>
                            <select 
                                className="w-full p-2.5 rounded-lg border border-base-300 bg-white text-sm font-bold focus:ring-2 focus:ring-primary"
                                value={selectedDomain}
                                onChange={e => setSelectedDomain(e.target.value)}
                            >
                                {domains.map(d => (
                                    <option key={d} value={d}>{d}</option>
                                ))}
                            </select>
                        </div>
                        <div className="flex flex-col gap-1 flex-1">
                            <label className="text-xs font-bold text-gray-500 ml-1">성취기준 / 평가요소</label>
                            <select 
                                className="w-full p-2.5 rounded-lg border border-base-300 bg-white text-sm font-bold focus:ring-2 focus:ring-primary"
                                value={selectedAssessId}
                                onChange={e => setSelectedAssessId(e.target.value)}
                            >
                                {domainAssessments.map(a => (
                                    <option key={a.id} value={a.id}>
                                        {a.evaluationElement}  {a.achievementStandard ? `(${a.achievementStandard})` : ''}
                                    </option>
                                ))}
                                {domainAssessments.length === 0 && <option value="">이 영역에 등록된 평가가 없습니다.</option>}
                            </select>
                        </div>
                    </div>
                )}
            </div>

            {selectedAssessment ? (
                <div className="flex-1 flex flex-col lg:flex-row gap-4 overflow-hidden min-h-0 relative">
                    <div className="flex-1 bg-white border border-base-300 rounded-xl flex flex-col shadow-sm overflow-hidden min-h-0 relative">
                        <div className="p-2 border-b border-base-200 bg-base-50/50 flex justify-end gap-2 items-center overflow-x-auto custom-scrollbar shrink-0">
                            <span className="text-xs font-bold text-gray-500 mr-1 whitespace-nowrap">일괄 입력 (저장 전):</span>
                            <button onClick={() => handleBatchLocalUpdate('high')} className="px-3 py-1 bg-green-100 text-green-800 text-xs font-bold rounded border border-green-200 hover:bg-green-200 transition-colors whitespace-nowrap">전체 잘함</button>
                            <button onClick={() => handleBatchLocalUpdate('middle')} className="px-3 py-1 bg-yellow-100 text-yellow-800 text-xs font-bold rounded border border-yellow-200 hover:bg-yellow-200 transition-colors whitespace-nowrap">전체 보통</button>
                            <button onClick={() => handleBatchLocalUpdate('low')} className="px-3 py-1 bg-red-100 text-red-800 text-xs font-bold rounded border border-red-200 hover:bg-red-200 transition-colors whitespace-nowrap">전체 노력</button>
                            <div className="w-px h-4 bg-gray-300 mx-1"></div>
                            <button onClick={() => handleBatchLocalUpdate('none')} className="px-3 py-1 bg-gray-100 text-gray-600 text-xs font-bold rounded border border-gray-300 hover:bg-gray-200 transition-colors whitespace-nowrap">전체 초기화</button>
                        </div>

                        {/* iPad Fix: Added pb-40 to table scroll */}
                        <div className="flex-1 overflow-auto custom-scrollbar relative bg-white pb-40">
                            <table className="w-full text-sm min-w-[500px]">
                                <thead className="bg-base-100 sticky top-0 z-10 font-bold text-base-content border-b border-base-200 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
                                    <tr>
                                        <th className="p-3 w-16 text-center whitespace-nowrap bg-base-100">번호</th>
                                        <th className="p-3 w-24 text-center whitespace-nowrap bg-base-100">이름</th>
                                        <th className="p-3 text-center whitespace-nowrap bg-base-100">평가 (잘함 / 보통 / 노력요함 / 미실시)</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-base-100">
                                    {students.map(student => {
                                        const level = getLevel(student.id);
                                        const isChanged = unsavedChanges[student.id] !== undefined;
                                        
                                        return (
                                            <tr key={student.id} className={`hover:bg-base-50 transition-colors ${isChanged ? 'bg-blue-50/30' : ''}`}>
                                                <td className="p-3 text-center font-bold text-gray-500">{student.number}</td>
                                                <td className="p-3 text-center font-bold text-lg text-gray-800 whitespace-nowrap">
                                                    {student.name.hangul}
                                                    {isChanged && <span className="text-[10px] text-blue-500 ml-1">●</span>}
                                                </td>
                                                <td className="p-2 text-center">
                                                    <div className="flex justify-center gap-1 mx-auto max-w-[320px]">
                                                        {(['high', 'middle', 'low'] as const).map(lvl => (
                                                            <button
                                                                type="button"
                                                                key={lvl}
                                                                onClick={() => handleLevelChange(student.id, lvl)}
                                                                className={`w-14 h-8 rounded-lg border transition-all font-bold text-xs shadow-sm ${
                                                                    level === lvl 
                                                                    ? lvl === 'high' ? 'bg-green-500 text-white border-green-600 ring-2 ring-green-200'
                                                                    : lvl === 'middle' ? 'bg-yellow-400 text-white border-yellow-500 ring-2 ring-yellow-200'
                                                                    : 'bg-red-400 text-white border-red-500 ring-2 ring-red-200'
                                                                    : 'bg-white text-gray-500 border-base-300 hover:bg-base-100 hover:text-gray-700'
                                                                }`}
                                                            >
                                                                {lvl === 'high' ? '잘함' : lvl === 'middle' ? '보통' : '노력'}
                                                            </button>
                                                        ))}
                                                        <button
                                                            type="button"
                                                            onClick={() => handleLevelChange(student.id, 'none')}
                                                            className={`w-14 h-8 rounded-lg border transition-all font-bold text-xs shadow-sm ${
                                                                level === 'none' || !level
                                                                ? 'bg-gray-500 text-white border-gray-600 ring-2 ring-gray-300'
                                                                : 'bg-white text-gray-400 border-base-300 hover:bg-gray-50 hover:text-gray-600'
                                                            }`}
                                                            title="평가 미실시"
                                                        >
                                                            미실시
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="w-full lg:w-80 flex flex-col gap-4 overflow-y-auto custom-scrollbar shrink-0 pb-40">
                         {/* Stats Panel */}
                         <div className="bg-white p-4 rounded-xl border border-base-300 shadow-sm">
                             <h4 className="font-bold mb-3 text-base-content-secondary flex justify-between">
                                 진행 현황 <span className="text-[10px] font-normal text-gray-400 self-center">(저장 전 상태 포함)</span>
                             </h4>
                             <div className="flex items-center gap-2 mb-2">
                                 <div className="flex-1 h-3 bg-base-200 rounded-full overflow-hidden">
                                     <div className="h-full bg-primary" style={{ width: `${(stats.done / stats.total) * 100}%` }}></div>
                                 </div>
                                 <span className="text-xs font-bold text-gray-700">{stats.done}/{stats.total}명</span>
                             </div>
                             <div className="grid grid-cols-2 gap-2 text-center text-xs">
                                 <div className="bg-green-50 p-2 rounded border border-green-100">
                                     <div className="font-bold text-green-700">{stats.h}</div>
                                     <div className="text-green-600">잘함</div>
                                 </div>
                                 <div className="bg-yellow-50 p-2 rounded border border-yellow-100">
                                     <div className="font-bold text-yellow-700">{stats.m}</div>
                                     <div className="text-yellow-600">보통</div>
                                 </div>
                                 <div className="bg-red-50 p-2 rounded border border-red-100">
                                     <div className="font-bold text-red-700">{stats.l}</div>
                                     <div className="text-red-600">노력</div>
                                 </div>
                                 <div className="bg-gray-100 p-2 rounded border border-gray-200">
                                     <div className="font-bold text-gray-700">{stats.n}</div>
                                     <div className="text-gray-500">미실시</div>
                                 </div>
                             </div>
                         </div>

                         <div className="bg-base-50 p-4 rounded-xl border border-base-300 shadow-inner flex-1 min-h-[200px]">
                             <h4 className="font-bold mb-3 text-base-content flex items-center gap-2">
                                 <span>ℹ️</span> 평가 기준
                             </h4>
                             <div className="space-y-3 text-sm h-full overflow-y-auto custom-scrollbar pr-1">
                                 {selectedAssessment.timing && (
                                     <div className="mb-2 pb-2 border-b border-base-200">
                                         <span className="text-xs font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded">평가 시기</span>
                                         <span className="ml-2 text-gray-800 font-bold">{selectedAssessment.timing}</span>
                                     </div>
                                 )}
                                 <div>
                                     <span className="text-xs font-bold bg-green-100 text-green-800 px-2 py-0.5 rounded">잘함</span>
                                     <p className="mt-1 p-2 bg-white rounded border border-base-200 text-gray-800 leading-relaxed">{selectedAssessment.criteria.high || '-'}</p>
                                 </div>
                                 <div>
                                     <span className="text-xs font-bold bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">보통</span>
                                     <p className="mt-1 p-2 bg-white rounded border border-base-200 text-gray-800 leading-relaxed">{selectedAssessment.criteria.middle || '-'}</p>
                                 </div>
                                 <div>
                                     <span className="text-xs font-bold bg-red-100 text-red-800 px-2 py-0.5 rounded">노력요함</span>
                                     <p className="mt-1 p-2 bg-white rounded border border-base-200 text-gray-800 leading-relaxed">{selectedAssessment.criteria.low || '-'}</p>
                                 </div>
                             </div>
                         </div>
                    </div>
                </div>
            ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-base-content-secondary opacity-60">
                    <span className="text-5xl mb-4">👈</span>
                    <p>위에서 평가 영역 및 요소를 선택해주세요.</p>
                </div>
            )}
        </div>
    );
};

const MissingEvaluationView = ({ students, assessments, evaluations, onNavigateToEntry }: { 
    students: Student[], 
    assessments: Assessment[], 
    evaluations: Record<string, Record<string, EvaluationRecord>>,
    onNavigateToEntry: (id: string) => void
}) => {
    const [selectedSemester, setSelectedSemester] = useState(getCurrentSemester());

    const sortedAssessments = useMemo(() => {
        // Exclude 'isExcluded' assessments from Missing View
        let filtered = assessments.filter(a => a.semester === selectedSemester && !a.isExcluded);
        return [...filtered].sort(sortAssessments);
    }, [assessments, selectedSemester]);

    const dataBySubject = useMemo(() => {
        const grouped: Record<string, {
            incomplete: { assessment: Assessment, missingStudents: Student[] }[],
            complete: Assessment[]
        }> = {};

        const subjects = Array.from(new Set(sortedAssessments.map(a => a.subject)));
        subjects.forEach(s => grouped[String(s)] = { incomplete: [], complete: [] });
        
        sortedAssessments.forEach((assessment: Assessment) => {
            const missingStudents = students.filter(s => {
                const record = evaluations[String(assessment.id)]?.[String(s.id)];
                return !record || !record.level;
            });

            const group = grouped[String(assessment.subject)];
            if (group) {
                if (missingStudents.length > 0) {
                    group.incomplete.push({ assessment, missingStudents });
                } else {
                    group.complete.push(assessment);
                }
            }
        });

        return grouped;
    }, [students, sortedAssessments, evaluations]);

    const subjectKeys = Object.keys(dataBySubject).sort(sortSubjects);

    const getSubjectBaseColor = (subject: string) => {
        const colorClass = SUBJECT_COLORS[subject] || 'bg-gray-100 text-gray-800 border-gray-200';
        const bgPart = colorClass.split(' ').find(c => c.startsWith('bg-')) || 'bg-gray-100';
        return bgPart;
    };
    
    const getSubjectTextColor = (subject: string) => {
        const colorClass = SUBJECT_COLORS[subject] || 'bg-gray-100 text-gray-800 border-gray-200';
        const textPart = colorClass.split(' ').find(c => c.startsWith('text-')) || 'text-gray-800';
        return textPart;
    }
    
    const getSubjectBorderColor = (subject: string) => {
        const colorClass = SUBJECT_COLORS[subject] || 'bg-gray-100 text-gray-800 border-gray-200';
        const borderPart = colorClass.split(' ').find(c => c.startsWith('border-')) || 'border-gray-200';
        return borderPart;
    }

    return (
        <div className="h-full flex flex-col p-4 overflow-hidden gap-4 pb-40 lg:pb-0">
             <div className="flex justify-end mb-2">
                 <div className="flex bg-white rounded-lg p-1 border border-base-300 shadow-sm shrink-0">
                    {['1', '2'].map((sem) => (
                        <button
                            key={sem}
                            onClick={() => setSelectedSemester(sem)}
                            className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${selectedSemester === sem ? 'bg-primary text-primary-content shadow-sm' : 'text-base-content-secondary hover:bg-base-50'}`}
                        >
                            {sem}학기
                        </button>
                    ))}
                </div>
             </div>
             
             {/* iPad Fix: Added pb-40 */}
             {subjectKeys.length > 0 ? (
                 <div className="flex-1 overflow-auto custom-scrollbar space-y-8 pb-40">
                     {subjectKeys.map((subject: string) => {
                         const { incomplete, complete } = dataBySubject[subject];
                         const bgColorClass = getSubjectBaseColor(subject);
                         const textColorClass = getSubjectTextColor(subject);
                         const borderColorClass = getSubjectBorderColor(subject);

                         return (
                             <div key={subject} className="flex flex-col">
                                 <h3 className={`text-lg font-bold mb-3 px-2 border-l-4 pl-3 flex items-center gap-2 ${textColorClass} ${borderColorClass.replace('border-', 'border-l-')}`}>
                                     {subject}
                                     <span className="text-xs font-normal text-gray-500 bg-white border border-gray-200 px-2 py-0.5 rounded-full ml-1">
                                         미입력 {incomplete.length}건 / 완료 {complete.length}건
                                     </span>
                                 </h3>

                                 {incomplete.length > 0 ? (
                                     <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                         {incomplete.map(({ assessment, missingStudents }) => (
                                             <div key={assessment.id} className="bg-white border border-base-300 rounded-xl p-4 shadow-sm relative overflow-hidden group hover:border-primary/50 transition-colors">
                                                 <div className={`absolute top-0 left-0 right-0 h-1 ${bgColorClass.replace('100', '400')}`}></div>
                                                 <div 
                                                    className="font-bold text-base-content mb-1 hover:text-primary hover:underline cursor-pointer text-sm leading-tight pt-1" 
                                                    onClick={() => onNavigateToEntry(assessment.id)}
                                                 >
                                                    {assessment.evaluationElement}
                                                 </div>
                                                 <div className="text-xs text-base-content-secondary mb-3 font-medium flex items-center gap-1">
                                                    <span className="bg-base-100 px-1.5 rounded border border-base-200">{assessment.semester}학기</span>
                                                    <span>{assessment.timing}</span>
                                                 </div>
                                                 <div className="flex flex-wrap gap-1.5">
                                                     {missingStudents.map(s => (
                                                         <span key={s.id} className="text-[11px] font-bold text-red-600 bg-red-50 border border-red-100 px-1.5 py-0.5 rounded">
                                                             {s.number}.{s.name.hangul}
                                                         </span>
                                                     ))}
                                                 </div>
                                                 <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                     <button onClick={() => onNavigateToEntry(assessment.id)} className="p-1.5 bg-base-100 hover:bg-primary/10 hover:text-primary rounded-lg text-gray-400">
                                                         <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                                         </svg>
                                                     </button>
                                                 </div>
                                             </div>
                                         ))}
                                     </div>
                                 ) : (
                                     <div className="bg-green-50 border border-green-100 rounded-xl p-4 flex items-center justify-center gap-2 text-green-800 font-bold text-sm shadow-sm">
                                         <span>🎉</span>
                                         <span>모든 평가 입력이 완료되었습니다!</span>
                                     </div>
                                 )}
                             </div>
                         );
                     })}
                 </div>
             ) : (
                 <div className="flex-1 flex flex-col items-center justify-center text-green-600 opacity-80">
                    <span className="text-5xl mb-4">🎉</span>
                    <p className="text-lg font-bold">모든 평가 입력이 완료되었습니다!</p>
                </div>
             )}
        </div>
    );
};

const StudentCommentCard = ({ student, initialComment, onSave, onGenerate }: any) => {
    const { showToast } = useModal();
    const [isEditing, setIsEditing] = useState(false);
    const [text, setText] = useState(initialComment);
    const [isSaving, setIsSaving] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);

    useEffect(() => { if (!isEditing) setText(initialComment); }, [initialComment, isEditing]);

    const handleCopy = () => { navigator.clipboard.writeText(text); showToast("내용이 복사되었습니다."); };
    const handleSave = async () => { setIsSaving(true); await onSave(student.id, text); setIsSaving(false); setIsEditing(false); };
    const handleGenerate = async () => { setIsGenerating(true); try { const newText = await onGenerate(student); if(newText) setText(newText); } catch(e){ console.error(e); } finally { setIsGenerating(false); } };

    if (isEditing) return (
        <div className="!bg-white p-4 rounded-xl border-2 border-primary/20 shadow-md mb-3">
            <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-2"><span className="bg-primary/10 text-primary px-2 py-0.5 rounded text-sm font-bold">{student.number}번</span><span className="text-lg font-bold !text-gray-900">{student.name.hangul}</span></div>
                <div className="flex gap-2"><button onClick={handleGenerate} disabled={isGenerating} className="text-xs bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-lg border border-indigo-100 font-bold hover:bg-indigo-100 flex items-center gap-1">{isGenerating ? <span className="loading loading-spinner loading-xs"></span> : '🤖 AI 재생성'}</button></div>
            </div>
            <textarea className="w-full p-3 border border-base-300 rounded-lg text-sm leading-relaxed focus:ring-2 focus:ring-primary focus:border-primary resize-none h-32 mb-2 font-medium !bg-white !text-gray-900 placeholder-gray-400" placeholder="내용을 입력하세요..." value={text} onChange={(e) => setText(e.target.value)} />
            <div className="flex justify-end gap-2"><button onClick={() => { setIsEditing(false); setText(initialComment); }} className="px-3 py-1.5 rounded-lg text-sm font-bold text-gray-500 hover:bg-gray-100 transition-colors" disabled={isSaving}>취소</button><button onClick={handleSave} disabled={isSaving} className="px-4 py-1.5 bg-primary text-white rounded-lg text-sm font-bold hover:bg-primary-focus shadow-sm transition-colors flex items-center gap-1">{isSaving ? <span className="loading loading-spinner loading-xs"></span> : '저장'}</button></div>
        </div>
    );
    return (
        <div className="!bg-white p-4 rounded-xl border border-base-200 shadow-sm hover:shadow-md transition-all duration-200 group mb-3">
            <div className="flex justify-between items-start mb-2 pb-1">
                <div className="flex items-center gap-2"><span className="bg-base-100 px-2 py-0.5 rounded text-sm font-bold text-gray-600 border border-base-200">{student.number}번</span><span className="text-lg font-bold !text-gray-900">{student.name.hangul}</span></div>
                <button onClick={() => setIsEditing(true)} className="text-xs bg-white text-gray-500 border border-base-200 px-3 py-1.5 rounded-lg font-bold hover:bg-base-50 hover:text-gray-900 transition-colors opacity-0 group-hover:opacity-100">수정</button>
            </div>
            <div className="p-3 bg-[#f0fdf4] rounded-lg text-sm leading-relaxed !text-gray-900 min-h-[3rem] cursor-pointer hover:bg-[#dcfce7] transition-colors border border-green-100 font-medium" onClick={handleCopy} title="클릭하여 복사">{text || <span className="text-gray-400 italic">작성된 내용이 없습니다.</span>}</div>
        </div>
    );
};

const SeteukBatchModal = ({ students, subject, semester, onConfirm, onClose }: any) => {
    const [sentenceCount, setSentenceCount] = useState(2);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(students.map((s:any) => s.id)));
    const toggleStudent = (id: string) => { const newSet = new Set(selectedIds); if (newSet.has(id)) newSet.delete(id); else newSet.add(id); setSelectedIds(newSet); };
    const selectAll = () => setSelectedIds(new Set(students.map((s:any) => s.id)));
    const deselectAll = () => setSelectedIds(new Set());

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
            if (selectedIds.size > 0) {
                onConfirm(sentenceCount, Array.from(selectedIds));
            }
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
            <div 
                className="bg-white rounded-xl shadow-2xl w-full max-w-lg border border-base-300 overflow-hidden flex flex-col max-h-[90vh]" 
                onClick={e => e.stopPropagation()}
                onKeyDown={handleKeyDown}
            >
                <div className="p-5 bg-gradient-to-r from-indigo-50 to-white border-b border-base-200 shrink-0"><h3 className="font-bold text-lg text-indigo-900 flex items-center gap-2"><span>✨</span> 해당 교과 AI 생성 설정</h3><p className="text-xs text-indigo-700 mt-1 font-medium"><span className="font-bold bg-indigo-100 px-1.5 py-0.5 rounded mr-1">{semester}학기</span><span className="font-bold">{subject}</span> 교과</p></div>
                <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
                    <div className="mb-6"><label className="block text-sm font-bold text-gray-700 mb-3">문장 길이 선택</label><div className="grid grid-cols-3 gap-3">{[2, 3, 4].map(count => (<button key={count} onClick={() => setSentenceCount(count)} className={`py-3 rounded-xl border-2 font-bold text-lg transition-all ${sentenceCount === count ? 'border-indigo-500 bg-indigo-50 text-indigo-700 shadow-md ring-2 ring-indigo-200' : 'border-base-200 bg-white text-gray-500 hover:border-indigo-300 hover:bg-base-50'}`}>{count}문장</button>))}</div></div>
                    <div><div className="flex justify-between items-end mb-3"><label className="block text-sm font-bold text-gray-700">학생 선택 <span className="text-indigo-600 ml-1 text-xs">({selectedIds.size}/{students.length}명)</span></label><div className="flex gap-2 text-xs"><button onClick={selectAll} className="text-indigo-600 font-bold hover:underline">전체 선택</button><span className="text-gray-300">|</span><button onClick={deselectAll} className="text-gray-500 font-bold hover:underline">전체 해제</button></div></div><div className="grid grid-cols-2 sm:grid-cols-3 gap-2">{students.map((student:any) => (<button key={student.id} onClick={() => toggleStudent(student.id)} className={`px-3 py-2 rounded-lg border text-left text-sm flex items-center gap-2 transition-all ${selectedIds.has(student.id) ? 'border-indigo-500 bg-indigo-50 text-indigo-900 ring-1 ring-indigo-200' : 'border-base-200 bg-white text-gray-500 hover:bg-base-50'}`}><div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${selectedIds.has(student.id) ? 'bg-indigo-500 border-indigo-500' : 'bg-white border-gray-300'}`}>{selectedIds.has(student.id) && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}</div><span className="font-bold truncate">{student.number}번 {student.name.hangul}</span></button>))}</div></div>
                    <p className="text-xs text-gray-500 mt-6 text-center bg-base-50 p-2 rounded">기존에 작성된 내용은 덮어씌워질 수 있습니다.</p>
                </div>
                <div className="p-4 border-t border-base-200 bg-base-50 flex gap-3 shrink-0"><button onClick={onClose} className="flex-1 py-2.5 rounded-lg font-bold text-gray-600 hover:bg-gray-200 transition-colors">취소</button><button onClick={() => onConfirm(sentenceCount, Array.from(selectedIds))} disabled={selectedIds.size === 0} className="flex-1 py-2.5 rounded-lg font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed">생성 시작 (Enter)</button></div>
            </div>
        </div>
    );
};

const SubjectCommentManager = ({ students, assessments, evaluations, settings }: any) => {
    const { showAlert, showConfirm } = useModal();
    const [semester, setSemester] = useState(getCurrentSemester()); 
    const [subject, setSubject] = useState('');
    const [comments, setComments] = useState<Record<string, string>>({});
    const [isBatchGenerating, setIsBatchGenerating] = useState(false);
    const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
    const [progress, setProgress] = useState(0);
    const [totalStudents, setTotalStudents] = useState(0);
    const [currentProcessingName, setCurrentProcessingName] = useState('');

    const availableSubjects = useMemo(() => {
        let filteredAssessments = assessments.filter((a:any) => a.semester === semester && !a.isExcluded);
        return Array.from(new Set(filteredAssessments.map((a:any) => a.subject))).sort(sortSubjects as any);
    }, [assessments, semester]);

    useEffect(() => {
        if (availableSubjects.length > 0 && !availableSubjects.includes(subject)) {
            setSubject(availableSubjects[0] as string);
        } else if (availableSubjects.length === 0) {
            setSubject('');
        }
    }, [availableSubjects]);

    useEffect(() => {
        if (!subject) return;
        const fetchComments = async () => {
            const user = auth.currentUser;
            if (!user) return;
            const snapshot = await firestore.collection('users').doc(user.uid).collection('subjectComments')
                .where('semester', '==', semester)
                .where('subject', '==', subject)
                .get();
            const loadedComments: Record<string, string> = {};
            snapshot.docs.forEach((doc: any) => {
                const data = doc.data();
                if (data && typeof data === 'object') {
                     const typedData = data as { studentId: string; comment: string; schoolYear?: string };
                     if (typedData.schoolYear && typedData.schoolYear !== settings.schoolYear) return;
                     if (typedData.studentId) {
                         loadedComments[String(typedData.studentId)] = typedData.comment;
                     }
                }
            });
            setComments(loadedComments);
        };
        fetchComments();
    }, [settings.schoolYear, semester, subject]);

    const generateCommentForStudent = async (student: Student, count: number): Promise<string> => {
        const relevantAssessments = assessments.filter((a:any) => 
            a.subject === subject && 
            a.semester === semester &&
            !a.isExcluded
        );
        
        if (relevantAssessments.length === 0) {
            return "평가 계획이 없습니다.";
        }

        const studentEvals = relevantAssessments.map((a:any) => {
            const record = evaluations[String(a.id)]?.[String(student.id)];
            let criteriaDetail = '';
            if (record?.level === 'high') criteriaDetail = a.criteria.high;
            else if (record?.level === 'middle') criteriaDetail = a.criteria.middle;
            else if (record?.level === 'low') criteriaDetail = a.criteria.low;
            return {
                element: a.evaluationElement,
                level: record?.level || 'none',
                criteriaDetail
            };
        });
        return await generateSubjectComment(
            student.name.hangul, 
            subject, 
            studentEvals, 
            count,
            settings.geminiApiKey,
            settings.geminiModel
        );
    };

    const handleGenerateSingle = async (student: Student): Promise<string> => {
        if (!subject) return "";
        try {
            const comment = await generateCommentForStudent(student, 2);
            setComments(prev => ({ ...prev, [student.id]: comment }));
            await handleSave(student.id, comment);
            return comment;
        } catch (error) {
            console.error(error);
            await showAlert("생성 중 오류가 발생했습니다.");
            return "";
        }
    };

    const handleBatchGenerate = async (sentenceCount: number, selectedStudentIds: string[]) => {
        setIsBatchModalOpen(false);
        if (!subject) return;
        setIsBatchGenerating(true);
        setProgress(0);
        const studentsToProcess = students.filter((s:any) => selectedStudentIds.includes(s.id));
        setTotalStudents(studentsToProcess.length);
        const newComments = { ...comments };
        try {
             for (let i = 0; i < studentsToProcess.length; i++) {
                 const student = studentsToProcess[i];
                 setCurrentProcessingName(student.name.hangul);
                 try {
                     const comment = await generateCommentForStudent(student, sentenceCount);
                     newComments[String(student.id)] = comment;
                     const user = auth.currentUser;
                     if (user) {
                         const docId = `${student.id}_${subject}_${semester}`;
                         await firestore.collection('users').doc(user.uid).collection('subjectComments').doc(docId).set({
                            studentId: student.id,
                            studentName: student.name.hangul,
                            subject,
                            semester,
                            schoolYear: settings.schoolYear,
                            comment,
                            updatedAt: Date.now()
                         });
                     }
                 } catch (e) {
                     console.error(`Error generating for ${student.name.hangul}`, e);
                 }
                 setProgress(Math.round(((i + 1) / studentsToProcess.length) * 100));
             }
             setComments(newComments);
             await showAlert(`${studentsToProcess.length}명의 AI 생성이 완료되었습니다.\n자동으로 저장되었습니다.`);
        } catch (e) {
            console.error(e);
            await showAlert("일괄 생성 중 오류가 발생했습니다.");
        } finally {
            setIsBatchGenerating(false);
            setProgress(0);
            setCurrentProcessingName('');
        }
    };

    const handleSave = async (studentId: string, comment: string) => {
        const user = auth.currentUser;
        if (!user || !subject) return;
        const student = students.find((s:any) => s.id === studentId);
        if (!student) return;
        try {
            const docId = `${studentId}_${subject}_${semester}`; 
            await firestore.collection('users').doc(user.uid).collection('subjectComments').doc(docId).set({
                studentId,
                studentName: student.name.hangul,
                subject,
                semester,
                schoolYear: settings.schoolYear,
                comment,
                updatedAt: Date.now()
            });
            setComments(prev => ({ ...prev, [studentId]: comment }));
        } catch (error) {
            console.error(error);
            await showAlert("저장 실패");
        }
    };

    const handleDeleteAllComments = async () => {
        const user = auth.currentUser;
        if (!user || !subject) return;
        const confirmMsg = `${settings.schoolYear}학년도 ${semester}학기 [${subject}] 교과의\n모든 학생 세특 내용을 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`;
        if (!(await showConfirm(confirmMsg))) return;
        try {
            const snapshot = await firestore.collection('users').doc(user.uid).collection('subjectComments')
                .where('semester', '==', semester)
                .where('subject', '==', subject)
                .where('schoolYear', '==', settings.schoolYear)
                .get();
            if (snapshot.empty) {
                await showAlert("삭제할 데이터가 없습니다.");
                return;
            }
            const batch = firestore.batch();
            snapshot.docs.forEach((doc: any) => {
                batch.delete(doc.ref);
            });
            await batch.commit();
            setComments({});
            await showAlert("삭제되었습니다.");
        } catch (error) {
            console.error("Error deleting all comments:", error);
            await showAlert("삭제 중 오류가 발생했습니다.");
        }
    };

    return (
        <div className="h-full flex flex-col md:flex-row p-4 gap-4 overflow-hidden pb-20 lg:pb-0">
             <div className="md:w-40 lg:w-48 flex-shrink-0 flex md:flex-col gap-2 overflow-x-auto md:overflow-y-auto custom-scrollbar p-2 bg-base-50 rounded-xl border border-base-300 md:h-full">
                <div className="flex md:flex-col gap-2 shrink-0">
                    <div className="bg-white rounded-lg p-1 border border-base-300 shadow-sm flex md:flex-col shrink-0">
                        {['1', '2'].map((sem) => (
                            <button key={sem} onClick={() => setSemester(sem)} className={`px-3 py-2 rounded-md text-xs font-bold transition-all ${semester === sem ? 'bg-primary text-primary-content shadow-sm' : 'text-base-content-secondary hover:bg-base-50'}`}>{sem}학기</button>
                        ))}
                    </div>
                    <div className="hidden md:block w-full h-px bg-gray-200 my-1"></div>
                    {availableSubjects.map((s:any) => (
                        <button key={s} onClick={() => setSubject(s)} className={`px-3 py-2 rounded-lg text-sm font-bold text-left transition-all border ${subject === s ? `${getSubjectColor(s, true)} ring-2 ring-offset-1 ring-current shadow-md` : `bg-white text-gray-600 border-transparent hover:bg-gray-100 hover:border-gray-200`}`}>{s}</button>
                    ))}
                    {availableSubjects.length === 0 && <div className="text-xs text-gray-400 text-center py-4">교과 없음</div>}
                </div>
             </div>
             <div className="flex-1 flex flex-col min-h-0 bg-white rounded-xl border border-base-300 shadow-sm overflow-hidden relative">
                 <div className="p-4 border-b border-base-200 flex justify-between items-center bg-base-50/50">
                    <h3 className="font-bold text-lg text-base-content flex items-center gap-2">{subject ? <span className={`px-2 py-0.5 rounded text-sm ${getSubjectColor(subject)}`}>{subject}</span> : '교과 선택'} <span className="text-gray-400 text-sm font-medium">세부능력 및 특기사항</span></h3>
                    {subject && (
                        <div className="flex gap-2">
                            <button onClick={handleDeleteAllComments} disabled={isBatchGenerating} className="bg-white text-red-500 border border-red-200 px-3 py-2 rounded-lg text-sm font-bold hover:bg-red-50 transition-all flex items-center gap-1 shadow-sm" title="전체 삭제">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                <span className="hidden sm:inline">전체 삭제</span>
                            </button>
                            <button onClick={() => setIsBatchModalOpen(true)} disabled={isBatchGenerating} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-indigo-700 shadow-md transition-all flex items-center gap-2 disabled:opacity-50">{isBatchGenerating ? <span className="loading loading-spinner loading-sm"></span> : '해당 교과 AI 생성'}</button>
                        </div>
                    )}
                 </div>
                 {isBatchGenerating && (
                     <div className="absolute inset-0 bg-white/90 z-20 flex flex-col items-center justify-center backdrop-blur-sm">
                         <div className="w-64"><div className="flex justify-between items-end mb-2"><span className="text-indigo-800 font-bold text-lg animate-pulse">{progress < 100 ? '세특 생성 중...' : '마무리 중...'}</span><span className="text-indigo-600 font-bold text-sm">{progress}%</span></div><div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden shadow-inner"><div className="bg-indigo-600 h-4 rounded-full transition-all duration-300 ease-out" style={{ width: `${progress}%` }}></div></div><p className="text-indigo-500 text-xs mt-3 text-center font-medium">{currentProcessingName ? `${currentProcessingName} 학생의 기록을 분석하고 있습니다.` : '잠시만 기다려주세요.'}</p></div>
                     </div>
                 )}
                 {/* iPad Fix: Added pb-40 */}
                 <div className="flex-1 overflow-y-auto custom-scrollbar p-4 bg-base-50/30 pb-40">
                    {subject ? (
                        students.map((student:any) => (
                            <StudentCommentCard key={student.id} student={student} initialComment={comments[student.id] || ''} onSave={handleSave} onGenerate={handleGenerateSingle} />
                        ))
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-2"><span className="text-4xl">👈</span><p>왼쪽에서 교과를 선택해주세요.</p></div>
                    )}
                 </div>
             </div>
             {isBatchModalOpen && <SeteukBatchModal students={students} subject={subject} semester={semester} onConfirm={handleBatchGenerate} onClose={() => setIsBatchModalOpen(false)} />}
        </div>
    );
}

const EvaluationManager = ({ students, settings }: EvaluationManagerProps): React.ReactElement => {
  const { showAlert, showConfirm } = useModal();
  const [activeTab, setActiveTab] = useState<Tab>('entry');
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [evaluations, setEvaluations] = useState<Record<string, Record<string, EvaluationRecord>>>({});
  const [loading, setLoading] = useState(true);

  // Fetch data
  useEffect(() => {
    const fetchData = async () => {
      const user = auth.currentUser;
      if (!user) return;
      setLoading(true);
      try {
        const assessSnap = await firestore.collection('users').doc(user.uid).collection('assessments').get();
        const loadedAssessments = assessSnap.docs
            .map((doc: any) => ({ id: doc.id, ...doc.data() } as Assessment))
            .filter((a: any) => !a.schoolYear || a.schoolYear === settings.schoolYear);

        setAssessments(loadedAssessments);

        const evalSnap = await firestore.collection('users').doc(user.uid).collection('evaluations').get();
            
        const loadedEvaluations: Record<string, Record<string, EvaluationRecord>> = {};
        evalSnap.docs.forEach((doc: any) => {
            const data = doc.data() as EvaluationRecord;
            // @ts-ignore
            if (data.schoolYear && data.schoolYear !== settings.schoolYear) return;

            if (!loadedEvaluations[data.assessmentId]) {
                loadedEvaluations[data.assessmentId] = {};
            }
            loadedEvaluations[data.assessmentId][data.studentId] = data;
        });
        setEvaluations(loadedEvaluations);

      } catch (error) {
        console.error("Error fetching evaluation data:", error);
        await showAlert("데이터를 불러오는 중 오류가 발생했습니다.");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [settings.schoolYear]);

  // Handlers
  const handleAddAssessment = async (data: any) => {
      const user = auth.currentUser;
      if (!user) return;
      const docRef = await firestore.collection('users').doc(user.uid).collection('assessments').add(data);
      setAssessments(prev => [...prev, { ...data, id: docRef.id }]);
  };

  const handleUpdateAssessment = async (id: string, data: any) => {
      const user = auth.currentUser;
      if (!user) return;
      await firestore.collection('users').doc(user.uid).collection('assessments').doc(id).update(data);
      setAssessments(prev => prev.map(a => a.id === id ? { ...a, ...data } : a));
  };

  const handleDeleteAssessment = async (id: string) => {
      const user = auth.currentUser;
      if (!user) return;
      if (await showConfirm("이 평가 계획을 삭제하시겠습니까?\n입력된 학생들의 평가 결과도 함께 삭제됩니다.")) {
          await firestore.collection('users').doc(user.uid).collection('assessments').doc(id).delete();
          setAssessments(prev => prev.filter(a => a.id !== id));
          
          const evalSnap = await firestore.collection('users').doc(user.uid).collection('evaluations').where('assessmentId', '==', id).get();
          const batch = firestore.batch();
          evalSnap.docs.forEach((doc: any) => batch.delete(doc.ref));
          await batch.commit();

          setEvaluations(prev => {
              const next = { ...prev };
              delete next[id];
              return next;
          });
      }
  };

  const handleDeleteSemester = async (semester: string) => {
      const user = auth.currentUser;
      if (!user) return;
      if (await showConfirm(`${semester}학기 평가 계획을 모두 초기화하시겠습니까?`)) {
          const targetIds = assessments.filter(a => a.semester === semester).map(a => a.id);
          const batch = firestore.batch();
          
          targetIds.forEach(id => {
              const ref = firestore.collection('users').doc(user.uid).collection('assessments').doc(id);
              batch.delete(ref);
          });
          
          await batch.commit();
          setAssessments(prev => prev.filter(a => a.semester !== semester));
          await showAlert("초기화되었습니다.");
      }
  };

  const handleSaveEvaluations = async (assessmentId: string, updates: { studentId: string, level: EvaluationLevel }[]) => {
      const user = auth.currentUser;
      if (!user) return;

      const batch = firestore.batch();
      const newEvalsForAssessment = { ...(evaluations[assessmentId] || {}) };

      updates.forEach(({ studentId, level }) => {
          const existing = newEvalsForAssessment[studentId];
          const docId = existing ? existing.id : `${assessmentId}_${studentId}`;
          
          if (level === 'none') {
               // Delete/Clear if it exists
               if (existing) {
                    const ref = firestore.collection('users').doc(user.uid).collection('evaluations').doc(existing.id);
                    batch.delete(ref);
                    delete newEvalsForAssessment[studentId];
               }
          } else {
              const evalData: EvaluationRecord = {
                  id: docId,
                  assessmentId,
                  studentId,
                  level,
                  schoolYear: settings.schoolYear || '',
                  updatedAt: Date.now()
              };
              const ref = firestore.collection('users').doc(user.uid).collection('evaluations').doc(docId);
              batch.set(ref, evalData);
              newEvalsForAssessment[studentId] = evalData;
          }
      });
      
      try {
          await batch.commit();
          setEvaluations(prev => ({
              ...prev,
              [assessmentId]: newEvalsForAssessment
          }));
          await showAlert("저장되었습니다.");
      } catch (e) {
          console.error(e);
          await showAlert("저장 중 오류가 발생했습니다.");
      }
  };

  return (
    <div className="h-full bg-base-100 rounded-xl shadow-lg border border-base-300/60 flex flex-col overflow-hidden min-h-0">
        <div className="p-1 sm:p-2 border-b border-base-300 flex justify-between items-center bg-base-50/50 shrink-0 overflow-x-auto">
             <div className="flex bg-white rounded-lg p-1 border border-base-300 shadow-sm shrink-0">
                <button onClick={() => setActiveTab('entry')} className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all whitespace-nowrap ${activeTab === 'entry' ? 'bg-primary text-primary-content shadow-sm' : 'text-base-content-secondary hover:bg-base-50'}`}>평가 입력</button>
                <button onClick={() => setActiveTab('missing')} className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all whitespace-nowrap ${activeTab === 'missing' ? 'bg-primary text-primary-content shadow-sm' : 'text-base-content-secondary hover:bg-base-50'}`}>미입력 현황</button>
                <button onClick={() => setActiveTab('seteuk')} className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all whitespace-nowrap ${activeTab === 'seteuk' ? 'bg-primary text-primary-content shadow-sm' : 'text-base-content-secondary hover:bg-base-50'}`}>세특 관리</button>
                <button onClick={() => setActiveTab('setup')} className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all whitespace-nowrap ${activeTab === 'setup' ? 'bg-primary text-primary-content shadow-sm' : 'text-base-content-secondary hover:bg-base-50'}`}>평가 계획 설정</button>
            </div>
        </div>

        <div className="flex-1 overflow-hidden min-h-0 relative">
             {loading ? (
                 <div className="absolute inset-0 flex items-center justify-center bg-base-100/50 backdrop-blur-sm z-10">
                    <svg className="animate-spin h-8 w-8 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                 </div>
            ) : null}
            
            {activeTab === 'setup' && (
                <AssessmentSetup 
                    assessments={assessments} 
                    onAdd={handleAddAssessment} 
                    onUpdate={handleUpdateAssessment} 
                    onDelete={handleDeleteAssessment} 
                    onDeleteSemester={handleDeleteSemester}
                    schoolYear={settings.schoolYear || ''}
                    settings={settings}
                />
            )}
            {activeTab === 'entry' && (
                <EvaluationEntry 
                    students={students} 
                    assessments={assessments} 
                    evaluations={evaluations}
                    onSave={handleSaveEvaluations}
                />
            )}
            {activeTab === 'missing' && (
                <MissingEvaluationView 
                    students={students} 
                    assessments={assessments} 
                    evaluations={evaluations}
                    onNavigateToEntry={(id) => setActiveTab('entry')}
                />
            )}
            {activeTab === 'seteuk' && (
                <SubjectCommentManager 
                    students={students} 
                    assessments={assessments} 
                    evaluations={evaluations} 
                    settings={settings}
                />
            )}
        </div>
    </div>
  );
};

export default EvaluationManager;
