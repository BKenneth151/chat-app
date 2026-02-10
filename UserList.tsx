import React from 'react';
import { Wifi } from 'lucide-react';
import useChatStore from '../store/chatStore';
import './UserList.css';

const UserList: React.FC = () => {
  const { users, currentUser, setCurrentChat, getUserNotificationCount } = useChatStore();

  const handleUserClick = (userId: string) => {
    setCurrentChat(userId, 'user');
  };

  if (users.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon">👤</div>
        <p>No other users online</p>
      </div>
    );
  }

  // Filter out current user
  const otherUsers = users.filter(user => user.id !== currentUser?.id);

  return (
    <div className="user-list">
      {otherUsers.map(user => {
        // Get notification count for this user
        const notificationCount = getUserNotificationCount(user.id);

        return (
          <div
            key={user.id}
            className="user-item"
            onClick={() => handleUserClick(user.id)}
          >
            <div className="user-avatar-container">
              <div className={`user-avatar ${user.isOnline ? 'online' : 'offline'}`}>
                {user.username.charAt(0).toUpperCase()}
              </div>

              {/* Show unread badge if there are notifications */}
              {notificationCount > 0 && (
                <div className="unread-badge">
                  {notificationCount > 9 ? '9+' : notificationCount}
                </div>
              )}
            </div>

            <div className="user-info">
              <div className="user-name">
                {user.username}
                {user.isOnline && (
                  <span className="online-indicator">
                    <Wifi size={10} />
                    Online
                  </span>
                )}
              </div>
              <div className="user-server">Server: {user.serverId}</div>
            </div>

            {/* Alternative: Show dot indicator if no count but unread */}
            {notificationCount > 0 && (
              <div className="unread-indicator" />
            )}
          </div>
        );
      })}
    </div>
  );
};

export default UserList;
