
import React, { useState, useEffect } from 'react';
import { AppSettings } from '../App';
import { searchSchool, School } from '../services/neisService';

interface SettingsModalProps {
  currentSettings: AppSettings;
  onSave: (settings: AppSettings) => void;
  onClose: () => void;
  isInitialSetup?: boolean;
}

const EDUCATION_OFFICES = [
  { name: '교육청 선택', code: '' },
  { name: '서울특별시교육청', code: 'B10' },
  { name: '부산광역시교육청', code: 'C10' },
  { name: '대구광역시교육청', code: 'D10' },
  { name: '인천광역시교육청', code: 'E10' },
  { name: '광주광역시교육청', code: 'F10' },
  { name: '대전광역시교육청', code: 'G10' },
  { name: '울산광역시교육청', code: 'H10' },
  { name: '세종특별자치시교육청', code: 'I10' },
  { name: '경기도교육청', code: 'J10' },
  { name: '강원특별자치도교육청', code: 'K10' },
  { name: '충청북도교육청', code: 'M10' },
  { name: '충청남도교육청', code: 'N10' },
  { name: '전북특별자치도교육청', code: 'P10' },
  { name: '전라남도교육청', code: 'Q10' },
  { name: '경상북도교육청', code: 'R10' },
  { name: '경상남도교육청', code: 'S10' },
  { name: '제주특별자치도교육청', code: 'T10' }
];

const GEMINI_MODELS = [
  { value: 'gemini-2.5-flash', label: '2.5 Flash (기본 - 빠르고 경제적)' },
  { value: 'gemini-3-flash-preview', label: '3.0 Flash Preview (최신 - 더 똑똑함)' },
  { value: 'gemini-2.5-pro', label: '2.5 Pro (고성능 모델)' },
  { value: 'gemini-3-pro-preview', label: '3.0 Pro (최고 성능)' }
];


const SettingsModal = ({ currentSettings, onSave, onClose, isInitialSetup = false }: SettingsModalProps): React.ReactElement => {
  const [settings, setSettings] = useState<AppSettings>(currentSettings);
  const [searchQuery, setSearchQuery] = useState(currentSettings.school || '');
  const [searchResults, setSearchResults] = useState<School[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  useEffect(() => {
    const handler = setTimeout(async () => {
      if (searchQuery.trim().length > 1 && settings.atptOfcdcScCode && searchQuery !== settings.school) {
        setIsSearching(true);
        const results = await searchSchool(settings.atptOfcdcScCode, searchQuery);
        setSearchResults(results || []);
        setIsSearching(false);
        setIsDropdownOpen(true);
      } else {
        setSearchResults([]);
      }
    }, 500);

    return () => {
      clearTimeout(handler);
    };
  }, [searchQuery, settings.atptOfcdcScCode, settings.school]);


  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setSettings(prev => ({ ...prev, [name]: value }));
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  }

  const handleOfficeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedCode = e.target.value;
    setSettings(prev => ({
      ...prev,
      atptOfcdcScCode: selectedCode,
      school: '',
      sdSchulCode: ''
    }));
    setSearchQuery('');
    setSearchResults([]);
    setIsDropdownOpen(false);
  };

  const handleSelectSchool = (school: School) => {
    setSettings(prev => ({
      ...prev,
      school: school.SCHUL_NM,
      atptOfcdcScCode: school.ATPT_OFCDC_SC_CODE,
      sdSchulCode: school.SD_SCHUL_CODE
    }));
    setSearchQuery(school.SCHUL_NM);
    setSearchResults([]);
    setIsDropdownOpen(false);
  }

  const handleSave = () => {
    onSave(settings);
  };

  const canSave = settings.school && settings.grade && settings.class && settings.atptOfcdcScCode && settings.sdSchulCode && settings.schoolYear;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
      // Prevent submission if in the search field and dropdown is open (user might be selecting)
      if (document.activeElement?.id === 'school' && isDropdownOpen) {
        return;
      }
      if (!isInitialSetup || canSave) {
        handleSave();
      }
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={!isInitialSetup ? onClose : undefined}
    >
      <div
        className="bg-base-100 rounded-xl shadow-2xl p-8 w-full max-w-lg m-4 transform transition-all border border-base-300 max-h-[90vh] overflow-y-auto custom-scrollbar"
        onClick={e => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-base-content">{isInitialSetup ? '학급 정보 설정' : '설정'}</h2>
          {!isInitialSetup && (
            <button onClick={onClose} className="text-base-content-secondary hover:text-base-content">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {isInitialSetup && (
          <p className="text-center text-base-content-secondary -mt-4 mb-6">
            환영합니다! 시작하기 전에 학급 정보를 설정해주세요.
          </p>
        )}

        <div className="space-y-6">
          {/* School Year Section with Emphasis */}
          <div className="bg-primary/5 p-4 rounded-lg border border-primary/20">
            <label className="block text-sm font-bold text-primary mb-2 flex items-center justify-between" htmlFor="schoolYear">
              <span>데이터 기준 학년도</span>
              <span className="text-[10px] bg-white px-2 py-0.5 rounded-full border border-primary/20">필수</span>
            </label>
            <div className="flex items-center justify-center gap-4 py-2">
              <button
                type="button"
                onClick={() => setSettings(prev => ({ ...prev, schoolYear: String(parseInt(prev.schoolYear || String(new Date().getFullYear())) - 1) }))}
                className="p-2 bg-white rounded-full border border-base-300 shadow-sm hover:bg-base-200 transition-colors text-primary"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-extrabold text-base-content">{settings.schoolYear || new Date().getFullYear()}</span>
                <span className="text-sm font-bold text-base-content-secondary">학년도</span>
              </div>
              <button
                type="button"
                onClick={() => setSettings(prev => ({ ...prev, schoolYear: String(parseInt(prev.schoolYear || String(new Date().getFullYear())) + 1) }))}
                className="p-2 bg-white rounded-full border border-base-300 shadow-sm hover:bg-base-200 transition-colors text-primary"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
            <p className="text-xs text-base-content-secondary mt-2 leading-relaxed">
              * 학년도를 변경하면 해당 연도의 학생 및 데이터만 로드됩니다.
              새 학년이 시작되면 학년도를 변경하여 새 데이터를 관리하세요.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-base-content-secondary mb-2" htmlFor="grade">학년</label>
              <input
                id="grade"
                name="grade"
                type="text"
                value={settings.grade}
                onChange={handleChange}
                className="w-full p-2 border border-base-300 rounded-md focus:ring-primary focus:border-primary shadow-sm bg-base-100 focus:bg-white transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-base-content-secondary mb-2" htmlFor="class">반</label>
              <input
                id="class"
                name="class"
                type="text"
                value={settings.class}
                onChange={handleChange}
                className="w-full p-2 border border-base-300 rounded-md focus:ring-primary focus:border-primary shadow-sm bg-base-100 focus:bg-white transition-colors"
              />
            </div>
          </div>

          <div className="border-t border-base-300 my-4"></div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-base-content-secondary mb-2" htmlFor="atptOfcdcScCode">
                광역시/도 교육청
              </label>
              <select
                id="atptOfcdcScCode"
                name="atptOfcdcScCode"
                value={settings.atptOfcdcScCode || ''}
                onChange={handleOfficeChange}
                className="w-full p-2 border border-base-300 rounded-md focus:ring-primary focus:border-primary shadow-sm bg-base-100 focus:bg-white transition-colors"
              >
                {EDUCATION_OFFICES.map(office => (
                  <option key={office.code} value={office.code}>{office.name}</option>
                ))}
              </select>
            </div>
            <div className="relative">
              <label className="block text-sm font-semibold text-base-content-secondary mb-2" htmlFor="school">학교 이름 검색</label>
              <input
                id="school"
                name="school"
                type="text"
                value={searchQuery}
                onChange={handleSearchChange}
                disabled={!settings.atptOfcdcScCode}
                placeholder={settings.atptOfcdcScCode ? "학교 이름을 입력하여 검색..." : "교육청을 먼저 선택해주세요"}
                className="w-full p-2 border border-base-300 rounded-md focus:ring-primary focus:border-primary shadow-sm bg-base-100 focus:bg-white transition-colors disabled:bg-base-200"
              />
              {isSearching && <div className="absolute right-3 top-10 text-xs text-base-content-secondary">검색 중...</div>}
              {isDropdownOpen && searchResults.length > 0 && (
                <ul className="absolute z-10 w-full mt-1 bg-base-100 border border-base-300 rounded-md shadow-lg max-h-60 overflow-auto">
                  {searchResults.map((school) => (
                    <li
                      key={school.SD_SCHUL_CODE}
                      onClick={() => handleSelectSchool(school)}
                      className="px-4 py-2 hover:bg-base-200 cursor-pointer"
                    >
                      <span className="font-semibold">{school.SCHUL_NM}</span>
                      <span className="text-sm text-base-content-secondary ml-2">({school.LCTN_SC_NM})</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* AI Settings Section */}
          <div className="border-t border-base-300 pt-4 mt-4">
            <h3 className="text-md font-bold text-base-content mb-3 flex items-center gap-2">
              <span>🤖</span> AI 설정 (Gemini)
            </h3>
            <div className="bg-base-50 p-4 rounded-lg border border-base-300 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-base-content-secondary mb-2" htmlFor="geminiApiKey">
                  Gemini API Key
                </label>
                <input
                  id="geminiApiKey"
                  name="geminiApiKey"
                  type="password"
                  value={settings.geminiApiKey || ''}
                  onChange={handleChange}
                  placeholder="개인 API Key 입력 (비워두면 기본 키 사용)"
                  className="w-full p-2 border border-base-300 rounded-md focus:ring-primary focus:border-primary shadow-sm bg-white text-sm"
                />
                <p className="text-[10px] text-base-content-secondary mt-1 ml-1">
                  * 개인 키를 입력하면 할당량 제한 없이 더 안정적으로 사용할 수 있습니다.
                </p>
              </div>
              <div>
                <label className="block text-sm font-semibold text-base-content-secondary mb-2" htmlFor="geminiModel">
                  AI 모델 선택
                </label>
                <select
                  id="geminiModel"
                  name="geminiModel"
                  value={settings.geminiModel || 'gemini-2.5-flash'}
                  onChange={handleChange}
                  className="w-full p-2 border border-base-300 rounded-md focus:ring-primary focus:border-primary shadow-sm bg-white text-sm"
                >
                  {GEMINI_MODELS.map(model => (
                    <option key={model.value} value={model.value}>
                      {model.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end space-x-4 mt-8">
          {!isInitialSetup && (
            <button
              type="button"
              onClick={onClose}
              className="bg-base-300 text-base-content font-semibold py-2 px-6 rounded-lg hover:bg-gray-300 transition-colors"
            >
              취소
            </button>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={isInitialSetup && !canSave}
            className="bg-primary text-primary-content font-semibold py-2 px-6 rounded-lg shadow-md hover:bg-primary-focus transition-colors disabled:bg-base-300 disabled:cursor-not-allowed"
          >
            저장하기 (Enter)
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
