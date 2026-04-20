
import React, { useEffect } from 'react';
import { Student } from './types';
import Dashboard from './components/Dashboard';
import StudentForm from './components/StudentForm';
import SettingsModal from './components/SettingsModal';
import Login from './components/Login';
import GrowthLogo from './components/GrowthLogo';
import NoticeBoard from './components/NoticeBoard';
import { useAppLogic, View } from './hooks/useAppLogic';

export interface SchoolYearEntry {
  schoolYear: string;
  grade: string;
  class: string;
  active: boolean;
}

export interface AppSettings {
  school: string;
  grade: string;
  class: string;
  schoolYear?: string;
  /** 학년도·학반 목록. 활성(active: true)인 한 개만 실제 운영에 사용됨. */
  schoolYearEntries?: SchoolYearEntry[];
  atptOfcdcScCode?: string;
  sdSchulCode?: string;
  geminiApiKey?: string;
  geminiModel?: string;
}

const App = (): React.ReactElement => {
  const {
    user,
    authLoading,
    isDataLoading,
    isLoading,
    view,
    setView,
    students,
    selectedStudent,
    onSelectStudent,
    editingStudent,
    setEditingStudent,
    settings,
    isSettingsModalOpen,
    setIsSettingsModalOpen,
    isInitialSetupRequired,
    fileInputRef,
    handleShowForm,
    handleImportClick,
    handleDownloadTemplate,
    handleFileChange,
    handleAddStudent,
    handleUpdateStudent,
    handleDeleteStudent,
    handleAddBehaviorRecord,
    handleDeleteBehaviorRecord,
    handleSaveSettings,
    handleLogout,
    schoolYearsFromData
  } = useAppLogic();

  useEffect(() => {
    document.title = '학급 성장 기록장';

    const favicon = document.createElement('link');
    favicon.rel = 'icon';
    favicon.href = "data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🌱</text></svg>";
    document.head.appendChild(favicon);
  }, []);

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
          schoolYearsFromData={schoolYearsFromData}
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
        <div className="w-full px-1 sm:px-4 lg:px-6">
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
                  <button
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
                  </button>
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
                  className={`py-1.5 px-3 rounded-lg font-bold text-sm transition-all duration-200 shadow-sm ${view === 'notice'
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

      <main className="flex-1 w-full min-h-0 overflow-hidden px-1 py-2 transition-all sm:px-4 sm:py-4 lg:px-6 pb-16 sm:pb-4">
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
      <footer className="pointer-events-none fixed bottom-[max(0.75rem,env(safe-area-inset-bottom,0px))] right-3 z-30 text-[10px] text-base-content-secondary/90 sm:bottom-4 sm:right-6 sm:z-50 sm:text-xs">
        <span className="pointer-events-auto rounded-full border border-base-300/40 bg-base-100/90 px-2 py-1 shadow-sm backdrop-blur-sm sm:px-3">
          제작자: 푸른달 선생님
        </span>
      </footer>
    </div>
  );
};

export default App;
