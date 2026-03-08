
import React, { useState, useEffect, useRef } from 'react';
import { firestore } from '../firebase';
import { Notice, NoticeComment } from '../types';
import { useModal } from '../context/ModalContext';

// *** 중요: 여기에 개발자(관리자)의 이메일을 입력하세요 ***
const ADMIN_EMAILS = ['kth9302@gmail.com']; // 예시: 본인의 구글 이메일로 변경

interface NoticeBoardProps {
  user: any; // Firebase User object
}

type BoardView = 'list' | 'detail' | 'form';

const NoticeBoard = ({ user }: NoticeBoardProps): React.ReactElement => {
  const { showAlert, showConfirm, showToast } = useModal();
  const [view, setView] = useState<BoardView>('list');
  const [notices, setNotices] = useState<Notice[]>([]);
  const [selectedNotice, setSelectedNotice] = useState<Notice | null>(null);
  const [loading, setLoading] = useState(false);
  const [comments, setComments] = useState<NoticeComment[]>([]);

  // Form State
  const [formTitle, setFormTitle] = useState('');
  const [formContent, setFormContent] = useState(''); // This will now hold HTML
  const [commentInput, setCommentInput] = useState('');
  
  // Editor State
  const contentEditableRef = useRef<HTMLDivElement>(null);
  const [chordMode, setChordMode] = useState(false); // For Ctrl+M chord

  const isAdmin = user && user.email && ADMIN_EMAILS.includes(user.email);

  useEffect(() => {
    fetchNotices();
  }, []);

  const fetchNotices = async () => {
    setLoading(true);
    try {
      // Global notices collection
      const snapshot = await firestore.collection('notices').orderBy('createdAt', 'desc').get();
      const loadedNotices = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Notice));
      setNotices(loadedNotices);
    } catch (error) {
      console.error("Error fetching notices:", error);
      await showAlert("공지사항을 불러오는 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const fetchComments = async (noticeId: string) => {
    try {
      const snapshot = await firestore.collection('notices').doc(noticeId).collection('comments').orderBy('createdAt', 'asc').get();
      const loadedComments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as NoticeComment));
      setComments(loadedComments);
    } catch (error) {
        console.error("Error fetching comments", error);
    }
  };

  const handleSelectNotice = (notice: Notice) => {
    setSelectedNotice(notice);
    setComments([]);
    fetchComments(notice.id);
    setView('detail');
  };

  const handleCreateClick = () => {
    setFormTitle('');
    setFormContent('');
    setSelectedNotice(null);
    setView('form');
  };

  const handleEditClick = (notice: Notice) => {
    setFormTitle(notice.title);
    setFormContent(notice.content);
    setSelectedNotice(notice);
    setView('form');
  };

  // Editor Command Helper
  const execCmd = (command: string, value: string | undefined = undefined) => {
      document.execCommand(command, false, value);
      if (contentEditableRef.current) {
          contentEditableRef.current.focus();
      }
  };

  // Shortcut Handler
  const handleEditorKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
      // 1. Chord Mode Activation (Ctrl + m)
      if (e.ctrlKey && e.key === 'm') {
          e.preventDefault();
          setChordMode(true);
          showToast("색상 모드: R(레드) 또는 B(블루)를 누르세요.", 1000);
          return;
      }

      // 2. Chord Action (If chord mode is active)
      if (chordMode) {
          e.preventDefault();
          if (e.key === 'r' || e.key === 'R' || e.key === 'ㄱ') {
              execCmd('foreColor', '#ef4444'); // Tailwind red-500
              showToast("빨간색 적용");
          } else if (e.key === 'b' || e.key === 'B' || e.key === 'ㅠ') {
              execCmd('foreColor', '#3b82f6'); // Tailwind blue-500
              showToast("파란색 적용");
          } else {
              showToast("취소되었습니다.");
          }
          setChordMode(false);
          return;
      }

      // 3. Standard Shortcuts
      if (e.ctrlKey) {
          switch (e.key.toLowerCase()) {
              case 'b':
                  e.preventDefault();
                  execCmd('bold');
                  break;
              case 'u':
                  e.preventDefault();
                  execCmd('underline');
                  break;
          }
      }
  };

  const handleSaveNotice = async () => {
    // Get content from ref just to be sure we have the latest HTML
    const currentContent = contentEditableRef.current?.innerHTML || formContent;

    if (!formTitle.trim() || !currentContent.trim()) {
      await showAlert("제목과 내용을 모두 입력해주세요.");
      return;
    }

    try {
      const noticeData = {
        title: formTitle,
        content: currentContent,
        authorUid: user.uid,
        updatedAt: Date.now()
      };

      if (selectedNotice && selectedNotice.id) {
        // Update
        await firestore.collection('notices').doc(selectedNotice.id).update(noticeData);
        await showAlert("공지사항이 수정되었습니다.");
      } else {
        // Create
        await firestore.collection('notices').add({
          ...noticeData,
          createdAt: Date.now()
        });
        await showAlert("공지사항이 등록되었습니다.");
      }
      
      setView('list');
      fetchNotices();
    } catch (error) {
      console.error("Error saving notice:", error);
      await showAlert("저장 중 오류가 발생했습니다.");
    }
  };

  const handleDeleteNotice = async (noticeId: string) => {
    if (await showConfirm("정말 이 공지사항을 삭제하시겠습니까?")) {
      try {
        await firestore.collection('notices').doc(noticeId).delete();
        await showAlert("삭제되었습니다.");
        setView('list');
        fetchNotices();
      } catch (error) {
        await showAlert("삭제 실패");
      }
    }
  };

  const handleAddComment = async () => {
    if (!selectedNotice || !commentInput.trim()) return;
    
    try {
        const commentData = {
            noticeId: selectedNotice.id,
            authorName: user.displayName || '익명',
            authorUid: user.uid,
            content: commentInput.trim(),
            createdAt: Date.now()
        };
        const docRef = await firestore.collection('notices').doc(selectedNotice.id).collection('comments').add(commentData);
        setComments(prev => [...prev, { id: docRef.id, ...commentData }]);
        setCommentInput('');
    } catch (error) {
        console.error(error);
        showToast("댓글 등록 실패");
    }
  };

  const handleDeleteComment = async (commentId: string) => {
      if(!selectedNotice) return;
      if (await showConfirm("댓글을 삭제하시겠습니까?")) {
          try {
              await firestore.collection('notices').doc(selectedNotice.id).collection('comments').doc(commentId).delete();
              setComments(prev => prev.filter(c => c.id !== commentId));
          } catch(e) {
              console.error(e);
          }
      }
  };

  // --- Renders ---

  if (view === 'list') {
    return (
      <div className="w-full max-w-4xl mx-auto bg-base-100 rounded-xl shadow-lg border border-base-300/60 flex flex-col h-full overflow-hidden min-h-0">
        <div className="p-4 border-b border-base-300 bg-base-50 flex justify-between items-center shrink-0">
          <h2 className="text-xl font-bold text-base-content flex items-center gap-2">
            공지사항
          </h2>
          {isAdmin && (
            <button 
              onClick={handleCreateClick}
              className="bg-primary text-primary-content px-4 py-2 rounded-lg font-bold shadow-sm hover:bg-primary-focus transition-all text-sm"
            >
              글쓰기
            </button>
          )}
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
          {loading ? (
            <div className="flex justify-center p-8"><span className="loading loading-spinner text-primary"></span></div>
          ) : notices.length === 0 ? (
            <div className="text-center text-base-content-secondary py-10">등록된 공지사항이 없습니다.</div>
          ) : (
            <div className="space-y-2">
              {notices.map((notice, index) => (
                <div 
                  key={notice.id} 
                  onClick={() => handleSelectNotice(notice)}
                  className="bg-white p-4 rounded-xl border border-base-200 hover:border-primary/50 hover:shadow-md transition-all cursor-pointer group flex items-center gap-4"
                >
                  <div className="flex flex-col items-center justify-center bg-base-200 min-w-[3rem] h-12 rounded-lg border border-base-300 shrink-0">
                      <span className="text-xs font-bold text-base-content-secondary">No.</span>
                      <span className="font-bold text-primary text-lg leading-none">{notices.length - index}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center mb-1">
                        <h3 className="font-bold text-lg text-base-content group-hover:text-primary transition-colors truncate pr-2">
                            {notice.title}
                        </h3>
                        <span className="text-xs text-base-content-secondary whitespace-nowrap shrink-0">
                            {new Date(notice.createdAt).toLocaleDateString()}
                        </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (view === 'detail' && selectedNotice) {
    return (
      <div className="w-full max-w-4xl mx-auto bg-base-100 rounded-xl shadow-lg border border-base-300/60 flex flex-col h-full overflow-hidden min-h-0">
        <div className="p-4 border-b border-base-300 bg-base-50 flex justify-between items-center shrink-0">
          <button 
            onClick={() => setView('list')}
            className="text-base-content-secondary hover:text-base-content flex items-center gap-1 font-bold text-sm"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
            </svg>
            목록으로
          </button>
          {isAdmin && (
            <div className="flex gap-2">
              <button onClick={() => handleEditClick(selectedNotice)} className="text-xs bg-white border border-base-300 px-3 py-1.5 rounded-lg font-bold hover:bg-base-100">수정</button>
              <button onClick={() => handleDeleteNotice(selectedNotice.id)} className="text-xs bg-white text-red-500 border border-red-200 px-3 py-1.5 rounded-lg font-bold hover:bg-red-50">삭제</button>
            </div>
          )}
        </div>
        
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-base-content mb-2">{selectedNotice.title}</h1>
            <div className="flex items-center gap-2 text-sm text-base-content-secondary">
              <span>{new Date(selectedNotice.createdAt).toLocaleString()}</span>
              {selectedNotice.updatedAt && <span>(수정됨)</span>}
            </div>
          </div>
          
          {/* Changed to dangerouslySetInnerHTML to support HTML content from editor */}
          <div 
            className="prose max-w-none text-base-content whitespace-pre-wrap leading-relaxed mb-8 min-h-[100px]"
            dangerouslySetInnerHTML={{ __html: selectedNotice.content }}
          />

          <div className="border-t border-base-200 pt-6">
            <h3 className="font-bold text-base-content mb-4 flex items-center gap-2">
                💬 댓글 <span className="text-primary">{comments.length}</span>
            </h3>
            
            <div className="space-y-4 mb-6">
                {comments.map(comment => (
                    <div key={comment.id} className="bg-base-50 p-3 rounded-xl border border-base-200">
                        <div className="flex justify-between items-start mb-1">
                            <span className="font-bold text-sm text-base-content">{comment.authorName}</span>
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-base-content-secondary">{new Date(comment.createdAt).toLocaleDateString()}</span>
                                {(isAdmin || user.uid === comment.authorUid) && (
                                    <button onClick={() => handleDeleteComment(comment.id)} className="text-xs text-red-400 hover:text-red-600">삭제</button>
                                )}
                            </div>
                        </div>
                        <p className="text-sm text-base-content whitespace-pre-wrap">{comment.content}</p>
                    </div>
                ))}
                {comments.length === 0 && <p className="text-sm text-base-content-secondary italic">아직 댓글이 없습니다.</p>}
            </div>

            <div className="flex gap-2">
                <input 
                    type="text" 
                    value={commentInput}
                    onChange={(e) => setCommentInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddComment()}
                    placeholder="댓글을 입력하세요..."
                    className="flex-1 p-3 border border-base-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary text-sm bg-white text-gray-900"
                />
                <button 
                    onClick={handleAddComment}
                    className="bg-base-200 text-base-content font-bold px-4 rounded-xl hover:bg-base-300 transition-colors text-sm"
                >
                    등록
                </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'form' && isAdmin) {
    return (
      <div className="w-full max-w-4xl mx-auto bg-base-100 rounded-xl shadow-lg border border-base-300/60 flex flex-col h-full overflow-hidden min-h-0">
        <div className="p-4 border-b border-base-300 bg-base-50 flex justify-between items-center shrink-0">
          <h2 className="text-xl font-bold text-base-content">
            {selectedNotice ? '공지사항 수정' : '새 공지사항 작성'}
          </h2>
          <button 
            onClick={() => setView('list')}
            className="text-base-content-secondary hover:text-base-content font-bold text-sm"
          >
            취소
          </button>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 flex flex-col gap-4">
          <div>
            <label className="block text-sm font-bold text-base-content mb-1">제목</label>
            <input 
              type="text" 
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              className="w-full p-3 border border-base-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary font-bold text-base-content bg-white"
              placeholder="제목을 입력하세요"
            />
          </div>
          
          <div className="flex-1 flex flex-col">
            <label className="block text-sm font-bold text-base-content mb-1 flex justify-between items-center">
                <span>내용</span>
                <span className="text-xs text-base-content-secondary font-normal">
                    단축키: <b>Ctrl+B</b>(볼드), <b>Ctrl+U</b>(밑줄), <b>Ctrl+M→R</b>(빨강), <b>Ctrl+M→B</b>(파랑)
                </span>
            </label>
            
            {/* Simple Editor Toolbar */}
            <div className="flex items-center gap-1 p-2 bg-base-200 border border-base-300 rounded-t-xl border-b-0">
                <button 
                    onClick={() => execCmd('bold')} 
                    className="p-1.5 rounded hover:bg-base-300 font-bold w-8 text-center" 
                    title="굵게 (Ctrl+B)"
                >B</button>
                <button 
                    onClick={() => execCmd('underline')} 
                    className="p-1.5 rounded hover:bg-base-300 underline w-8 text-center" 
                    title="밑줄 (Ctrl+U)"
                >U</button>
                <div className="w-px h-4 bg-base-300 mx-1"></div>
                <button 
                    onClick={() => execCmd('foreColor', '#ef4444')} 
                    className="p-1.5 rounded hover:bg-base-300 text-red-500 font-bold w-8 text-center"
                    title="빨간색 (Ctrl+M 누른 후 R)"
                >A</button>
                <button 
                    onClick={() => execCmd('foreColor', '#3b82f6')} 
                    className="p-1.5 rounded hover:bg-base-300 text-blue-500 font-bold w-8 text-center"
                    title="파란색 (Ctrl+M 누른 후 B)"
                >A</button>
                <button 
                    onClick={() => execCmd('removeFormat')} 
                    className="p-1.5 rounded hover:bg-base-300 text-xs ml-auto"
                    title="서식 지우기"
                >서식제거</button>
            </div>

            {/* Rich Text Editor Div */}
            <div 
                ref={contentEditableRef}
                contentEditable
                className="w-full flex-1 p-4 border border-base-300 rounded-b-xl focus:ring-2 focus:ring-primary focus:border-primary focus:outline-none text-base-content leading-relaxed bg-white overflow-y-auto custom-scrollbar min-h-[300px]"
                onInput={(e) => setFormContent(e.currentTarget.innerHTML)}
                onKeyDown={handleEditorKeyDown}
                suppressContentEditableWarning={true}
                dangerouslySetInnerHTML={{ __html: formContent }} // Initial load
            />
          </div>

          <div className="flex justify-end">
            <button 
              onClick={handleSaveNotice}
              className="bg-primary text-primary-content px-6 py-3 rounded-xl font-bold shadow-md hover:bg-primary-focus transition-all"
            >
              저장하기
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <div>접근 권한이 없습니다.</div>;
};

export default NoticeBoard;
