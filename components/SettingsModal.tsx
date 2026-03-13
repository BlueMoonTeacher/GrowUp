
import React, { useState, useEffect, useMemo } from 'react';
import { AppSettings, SchoolYearEntry } from '../App';
import { searchSchool, School } from '../services/neisService';

interface SettingsModalProps {
  currentSettings: AppSettings;
  /** 이 계정 학생 데이터에서 추출한 학년도·학반 목록 (설정에 없어도 표시용으로 병합) */
  schoolYearsFromData?: { schoolYear: string; grade: string; class: string }[];
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
  { value: 'gemini-2.5-pro', label: '2.5 Pro (기본 - 고성능)' },
  { value: 'gemini-2.5-flash', label: '2.5 Flash (빠르고 경제적)' },
  { value: 'gemini-3-flash-preview', label: '3.0 Flash Preview (최신)' },
  { value: 'gemini-3-pro-preview', label: '3.0 Pro (최고 성능)' }
];


const defaultSchoolYear = () => {
  const y = new Date().getFullYear();
  const m = new Date().getMonth() + 1;
  return String(m >= 3 ? y : y - 1);
};

const SettingsModal = ({ currentSettings, schoolYearsFromData = [], onSave, onClose, isInitialSetup = false }: SettingsModalProps): React.ReactElement => {
  const [settings, setSettings] = useState<AppSettings>(() => {
    const entries = currentSettings.schoolYearEntries;
    if (entries?.length) return currentSettings;
    const sy = currentSettings.schoolYear || defaultSchoolYear();
    const grade = currentSettings.grade || '';
    const class_ = currentSettings.class || '';
    return {
      ...currentSettings,
      schoolYearEntries: [{ schoolYear: sy, grade, class: class_, active: true }],
      schoolYear: sy,
      grade,
      class: class_
    };
  });
  const [searchQuery, setSearchQuery] = useState(currentSettings.school || '');
  const [searchResults, setSearchResults] = useState<School[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const entries = useMemo(() => settings.schoolYearEntries || [], [settings.schoolYearEntries]);

  /** 학생 데이터에 있는 학년도·학반을 목록에 병합 (저장된 모든 학년도가 보이도록) */
  useEffect(() => {
    if (!schoolYearsFromData.length) return;
    setSettings(prev => {
      const existing = prev.schoolYearEntries || [];
      const key = (e: SchoolYearEntry) => `${e.schoolYear}-${e.grade}-${e.class}`;
      const existingKeys = new Set(existing.map(key));
      const added: SchoolYearEntry[] = [];
      for (const d of schoolYearsFromData) {
        const k = `${d.schoolYear}-${d.grade}-${d.class}`;
        if (existingKeys.has(k)) continue;
        existingKeys.add(k);
        added.push({ schoolYear: d.schoolYear, grade: d.grade, class: d.class, active: false });
      }
      if (added.length === 0) return prev;
      const next = [...existing, ...added].sort((a, b) => a.schoolYear.localeCompare(b.schoolYear));
      return { ...prev, schoolYearEntries: next };
    });
  }, [schoolYearsFromData]);

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

  const setEntries = (next: SchoolYearEntry[]) => {
    setSettings(prev => ({ ...prev, schoolYearEntries: next }));
  };

  const [newYear, setNewYear] = useState('');
  const [newGrade, setNewGrade] = useState('');
  const [newClass, setNewClass] = useState('');

  const addEntryFromForm = () => {
    const sy = newYear.trim() || defaultSchoolYear();
    const grade = newGrade.trim();
    const class_ = newClass.trim();
    if (!grade || !class_) return;
    setEntries([...entries, { schoolYear: sy, grade, class: class_, active: entries.length === 0 }]);
    setNewYear('');
    setNewGrade('');
    setNewClass('');
  };

  const updateEntry = (index: number, field: keyof SchoolYearEntry, value: string | boolean) => {
    const next = entries.map((e, i) =>
      i === index ? { ...e, [field]: value } : field === 'active' && value === true ? { ...e, active: false } : e
    );
    setEntries(next);
  };

  const removeEntry = (index: number) => {
    const next = entries.filter((_, i) => i !== index);
    if (entries[index].active && next.length) next[0].active = true;
    setEntries(next);
  };

  const handleSave = () => {
    onSave(settings);
  };

  const hasValidActive = entries.some(e => e.active && e.schoolYear && e.grade && e.class);
  const canSave = settings.school && settings.atptOfcdcScCode && settings.sdSchulCode && hasValidActive;

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
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div
        className="bg-base-100 rounded-xl shadow-2xl p-8 w-full max-w-5xl m-4 transform transition-all border border-base-300 max-h-[90vh] overflow-y-auto custom-scrollbar"
        onKeyDown={handleKeyDown}
      >
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-base-content">{isInitialSetup ? '학급 정보 설정' : '설정'}</h2>
          <button type="button" onClick={onClose} className="text-base-content-secondary hover:text-base-content p-1 rounded" aria-label="닫기">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {isInitialSetup && (
          <p className="text-center text-base-content-secondary -mt-4 mb-6">
            환영합니다! 시작하기 전에 학급 정보를 설정해주세요.
          </p>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* 왼쪽: 데이터 기준 학년도 */}
          <div className="bg-primary/5 p-4 rounded-lg border border-primary/20 min-w-0">
            <label className="block text-sm font-bold text-primary mb-2">
              데이터 기준 학년도
              <span className="text-[10px] bg-white px-2 py-0.5 rounded-full border border-primary/20 ml-1">필수</span>
            </label>
            {entries.length === 0 ? (
              <p className="text-sm text-base-content-secondary py-4 text-center border border-dashed border-base-300 rounded-lg bg-base-100/50">
                학년도와 학반을 등록해 주세요. 아래 입력란에 입력 후 &apos;추가&apos;를 누르면 목록에 추가됩니다.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-base-300 bg-base-100">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-base-200 border-b border-base-300">
                      <th className="text-left py-2 px-3 font-bold text-base-content">학년도</th>
                      <th className="text-left py-2 px-3 font-bold text-base-content">학년·반</th>
                      <th className="text-center py-2 px-3 font-bold text-base-content w-20">활성화</th>
                      <th className="w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((row, idx) => (
                      <tr key={idx} className="border-b border-base-200 last:border-0">
                        <td className="py-2.5 px-3 align-middle text-base-content">
                          {row.schoolYear}학년도
                        </td>
                        <td className="py-2.5 px-3 align-middle text-base-content">
                          {row.grade}학년 {row.class}반
                        </td>
                        <td className="py-2.5 px-3 align-middle text-center">
                          <label className="inline-flex items-center justify-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={row.active}
                              onChange={(e) => updateEntry(idx, 'active', e.target.checked)}
                              className="w-5 h-5 rounded border-base-300 text-primary focus:ring-primary cursor-pointer"
                              title="활성화"
                            />
                          </label>
                        </td>
                        <td className="py-2 px-2 align-middle">
                          {entries.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeEntry(idx)}
                              className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50"
                              title="행 삭제"
                              aria-label="행 삭제"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                              </svg>
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="mt-3 pt-3 border-t border-primary/20">
              <p className="text-xs font-semibold text-base-content-secondary mb-2">새 학년도·학반 등록</p>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  inputMode="numeric"
                  value={newYear}
                  onChange={(e) => setNewYear(e.target.value)}
                  placeholder="2026"
                  className="w-16 p-2 border border-base-300 rounded-md text-sm focus:ring-primary focus:border-primary"
                />
                <span className="text-sm text-base-content-secondary">학년도</span>
                <input
                  type="text"
                  value={newGrade}
                  onChange={(e) => setNewGrade(e.target.value)}
                  placeholder="5"
                  className="w-14 p-2 border border-base-300 rounded-md text-sm focus:ring-primary focus:border-primary text-center"
                />
                <span className="text-sm text-base-content-secondary">학년</span>
                <input
                  type="text"
                  value={newClass}
                  onChange={(e) => setNewClass(e.target.value)}
                  placeholder="1"
                  className="w-14 p-2 border border-base-300 rounded-md text-sm focus:ring-primary focus:border-primary text-center"
                />
                <span className="text-sm text-base-content-secondary">반</span>
                <button
                  type="button"
                  onClick={addEntryFromForm}
                  disabled={!newGrade.trim() || !newClass.trim()}
                  className="text-sm font-bold text-primary border border-primary/40 bg-white px-3 py-2 rounded-lg hover:bg-primary/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  추가
                </button>
              </div>
            </div>
            <p className="text-xs text-base-content-secondary mt-2 leading-relaxed">
              * 체크한 한 개의 학년도·학반만 현재 운영됩니다. 해당 연도의 학생 및 데이터만 로드됩니다.
            </p>
          </div>

          {/* 오른쪽: 광역시/학교 + Gemini AI 설정 */}
          <div className="space-y-6 min-w-0">
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

            <div className="border-t border-base-300 pt-4">
              <h3 className="text-md font-bold text-base-content mb-3 flex items-center gap-2">
                <span className="text-lg" title="인증">🔑</span> Gemini AI 설정하기
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
                    value={settings.geminiModel || 'gemini-2.5-pro'}
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
