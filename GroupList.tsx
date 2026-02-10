import React, { useState } from 'react';
import { Users, Hash, Globe, Plus } from 'lucide-react';
import useChatStore from '../store/chatStore';
import './GroupList.css';

const GroupList: React.FC = () => {
  const { groups, currentUser, joinGroup, setCurrentChat, getUnreadCount } = useChatStore();
  const [showAll, setShowAll] = useState(false);

  const handleJoinGroup = async (groupId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    try {
      await joinGroup(groupId);
    } catch (error) {
      console.error('Failed to join group:', error);
    }
  };

  const handleGroupClick = (groupId: string) => {
    setCurrentChat(groupId, 'group');
  };

  const userGroups = groups.filter(group =>
    currentUser && group.members.includes(currentUser.id)
  );

  const otherGroups = groups.filter(group =>
    !currentUser || !group.members.includes(currentUser.id)
  );

  const displayedGroups = showAll ? groups : [...userGroups, ...otherGroups.slice(0, 3)];

  return (
    <div className="group-list">
      {userGroups.length > 0 && (
        <>
          <div className="section-title">Your Groups ({userGroups.length})</div>
          {userGroups.map(group => {
            const isCreator = group.creator === currentUser?.id;
            const unreadCount = getUnreadCount(group.id, false);

            return (
              <div
                key={group.id}
                className="group-item joined"
                onClick={() => handleGroupClick(group.id)}
              >
                <div className="group-icon-container">
                  <div className="group-icon">
                    <Hash size={18} />
                  </div>
                  {unreadCount > 0 && (
                    <div className="unread-badge">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </div>
                  )}
                </div>
                <div className="group-info">
                  <div className="group-name">
                    {group.name}
                    {isCreator && <span className="creator-tag">Creator</span>}
                  </div>
                  <div className="group-meta">
                    <Users size={12} />
                    <span>{group.members.length} members</span>
                    <span className="joined-tag">Joined</span>
                  </div>
                </div>
                {unreadCount > 0 && (
                  <div className="unread-indicator"></div>
                )}
              </div>
            );
          })}
        </>
      )}

      {otherGroups.length > 0 && (
        <>
          <div className="section-title">Available Groups ({otherGroups.length})</div>
          {displayedGroups.filter(group => !userGroups.includes(group)).map(group => {
            const unreadCount = getUnreadCount(group.id, false);

            return (
              <div
                key={group.id}
                className="group-item"
                onClick={() => handleGroupClick(group.id)}
              >
                <div className="group-icon-container">
                  <div className="group-icon">
                    <Globe size={18} />
                  </div>
                  {unreadCount > 0 && (
                    <div className="unread-badge">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </div>
                  )}
                </div>
                <div className="group-info">
                  <div className="group-name">{group.name}</div>
                  <div className="group-meta">
                    <Users size={12} />
                    <span>{group.members.length} members</span>
                  </div>
                </div>
                <button
                  className="join-button"
                  onClick={(e) => handleJoinGroup(group.id, e)}
                >
                  <Plus size={14} />
                  Join
                </button>
              </div>
            );
          })}

          {otherGroups.length > 3 && !showAll && (
            <button className="show-more" onClick={() => setShowAll(true)}>
              Show {otherGroups.length - 3} more groups
            </button>
          )}

          {showAll && (
            <button className="show-less" onClick={() => setShowAll(false)}>
              Show less
            </button>
          )}
        </>
      )}

      {groups.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon">👥</div>
          <p>No groups created yet</p>
        </div>
      )}
    </div>
  );
};

export default GroupList;
