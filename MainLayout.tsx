import React, { useState } from 'react';
import { Menu, Bell, Search, Settings, Users, Hash, LogOut, Plus } from 'lucide-react';
import useChatStore from '../../store/chatStore';
import ChatWindow from '../ChatWindow';
import GroupList from '../GroupList';
import UserList from '../UserList';
import SearchModal from '../SearchModal';
import NotificationsModal from '../NotificationsModal'; // Add this import
import './MainLayout.css';

const MainLayout: React.FC = () => {
  const { currentUser, logoutUser, currentServer, createGroup, getTotalNotifications } = useChatStore();
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false); // Add this
  const [newGroupName, setNewGroupName] = useState('');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const handleCreateGroup = async () => {
    if (newGroupName.trim()) {
      await createGroup(newGroupName.trim());
      setNewGroupName('');
      setShowCreateGroup(false);
    }
  };

  return (
    <div className="main-layout">
      {/* Top Navigation */}
      <nav className="top-nav">
        <div className="nav-left">
          <button
            className="menu-button"
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          >
            <Menu size={24} />
          </button>
          <div className="server-info">
            <h1 className="server-title">Distributed Chat | Server {currentServer?.split(':').pop()?.slice(-1) || '1'}</h1>
            <span className="online-badge">● Online</span>
          </div>
        </div>

        <div className="nav-right">
          <div className="search-container" onClick={() => setShowSearch(true)}>
            <Search size={20} />
            <input
              type="text"
              placeholder="Search messages, users, groups..."
              className="search-input"
              readOnly
            />
          </div>

          <button
            className="nav-icon"
            onClick={() => setShowNotifications(true)}
          >
            <Bell size={22} />
            {getTotalNotifications() > 0 && (
              <span className="notification-badge">{getTotalNotifications()}</span>
            )}
          </button>

          <button className="nav-icon">
            <Settings size={22} />
          </button>

          <div className="user-profile">
            <div className="avatar">{currentUser?.username.charAt(0).toUpperCase()}</div>
            <span className="username">{currentUser?.username}</span>
          </div>
        </div>
      </nav>

      <div className="main-content">
        {/* Left Sidebar */}
        <aside className={`sidebar ${isSidebarCollapsed ? 'collapsed' : ''}`}>
          <div className="sidebar-section">
            <h3 className="sidebar-title">
              <Users size={18} />
              ONLINE USERS
            </h3>
            <UserList />
          </div>

          <div className="sidebar-section">
            <h3 className="sidebar-title">
              <Hash size={18} />
              GROUPS
            </h3>
            <GroupList />
          </div>

          <div className="sidebar-section">
            <h3 className="sidebar-title">
              <Hash size={18} />
              ACTIVE GROUPS
            </h3>
            <div className="active-groups">
              {/* Active groups list */}
              <div className="active-group-item">
                <div className="group-avatar">D</div>
                <div className="group-info">
                  <div className="group-name">DevOps Team</div>
                  <div className="group-preview">Bob: Deployment successful...</div>
                </div>
                <div className="group-time">10:42</div>
              </div>
            </div>
          </div>

          <button
            className="create-group-button"
            onClick={() => setShowCreateGroup(true)}
          >
            <Plus size={18} />
            Create New Group
          </button>

          <button className="logout-button" onClick={logoutUser}>
            <LogOut size={18} />
            Logout
          </button>
        </aside>

        {/* Main Chat Area */}
        <main className="chat-area">
          <ChatWindow />
        </main>
      </div>

      {/* Create Group Modal */}
      {showCreateGroup && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Create New Group</h3>
            <input
              type="text"
              placeholder="Group Name"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              className="modal-input"
              onKeyDown={(e) => e.key === 'Enter' && handleCreateGroup()}
            />
            <div className="modal-buttons">
              <button onClick={() => setShowCreateGroup(false)}>Cancel</button>
              <button onClick={handleCreateGroup} disabled={!newGroupName.trim()}>
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Search Modal */}
      <SearchModal isOpen={showSearch} onClose={() => setShowSearch(false)} />

      {/* Notifications Modal */}
      <NotificationsModal
        isOpen={showNotifications}
        onClose={() => setShowNotifications(false)}
      />
    </div>
  );
};

export default MainLayout;
