import React, { useState, useEffect } from 'react';
import { Bell, X, User, Hash, Clock, Check } from 'lucide-react';
import useChatStore from '../store/chatStore';
import './NotificationsModal.css';

interface UserNotification {
  id: string;
  userId: string; // The user who sent the message
  senderId: string;
  senderName: string;
  content: string;
  timestamp: Date;
  isRead: boolean;
  isPrivate: true;
}

interface GroupNotification {
  id: string;
  groupId: string; // The group where the message was sent
  senderId: string;
  senderName: string;
  content: string;
  timestamp: Date;
  isRead: boolean;
  isPrivate: false;
}

type Notification = UserNotification | GroupNotification;

interface NotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const NotificationsModal: React.FC<NotificationsModalProps> = ({ isOpen, onClose }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { setCurrentChat, clearNotification, currentUser } = useChatStore();

  useEffect(() => {
    if (isOpen) {
      loadNotifications();
    }
  }, [isOpen]);

  const loadNotifications = () => {
    setIsLoading(true);
    try {
      // Load notifications from localStorage - check both types
      const userNotifs: UserNotification[] = JSON.parse(localStorage.getItem('user_notifications') || '[]')
        .map((notif: any) => ({ ...notif, isPrivate: true }));

      const groupNotifs: GroupNotification[] = JSON.parse(localStorage.getItem('group_notifications') || '[]')
        .map((notif: any) => ({ ...notif, isPrivate: false }));

      // Combine and sort by timestamp
      const allNotifs = [...userNotifs, ...groupNotifs]
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      setNotifications(allNotifs);

      // Mark all as read in localStorage
      const readUserNotifs = userNotifs.map((notif: UserNotification) => ({
        ...notif,
        isRead: true
      }));
      const readGroupNotifs = groupNotifs.map((notif: GroupNotification) => ({
        ...notif,
        isRead: true
      }));

      localStorage.setItem('user_notifications', JSON.stringify(readUserNotifs));
      localStorage.setItem('group_notifications', JSON.stringify(readGroupNotifs));
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    console.log('📌 Handling notification click:', notification);

    let chatId: string;
    let chatType: 'user' | 'group';

    if (notification.isPrivate) {
      // For private messages, chatId is the sender's ID
      chatId = notification.senderId;
      chatType = 'user';
    } else {
      // For group messages, chatId is the group ID
      chatId = notification.groupId;
      chatType = 'group';
    }

    console.log('📌 Navigating to:', { chatId, chatType });

    // Navigate to chat
    setCurrentChat(chatId, chatType);

    // Clear the notification from store
    clearNotification(chatId, notification.isPrivate);

    // Remove from localStorage
    if (notification.isPrivate) {
      const updatedNotifs = JSON.parse(localStorage.getItem('user_notifications') || '[]')
        .filter((n: UserNotification) => n.id !== notification.id);
      localStorage.setItem('user_notifications', JSON.stringify(updatedNotifs));
    } else {
      const updatedNotifs = JSON.parse(localStorage.getItem('group_notifications') || '[]')
        .filter((n: GroupNotification) => n.id !== notification.id);
      localStorage.setItem('group_notifications', JSON.stringify(updatedNotifs));
    }

    // Update local state
    setNotifications(prev => prev.filter(n => n.id !== notification.id));

    onClose();
  };

  const clearAllNotifications = () => {
    localStorage.removeItem('user_notifications');
    localStorage.removeItem('group_notifications');
    setNotifications([]);
  };

  const formatTime = (timestamp: Date) => {
    try {
      const date = new Date(timestamp);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      return 'Recently';
    }
  };

  const getSenderName = (notification: Notification): string => {
    return notification.senderName || 'Unknown';
  };

  const getNotificationContent = (notification: Notification): string => {
    return notification.content || 'New message';
  };

  if (!isOpen) return null;

  return (
    <div className="notifications-modal-overlay" onClick={onClose}>
      <div className="notifications-modal" onClick={e => e.stopPropagation()}>
        <div className="notifications-header">
          <div className="header-left">
            <Bell size={24} />
            <h2>Notifications</h2>
            {notifications.length > 0 && (
              <span className="count-badge">{notifications.length}</span>
            )}
          </div>
          <div className="header-right">
            {notifications.length > 0 && (
              <button className="clear-all" onClick={clearAllNotifications}>
                Clear all
              </button>
            )}
            <button className="close-button" onClick={onClose}>
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="notifications-list">
          {isLoading ? (
            // Loading skeleton
            Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="notification-item loading-notification">
                <div className="notification-icon" style={{ background: '#e5e7eb' }}></div>
                <div className="notification-content">
                  <div className="notification-header" style={{ marginBottom: '8px' }}>
                    <div style={{
                      width: '100px',
                      height: '16px',
                      background: '#e5e7eb',
                      borderRadius: '4px'
                    }}></div>
                  </div>
                  <div style={{
                    width: '80%',
                    height: '14px',
                    background: '#f3f4f6',
                    borderRadius: '4px',
                    marginBottom: '8px'
                  }}></div>
                  <div style={{
                    width: '60px',
                    height: '12px',
                    background: '#f3f4f6',
                    borderRadius: '4px'
                  }}></div>
                </div>
              </div>
            ))
          ) : notifications.length === 0 ? (
            <div className="empty-notifications">
              <Bell size={48} className="empty-icon" />
              <h3>No notifications</h3>
              <p>You're all caught up!</p>
            </div>
          ) : (
            notifications.map(notification => (
              <div
                key={notification.id}
                className={`notification-item ${notification.isRead ? 'read' : 'unread'}`}
                onClick={() => handleNotificationClick(notification)}
                title="Click to open chat"
              >
                <div
                  className="notification-icon"
                  data-type={notification.isPrivate ? "private" : "group"}
                >
                  {notification.isPrivate ? (
                    <User size={20} />
                  ) : (
                    <Hash size={20} />
                  )}
                </div>
                <div className="notification-content">
                  <div className="notification-header">
                    <span className="sender-name">{getSenderName(notification)}</span>
                    <span className="notification-type">
                      {notification.isPrivate ? 'sent you a message' : 'mentioned you'}
                    </span>
                  </div>
                  <div className="message-preview">
                    {getNotificationContent(notification)}
                  </div>
                  <div className="notification-footer">
                    <div className="time">
                      <Clock size={12} />
                      {formatTime(notification.timestamp)}
                    </div>
                    {!notification.isRead && (
                      <div className="unread-dot" title="Unread" />
                    )}
                  </div>
                </div>
                <div className="notification-actions">
                  <Check size={16} className="check-icon" />
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default NotificationsModal;
