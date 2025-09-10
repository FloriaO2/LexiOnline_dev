import React, { useState, useEffect } from 'react';
import './PasswordModal.css';

interface PasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (password: string) => void;
  roomTitle?: string;
}

const PasswordModal: React.FC<PasswordModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  roomTitle
}) => {
  const [password, setPassword] = useState('');

  useEffect(() => {
    if (isOpen) {
      setPassword('');
      // 모달이 열릴 때 첫 번째 입력 필드에 포커스
      const timer = setTimeout(() => {
        const input = document.getElementById('password-input');
        if (input) {
          input.focus();
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password.trim()) {
      onConfirm(password.trim());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="password-modal-overlay" onClick={onClose}>
      <div className="password-modal" onClick={(e) => e.stopPropagation()}>
        <div className="password-modal-header">
          <div className="password-modal-icon">🔒</div>
          <h3>비밀방 입장</h3>
          {roomTitle && <p className="room-title">{roomTitle}</p>}
        </div>
        
        <form onSubmit={handleSubmit} className="password-modal-form">
          <div className="password-input-group">
            <label htmlFor="password-input">비밀번호</label>
            <input
              id="password-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="비밀번호를 입력하세요"
              autoComplete="off"
              required
            />
          </div>
          
          <div className="password-modal-actions">
            <button
              type="button"
              className="btn btn-cancel"
              onClick={onClose}
            >
              취소
            </button>
            <button
              type="submit"
              className="btn btn-confirm"
              disabled={!password.trim()}
            >
              입장하기
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PasswordModal;
