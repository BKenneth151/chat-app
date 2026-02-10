import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  Paperclip, Image, File, Mic, Video, Send,
  MoreVertical, Users, CheckCircle, Download,
  Settings, Smile, Square, Play, Pause, Trash2,
  FastForward, Rewind, X, Reply, Edit2, Check, Clock
} from 'lucide-react';
import useChatStore from '../store/chatStore';
import SettingsModal from './SettingsModal';
import MessageOptions from './MessageOptions';
import './ChatWindow.css';

interface Message {
  id: string;
  sender: string;
  content: string;
  timestamp: string | Date;
  attachments?: string[];
  replyTo?: string;
  repliedMessage?: {
    id: string;
    sender: string;
    senderName?: string;
    content: string;
    timestamp: Date;
    isPrivate?: boolean;
  };
  read?: boolean;
  delivered?: boolean;
  deletedForMe?: boolean;
  deletedForEveryone?: boolean;
  isOwnMessage?: boolean;
  isPrivate?: boolean;
  senderName?: string;
  edited?: boolean;
  editedAt?: Date;
  pending?: boolean;
  deliveryAttempts?: number;
  lastDeliveryAttempt?: Date;
  type?: 'group' | 'private' | 'system';
  deletedBy?: string;
}

interface ChatPartner {
  id: string;
  username: string;
  isOnline: boolean;
  serverId?: string;
}

interface Group {
  id: string;
  name: string;
  members: string[];
}

interface CurrentChat {
  id: string;
  type: 'user' | 'group';
}

const ChatWindow: React.FC = () => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const [newMessage, setNewMessage] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedAudio, setRecordedAudio] = useState<Blob | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [showSpeedMenu, setShowSpeedMenu] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [swipingMessageId, setSwipingMessageId] = useState<string | null>(null);
  const [touchStart, setTouchStart] = useState<{x: number, y: number} | null>(null);
  const [mouseStart, setMouseStart] = useState<{x: number, y: number} | null>(null);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [editContent, setEditContent] = useState('');
  const [isSending, setIsSending] = useState(false);
  const lastSendTimeRef = useRef<number>(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioRefs = useRef<Map<string, HTMLAudioElement>>(new Map());
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const retryIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const {
    messages,
    currentChat,
    users,
    groups,
    currentUser,
    currentGroup,
    sendGroupMessage,
    sendPrivateMessage,
    editMessage,
    leaveGroup,
    startTyping,
    stopTyping,
    markAsRead,
    deleteMessage,
    retryFailedMessages,
    addToRetryQueue
  } = useChatStore();

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, currentChat, replyingTo, scrollToBottom]);

  useEffect(() => {
    if (currentChat) {
      markAsRead(currentChat.id, currentChat.type === 'user');
    }
  }, [currentChat, markAsRead]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
        setShowEmojiPicker(false);
      }
    };

    if (showEmojiPicker) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showEmojiPicker]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showSpeedMenu) {
        setShowSpeedMenu(null);
      }
    };

    if (showSpeedMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showSpeedMenu]);

  useEffect(() => {
    const handleTyping = () => {
      if (currentChat && newMessage.trim()) {
        startTyping(currentChat.id, currentChat.type === 'user');
      }
    };

    const typingTimeout = setTimeout(handleTyping, 500);
    return () => {
      clearTimeout(typingTimeout);
      if (currentChat && newMessage.trim()) {
        stopTyping(currentChat.id, currentChat.type === 'user');
      }
    };
  }, [newMessage, currentChat, startTyping, stopTyping]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (replyingTo) {
          cancelReply();
        }
        if (editingMessage) {
          setEditingMessage(null);
          setEditContent('');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [replyingTo, editingMessage]);

  useEffect(() => {
    retryIntervalRef.current = setInterval(() => {
      retryFailedMessages();
    }, 30000);

    return () => {
      if (retryIntervalRef.current) {
        clearInterval(retryIntervalRef.current);
      }
    };
  }, [retryFailedMessages]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      setAttachments(prev => [...prev, ...files]);
    }
  };

  const handleEmojiSelect = (emoji: string) => {
    if (editingMessage) {
      setEditContent(prev => prev + emoji);
    } else {
      setNewMessage(prev => prev + emoji);
    }
    setShowEmojiPicker(false);
  };

  const scrollToRepliedMessage = (messageId: string) => {
    const messageElement = document.getElementById(`message-${messageId}`);
    if (messageElement) {
      messageElement.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
      messageElement.classList.add('highlight-reply');
      setTimeout(() => {
        messageElement.classList.remove('highlight-reply');
      }, 2000);
    }
  };

  const startVoiceRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setRecordedAudio(audioBlob);
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        audioRefs.current.set('recording', audio);
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

      setShowVoiceRecorder(true);
    } catch (error) {
      alert('Could not access microphone.');
    }
  };

  const stopVoiceRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      setIsRecording(false);

      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
  };

  const playVoiceRecording = () => {
    const audio = audioRefs.current.get('recording');
    if (audio) {
      audio.play();
      setIsPlaying(true);
      audio.onended = () => {
        setIsPlaying(false);
      };
    }
  };

  const pauseVoiceRecording = () => {
    const audio = audioRefs.current.get('recording');
    if (audio) {
      audio.pause();
      setIsPlaying(false);
    }
  };

  const deleteVoiceRecording = () => {
    const audio = audioRefs.current.get('recording');
    if (audio) {
      audio.pause();
      URL.revokeObjectURL(audio.src);
      audioRefs.current.delete('recording');
    }
    setRecordedAudio(null);
    setIsPlaying(false);
    setShowVoiceRecorder(false);
  };

  const sendVoiceRecording = async () => {
    if (!currentChat || !recordedAudio) return;

    try {
      const reader = new FileReader();
      reader.readAsDataURL(recordedAudio);

      reader.onloadend = async () => {
        const audioData = reader.result as string;

        if (currentChat.type === 'group') {
          await sendGroupMessage(currentChat.id, '[Voice Message]', [audioData]);
        } else {
          await sendPrivateMessage(currentChat.id, '[Voice Message]', [audioData]);
        }

        deleteVoiceRecording();
      };
    } catch (error) {
      alert('Failed to send voice message');
    }
  };

  const handleSendMessage = async () => {
    if (isSending || !currentChat || (!newMessage.trim() && attachments.length === 0)) return;

    const now = Date.now();
    if (lastSendTimeRef.current && now - lastSendTimeRef.current < 1000) {
      return;
    }

    setIsSending(true);
    lastSendTimeRef.current = now;

    const content = newMessage.trim();
    const replyToId = replyingTo?.id;

    const attachmentUrls = attachments.map(file => ({
      url: URL.createObjectURL(file),
      name: file.name,
      type: file.type,
      size: file.size
    }));

    try {
      setNewMessage('');
      setAttachments([]);
      setReplyingTo(null);

      const attachmentUrlsOnly = attachmentUrls.map(a => a.url);

      let success;
      if (currentChat.type === 'group') {
        success = await sendGroupMessage(currentChat.id, content, attachmentUrlsOnly, replyToId);
      } else {
        success = await sendPrivateMessage(currentChat.id, content, attachmentUrlsOnly, replyToId);
      }

      if (success) {
        attachmentUrls.forEach(attachment => {
          URL.revokeObjectURL(attachment.url);
        });

        if (currentChat) {
          stopTyping(currentChat.id, currentChat.type === 'user');
        }
      }
    } catch (error) {
      alert('Failed to send message');
    } finally {
      setIsSending(false);
    }
  };

  const handleEditMessage = async () => {
    if (!editingMessage || !currentChat || !editContent.trim()) return;

    try {
      const success = await editMessage(
        editingMessage.id,
        currentChat.id,
        currentChat.type === 'user',
        editContent
      );

      if (success) {
        setEditingMessage(null);
        setEditContent('');
      }
    } catch (error) {
      alert('Failed to edit message');
    }
  };

  const handleRetryMessage = async (msg: Message) => {
    if (!currentChat) return;

    try {
      if (currentChat.type === 'group') {
        await sendGroupMessage(currentChat.id, msg.content, msg.attachments, msg.replyTo);
      } else {
        await sendPrivateMessage(currentChat.id, msg.content, msg.attachments, msg.replyTo);
      }
    } catch (error) {
      alert('Failed to resend message');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      e.stopPropagation();

      if (editingMessage) {
        handleEditMessage();
      } else {
        handleSendMessage();
      }
    }
  };

  const handleLeaveGroup = () => {
    if (currentChat?.type === 'group' && window.confirm('Are you sure you want to leave this group?')) {
      leaveGroup(currentChat.id);
    }
  };


  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDateTime = (date: Date | string) => {
    const d = new Date(date);
    return d.toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getDeliveryStatus = (msg: Message) => {
    if (msg.type === 'system') return { icon: null, color: 'transparent', text: '' };
    if (msg.pending) return { icon: <Clock size={12} />, color: '#9ca3af', text: 'Sending...' };
    if (msg.delivered && msg.read) return { icon: '✓✓', color: '#10b981', text: 'Read' };
    if (msg.delivered) return { icon: '✓✓', color: '#6b7280', text: 'Delivered' };
    return { icon: '✓', color: '#9ca3af', text: 'Sent' };
  };

  const playAudioMessage = (audioData: string, messageId: string) => {
    try {
      if (!audioData || audioData.trim() === '') {
        alert('Audio data is empty');
        return;
      }

      if (!audioData.startsWith('data:audio/') && !audioData.startsWith('data:application/octet-stream')) {
        alert('Invalid audio format');
        return;
      }

      if (playingAudioId && playingAudioId !== messageId) {
        const prevAudio = audioRefs.current.get(playingAudioId);
        if (prevAudio) {
          prevAudio.pause();
          prevAudio.currentTime = 0;
        }
      }

      let audio = audioRefs.current.get(messageId);
      if (!audio) {
        audio = new Audio(audioData);
        audioRefs.current.set(messageId, audio);
      }

      audio.playbackRate = playbackSpeed;

      audio.onerror = (e) => {
        setPlayingAudioId(null);
        setCurrentTime(0);
        setDuration(0);
        if (progressIntervalRef.current) {
          clearInterval(progressIntervalRef.current);
        }
        alert('Cannot play audio.');
      };

      audio.oncanplaythrough = () => {
        setDuration(audio!.duration);
      };

      audio.onended = () => {
        setPlayingAudioId(null);
        setCurrentTime(0);
        if (progressIntervalRef.current) {
          clearInterval(progressIntervalRef.current);
        }
      };

      audio.ontimeupdate = () => {
        setCurrentTime(audio!.currentTime);
      };

      setPlayingAudioId(messageId);

      const playPromise = audio.play();

      if (playPromise !== undefined) {
        playPromise.then(() => {
          if (progressIntervalRef.current) {
            clearInterval(progressIntervalRef.current);
          }

          progressIntervalRef.current = setInterval(() => {
            const currentAudio = audioRefs.current.get(messageId);
            if (currentAudio && !currentAudio.paused) {
              setCurrentTime(currentAudio.currentTime);
            }
          }, 100);

        }).catch(error => {
          setPlayingAudioId(null);
          setCurrentTime(0);
          setDuration(0);
          if (progressIntervalRef.current) {
            clearInterval(progressIntervalRef.current);
          }
          alert('Cannot play audio.');
        });
      }
    } catch (error) {
      alert('Error playing audio message');
    }
  };

  const pauseAudioMessage = (messageId: string) => {
    const audio = audioRefs.current.get(messageId);
    if (audio) {
      audio.pause();
      setPlayingAudioId(null);
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    }
  };

  const changePlaybackSpeed = (speed: number, messageId: string) => {
    setPlaybackSpeed(speed);
    const audio = audioRefs.current.get(messageId);
    if (audio) {
      audio.playbackRate = speed;
    }
    setShowSpeedMenu(null);
  };

  const handleReplySymbolClick = (e: React.MouseEvent, message: Message) => {
    e.stopPropagation();
    if (message.type !== 'system') {
      setReplyingTo(message);
    }
  };

  const handleReplySymbolTouch = (e: React.TouchEvent, message: Message) => {
    e.stopPropagation();
    if (message.type !== 'system') {
      setReplyingTo(message);
    }
  };

  const handleMessageClick = (e: React.MouseEvent, message: Message) => {
    if (swipingMessageId) {
      e.preventDefault();
      return;
    }
  };

  const cancelReply = () => {
    setReplyingTo(null);
  };

  const emojis = [
  '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃',
  '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😋',
  '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐',
  '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '🤥', '😌',
  '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮', '🤧',
  '🥵', '🥶', '🥴', '😵', '🤯', '🤠', '🥳', '😎', '🤓', '🧐',
  '😕', '😟', '🙁', '☹️', '😮', '😯', '😲', '😳', '🥺', '😦',
  '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔',
  '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '☮️', '✝️',
  '☪️', '🕉️', '☸️', '✡️', '🔯', '🕎', '☯️', '☦️', '🛐', '⛎',
  '♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑',
  '♒', '♓', '🆔', '⚛️', '🕊️', '💢', '💥', '💫', '💦', '💨',
  '🕳️', '💣', '💬', '👁️‍🗨️', '🗨️', '🗯️', '💭', '💤', '👋', '🤚',
  '🖐️', '✋', '🖖', '👌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙',
  '👈', '👉', '👆', '🖕', '👇', '☝️', '👍', '👎', '✊', '👊'
];

  if (!currentChat) {
    return (
      <div className="welcome-screen">
        <div className="welcome-content">
          <div className="welcome-icon">💬</div>
          <h2>Welcome to Distributed Chat</h2>
          <p>Select a group or user to start chatting</p>
        </div>
      </div>
    );
  }

  const isGroupChat = currentChat.type === 'group';
  const chatPartner = users.find(u => u.id === currentChat.id) as ChatPartner | undefined;
  const group = groups.find(g => g.id === currentChat.id) as Group | undefined;

  const chatKey = currentUser && isGroupChat
    ? currentChat.id
    : currentUser ? [currentUser.id, currentChat.id].sort().join('_') : '';
  const chatMessages = (messages.get(chatKey) || []) as Message[];

  return (
    <>
      <div className="chat-window">
        <div className="chat-header">
          <div className="header-left">
            <div className="chat-avatar">
              {isGroupChat ? (
                <div className="group-avatar">{group?.name.charAt(0).toUpperCase() || 'G'}</div>
              ) : (
                <div className={`user-avatar ${chatPartner?.isOnline ? 'online' : ''}`}>
                  {chatPartner?.username.charAt(0).toUpperCase() || 'U'}
                </div>
              )}
            </div>
            <div className="chat-info" style={{ color: '#111827' }}>
              <h2 className="chat-name" style={{ color: '#111827' }}>
                {isGroupChat ? group?.name : chatPartner?.username}
                {isGroupChat && group && (
                  <span className="member-count">
                    <Users size={14} />
                    {group.members.length} members
                  </span>
                )}
              </h2>
              <div className="chat-status" style={{ color: '#4b5563' }}>
                <span className={`status-dot ${isGroupChat ? 'group' : chatPartner?.isOnline ? 'online' : 'offline'}`} />
                {isGroupChat ? 'Group Chat' : (chatPartner?.isOnline ? 'Online' : 'Offline')}
                {!isGroupChat && chatPartner?.serverId && (
                  <span className="server-tag">Server: {chatPartner.serverId}</span>
                )}
              </div>
            </div>
          </div>

          <div className="header-right">
            <button
              className="header-button settings-button"
              onClick={() => setShowSettings(true)}
              title="Settings"
            >
              <Settings size={20} />
            </button>

            {isGroupChat && (
              <button className="header-button" onClick={handleLeaveGroup}>
                <CheckCircle size={20} />
                <span>Joined</span>
              </button>
            )}

            <button className="header-button">
              <MoreVertical size={20} />
            </button>
          </div>
        </div>

        <div className="messages-area">
          {chatMessages.length === 0 ? (
            <div className="empty-chat">
              <div className="empty-icon">
                {isGroupChat ? '👥' : '👤'}
              </div>
              <h3>{isGroupChat ? 'Group created!' : 'Start a conversation'}</h3>
              <p>
                {isGroupChat
                  ? 'Send the first message to get the conversation started'
                  : 'Say hello to start chatting'
                }
              </p>
            </div>
          ) : (
            <div className="messages-list">
              <div className="welcome-message">
                <span className="welcome-tag">Welcome to #{isGroupChat ? group?.name : 'chat'}!</span>
                <p>This is the start of the distributed chat history.</p>
              </div>

              {chatMessages.map((msg, index) => {
                const isOwnMessage = msg.sender === currentUser?.id || Boolean(msg.isOwnMessage);
                const sender = users.find(u => u.id === msg.sender);
                const previousMessage = chatMessages[index - 1];
                const showSender = !previousMessage || previousMessage.sender !== msg.sender;
                const isVoiceMessage = msg.content === '[Voice Message]' ||
                                      (msg.attachments && msg.attachments.some(att =>
                                        att.includes('data:audio') || att.includes('audio/')));
                const isPlayingThis = playingAudioId === msg.id;
                const isDeleted = Boolean(msg.deletedForEveryone) || (Boolean(msg.deletedForMe) && isOwnMessage);
                const isSwipingThis = swipingMessageId === msg.id;
                const isSystemMessage = msg.type === 'system';
                const status = getDeliveryStatus(msg);

                if (isSystemMessage) {
                  return (
                    <div key={msg.id} className="message-system">
                      <div className="message-content">
                        {msg.content}
                        <span className="message-time">
                          {new Date(msg.timestamp).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                    </div>
                  );
                }

                if (isDeleted) {
                  return (
                    <div
                      key={msg.id}
                      className={`message-container ${isOwnMessage ? 'own' : 'other'}`}
                    >
                      <div className="message-bubble">
                        <div className="message-content deleted-message">
                          <span className="deleted-text">This message was deleted</span>
                          <div className="message-meta">
                            <span className="message-time">
                              {new Date(msg.timestamp).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                            {msg.deletedBy && msg.deletedBy !== currentUser?.id && (
                              <span className="deleted-by">
                                (deleted by {users.find(u => u.id === msg.deletedBy)?.username || 'user'})
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={msg.id}
                    id={`message-${msg.id}`}
                    className={`message-container ${isOwnMessage ? 'own' : 'other'}`}
                  >
                    {!isOwnMessage && showSender && !isSystemMessage && (
                      <div className="sender-info">
                        <div className="sender-avatar">
                          {sender?.username.charAt(0).toUpperCase() || 'U'}
                        </div>
                        <span className="sender-name">{sender?.username}</span>
                      </div>
                    )}

                    <div
                      className={`message-bubble ${isSwipingThis ? 'swiping' : ''} ${isSystemMessage ? 'system' : ''}`}
                      onClick={(e) => handleMessageClick(e, msg)}
                    >
                      {!isSystemMessage && (
                        <div
                          className="reply-hint"
                          onClick={(e) => handleReplySymbolClick(e, msg)}
                          onTouchStart={(e) => handleReplySymbolTouch(e, msg)}
                          title="Reply to this message"
                        >
                          <Reply size={14} />
                        </div>
                      )}

                      {msg.replyTo && msg.repliedMessage && (
                        <div
                          className="message-reply-indicator clickable"
                          onClick={() => scrollToRepliedMessage(msg.replyTo!)}
                          title="Click to view original message"
                        >
                          <div className="reply-line"></div>
                          <div className="reply-preview-small">
                            <span className="reply-sender">
                              {users.find(u => u.id === msg.repliedMessage?.sender)?.username ||
                               msg.repliedMessage?.senderName ||
                               (msg.repliedMessage?.sender === currentUser?.id ? 'You' : 'Unknown')}
                            </span>
                            <span className="reply-content">
                              {msg.repliedMessage.content.length > 50
                                ? `${msg.repliedMessage.content.substring(0, 50)}...`
                                : msg.repliedMessage.content}
                            </span>
                          </div>
                        </div>
                      )}

                      <div className="message-content">
                        {!isVoiceMessage && msg.content}
                        {msg.edited && (
                          <span className="message-edited" title={`Edited at ${formatDateTime(msg.editedAt || msg.timestamp)}`}>
                            (edited)
                          </span>
                        )}

                        {isVoiceMessage && (
                          <div className={`voice-message-player ${isPlayingThis ? 'playing' : ''}`}>
                            <button
                              className="play-voice-btn"
                              onClick={() => {
                                if (isPlayingThis) {
                                  pauseAudioMessage(msg.id);
                                } else {
                                  if (msg.attachments && msg.attachments[0]) {
                                    playAudioMessage(msg.attachments[0], msg.id);
                                  } else {
                                    alert('No audio data found in this message');
                                  }
                                }
                              }}
                              title={isPlayingThis ? "Pause voice message" : "Play voice message"}
                            >
                              {isPlayingThis ? <Pause size={20} /> : <Play size={20} />}
                            </button>
                            <div className="voice-message-info">
                              <span className="voice-label">Voice Message</span>

                              <div className="voice-progress-container">
                                <div className="voice-progress-bar">
                                  <div
                                    className="voice-progress-fill"
                                    style={{
                                      width: duration > 0 ? `${(currentTime / duration) * 100}%` : '0%'
                                    }}
                                  />
                                </div>
                                <div className="voice-controls-bottom">
                                  <span className="voice-duration">
                                    {formatTime(currentTime)} / {formatTime(duration)}
                                  </span>
                                  {isPlayingThis && (
                                    <div className="playback-speed-container">
                                      <button
                                        className="speed-toggle-btn"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setShowSpeedMenu(showSpeedMenu === msg.id ? null : msg.id);
                                        }}
                                        title={`Speed: ${playbackSpeed}x`}
                                      >
                                        {playbackSpeed}x
                                      </button>
                                      {showSpeedMenu === msg.id && (
                                        <div className="speed-menu">
                                          <button onClick={() => changePlaybackSpeed(0.5, msg.id)}>0.5x</button>
                                          <button onClick={() => changePlaybackSpeed(1.0, msg.id)}>1.0x</button>
                                          <button onClick={() => changePlaybackSpeed(1.5, msg.id)}>1.5x</button>
                                          <button onClick={() => changePlaybackSpeed(2.0, msg.id)}>2.0x</button>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>

                            {isPlayingThis && (
                              <div className="sound-waves">
                                <div className="wave"></div>
                                <div className="wave"></div>
                                <div className="wave"></div>
                                <div className="wave"></div>
                              </div>
                            )}
                          </div>
                        )}

                        {msg.attachments && msg.attachments.length > 0 && !isVoiceMessage && (
                          <div className="attachments">
                            {msg.attachments.map((attachment, idx) => {
                              if (attachment.includes('data:audio') || attachment.includes('audio/')) {
                                return (
                                  <div key={idx} className="voice-attachment">
                                    <button
                                      className="play-voice-btn"
                                      onClick={() => playAudioMessage(attachment, `attachment_${idx}`)}
                                    >
                                      <Play size={16} />
                                    </button>
                                    <span>Voice Message</span>
                                  </div>
                                );
                              }

                              return (
                                <div key={idx} className="attachment">
                                  <File size={16} />
                                  <span>{attachment.split('/').pop()}</span>
                                  <button
                                    className="download-btn"
                                    onClick={() => window.open(attachment, '_blank')}
                                  >
                                    <Download size={14} />
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      <div className="message-meta">
                        <span className="message-time">
                          {new Date(msg.timestamp).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                        {isOwnMessage && status.icon && (
                          <span className="message-status" style={{ color: status.color }} title={status.text}>
                            {status.icon}
                          </span>
                        )}
                        {msg.pending && (
                          <button
                            className="retry-message-btn"
                            onClick={() => handleRetryMessage(msg)}
                            title="Retry sending"
                          >
                            ↻
                          </button>
                        )}
                        {isOwnMessage && !msg.pending && (
                          <button
                            className="edit-message-btn"
                            onClick={() => {
                              setEditingMessage(msg);
                              setEditContent(msg.content);
                            }}
                            title="Edit message"
                          >
                            <Edit2 size={12} />
                          </button>
                        )}
                        <MessageOptions
                          messageId={msg.id}
                          chatId={currentChat.id}
                          isPrivate={currentChat.type === 'user'}
                          isOwnMessage={isOwnMessage}
                          onDeleteForMe={() => {
                            if (msg.deletedForEveryone) {
                              alert("This message is already deleted for everyone");
                              return;
                            }
                            deleteMessage(msg.id, currentChat.id, currentChat.type === 'user', false);
                          }}
                          onDeleteForEveryone={() => {
                            if (msg.deletedForEveryone) {
                              alert("This message is already deleted for everyone");
                              return;
                            }
                            if (window.confirm('Are you sure you want to delete this message for everyone?')) {
                              deleteMessage(msg.id, currentChat.id, currentChat.type === 'user', true);
                            }
                          }}
                          onEdit={() => {
                            if (msg.deletedForEveryone || msg.deletedForMe) {
                              alert("Cannot edit a deleted message");
                              return;
                            }
                            setEditingMessage(msg);
                            setEditContent(msg.content);
                          }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {attachments.length > 0 && (
          <div className="attachment-preview">
            {attachments.map((file, index) => (
              <div key={index} className="attachment-item">
                <File size={16} />
                <span className="file-name">{file.name}</span>
                <button
                  className="remove-attachment"
                  onClick={() => setAttachments(attachments.filter((_, i) => i !== index))}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        {replyingTo && (
          <div className="reply-preview">
            <div className="reply-preview-header">
              <span className="reply-label">
                <Reply size={14} />
                Replying to {users.find(u => u.id === replyingTo.sender)?.username ||
                           (replyingTo.sender === currentUser?.id ? 'You' : 'Unknown')}
              </span>
              <button className="cancel-reply-btn" onClick={cancelReply} title="Cancel reply">
                <X size={16} />
              </button>
            </div>
            <div className="reply-preview-content">
              {replyingTo.content && (replyingTo.content.length > 100
                ? `${replyingTo.content.substring(0, 100)}...`
                : replyingTo.content)}
            </div>
          </div>
        )}

        {showVoiceRecorder && recordedAudio && (
          <div className="voice-recorder-preview">
            <div className="voice-controls">
              <button
                className="voice-control-btn"
                onClick={isPlaying ? pauseVoiceRecording : playVoiceRecording}
              >
                {isPlaying ? <Pause size={16} /> : <Play size={16} />}
              </button>
              <div className="voice-info">
                <span className="voice-duration">{formatTime(recordingTime)}</span>
                <span className="voice-label">Voice Message</span>
              </div>
              <div className="voice-actions">
                <button
                  className="voice-action-btn delete"
                  onClick={deleteVoiceRecording}
                  title="Delete"
                >
                  <Trash2 size={16} />
                </button>
                <button
                  className="voice-action-btn send"
                  onClick={sendVoiceRecording}
                  title="Send"
                >
                  <Send size={16} />
                </button>
              </div>
            </div>
            <button
              className="cancel-voice-btn"
              onClick={deleteVoiceRecording}
            >
              Cancel
            </button>
          </div>
        )}

        <div className="message-input-container">
          <div className="input-buttons">
            <button
              className="input-button"
              onClick={() => fileInputRef.current?.click()}
              title="Attach files"
            >
              <Paperclip size={20} />
            </button>
            <button
              className={`input-button ${isRecording ? 'recording' : ''}`}
              onClick={showVoiceRecorder ? stopVoiceRecording : startVoiceRecording}
              title={showVoiceRecorder ? "Stop recording" : "Record voice note"}
            >
              {showVoiceRecorder ? <Square size={20} /> : <Mic size={20} />}
              {isRecording && <span className="recording-dot"></span>}
            </button>
            <div className="emoji-picker-container" ref={emojiPickerRef}>
              <button
                className="input-button"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                title="Emoji"
              >
                <Smile size={20} />
              </button>

              {showEmojiPicker && (
                <div className="emoji-picker">
                  <div className="emoji-picker-header">
                    <span>Emoji</span>
                    <button
                      className="close-emoji-btn"
                      onClick={() => setShowEmojiPicker(false)}
                    >
                      ×
                    </button>
                  </div>
                  <div className="emoji-grid">
                    {emojis.map((emoji, index) => (
                      <button
                        key={index}
                        className="emoji-btn"
                        onClick={() => handleEmojiSelect(emoji)}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <button className="input-button" title="Video">
              <Video size={20} />
            </button>
          </div>

          <div className="text-input-area">
            <textarea
              value={editingMessage ? editContent : newMessage}
              onChange={(e) => editingMessage ? setEditContent(e.target.value) : setNewMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`${editingMessage ? 'Edit message...' : `Type a message to ${isGroupChat ? group?.name : chatPartner?.username}...`}`}
              className="message-textarea"
              rows={1}
            />
            {editingMessage ? (
              <>
                <button
                  className="send-button cancel-edit"
                  onClick={() => {
                    setEditingMessage(null);
                    setEditContent('');
                  }}
                  title="Cancel edit"
                >
                  <X size={20} />
                </button>
                <button
                  className="send-button"
                  onClick={handleEditMessage}
                  disabled={!editContent.trim()}
                  title="Save changes"
                >
                  <Check size={20} />
                </button>
              </>
            ) : (
              <button
                className="send-button"
                onClick={handleSendMessage}
                disabled={!newMessage.trim() && attachments.length === 0}
                title="Send message"
              >
                <Send size={20} />
              </button>
            )}
          </div>

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            multiple
            accept="image/*,video/*,.pdf,.doc,.docx,.txt"
            className="file-input-hidden"
          />

          <div className="input-hint">
            <span>{editingMessage ? 'Press Enter to save, Escape to cancel' : 'Enter to send. Shift + Enter for new line'}</span>
            {showVoiceRecorder && (
              <span className="recording-hint">
                {isRecording ? `Recording... ${formatTime(recordingTime)}` : 'Voice recorder active'}
              </span>
            )}
          </div>
        </div>
      </div>

      {editingMessage && (
        <div className="edit-message-modal" onClick={() => setEditingMessage(null)}>
          <div className="edit-modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Edit Message</h3>
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              rows={3}
              autoFocus
            />
            <div className="edit-modal-actions">
              <button onClick={() => setEditingMessage(null)}>Cancel</button>
              <button onClick={handleEditMessage} disabled={!editContent.trim()}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
      />
    </>
  );
};

export default ChatWindow;
