
import { AttendanceType, AttendanceCategory } from '../types';

export const ATTENDANCE_SYMBOLS: Record<AttendanceType, Record<AttendanceCategory, string>> = {
  '결석': {
    '질병': '😷',
    '미인정': '❌',
    '기타': '💬',
    '인정': '✅', 
  },
  '지각': {
    '질병': '🤕',
    '미인정': '🚫',
    '기타': '💭',
    '인정': '👌', 
  },
  '조퇴': {
    '질병': '🏥',
    '미인정': '🏃',
    '기타': '👋',
    '인정': '👌', 
  },
  '결과': {
    '질병': '💊',
    '미인정': '🔇',
    '기타': '📉',
    '인정': '👌', 
  }
};

export const getAttendanceSymbol = (type: AttendanceType, category: AttendanceCategory): string => {
  return ATTENDANCE_SYMBOLS[type]?.[category] || '?';
};

export const ATTENDANCE_TYPES: { type: AttendanceType; label: string }[] = [
  { type: '결석', label: '결석' },
  { type: '지각', label: '지각' },
  { type: '조퇴', label: '조퇴' },
  { type: '결과', label: '결과' },
];

export const CATEGORIES: { category: AttendanceCategory; label: string; color: string }[] = [
  { category: '질병', label: '질병', color: 'text-yellow-700 bg-yellow-50 border-yellow-200' },
  { category: '미인정', label: '미인정', color: 'text-red-700 bg-red-50 border-red-200' },
  { category: '기타', label: '기타', color: 'text-gray-700 bg-gray-50 border-gray-200' },
  { category: '인정', label: '인정(체험/감염병 등)', color: 'text-green-700 bg-green-50 border-green-200' },
];
