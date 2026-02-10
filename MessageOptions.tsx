import React, { useState, useRef, useEffect } from 'react';
import { MoreVertical, Trash2, UserX, Globe, Flag, Edit2 } from 'lucide-react';
import './MessageOptions.css';

interface MessageOptionsProps {
  messageId: string;
  chatId: string;
  isPrivate: boolean;
  isOwnMessage: boolean;
  onDeleteForMe: () => void;
  onDeleteForEveryone: () => void;
  onEdit: () => void; // ADD THIS LINE
}

const MessageOptions: React.FC<MessageOptionsProps> = ({
  messageId,
  chatId,
  isPrivate,
  isOwnMessage,
  onDeleteForMe,
  onDeleteForEveryone,
  onEdit // ADD THIS LINE
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleDeleteForMe = () => {
    if (window.confirm('Delete this message only for you?')) {
      onDeleteForMe();
      setIsOpen(false);
    }
  };

  const handleDeleteForEveryone = () => {
    if (window.confirm('Delete this message for everyone? This action cannot be undone.')) {
      onDeleteForEveryone();
      setIsOpen(false);
    }
  };

  const handleEdit = () => {
    onEdit();
    setIsOpen(false);
  };

  return (
    <div className="message-options-container" ref={menuRef}>
      <button
        className="message-options-button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Message options"
      >
        <MoreVertical size={16} />
      </button>

      {isOpen && (
        <div className="message-options-menu">
          {/* Show Edit option for your own messages */}
          {isOwnMessage && (
            <button
              className="option-item edit"
              onClick={handleEdit}
            >
              <Edit2 size={16} />
              <span>Edit</span>
            </button>
          )}

          {/* ALWAYS show Delete for me option for any message */}
          <button
            className="option-item delete-for-me"
            onClick={handleDeleteForMe}
          >
            <UserX size={16} />
            <span>Delete for me</span>
          </button>

          {/* Only show Delete for everyone for messages YOU sent */}
          {isOwnMessage && (
            <button
              className="option-item delete-everyone"
              onClick={handleDeleteForEveryone}
            >
              <Globe size={16} />
              <span>Delete for everyone</span>
            </button>
          )}

          {/* Only show Report option for messages from others */}
          {!isOwnMessage && (
            <button
              className="option-item report"
              onClick={() => {
                if (window.confirm('Report this message to moderators?')) {
                  alert('Message reported to moderators');
                  setIsOpen(false);
                }
              }}
            >
              <Flag size={16} />
              <span>Report</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default MessageOptions;
