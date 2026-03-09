import React, { useState, useRef, useEffect } from 'react';
import { auth, firestore } from '../firebase';
import { Student, BehaviorRecord } from '../types';
import { extractStudentInfoFromFile } from '../services/geminiService';
import { useModal } from '../context/ModalContext';
import { AppSettings } from '../App';

export type View = 'dashboard' | 'form' | 'notice';

const TEMPLATE_FILE_URL = 'https://firebasestorage.googleapis.com/v0/b/forstudents-e1117.firebasestorage.app/o/forms%2FSample%20form.hwp?alt=media&token=7b598032-bd15-45a8-8106-03129ff7a90b';

export const useAppLogic = () => {
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

    const fileInputRef = useRef<HTMLInputElement>(null);

    const fetchStudents = async (uid: string, schoolYear: string) => {
        try {
            const snapshot = await firestore.collection('users').doc(uid).collection('students').orderBy('name.hangul').get();
            const allStudents = snapshot.docs.map((doc: any) => ({
                id: doc.id,
                ...doc.data()
            })) as Student[];

            const filtered = allStudents.filter(s => {
                const studentYear = s.schoolYear || "2025";
                return studentYear === schoolYear;
            });

            setStudents(filtered);
        } catch (error) {
            console.error("Error fetching students:", error);
        }
    };

    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged(async (currentUser: any) => {
            setUser(currentUser);
            setAuthLoading(false);

            if (currentUser) {
                setIsDataLoading(true);
                try {
                    const settingsRef = firestore.collection('users').doc(currentUser.uid).collection('appData').doc('settings');
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

                    await fetchStudents(currentUser.uid, newSettings.schoolYear || defaultSchoolYear);

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
            if (selectedStudent?.id === updatedStudent.id) {
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
            if (studentToUpdate) {
                const newRecords = [...(studentToUpdate.behaviorRecords || []), fullRecord];
                await studentRef.update({ behaviorRecords: newRecords });

                const updatedStudents = students.map(s => s.id === studentId ? { ...s, behaviorRecords: newRecords } : s);
                setStudents(updatedStudents);
                if (selectedStudent?.id === studentId) {
                    setSelectedStudent(prev => prev ? { ...prev, behaviorRecords: newRecords } : null);
                }
            }
        } catch (error) {
            console.error("Error adding behavior record:", error);
            await showAlert("기록 저장 중 오류가 발생했습니다.");
        }
    };

    const handleDeleteBehaviorRecord = async (studentId: string, recordId: string) => {
        if (!user) return;
        try {
            const studentRef = firestore.collection('users').doc(user.uid).collection('students').doc(studentId);
            const studentToUpdate = students.find(s => s.id === studentId);
            if (studentToUpdate) {
                const newRecords = (studentToUpdate.behaviorRecords || []).filter(r => r.id !== recordId);
                await studentRef.update({ behaviorRecords: newRecords });

                const updatedStudents = students.map(s => s.id === studentId ? { ...s, behaviorRecords: newRecords } : s);
                setStudents(updatedStudents);
                if (selectedStudent?.id === studentId) {
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
            let filename = '기초조사서_양식.hwp';
            const response = await fetch(TEMPLATE_FILE_URL);
            if (!response.ok) throw new Error('Download failed: ' + response.statusText);

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error("Direct download failed:", error);
            const link = document.createElement('a');
            link.href = TEMPLATE_FILE_URL;
            link.download = '기초조사서_양식.hwp';
            link.target = '_blank';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file || !user) return;

        const fileExtension = file.name.split('.').pop()?.toLowerCase();
        if (fileExtension === 'hwp' || fileExtension === 'hwpx') {
            await showAlert("지원하지 않는 파일 형식입니다. 한글 프로그램에서 'PDF로 저장' 기능을 이용하시거나 이미지를 캡처하여 업로드해주세요.");
            if (fileInputRef.current) fileInputRef.current.value = '';
            return;
        }

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
            if (fileInputRef.current) {
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
    };

    const handleLogout = () => {
        auth.signOut();
    };

    const onSelectStudent = (student: Student) => {
        setSelectedStudent(student);
    };

    return {
        user,
        authLoading,
        isDataLoading,
        isLoading,
        setIsLoading,
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
        handleLogout
    };
};
