
import React, { useState, useEffect } from 'react';
import { Student } from '../types';
import { AppSettings } from '../App';

interface StudentFormProps {
  onSubmit: (student: any) => void;
  onCancel: () => void;
  onDelete?: (studentId: string) => void;
  studentToEdit?: Student | null;
  settings: AppSettings;
}

const getDefaultStudent = (settings: AppSettings): Omit<Student, 'id'> => ({
  school: settings.school || '', 
  grade: settings.grade || '', 
  class: settings.class || '', 
  number: '',
  gender: '남',
  name: { hangul: '', hanja: '' },
  dob: '',
  phone: { home: '', mobile: '' },
  address: '',
  specialNeeds: false,
  family: {
    guardians: [{ relationship: '모', name: '', phone: '' }, { relationship: '부', name: '', phone: '' }],
    isMulticultural: false,
    nationality: { father: '대한민국', mother: '대한민국' },
    siblings: [],
  },
  afterSchool: {
    activities: [],
    likes: '',
    dislikes: '',
  },
  learningStatus: '', healthStatus: '', parentRequests: '',
  behaviorRecords: [],
  attendanceRecords: [],
});

const createFilledStudentData = (student: Student | Omit<Student, 'id'> | null, settings: AppSettings): Student | Omit<Student, 'id'> => {
  const defaultStudent = getDefaultStudent(settings);

  if (!student) {
      const newDefault = JSON.parse(JSON.stringify(defaultStudent));
      newDefault.family.siblings = [
          { relationship: '', name: '', attendsSameSchool: false, gradeClass: '' },
          { relationship: '', name: '', attendsSameSchool: false, gradeClass: '' },
          { relationship: '', name: '', attendsSameSchool: false, gradeClass: '' }
      ];
      newDefault.afterSchool.activities = [
        { name: '', subject: '', schedule: '' }, 
        { name: '', subject: '', schedule: '' }, 
        { name: '', subject: '', schedule: '' }
      ];
      return newDefault;
  }
  
  const guardiansData = [...(student.family?.guardians ?? [])];
  const siblingsData = [...(student.family?.siblings ?? [])];
  const activitiesData = [...(student.afterSchool?.activities ?? [])];
  const behaviorRecords = [...(student.behaviorRecords ?? [])];
  const attendanceRecords = [...(student.attendanceRecords ?? [])];

  const padArray = (arr: any[], minLength: number, filler: object) => {
    if (arr.length < minLength) {
      return [...arr, ...Array.from({ length: minLength - arr.length }, () => JSON.parse(JSON.stringify(filler)))];
    }
    return arr;
  };
  
  const paddedGuardians = padArray(guardiansData, 2, { relationship: '', name: '', phone: '' });
  if (paddedGuardians[0] && !paddedGuardians[0].relationship) paddedGuardians[0].relationship = '모';
  if (paddedGuardians[1] && !paddedGuardians[1].relationship) paddedGuardians[1].relationship = '부';
  
  const GUARDIAN_ORDER: { [key: string]: number } = { '모': 1, '부': 2 };
  paddedGuardians.sort((a,b) => (GUARDIAN_ORDER[a.relationship] || 99) - (GUARDIAN_ORDER[b.relationship] || 99));

  const paddedSiblings = padArray(siblingsData, 3, { relationship: '', name: '', attendsSameSchool: false, gradeClass: '' });
  const paddedActivities = padArray(activitiesData, 3, { name: '', subject: '', schedule: '' });

  const filledStudent = {
    ...defaultStudent,
    ...student,
    school: settings.school,
    grade: settings.grade,
    class: settings.class,
    gender: student.gender || '남',
    name: { ...defaultStudent.name, ...(student.name ?? {}) },
    phone: { ...defaultStudent.phone, ...(student.phone ?? {}) },
    family: {
        ...defaultStudent.family,
        ...(student.family ?? {}),
        nationality: { ...defaultStudent.family.nationality, ...(student.family?.nationality ?? {}) },
        guardians: paddedGuardians,
        siblings: paddedSiblings,
    },
    afterSchool: {
        ...defaultStudent.afterSchool,
        ...(student.afterSchool ?? {}),
        activities: paddedActivities,
    },
    behaviorRecords: behaviorRecords,
    attendanceRecords: attendanceRecords,
  };
  return filledStudent;
};


const FormInput = (props: React.InputHTMLAttributes<HTMLInputElement>): React.ReactElement => (
    <input className="w-full max-w-full p-2 border border-base-300 rounded-md focus:ring-primary focus:border-primary shadow-sm bg-base-100 focus:bg-white disabled:bg-base-200 disabled:text-base-content-secondary disabled:border-base-300 disabled:cursor-not-allowed transition-colors min-w-0" {...props} />
);

const FormTextArea = (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>): React.ReactElement => (
     <textarea className="w-full max-w-full p-2 border border-base-300 rounded-md focus:ring-primary focus:border-primary shadow-sm bg-base-100 focus:bg-white transition-colors" rows={5} {...props} />
);

interface ToggleProps {
  value: boolean;
  onChange: (value: boolean) => void;
}
const Toggle = ({ value, onChange }: ToggleProps): React.ReactElement => (
    <div className="flex items-center space-x-2">
        <button type="button" onClick={() => onChange(true)} className={`px-4 py-1.5 rounded-md text-sm ${value ? 'bg-primary text-primary-content font-semibold' : 'bg-base-300 text-base-content'}`}>O</button>
        <button type="button" onClick={() => onChange(false)} className={`px-4 py-1.5 rounded-md text-sm ${!value ? 'bg-primary text-primary-content font-semibold' : 'bg-base-300 text-base-content'}`}>X</button>
    </div>
);

type LabelCellProps = React.PropsWithChildren<{
  className?: string;
}>;

const LabelCell = ({ children, className }: LabelCellProps): React.ReactElement => (
    <div className={`bg-secondary p-2 text-center font-semibold text-secondary-content flex items-center justify-center border-slate-300 ${className}`}>
        {children}
    </div>
);

// Use minmax(0, 1fr) instead of 1fr to allow content (like input) to shrink below its minimum content size
const SHARED_FORM_GRID_COLS = "grid-cols-[90px_minmax(0,1fr)] md:grid-cols-[120px_1fr_120px_1fr_150px_1fr_3rem]";
const SIBLING_FORM_GRID_COLS = "grid-cols-[90px_minmax(0,1fr)] md:grid-cols-[120px_1fr_80px_1fr_150px_2fr_3rem]";

const StudentForm = ({ onSubmit, onCancel, onDelete, studentToEdit, settings }: StudentFormProps): React.ReactElement => {
  const [formData, setFormData] = useState<Student | Omit<Student, 'id'>>(() => createFilledStudentData(studentToEdit, settings));
  
  useEffect(() => {
    setFormData(createFilledStudentData(studentToEdit, settings));
  }, [studentToEdit, settings]);


  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    const keys = name.split('.');
    
    setFormData(prev => {
      const newState = JSON.parse(JSON.stringify(prev));
      let current = newState;
      for (let i = 0; i < keys.length - 1; i++) {
        current = current[keys[i]];
      }
      current[keys[keys.length - 1]] = value;
      return newState;
    });
  };
  
  const handleArrayChange = (section: keyof Omit<Student, 'id'>, subKey: string, index: number, field: string, value: any) => {
     setFormData(prev => {
      const newState = JSON.parse(JSON.stringify(prev));
      (newState[section] as any)[subKey][index][field] = value;
      return newState;
    });
  }
  
  const handleSiblingSchoolToggle = (index: number, value: boolean) => {
    setFormData(prev => {
        const newState = JSON.parse(JSON.stringify(prev));
        const sibling = newState.family.siblings[index];
        sibling.attendsSameSchool = value;
        if (!value) {
            sibling.gradeClass = ''; // Clear grade/class if not attending
        }
        return newState;
    });
  };

  const addSibling = () => {
    setFormData(prev => ({
        ...prev,
        family: {
            ...prev.family,
            siblings: [...prev.family.siblings, { relationship: '', name: '', attendsSameSchool: false, gradeClass: '' }]
        }
    }));
  };

  const removeSibling = (index: number) => {
      setFormData(prev => ({
          ...prev,
          family: {
              ...prev.family,
              siblings: prev.family.siblings.filter((_, i) => i !== index)
          }
      }));
  };


  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const handleDelete = () => {
      if (studentToEdit && onDelete) {
          onDelete(studentToEdit.id);
      }
  };

  const topInputStyle = "p-1.5 text-center bg-base-200 border border-base-300 rounded-lg text-base-content-secondary cursor-not-allowed";
  const topEditableInputStyle = "p-1.5 text-center bg-base-100 border border-base-300 rounded-lg focus:ring-primary focus:border-primary shadow-sm";


  return (
    <div className="max-w-6xl mx-auto">
      <form onSubmit={handleSubmit} className="bg-base-100 p-4 sm:p-6 md:p-8 rounded-xl shadow-xl border border-base-300/60 relative">
        {/* Sticky Header */}
        <div className="sticky top-0 bg-base-100/95 backdrop-blur-sm z-20 -mx-4 sm:-mx-6 md:-mx-8 px-4 sm:px-6 md:px-8 py-3 border-b border-base-300 mb-6 rounded-t-xl shadow-sm">
            <div className="max-w-6xl mx-auto flex justify-between items-center">
                <h2 className="text-xl md:text-2xl font-bold text-base-content">
                    {studentToEdit ? '학생 정보 수정' : '새 학생 추가'}
                </h2>
                <div className="flex gap-2">
                    <button 
                        type="button" 
                        onClick={onCancel} 
                        className="bg-base-300 text-base-content font-semibold py-2 px-4 rounded-lg hover:bg-gray-300 transition-colors text-sm"
                    >
                        취소
                    </button>
                    <button 
                        type="submit" 
                        className="bg-primary text-primary-content font-semibold py-2 px-5 rounded-lg shadow-md hover:bg-primary-focus transition-colors flex items-center gap-2 text-sm"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <span>저장하기</span>
                    </button>
                </div>
            </div>
        </div>

        <div className="text-center mb-8">
            <h3 className="text-2xl font-bold text-base-content mb-2 hidden">학생 기초 조사서 ☀️</h3>
            <div className="flex justify-center items-center flex-wrap gap-x-4 gap-y-2 text-base-content">
                <div className="flex items-center space-x-2">
                    <span className="font-semibold text-sm text-base-content-secondary">학교</span>
                    <input name="school" value={formData.school} className={`${topInputStyle} w-32`} disabled/>
                </div>
                <div className="flex items-center space-x-2">
                    <input name="grade" value={formData.grade} required className={`${topInputStyle} w-12`} placeholder="학년" disabled/>
                    <span className="font-semibold">학년</span>
                </div>
                <div className="flex items-center space-x-2">
                    <input name="class" value={formData.class} required className={`${topInputStyle} w-12`} placeholder="반" disabled/>
                    <span className="font-semibold">반</span>
                </div>
                <div className="flex items-center space-x-2">
                    <input name="number" value={formData.number} onChange={handleChange} required className={`${topEditableInputStyle} w-12`} placeholder="번호" />
                    <span className="font-semibold">번</span>
                </div>
                <div className="flex items-center space-x-1 bg-base-200 rounded-lg p-1 border border-base-300">
                    <button 
                        type="button"
                        onClick={() => setFormData({...formData, gender: '남'})}
                        className={`px-3 py-0.5 rounded text-sm font-bold transition-colors ${formData.gender === '남' ? 'bg-primary text-primary-content shadow-sm' : 'text-base-content-secondary hover:bg-base-100/50'}`}
                    >남</button>
                    <button 
                        type="button"
                        onClick={() => setFormData({...formData, gender: '여'})}
                        className={`px-3 py-0.5 rounded text-sm font-bold transition-colors ${formData.gender === '여' ? 'bg-primary text-primary-content shadow-sm' : 'text-base-content-secondary hover:bg-base-100/50'}`}
                    >여</button>
                </div>
            </div>
        </div>

        <div className="border-2 border-slate-400">
            <div className="flex flex-col md:flex-row border-b-2 border-slate-400">
            <LabelCell className="w-full md:w-12 border-b md:border-b-0 md:border-r border-slate-400">학생</LabelCell>
            <div className="flex-1 grid grid-cols-1 divide-y divide-slate-300 border-t border-slate-300 md:border-t-0">
                {/* Changed grid-cols-[90px_1fr] to grid-cols-[90px_minmax(0,1fr)] to prevent mobile overflow */}
                <div className="grid grid-cols-[90px_minmax(0,1fr)] md:grid-cols-[120px_1fr_120px_1fr]">
                <LabelCell className="border-r">이 름</LabelCell>
                <div className="p-2 flex items-center gap-2">
                    <FormInput name="name.hangul" value={formData.name.hangul} onChange={handleChange} placeholder="한글" required />
                    <FormInput name="name.hanja" value={formData.name.hanja} onChange={handleChange} placeholder="한자" />
                </div>
                <LabelCell className="border-t md:border-t-0 border-r">생년월일</LabelCell>
                <div className="p-2 border-t md:border-t-0 min-w-0"><FormInput name="dob" value={formData.dob} onChange={handleChange} type="date" /></div>
                </div>
                {/* Changed grid-cols-[90px_1fr] to grid-cols-[90px_minmax(0,1fr)] */}
                <div className="grid grid-cols-[90px_minmax(0,1fr)] md:grid-cols-[120px_1fr]">
                <LabelCell className="border-r">현 주 소</LabelCell>
                <div className="p-2"><FormInput name="address" value={formData.address} onChange={handleChange} /></div>
                </div>
                {/* Row 3 uses SHARED_FORM_GRID_COLS */}
                <div className={`grid ${SHARED_FORM_GRID_COLS}`}>
                <LabelCell className="border-r border-b md:border-b-0">집 전화번호</LabelCell>
                <div className="p-2 border-b md:border-b-0"><FormInput name="phone.home" value={formData.phone.home} onChange={handleChange} /></div>
                <LabelCell className="border-r border-b md:border-b-0">휴대폰 번호</LabelCell>
                <div className="p-2 border-r border-b md:border-b-0"><FormInput name="phone.mobile" value={formData.phone.mobile} onChange={handleChange} /></div>
                <LabelCell className="border-r border-b md:border-b-0">특수교육대상</LabelCell>
                <div className="p-2 flex items-center"><Toggle value={formData.specialNeeds} onChange={v => setFormData({...formData, specialNeeds: v})} /></div>
                <div className="hidden md:block"/>
                </div>
            </div>
            </div>

            <div className="flex flex-col md:flex-row border-b-2 border-slate-400">
                <LabelCell className="w-full md:w-12 border-b md:border-b-0 md:border-r border-slate-400">가족사항</LabelCell>
                <div className="flex-1 grid grid-cols-1 divide-y divide-slate-300 border-t border-slate-300 md:border-t-0">
                    {formData.family.guardians.map((g, i) => (
                        <div key={i} className={`grid ${SHARED_FORM_GRID_COLS}`}>
                            <LabelCell className="border-r">관계(보호자)</LabelCell>
                            <div className="p-2"><FormInput value={g.relationship} onChange={e => handleArrayChange('family', 'guardians', i, 'relationship', e.target.value)} placeholder={i === 0 ? '모' : '부'} /></div>
                            <LabelCell className="border-t md:border-t-0 border-r">이름</LabelCell>
                            <div className="p-2"><FormInput value={g.name} onChange={e => handleArrayChange('family', 'guardians', i, 'name', e.target.value)} /></div>
                            <LabelCell className="border-t md:border-t-0 border-r">휴대폰 번호</LabelCell>
                            <div className="p-2 border-r"><FormInput value={g.phone} onChange={e => handleArrayChange('family', 'guardians', i, 'phone', e.target.value)} /></div>
                            <div className="hidden md:block"/>
                        </div>
                    ))}
                    <div className={`grid ${SHARED_FORM_GRID_COLS}`}>
                        <LabelCell className="border-r">다문화 가정</LabelCell>
                        <div className="p-2 flex items-center col-span-1 md:col-span-6"><Toggle value={formData.family.isMulticultural} onChange={v => setFormData({...formData, family: {...formData.family, isMulticultural: v}})} /></div>
                    </div>
                    {formData.family.isMulticultural && (
                        <div className={`grid ${SHARED_FORM_GRID_COLS}`}>
                            <LabelCell className="border-r">국적</LabelCell>
                            <div className="p-2 flex items-center gap-2 col-span-1 md:col-span-6">
                                <FormInput name="family.nationality.father" value={formData.family.nationality.father} onChange={handleChange} placeholder="부" />
                                <FormInput name="family.nationality.mother" value={formData.family.nationality.mother} onChange={handleChange} placeholder="모" />
                            </div>
                        </div>
                    )}
                    {formData.family.siblings.map((s, i) => (
                        <div key={i} className={`grid ${SIBLING_FORM_GRID_COLS}`}>
                            <LabelCell className="border-r">형제·자매 {i + 1}</LabelCell>
                            <div className="p-2"><FormInput value={s.relationship} onChange={e => handleArrayChange('family', 'siblings', i, 'relationship', e.target.value)} placeholder="관계"/></div>
                            <LabelCell className="border-t md:border-t-0 border-r">이름</LabelCell>
                            <div className="p-2"><FormInput value={s.name} onChange={e => handleArrayChange('family', 'siblings', i, 'name', e.target.value)} placeholder="이름"/></div>
                            <LabelCell className="border-t md:border-t-0 border-r">본교재학</LabelCell>
                            <div className="p-2 border-r flex items-center gap-2">
                                <Toggle value={s.attendsSameSchool} onChange={v => handleSiblingSchoolToggle(i, v)} />
                                <FormInput 
                                    value={s.gradeClass} 
                                    onChange={e => handleArrayChange('family', 'siblings', i, 'gradeClass', e.target.value)} 
                                    placeholder="3-1"
                                    disabled={!s.attendsSameSchool}
                                />
                            </div>
                            <div className="w-full flex items-center justify-center p-2 md:p-0">
                                <button type="button" onClick={() => removeSibling(i)} className="text-slate-400 hover:text-red-600 transition-colors p-1 rounded-full hover:bg-red-100">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                    ))}
                    <div className="p-2 flex justify-end">
                        <button type="button" onClick={addSibling} className="bg-base-200 text-base-content-secondary font-semibold py-1.5 px-3 rounded-lg hover:bg-base-300 transition-colors flex items-center space-x-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                <path d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110 2h3V6a1 1 0 011-1z" />
                            </svg>
                            <span>형제·자매 추가</span>
                        </button>
                    </div>
                </div>
            </div>

            <div className="flex flex-col md:flex-row border-b-2 border-slate-400">
                <LabelCell className="w-full md:w-12 border-b md:border-b-0 md:border-r border-slate-400">방과후활동</LabelCell>
                <div className="flex-1 grid grid-cols-1 divide-y divide-slate-300 border-t border-slate-300 md:border-t-0">
                    {formData.afterSchool.activities.map((a, i) => (
                        <div key={i} className={`grid ${SHARED_FORM_GRID_COLS}`}>
                            <LabelCell className="border-r">학원/방과후</LabelCell>
                            <div className="p-2"><FormInput value={a.name} onChange={e => handleArrayChange('afterSchool', 'activities', i, 'name', e.target.value)} /></div>
                            <LabelCell className="border-t md:border-t-0 border-r">과목</LabelCell>
                            <div className="p-2"><FormInput value={a.subject} onChange={e => handleArrayChange('afterSchool', 'activities', i, 'subject', e.target.value)} /></div>
                            <LabelCell className="border-t md:border-t-0 border-r">요일/시간</LabelCell>
                            <div className="p-2 border-r"><FormInput value={a.schedule} onChange={e => handleArrayChange('afterSchool', 'activities', i, 'schedule', e.target.value)} /></div>
                            <div className="hidden md:block"/>
                        </div>
                    ))}
                    <div className="grid grid-cols-[90px_minmax(0,1fr)] md:grid-cols-[120px_1fr]">
                        <LabelCell className="border-r row-span-2 border-b md:border-b-0">흥미/욕구</LabelCell>
                        <div className="grid grid-cols-[80px_minmax(0,1fr)] md:grid-cols-[100px_1fr] border-b border-slate-300">
                            <LabelCell className="border-r">좋아하는 것</LabelCell>
                            <div className="p-2"><FormInput name="afterSchool.likes" value={formData.afterSchool.likes} onChange={handleChange} /></div>
                        </div>
                        <div className="grid grid-cols-[80px_minmax(0,1fr)] md:grid-cols-[100px_1fr] col-start-2 md:col-start-auto">
                            <LabelCell className="border-r">싫어하는 것</LabelCell>
                            <div className="p-2"><FormInput name="afterSchool.dislikes" value={formData.afterSchool.dislikes} onChange={handleChange} /></div>
                        </div>
                    </div>
                </div>
            </div>
            
            <div className="flex flex-col md:flex-row border-b border-slate-300">
                <LabelCell className="w-full md:w-48 border-b md:border-b-0 md:border-r">학습 상태</LabelCell>
                <div className="p-3 flex-1"><FormTextArea name="learningStatus" value={formData.learningStatus} onChange={handleChange} placeholder="학생의 학습상의 특징, 가정학습을 도와주는 사람 등을 기록해 주세요." /></div>
            </div>
            <div className="flex flex-col md:flex-row border-b border-slate-300">
                <LabelCell className="w-full md:w-48 border-b md:border-b-0 md:border-r">건강 상태</LabelCell>
                <div className="p-3 flex-1"><FormTextArea name="healthStatus" value={formData.healthStatus} onChange={handleChange} placeholder="특이체질 및 지금 치료중인 질병, 급식 시 피해야 할 음식 등을 자세히 기록해 주세요."/></div>
            </div>
            <div className="flex flex-col md:flex-row">
                <LabelCell className="w-full md:w-48 border-b md:border-b-0 md:border-r">학부모의 요청사항</LabelCell>
                <div className="p-3 flex-1"><FormTextArea name="parentRequests" value={formData.parentRequests} onChange={handleChange} /></div>
            </div>
        </div>


        <div className="flex justify-between items-center pt-8">
            <div>
                {studentToEdit && onDelete && (
                    <button 
                        type="button" 
                        onClick={handleDelete}
                        className="bg-red-50 text-red-500 font-semibold py-2.5 px-6 rounded-lg hover:bg-red-100 transition-colors border border-red-200"
                    >
                        삭제하기
                    </button>
                )}
            </div>
            <div className="flex space-x-4">
                <button type="button" onClick={onCancel} className="bg-base-300 text-base-content font-semibold py-2.5 px-6 rounded-lg hover:bg-gray-300 transition-colors">취소</button>
                <button type="submit" className="bg-primary text-primary-content font-semibold py-2.5 px-6 rounded-lg shadow-md hover:bg-primary-focus transition-colors">{studentToEdit ? '수정하기' : '제출하기'}</button>
            </div>
        </div>
      </form>
    </div>
  );
};

export default StudentForm;
