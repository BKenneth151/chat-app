import React, { useState } from 'react';
import { Server, User, ArrowRight, Wifi, Users, MessageSquare, Shield } from 'lucide-react';
import useChatStore from '../store/chatStore';
import './ServerSelection.css';

const ServerSelection: React.FC<{ onJoin: () => void }> = ({ onJoin }) => {
  const [selectedServer, setSelectedServer] = useState<string>('server1');
  const [username, setUsername] = useState('');
  const { connectToServer, joinUser } = useChatStore();

  const servers = [
    { id: 'server1', name: 'Server 1', port: 3001, status: 'online', users: 24 },
    { id: 'server2', name: 'Server 2', port: 3002, status: 'online', users: 18 },
    { id: 'server3', name: 'Server 3', port: 3003, status: 'online', users: 32 },
  ];

  const handleJoin = async () => {
    if (!username.trim()) return;

    const serverUrl = `http://localhost:${selectedServer === 'server1' ? 3001 : selectedServer === 'server2' ? 3002 : 3003}`;

    connectToServer(serverUrl);

    // Small delay for connection
    setTimeout(async () => {
      const success = await joinUser(username.trim());
      if (success) {
        onJoin();
      }
    }, 500);
  };

  return (
    <div className="server-selection-page">
      <div className="selection-card">
        <div className="header-section">
          <h1 className="main-title">Distributed Chat System</h1>
          <p className="subtitle">Join a distributed server</p>
        </div>

        <div className="section">
          <h2 className="section-title">
            <Server size={20} />
            Select Your Server
          </h2>
          <div className="server-grid">
            {servers.map((server) => (
              <div
                key={server.id}
                className={`server-card ${selectedServer === server.id ? 'selected' : ''}`}
                onClick={() => setSelectedServer(server.id)}
              >
                <div className="server-header">
                  <div className="server-status">
                    <Wifi size={12} className={server.status} />
                    <span className="status-text">{server.status.toUpperCase()}</span>
                  </div>
                  <div className="server-users">
                    <Users size={12} />
                    <span>{server.users}</span>
                  </div>
                </div>
                <h3 className="server-name">{server.name}</h3>
                <p className="server-port">Port {server.port}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="section">
          <h2 className="section-title">
            <User size={20} />
            Username
          </h2>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Enter Your Username"
            className="username-input"
            onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
          />
        </div>

        <button
          className="join-button"
          onClick={handleJoin}
          disabled={!username.trim()}
        >
          Join Chat
          <ArrowRight size={20} />
        </button>

        <div className="footer">
          <p className="footer-text">Demonstrating Distributed Systems Concepts</p>
          <div className="features-grid">
            <div className="feature">
              <MessageSquare size={16} />
              <span>Real-time messaging</span>
            </div>
            <div className="feature">
              <Shield size={16} />
              <span>Secure & private</span>
            </div>
            <div className="feature">
              <Server size={16} />
              <span>Multi-server</span>
            </div>
            <div className="feature">
              <Users size={16} />
              <span>Group chats</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ServerSelection;
