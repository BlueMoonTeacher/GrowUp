
import React from 'react';
import { Student, Guardian, Sibling, AfterSchoolActivity } from '../types';

interface StudentDetailProps {
  student: Student;
  onEdit: (student: Student) => void;
  onDelete: (studentId: string) => void;
}

type InfoCardProps = React.PropsWithChildren<{
  title: string;
  icon: React.ReactElement;
}>;

const formatPhoneNumber = (phone: string | undefined | null): string => {
  if (!phone) return '-';
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 11) {
    return cleaned.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3');
  }
  if (cleaned.length === 10) {
    if (cleaned.startsWith('02')) {
       return cleaned.replace(/(\d{2})(\d{4})(\d{4})/, '$1-$2-$3');
    }
    return cleaned.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3');
  }
  if (cleaned.length === 9 && cleaned.startsWith('02')) {
      return cleaned.replace(/(\d{2})(\d{3})(\d{4})/, '$1-$2-$3');
  }
  return phone; 
};

const formatAddress = (addr: string | undefined): string => {
  if (!addr) return '-';
  // Find the last space in the string
  const lastSpaceIndex = addr.lastIndexOf(' ');
  
  // If a space exists and it's not at the start or end
  if (lastSpaceIndex > 0 && lastSpaceIndex < addr.length - 1) {
    const afterSpace = addr.substring(lastSpaceIndex + 1);
    // If the part after the space starts with a number (heuristic for unit/building info)
    if (/^\d/.test(afterSpace)) {
        return addr.substring(0, lastSpaceIndex) + ', ' + afterSpace;
    }
  }
  return addr;
};


const InfoCard = ({ title, icon, children }: InfoCardProps): React.ReactElement => (
  <div className="bg-base-100 rounded-xl shadow-lg border border-base-300/60 p-5">
    <div className="flex items-center mb-4">
      {icon}
      <h3 className="text-lg font-bold text-base-content">{title}</h3>
    </div>
    <div className="space-y-4 text-base-content">{children}</div>
  </div>
);

interface InfoItemProps {
  label: string;
  value?: string | React.ReactElement | null;
  isFlag?: boolean;
  className?: string;
}
const InfoItem = ({ label, value, isFlag = false, className = "" }: InfoItemProps): React.ReactElement => (
  <div className={className}>
    <p className="text-xs font-bold text-base-content-secondary mb-0.5 uppercase tracking-wider">{label}</p>
    {typeof value === 'string' ? (
      <p className={`font-medium truncate ${isFlag ? 'text-primary font-bold' : 'text-base-content'}`}>{value || '-'}</p>
    ) : (
      value || '-'
    )}
  </div>
);

const UserIcon = (): React.ReactElement => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2.5 text-primary" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
    </svg>
);
const FamilyIcon = (): React.ReactElement => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2.5 text-primary" viewBox="0 0 20 20" fill="currentColor">
        <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
    </svg>
);
const ActivityIcon = (): React.ReactElement => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2.5 text-primary" viewBox="0 0 20 20" fill="currentColor">
        <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.428A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
    </svg>
);
const DocumentIcon = (): React.ReactElement => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2.5 text-primary" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
    </svg>
);
const HealthIcon = (): React.ReactElement => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2.5 text-primary" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.707-10.293a1 1 0 00-1.414-1.414L6 10.586 7.293 9.293a1 1 0 10-1.414-1.414l-2 2a1 1 0 000 1.414l2 2a1 1 0 001.414-1.414L7.414 12l1.293-1.293a1 1 0 000-1.414zM11 9a1 1 0 112 0v6a1 1 0 11-2 0V9z" clipRule="evenodd" />
    </svg>
);

const StudentDetail = ({ student, onEdit, onDelete }: StudentDetailProps): React.ReactElement => {
  // Filter out siblings that don't have a name (empty rows from form padding)
  const validSiblings = student.family?.siblings?.filter(s => s.name && s.name.trim() !== '') || [];
  const GUARDIAN_ORDER: { [key: string]: number } = { '모': 1, '부': 2 };
  const sortedGuardians = [...(student.family?.guardians || [])]
    .filter(g => g.name && g.name.trim())
    .sort((a, b) => (GUARDIAN_ORDER[a.relationship] || 99) - (GUARDIAN_ORDER[b.relationship] || 99));

  return (
    <div className="space-y-5">
      <div className="bg-base-100 p-5 rounded-xl shadow-lg border border-base-300/60 flex justify-between items-start">
        <div>
          <div className="flex items-center space-x-2 mb-1.5">
            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-secondary text-secondary-content border border-green-200/80">
                {student.grade}학년 {student.class}반 {student.number}번
            </span>
          </div>
          <h2 className="text-3xl font-bold text-base-content flex items-baseline">
            {student.name?.hangul} 
            <span className="ml-2 text-xl font-medium text-base-content-secondary">{student.name?.hanja}</span>
          </h2>
        </div>
        <div className="flex space-x-2">
            <button 
                onClick={() => onEdit(student)}
                className="bg-base-100 text-base-content font-bold py-2 px-4 rounded-lg border border-base-300 hover:bg-base-200 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-75 transition-colors duration-200 flex items-center space-x-2 text-sm shadow-sm">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                </svg>
                <span>수정</span>
            </button>
            <button 
                onClick={() => onDelete(student.id)}
                className="bg-white text-red-500 font-bold py-2 px-3 rounded-lg border border-red-200 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-50 transition-colors duration-200 shadow-sm"
                title="학생 삭제"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
            </button>
        </div>
      </div>

      <InfoCard title="기본 정보" icon={<UserIcon />}>
        {/* Changed grid breakpoint from md to xl to prevent wrapping on tablets */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-x-6 gap-y-4">
          <InfoItem label="생년월일" value={student.dob} />
          <InfoItem label="성별" value={student.gender} />
          <InfoItem label="특수교육대상" value={student.specialNeeds ? '대상 (O)' : '비대상 (X)'} isFlag={student.specialNeeds} />
          <InfoItem label="휴대폰 번호" value={formatPhoneNumber(student.phone?.mobile)} />
          <InfoItem label="집 전화번호" value={formatPhoneNumber(student.phone?.home)} />
          <InfoItem label="주소" value={formatAddress(student.address)} className="xl:col-span-2" />
        </div>
      </InfoCard>

      <InfoCard title="가족 정보 🌳" icon={<FamilyIcon />}>
        <div className="space-y-4">
            {/* Simplified Multicultural UI */}
            <div className="bg-secondary/50 rounded-lg p-3 border border-green-200/60">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                     <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-base-content">다문화 여부 :</span>
                        {student.family?.isMulticultural ? (
                            <span className="text-sm font-bold text-primary">
                                맞음
                            </span>
                        ) : (
                            <span className="text-sm font-bold text-base-content-secondary">
                                아님
                            </span>
                        )}
                     </div>
                     
                     {/* Nationality only shown if multicultural */}
                     {student.family?.isMulticultural && (
                        <div className="flex items-center gap-3 text-sm bg-base-100 px-3 py-1.5 rounded-md border border-base-300 shadow-sm">
                            <div className="flex items-center">
                                <span className="text-xs font-bold text-base-content-secondary mr-1.5">부:</span> 
                                <span className="font-semibold text-base-content">{student.family?.nationality?.father || '-'}</span>
                            </div>
                            <div className="w-px h-3 bg-base-300"></div>
                            <div className="flex items-center">
                                <span className="text-xs font-bold text-base-content-secondary mr-1.5">모:</span> 
                                <span className="font-semibold text-base-content">{student.family?.nationality?.mother || '-'}</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="border-t border-base-200"></div>

            {/* Guardians: Clean List - Always 1 column to ensure name/phone space */}
            <div>
                <h4 className="text-xs font-bold text-base-content-secondary mb-2 uppercase tracking-wider">보호자</h4>
                <div className="grid grid-cols-1 gap-3">
                    {sortedGuardians.map((g: Guardian, i: number) => (
                        <div key={i} className="p-3 bg-base-200 rounded-lg border border-base-300/70 flex justify-between items-center hover:bg-white hover:shadow-sm transition-all">
                            <div className="flex items-center gap-2">
                                <span className="px-2 py-1 bg-base-100 rounded text-xs font-bold text-secondary-content border border-green-200/50 shadow-sm min-w-[2rem] text-center whitespace-nowrap">
                                    {g.relationship || '-'}
                                </span>
                                <span className="font-bold text-base-content text-sm whitespace-nowrap">{g.name || '-'}</span>
                            </div>
                            <span className="text-sm text-base-content font-bold tracking-wide whitespace-nowrap">
                                {formatPhoneNumber(g.phone) || '-'}
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            <div className="border-t border-base-200"></div>

            {/* Siblings: Filtered & Compact */}
            <div>
                <div className="flex items-center justify-between mb-2">
                     <h4 className="text-xs font-bold text-base-content-secondary uppercase tracking-wider">형제/자매</h4>
                     {validSiblings.length > 0 && (
                         <span className="text-xs font-bold text-primary-content bg-primary px-2 py-0.5 rounded-full">
                             {validSiblings.length}명
                         </span>
                     )}
                </div>
                
                {validSiblings.length > 0 ? (
                    <div className="space-y-1.5">
                        {validSiblings.map((s: Sibling, i: number) => (
                            <div key={i} className="px-3 py-2 bg-base-200 rounded-md border border-base-300/70 flex items-center justify-between text-sm">
                                <div className="flex items-center gap-2 overflow-hidden">
                                    <span className="text-xs font-bold text-base-content-secondary min-w-[2.5rem] whitespace-nowrap">
                                        {s.relationship}
                                    </span>
                                    <span className="w-px h-3 bg-base-300"></span>
                                    <span className="font-bold text-base-content truncate">{s.name}</span>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    {s.gradeClass && (
                                        <span className="text-base-content-secondary text-xs">{s.gradeClass}</span>
                                    )}
                                    {s.attendsSameSchool && (
                                        <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-secondary-content font-bold border border-green-200/80 whitespace-nowrap">
                                            본교
                                        </span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-base-content-secondary text-xs italic py-2 px-3 bg-base-200/50 rounded border border-base-300/50 text-center">
                        기록된 형제/자매 정보가 없습니다.
                    </div>
                )}
            </div>
        </div>
      </InfoCard>

      <InfoCard title="방과 후 활동 및 흥미 ☀️" icon={<ActivityIcon />}>
        <div className="space-y-4">
            <div>
                <h4 className="text-xs font-bold text-base-content-secondary mb-2 uppercase tracking-wider">활동 목록</h4>
                {(student.afterSchool?.activities?.filter(a => a.name).length ?? 0) > 0 ? (
                     <div className="space-y-1.5">
                        {student.afterSchool.activities.filter(a => a.name).map((a: AfterSchoolActivity, i: number) => (
                            <div key={i} className="px-3 py-2 bg-base-200 rounded-md border border-base-300/70 flex justify-between items-center text-sm">
                                <div>
                                    <span className="font-bold text-base-content">{a.name}</span>
                                    {a.subject && <span className="text-base-content-secondary text-xs ml-1">({a.subject})</span>}
                                </div>
                                <span className="text-xs text-base-content-secondary bg-base-100 px-2 py-1 rounded-md border border-base-300 max-w-[120px] truncate">
                                    {a.schedule}
                                </span>
                            </div>
                        ))}
                    </div>
                ) : <p className="text-base-content-secondary text-xs italic px-2">기록된 활동이 없습니다.</p>}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <InfoItem label="좋아하는 것" value={student.afterSchool?.likes} />
                <InfoItem label="싫어하는 것" value={student.afterSchool?.dislikes} />
            </div>
        </div>
      </InfoCard>

      <InfoCard title="학습 상태 🌱" icon={<DocumentIcon />}>
        <p className="whitespace-pre-wrap text-base-content text-sm leading-relaxed">{student.learningStatus || '-'}</p>
      </InfoCard>

      <InfoCard title="건강 상태" icon={<HealthIcon />}>
        <p className="whitespace-pre-wrap text-base-content text-sm leading-relaxed">{student.healthStatus || '-'}</p>
      </InfoCard>

      <InfoCard title="학부모 요청사항" icon={<DocumentIcon />}>
        <p className="whitespace-pre-wrap text-base-content text-sm leading-relaxed">{student.parentRequests || '-'}</p>
      </InfoCard>
    </div>
  );
};

export default StudentDetail;
