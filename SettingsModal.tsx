import React, { useState } from 'react';
import { Settings, X, User, LogOut, Users, AlertCircle } from 'lucide-react';
import useChatStore from '../store/chatStore';
import './SettingsModal.css';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const { currentUser, groups, leaveGroup, logoutUser, updateUsername } = useChatStore();

  const [newUsername, setNewUsername] = useState(currentUser?.username || '');
  const [selectedGroup, setSelectedGroup] = useState('');
  const [isChangingUsername, setIsChangingUsername] = useState(false);

  const handleLeaveGroup = async () => {
    if (!selectedGroup) return;

    if (window.confirm('Are you sure you want to leave this group? You won\'t be able to rejoin unless invited.')) {
      try {
        await leaveGroup(selectedGroup);
        setSelectedGroup('');
        alert('Successfully left the group!');
      } catch (error) {
        console.error('Failed to leave group:', error);
        alert('Failed to leave group. Please try again.');
      }
    }
  };

  const handleChangeUsername = async () => {
    if (!newUsername.trim() || newUsername === currentUser?.username) return;

    if (window.confirm('Are you sure you want to change your username?')) {
      setIsChangingUsername(true);
      try {
        const success = await updateUsername(newUsername);

        if (success) {
          alert('Username changed successfully!');
          setIsChangingUsername(false);
          setNewUsername(newUsername);
        } else {
          alert('Failed to change username. The username might already be taken.');
          setIsChangingUsername(false);
        }
      } catch (error) {
        console.error('Failed to change username:', error);
        alert('Failed to change username. Please try again.');
        setIsChangingUsername(false);
      }
    }
  };

  const handleLogout = () => {
    if (window.confirm('Are you sure you want to logout?')) {
      logoutUser();
      onClose();
    }
  };

  const userGroups = groups.filter(group =>
    currentUser && group.members.includes(currentUser.id)
  );

  if (!isOpen) return null;

  return (
    <div className="settings-modal-overlay" onClick={onClose}>
      <div className="settings-modal" onClick={e => e.stopPropagation()}>
        <div className="settings-header">
          <div className="header-left">
            <Settings size={24} />
            <h2>Settings</h2>
          </div>
          <button className="close-button" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="settings-content">
          <div className="section">
            <h3 className="section-title">
              <User size={18} />
              Profile
            </h3>

            <div className="setting-item">
              <label>Current Username</label>
              <div className="current-username">{currentUser?.username}</div>
            </div>

            <div className="setting-item">
              <label>Change Username</label>
              <div className="input-with-button">
                <input
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="Enter new username"
                  className="username-input"
                />
                <button
                  className="change-btn"
                  onClick={handleChangeUsername}
                  disabled={!newUsername.trim() || newUsername === currentUser?.username || isChangingUsername}
                >
                  {isChangingUsername ? 'Changing...' : 'Change'}
                </button>
              </div>
              <p className="help-text">
                <AlertCircle size={14} />
                This will update your display name in the chat
              </p>
            </div>
          </div>

          <div className="section">
            <h3 className="section-title">
              <Users size={18} />
              Groups ({userGroups.length})
            </h3>

            {userGroups.length === 0 ? (
              <div className="empty-state">
                <p>You haven't joined any groups yet.</p>
              </div>
            ) : (
              <div className="setting-item">
                <label>Leave Group</label>
                <div className="input-with-button">
                  <select
                    value={selectedGroup}
                    onChange={(e) => setSelectedGroup(e.target.value)}
                    className="group-select"
                  >
                    <option value="">Select a group to leave</option>
                    {userGroups.map(group => (
                      <option key={group.id} value={group.id}>
                        {group.name} ({group.members.length} members)
                      </option>
                    ))}
                  </select>
                  <button
                    className="leave-btn"
                    onClick={handleLeaveGroup}
                    disabled={!selectedGroup}
                  >
                    Leave
                  </button>
                </div>
                {selectedGroup && (
                  <p className="help-text warning">
                    <AlertCircle size={14} />
                    You won't be able to rejoin unless invited
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="section danger-section">
            <h3 className="section-title">Danger Zone</h3>
            <button className="logout-btn" onClick={handleLogout}>
              <LogOut size={16} />
              Logout
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
