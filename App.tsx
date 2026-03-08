
import React, { useState, useRef, useEffect } from 'react';
import { auth, firestore } from './firebase'; 
import { Student, BehaviorRecord } from './types';
import Dashboard from './components/Dashboard';
import StudentForm from './components/StudentForm';
import { extractStudentInfoFromFile } from './services/geminiService';
import SettingsModal from './components/SettingsModal';
import Login from './components/Login';
import GrowthLogo from './components/GrowthLogo';
import { useModal } from './context/ModalContext';
import NoticeBoard from './components/NoticeBoard';

type View = 'dashboard' | 'form' | 'notice';

// *** 업데이트된 Firebase Storage HWP 파일 다운로드 주소 ***
const TEMPLATE_FILE_URL = 'https://firebasestorage.googleapis.com/v0/b/forstudents-e1117.firebasestorage.app/o/forms%2FSample%20form.hwp?alt=media&token=7b598032-bd15-45a8-8106-03129ff7a90b';

export interface AppSettings {
  school: string;
  grade: string;
  class: string;
  schoolYear?: string;
  atptOfcdcScCode?: string;
  sdSchulCode?: string;
  geminiApiKey?: string;
  geminiModel?: string;
}

const App = (): React.ReactElement => {
  const { showAlert, showConfirm } = useModal();
  const [view, setView] = useState<View>('dashboard');
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  
  const [user, setUser] = useState<any | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [isInitialSetupRequired, setIsInitialSetupRequired] = useState(false);

  const [settings, setSettings] = useState<AppSettings>({ 
      school: '', grade: '', class: '', schoolYear: '', 
      geminiApiKey: '', geminiModel: 'gemini-2.5-flash' 
  });

  useEffect(() => {
    document.title = '학급 성장 기록장';

    const favicon = document.createElement('link');
    favicon.rel = 'icon';
    favicon.href = "data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🌱</text></svg>";
    document.head.appendChild(favicon);
  }, []);

  const fetchStudents = async (uid: string, schoolYear: string) => {
      try {
          const snapshot = await firestore.collection('users').doc(uid).collection('students').orderBy('name.hangul').get();
          const allStudents = snapshot.docs.map((doc: any) => ({
            id: doc.id,
            ...doc.data()
          })) as Student[];
          
          const filtered = allStudents.filter(s => {
              // 기존 데이터에 schoolYear가 없는 경우 2025년도로 간주
              const studentYear = s.schoolYear || "2025";
              return studentYear === schoolYear;
          });

          setStudents(filtered);
      } catch (error) {
          console.error("Error fetching students:", error);
      }
  };

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user: any) => {
      setUser(user);
      setAuthLoading(false);

      if (user) {
        setIsDataLoading(true);
        try {
          const settingsRef = firestore.collection('users').doc(user.uid).collection('appData').doc('settings');
          const settingsDoc = await settingsRef.get();
          
          const today = new Date();
          const currentMonth = today.getMonth() + 1;
          const currentYear = today.getFullYear();
          const defaultSchoolYear = currentMonth >= 3 ? String(currentYear) : String(currentYear - 1);

          let newSettings: AppSettings;

          if (settingsDoc.exists) {
              const loadedSettings = settingsDoc.data() as AppSettings;
              newSettings = {
                  ...loadedSettings,
                  schoolYear: loadedSettings.schoolYear || defaultSchoolYear,
                  geminiModel: loadedSettings.geminiModel || 'gemini-2.5-flash'
              };
          } else {
              newSettings = { school: '', grade: '', class: '', schoolYear: defaultSchoolYear, geminiApiKey: '', geminiModel: 'gemini-2.5-flash' };
          }
          
          setSettings(newSettings);

          if (newSettings.school && newSettings.grade && newSettings.class) {
             setIsInitialSetupRequired(false);
          } else {
             setIsInitialSetupRequired(true);
             setIsSettingsModalOpen(true);
          }

          await fetchStudents(user.uid, newSettings.schoolYear || defaultSchoolYear);

        } catch (error) {
          console.error("Error fetching data from Firestore:", error);
        } finally {
          setIsDataLoading(false);
        }
      } else {
        setStudents([]);
        setSettings({ school: '', grade: '', class: '', schoolYear: '', geminiApiKey: '', geminiModel: 'gemini-2.5-flash' });
        setIsInitialSetupRequired(false);
        setIsDataLoading(false);
      }
    });
    return unsubscribe;
  }, []);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAddStudent = async (newStudent: Omit<Student, 'id'>) => {
    if (!user) {
        await showAlert("학생 정보를 저장하려면 로그인이 필요합니다.");
        return;
    }
    setIsLoading(true);
    try {
        const studentWithYear = {
            ...newStudent,
            schoolYear: settings.schoolYear || new Date().getFullYear().toString()
        };

        const docRef = await firestore.collection('users').doc(user.uid).collection('students').add(studentWithYear);
        setStudents(prev => [...prev, { ...studentWithYear, id: docRef.id }]);
        setView('dashboard');
        setEditingStudent(null);
    } catch (error) {
        console.error("Error adding student:", error);
        await showAlert("학생 정보 저장 중 오류가 발생했습니다.");
    } finally {
        setIsLoading(false);
    }
  };

  const handleUpdateStudent = async (updatedStudent: Student) => {
    if (!user) {
        await showAlert("학생 정보를 수정하려면 로그인이 필요합니다.");
        return;
    }
    try {
        const { id, ...studentData } = updatedStudent;
        await firestore.collection('users').doc(user.uid).collection('students').doc(id).set(studentData);

        setStudents(prev => prev.map(s => s.id === updatedStudent.id ? updatedStudent : s));
        if(selectedStudent?.id === updatedStudent.id) {
            setSelectedStudent(updatedStudent);
        }
        setView('dashboard');
        setEditingStudent(null);
    } catch (error) {
        console.error("Error updating student:", error);
        await showAlert("학생 정보 수정 중 오류가 발생했습니다.");
    }
  };

  const handleDeleteStudent = async (studentId: string) => {
    if (!user) return;
    
    const confirmMessage = "정말 이 학생 정보를 삭제하시겠습니까?\n삭제된 데이터(행동발달, 출결 등)는 복구할 수 없습니다.";
    const isConfirmed = await showConfirm(confirmMessage, "학생 삭제", "삭제하기");

    if (isConfirmed) {
      setIsLoading(true);
      try {
        await firestore.collection('users').doc(user.uid).collection('students').doc(studentId).delete();
        
        setStudents(prev => prev.filter(s => s.id !== studentId));
        if (selectedStudent?.id === studentId) {
          setSelectedStudent(null);
        }
        setEditingStudent(null);
        setView('dashboard');
        await showAlert("학생 정보가 삭제되었습니다.");
      } catch (error) {
        console.error("Error deleting student:", error);
        await showAlert("학생 정보 삭제 중 오류가 발생했습니다.");
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleAddBehaviorRecord = async (studentId: string, record: Omit<BehaviorRecord, 'id'>) => {
      if (!user) return;
      
      try {
          const studentRef = firestore.collection('users').doc(user.uid).collection('students').doc(studentId);
          const newRecordId = Math.random().toString(36).substr(2, 9);
          const fullRecord = { ...record, id: newRecordId };
          
          const studentToUpdate = students.find(s => s.id === studentId);
          if(studentToUpdate) {
               const newRecords = [...(studentToUpdate.behaviorRecords || []), fullRecord];
               await studentRef.update({ behaviorRecords: newRecords });
               
               const updatedStudents = students.map(s => s.id === studentId ? { ...s, behaviorRecords: newRecords } : s);
               setStudents(updatedStudents);
               if(selectedStudent?.id === studentId) {
                   setSelectedStudent(prev => prev ? { ...prev, behaviorRecords: newRecords } : null);
               }
          }
      } catch(error) {
          console.error("Error adding behavior record:", error);
          await showAlert("기록 저장 중 오류가 발생했습니다.");
      }
  };

  const handleDeleteBehaviorRecord = async (studentId: string, recordId: string) => {
      if(!user) return;
      try {
           const studentRef = firestore.collection('users').doc(user.uid).collection('students').doc(studentId);
           const studentToUpdate = students.find(s => s.id === studentId);
           if(studentToUpdate) {
               const newRecords = (studentToUpdate.behaviorRecords || []).filter(r => r.id !== recordId);
               await studentRef.update({ behaviorRecords: newRecords });

               const updatedStudents = students.map(s => s.id === studentId ? { ...s, behaviorRecords: newRecords } : s);
               setStudents(updatedStudents);
               if(selectedStudent?.id === studentId) {
                   setSelectedStudent(prev => prev ? { ...prev, behaviorRecords: newRecords } : null);
               }
           }
      } catch (error) {
          console.error("Error deleting behavior record:", error);
          await showAlert("삭제 중 오류가 발생했습니다.");
      }
  };

  const handleShowForm = (student?: Student) => {
    setEditingStudent(student || null);
    setView('form');
  };
  
  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleDownloadTemplate = async (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    try {
        // 1. URL에서 원본 파일명 추출 (예: Sample form.hwp)
        let filename = '기초조사서_양식.hwp';
        try {
            const urlObj = new URL(TEMPLATE_FILE_URL);
            // pathname에서 마지막 슬래시 이후의 값 추출 후 디코딩
            const decodedPath = decodeURIComponent(urlObj.pathname);
            const extracted = decodedPath.split('/').pop();
            if (extracted) {
                // Firebase Storage는 폴더 구조를 위해 'forms/file.hwp' 처럼 파일명 앞에 경로가 붙을 수 있음
                // 하지만 우리는 '기초조사서_양식.hwp'로 고정해서 저장하는 것이 사용자에게 더 친숙함
                // filename = extracted.split('%2F').pop() || extracted;
            }
        } catch (err) {
            console.warn("Filename extraction failed, using default.");
        }

        // 2. Fetch를 통해 파일을 blob으로 가져옴 (CORS 설정 필수)
        const response = await fetch(TEMPLATE_FILE_URL);
        if (!response.ok) throw new Error('Download failed: ' + response.statusText);
        
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename; // 지정한 파일명으로 저장
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
    } catch (error) {
        console.error("Direct download failed:", error);
        // Fallback: CORS 이슈 등으로 fetch가 막히면 직접 링크로 이동 (브라우저가 다운로드 처리)
        const link = document.createElement('a');
        link.href = TEMPLATE_FILE_URL;
        link.download = '기초조사서_양식.hwp'; // cross-origin에서는 동작하지 않을 수 있지만 시도
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;
  
    setIsLoading(true);
    try {
      const extractedDataArray = await extractStudentInfoFromFile(file, settings.geminiApiKey, settings.geminiModel);
  
      if (!Array.isArray(extractedDataArray) || extractedDataArray.length === 0) {
        await showAlert("AI가 문서에서 학생 정보를 추출하지 못했습니다. 다른 파일을 시도해 주세요.");
        return;
      }
      
      const existingNames = new Set(students.map(s => s.name.hangul));
      const newStudentsData = [];
      const skippedStudentNames = [];
  
      for (const studentData of extractedDataArray) {
        const studentName = studentData.name?.hangul?.trim();
        if (studentName && !existingNames.has(studentName)) {
          newStudentsData.push({
              ...studentData,
              schoolYear: settings.schoolYear || new Date().getFullYear().toString()
          });
          existingNames.add(studentName);
        } else if (studentName) {
          skippedStudentNames.push(studentName);
        }
      }
  
      if (newStudentsData.length > 0) {
        const addedStudents = [];
        for (const newStudent of newStudentsData) {
          const docRef = await firestore.collection('users').doc(user.uid).collection('students').add(newStudent);
          addedStudents.push({ ...newStudent, id: docRef.id });
        }
        setStudents(prev => [...prev, ...addedStudents].sort((a, b) => a.name.hangul.localeCompare(b.name.hangul)));
      }
      
      let summaryMessage = '';
      if (newStudentsData.length > 0) {
        summaryMessage += `${newStudentsData.length}명의 학생 정보를 성공적으로 추가했습니다.\n`;
      }
      if (skippedStudentNames.length > 0) {
        summaryMessage += `${skippedStudentNames.length}명의 학생(${skippedStudentNames.join(', ')})은 이름이 중복되어 건너뛰었습니다.`;
      }
      
      if (summaryMessage) {
        await showAlert(summaryMessage.trim());
      } else {
        await showAlert("새로 추가할 학생 정보가 없거나, 파일의 모든 학생이 이미 등록되어 있습니다.");
      }
  
    } catch (error: any) {
      console.error("Failed to extract or save student info:", error);
      await showAlert(error.message || "문서 처리 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
      if(fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleSaveSettings = async (newSettings: AppSettings) => {
    if (!user) {
        await showAlert("설정을 저장하려면 로그인이 필요합니다.");
        return;
    }
    try {
        const settingsRef = firestore.collection('users').doc(user.uid).collection('appData').doc('settings');
        await settingsRef.set(newSettings, { merge: true });
        
        setSettings(newSettings);
        
        if (newSettings.schoolYear !== settings.schoolYear) {
            await fetchStudents(user.uid, newSettings.schoolYear || '');
            setSelectedStudent(null);
            setView('dashboard');
        }

        if (isInitialSetupRequired) {
            setIsInitialSetupRequired(false);
        }
        setIsSettingsModalOpen(false);
    } catch (error) {
        console.error("Error saving settings to Firestore:", error);
        await showAlert("설정 저장 중 오류가 발생했습니다.");
    }
  }
  
  const handleLogout = () => {
    auth.signOut();
  }

  // Fix for line 549 error: Cannot find name 'onSelectStudent'
  const onSelectStudent = (student: Student) => {
    setSelectedStudent(student);
  };

  if (authLoading) {
    return (
      <div className="h-screen bg-neutral flex items-center justify-center">
        <svg className="animate-spin h-10 w-10 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }
  
  if (isDataLoading) {
    return (
      <div className="h-screen bg-neutral flex items-center justify-center">
        <svg className="animate-spin h-10 w-10 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      </div>
    );
  }

  return (
    <div className="bg-neutral h-[100dvh] flex flex-col text-base-content font-sans overflow-hidden">
      {isLoading && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex flex-col items-center justify-center z-[9999]">
          <svg className="animate-spin h-12 w-12 text-white mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <h2 className="text-white text-xl font-semibold">AI가 작업 중입니다...</h2>
          <p className="text-white/80 mt-2">잠시만 기다려 주세요.</p>
        </div>
      )}
       {isSettingsModalOpen && (
        <SettingsModal 
          currentSettings={settings}
          onSave={handleSaveSettings}
          onClose={() => setIsSettingsModalOpen(false)}
          isInitialSetup={isInitialSetupRequired}
        />
      )}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        accept="image/*,application/pdf"
      />
      <header className="bg-base-100 shadow-md z-20 border-b border-base-300/70 shrink-0">
        <div className="w-full px-2 sm:px-6 lg:px-8 xl:px-12">
          <div className="flex justify-between items-center py-2 sm:py-3">
            <div className="flex items-center space-x-2 sm:space-x-3 truncate">
              <button onClick={() => setView('dashboard')} className="flex items-center space-x-2 sm:space-x-3 focus:outline-none">
                  <GrowthLogo variant="header" />
                  <div className="flex flex-col sm:flex-row sm:items-baseline sm:gap-2 truncate text-left">
                     <h1 className="text-lg sm:text-2xl font-bold text-base-content tracking-tight truncate flex items-center gap-1.5">
                        {settings.school && settings.grade && settings.class ? (
                            <>
                            <span className="truncate max-w-[100px] xs:max-w-[120px] sm:max-w-none">{settings.school}</span> <span className="text-primary whitespace-nowrap text-sm sm:text-lg">{settings.grade}학년 {settings.class}반</span>
                            </>
                        ) : (
                            <>
                            <span className="truncate max-w-[100px] xs:max-w-[120px] sm:max-w-none">새싹 초등학교</span> <span className="text-primary whitespace-nowrap text-sm sm:text-lg">1학년 1반</span>
                            </>
                        )}
                     </h1>
                     {settings.schoolYear && (
                        <span className="text-[10px] sm:text-xs font-bold text-base-content-secondary bg-base-200 px-1.5 py-0.5 rounded-full border border-base-300 hidden sm:inline-block">
                            {settings.schoolYear}학년도
                        </span>
                     )}
                  </div>
              </button>
            </div>
            
            {(view === 'dashboard' || view === 'notice') && (
              <div className="flex items-center gap-1 sm:gap-3 shrink-0">
                {view === 'dashboard' && (
                    <a
                      href={TEMPLATE_FILE_URL}
                      onClick={handleDownloadTemplate}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hidden lg:flex bg-green-50 text-green-700 border border-green-200 font-semibold py-1.5 px-3 rounded-lg hover:bg-green-100 focus:outline-none transition-colors duration-200 items-center space-x-2 text-sm"
                      title="학생 기초 조사서 양식 다운로드"
                    >
                       <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                      <span>양식 내려받기</span>
                    </a>
                )}

                {view === 'dashboard' && (
                    <button
                      onClick={handleImportClick}
                      title={'파일에서 학생 정보 가져오기'}
                      className="bg-base-200 text-base-content-secondary font-semibold py-1.5 px-3 rounded-lg hover:bg-base-300 focus:outline-none transition-colors duration-200 flex items-center space-x-2 text-sm hidden sm:flex"
                    >
                       <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
                      </svg>
                      <span className="hidden sm:inline">가져오기</span>
                    </button>
                )}

                {view === 'dashboard' && (
                    <button
                      onClick={() => handleShowForm()}
                      className="bg-primary text-primary-content font-bold py-1.5 px-3 rounded-lg shadow-sm hover:shadow-md hover:bg-primary-focus focus:outline-none transition-all duration-200 flex items-center space-x-2 text-xs sm:text-sm whitespace-nowrap justify-center"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 sm:h-4 sm:w-4" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                      </svg>
                      <span className="hidden sm:inline">학생 추가</span>
                    </button>
                )}

                <button
                  onClick={() => setView('notice')}
                  className={`py-1.5 px-3 rounded-lg font-bold text-sm transition-all duration-200 shadow-sm ${
                      view === 'notice' 
                      ? 'bg-yellow-500 text-white ring-2 ring-yellow-300' 
                      : 'bg-yellow-400 text-white hover:bg-yellow-500'
                  }`}
                >
                  <span className="hidden sm:inline">공지사항</span>
                  <span className="sm:hidden">공지</span>
                </button>

                 <div className="flex items-center gap-1 sm:gap-2 pl-2 sm:pl-3 ml-2 sm:ml-3 border-l border-base-300">
                    <button
                        onClick={() => setIsSettingsModalOpen(true)}
                        className="bg-transparent text-base-content-secondary p-1.5 rounded-full hover:bg-base-200 focus:outline-none transition-colors"
                        title="설정">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                           <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                           <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      </button>
                    <div className="text-right hidden md:block">
                        <p className="text-sm font-bold text-base-content leading-tight truncate max-w-[120px]" title={user.displayName}>{user.displayName}</p>
                        <p className="text-xs text-base-content-secondary leading-tight truncate max-w-[120px]" title={user.email}>{user.email}</p>
                    </div>
                     <button
                        onClick={handleLogout}
                        className="bg-transparent text-base-content-secondary p-1.5 rounded-full hover:bg-red-100 hover:text-red-500 focus:outline-none transition-colors"
                        title="로그아웃">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                           <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clipRule="evenodd" />
                        </svg>
                      </button>
                 </div>
              </div>
            )}
            {view === 'form' && (
              <button
                onClick={() => { setView('dashboard'); setEditingStudent(null); }}
                className="bg-base-200 text-base-content-secondary font-semibold py-2 px-4 rounded-lg hover:bg-base-300 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-75 transition-colors duration-200 flex items-center space-x-2 text-sm"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.707-10.293a1 1 0 00-1.414-1.414L7 8.586 5.707 7.293a1 1 0 00-1.414 1.414L5.586 10l-1.293 1.293a1 1 0 101.414 1.414L7 11.414l1.293 1.293a1 1 0 001.414-1.414L8.414 10l1.293-1.293z" clipRule="evenodd" />
                </svg>
                <span className="hidden sm:inline">취소</span>
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 w-full px-2 sm:px-4 lg:px-8 xl:px-12 py-2 sm:py-4 overflow-hidden min-h-0 mx-auto transition-all">
        {view === 'dashboard' ? (
          <Dashboard 
            students={students} 
            selectedStudent={selectedStudent} 
            onSelectStudent={onSelectStudent} 
            onEditStudent={handleShowForm}
            onDeleteStudent={handleDeleteStudent}
            onAddBehaviorRecord={handleAddBehaviorRecord}
            onDeleteBehaviorRecord={handleDeleteBehaviorRecord}
            onUpdateStudent={handleUpdateStudent}
            settings={settings}
            />
        ) : view === 'notice' ? (
            <NoticeBoard user={user} />
        ) : (
            <div className="h-full overflow-y-auto custom-scrollbar pb-24">
                <StudentForm 
                    onSubmit={editingStudent && 'id' in editingStudent ? handleUpdateStudent : handleAddStudent} 
                    onCancel={() => { setView('dashboard'); setEditingStudent(null); }}
                    onDelete={handleDeleteStudent}
                    studentToEdit={editingStudent}
                    settings={settings}
                />
          </div>
        )}
      </main>
      <footer className="fixed bottom-4 right-6 text-xs text-base-content-secondary/80 bg-base-100/50 backdrop-blur-sm py-1 px-3 rounded-full z-50 shadow-sm border border-base-300/30">
        제작자: 푸른달 선생님
      </footer>
    </div>
  );
};

export default App;
