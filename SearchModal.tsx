import React, { useState, useEffect } from 'react';
import { Search, X, MessageSquare, Users, Hash, User } from 'lucide-react';
import useChatStore from '../store/chatStore';
import './SearchModal.css';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SearchModal: React.FC<SearchModalProps> = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{
    messages: any[];
    users: any[];
    groups: any[];
  }>({ messages: [], users: [], groups: [] });

  const { messages, users, groups, setCurrentChat } = useChatStore();

  useEffect(() => {
    if (!query.trim()) {
      setSearchResults({ messages: [], users: [], groups: [] });
      return;
    }

    const searchTerm = query.toLowerCase();

    // Search messages
    const messageResults: any[] = [];
    messages.forEach((msgList, chatKey) => {
      msgList.forEach(msg => {
        if (msg.content.toLowerCase().includes(searchTerm)) {
          messageResults.push({
            ...msg,
            chatKey,
            isPrivate: msg.type === 'private'
          });
        }
      });
    });

    // Search users
    const userResults = users.filter(user =>
      user.username.toLowerCase().includes(searchTerm) ||
      user.serverId.toLowerCase().includes(searchTerm)
    );

    // Search groups
    const groupResults = groups.filter(group =>
      group.name.toLowerCase().includes(searchTerm) ||
      (group.description && group.description.toLowerCase().includes(searchTerm))
    );

    setSearchResults({
      messages: messageResults.slice(0, 10), // Limit results
      users: userResults,
      groups: groupResults
    });
  }, [query, messages, users, groups]);

  const handleMessageClick = (message: any) => {
    const [user1, user2] = message.chatKey.split('_');
    const chatId = message.isPrivate ?
      (user1 === message.sender ? user2 : user1) :
      message.recipient;

    setCurrentChat(chatId, message.isPrivate ? 'user' : 'group');
    onClose();
  };

  const handleUserClick = (userId: string) => {
    setCurrentChat(userId, 'user');
    onClose();
  };

  const handleGroupClick = (groupId: string) => {
    setCurrentChat(groupId, 'group');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="search-modal-overlay" onClick={onClose}>
      <div className="search-modal" onClick={e => e.stopPropagation()}>
        <div className="search-header">
          <div className="search-input-container">
            <Search size={20} />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search messages, users, groups..."
              className="search-input"
              autoFocus
            />
            <button className="close-search" onClick={onClose}>
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="search-results">
          {/* Messages Results */}
          {searchResults.messages.length > 0 && (
            <div className="results-section">
              <h3 className="section-title">
                <MessageSquare size={16} />
                Messages ({searchResults.messages.length})
              </h3>
              {searchResults.messages.map((msg, index) => (
                <div
                  key={`${msg.id}-${index}`}
                  className="result-item message-result"
                  onClick={() => handleMessageClick(msg)}
                >
                  <div className="message-preview">
                    <div className="message-sender">
                      {msg.senderName || 'Unknown'}
                    </div>
                    <div className="message-content">
                      {msg.content.length > 100
                        ? msg.content.substring(0, 100) + '...'
                        : msg.content}
                    </div>
                  </div>
                  <div className="message-time">
                    {new Date(msg.timestamp).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Users Results */}
          {searchResults.users.length > 0 && (
            <div className="results-section">
              <h3 className="section-title">
                <User size={16} />
                Users ({searchResults.users.length})
              </h3>
              {searchResults.users.map(user => (
                <div
                  key={user.id}
                  className="result-item user-result"
                  onClick={() => handleUserClick(user.id)}
                >
                  <div className="user-avatar">
                    {user.username.charAt(0).toUpperCase()}
                  </div>
                  <div className="user-info">
                    <div className="user-name">{user.username}</div>
                    <div className="user-server">Server: {user.serverId}</div>
                  </div>
                  <div className={`user-status ${user.isOnline ? 'online' : 'offline'}`}>
                    {user.isOnline ? 'Online' : 'Offline'}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Groups Results */}
          {searchResults.groups.length > 0 && (
            <div className="results-section">
              <h3 className="section-title">
                <Hash size={16} />
                Groups ({searchResults.groups.length})
              </h3>
              {searchResults.groups.map(group => (
                <div
                  key={group.id}
                  className="result-item group-result"
                  onClick={() => handleGroupClick(group.id)}
                >
                  <div className="group-avatar">
                    {group.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="group-info">
                    <div className="group-name">{group.name}</div>
                    <div className="group-members">
                      <Users size={12} />
                      {group.members.length} members
                    </div>
                  </div>
                  {group.description && (
                    <div className="group-description">{group.description}</div>
                  )}
                </div>
              ))}
            </div>
          )}

          {query &&
           searchResults.messages.length === 0 &&
           searchResults.users.length === 0 &&
           searchResults.groups.length === 0 && (
            <div className="no-results">
              No results found for "{query}"
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SearchModal;
