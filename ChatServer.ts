import express from 'express';
import http from 'http';
import cors from 'cors';
import { Server, Socket } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';

interface User {
  id: string;
  username: string;
  socketId: string;
  serverId: string;
  groups: string[];
  isOnline: boolean;
  lastSeen: Date;
}

interface Group {
  id: string;
  name: string;
  description?: string;
  creator: string;
  members: string[];
  createdAt: Date;
}

interface Message {
  id: string;
  type: 'group' | 'private' | 'system';
  sender: string;
  recipient: string;
  content: string;
  timestamp: Date;
  delivered: boolean;
  read: boolean;
  attachments?: string[];
  deletedForMe?: boolean;
  deletedForEveryone?: boolean;
  deletedBy?: string;
  replyTo?: string;
  repliedMessage?: any;
  edited?: boolean;
  editedAt?: Date;
}

interface CustomSocket extends Socket {
  data: {
    userId?: string;
    username?: string;
  };
}

export class DistributedChatServer {
  private readonly app: express.Application;
  private readonly server: http.Server;
  private readonly io: Server;
  private readonly port: number;
  private readonly serverId: string;

  private users: Map<string, User> = new Map();
  private groups: Map<string, Group> = new Map();
  private messages: Map<string, Message[]> = new Map();
  private userSocketMap: Map<string, string> = new Map();
  private typingStatus: Map<string, { chatId: string; isPrivate: boolean; timestamp: Date }> = new Map();

  constructor(port: number = 3001, serverId: string = 'server1') {
    this.port = port;
    this.serverId = serverId;

    this.app = express();

    // Configure CORS for REST API
    this.app.use(cors({
      origin: "http://localhost:3000",
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    }));

    // Handle preflight requests
    this.app.options('*', cors());

    this.app.use(express.json());

    this.server = http.createServer(this.app);

    // Configure Socket.io with proper CORS and transports
    this.io = new Server(this.server, {
      cors: {
        origin: "http://localhost:3000",
        credentials: true,
        methods: ["GET", "POST"]
      },
      transports: ['websocket', 'polling'],
      allowEIO3: true,
      pingTimeout: 60000,
      pingInterval: 25000,
      connectTimeout: 10000
    });

    this.setupRoutes();
    this.setupSocketHandlers();
    this.initializeSampleData();
  }

  private initializeSampleData(): void {
    const sampleGroups = [
      { name: 'General', description: 'General discussions' },
      { name: 'Tech Talk', description: 'Technology discussions' },
      { name: 'Random', description: 'Random chat' },
      { name: 'Project Help', description: 'Get help with projects' }
    ];

    sampleGroups.forEach((groupData, index) => {
      const group: Group = {
        id: `group-${index + 1}`,
        name: groupData.name,
        description: groupData.description,
        creator: 'system',
        members: [],
        createdAt: new Date()
      };
      this.groups.set(group.id, group);
    });
  }

  private setupRoutes(): void {
    this.app.get('/health', (_req: express.Request, res: express.Response) => {
      res.json({
        status: 'healthy',
        serverId: this.serverId,
        users: this.users.size,
        groups: this.groups.size,
        onlineUsers: Array.from(this.users.values()).filter(u => u.isOnline).length,
        timestamp: new Date().toISOString()
      });
    });

    this.app.get('/users', (_req: express.Request, res: express.Response) => {
      res.json(Array.from(this.users.values()));
    });

    this.app.get('/users/online', (_req: express.Request, res: express.Response) => {
      const onlineUsers = Array.from(this.users.values()).filter(u => u.isOnline);
      res.json(onlineUsers);
    });

    this.app.get('/groups', (_req: express.Request, res: express.Response) => {
      res.json(Array.from(this.groups.values()));
    });

    this.app.get('/groups/:groupId', (req: express.Request, res: express.Response) => {
      const group = this.groups.get(req.params.groupId);
      if (!group) {
        res.status(404).json({ error: 'Group not found' });
        return;
      }
      res.json(group);
    });

    this.app.get('/groups/:groupId/users', (req: express.Request, res: express.Response) => {
      const group = this.groups.get(req.params.groupId);
      if (!group) {
        res.status(404).json({ error: 'Group not found' });
        return;
      }

      const groupUsers = group.members
        .map(userId => this.users.get(userId))
        .filter(user => user !== undefined);

      res.json(groupUsers);
    });

    this.app.get('/messages/:chatId', (req: express.Request, res: express.Response) => {
      const { chatId } = req.params;
      const { type, limit } = req.query;
      const isPrivate = type === 'private';

      let messages: Message[] = [];
      if (isPrivate) {
        const conversationKey = chatId;
        messages = this.messages.get(conversationKey) || [];
      } else {
        messages = this.messages.get(chatId) || [];
      }

      if (limit && !isNaN(Number(limit))) {
        messages = messages.slice(-Number(limit));
      }

      res.json(messages);
    });
  }

  private setupSocketHandlers(): void {
    this.io.on('connection', (socket: Socket) => {
      const customSocket = socket as CustomSocket;
      console.log(`✅ User connected: ${socket.id} to ${this.serverId}`);

      // Send server info immediately
      socket.emit('server:info', {
        serverId: this.serverId,
        users: Array.from(this.users.values()).filter(u => u.isOnline),
        groups: Array.from(this.groups.values()),
        timestamp: new Date()
      });

      socket.on('user:join', (username: string, callback: (response: any) => void) => {
        try {
          if (!username || username.trim().length === 0) {
            callback({ success: false, error: 'Username is required' });
            return;
          }

          const existingUser = Array.from(this.users.values())
            .find(u => u.username === username && u.serverId === this.serverId);

          if (existingUser && existingUser.isOnline) {
            callback({ success: false, error: 'Username already taken' });
            return;
          }

          let user: User;

          if (existingUser) {
            user = existingUser;
            user.isOnline = true;
            user.socketId = socket.id;
            user.lastSeen = new Date();
            console.log(`↩️ User reconnected: ${username}`);
          } else {
            user = {
              id: uuidv4(),
              username: username.trim(),
              socketId: socket.id,
              serverId: this.serverId,
              groups: [],
              isOnline: true,
              lastSeen: new Date()
            };
            this.users.set(user.id, user);
            console.log(`👤 New user registered: ${username}`);
          }

          this.userSocketMap.set(user.id, socket.id);
          customSocket.data.userId = user.id;
          customSocket.data.username = user.username;

          // Notify all users
          this.io.emit('user:joined', {
            ...user,
            action: existingUser ? 'reconnected' : 'joined'
          });

          // Get online users (excluding current user)
          const onlineUsers = Array.from(this.users.values())
            .filter(u => u.isOnline && u.serverId === this.serverId && u.id !== user.id);

          // Send data to the new user
          socket.emit('users:list', onlineUsers);
          socket.emit('groups:list', Array.from(this.groups.values()));
          socket.emit('user:registered', user);

          callback({
            success: true,
            user,
            users: onlineUsers,
            groups: Array.from(this.groups.values())
          });
        } catch (error) {
          console.error('Error in user:join:', error);
          callback({ success: false, error: 'Internal server error' });
        }
      });

      socket.on('user:reconnect', (userId: string, callback?: (response: any) => void) => {
        try {
          const user = this.users.get(userId);
          if (user) {
            user.isOnline = true;
            user.socketId = socket.id;
            user.lastSeen = new Date();
            this.userSocketMap.set(userId, socket.id);
            customSocket.data.userId = userId;
            customSocket.data.username = user.username;

            this.io.emit('user:reconnected', user);

            const onlineUsers = Array.from(this.users.values())
              .filter(u => u.isOnline && u.serverId === this.serverId && u.id !== userId);

            socket.emit('users:list', onlineUsers);
            socket.emit('groups:list', Array.from(this.groups.values()));

            callback?.({ success: true, user });
            console.log(`🔁 User reconnected via API: ${user.username}`);
          } else {
            callback?.({ success: false, error: 'User not found' });
          }
        } catch (error) {
          console.error('Error in user:reconnect:', error);
          callback?.({ success: false, error: 'Internal server error' });
        }
      });

      socket.on('user:leave', () => {
        this.handleUserDisconnect(customSocket);
      });

      socket.on('users:get', (callback: (users: User[]) => void) => {
        try {
          const currentUser = this.users.get(customSocket.data.userId || '');
          if (!currentUser) {
            callback([]);
            return;
          }

          const sameServerUsers = Array.from(this.users.values())
            .filter(u => u.isOnline && u.serverId === this.serverId && u.id !== currentUser.id);

          callback(sameServerUsers);
        } catch (error) {
          console.error('Error in users:get:', error);
          callback([]);
        }
      });

      socket.on('group:create', (data: { name: string; description?: string }, callback: (response: any) => void) => {
        try {
          const userId = customSocket.data.userId;
          const user = userId ? this.users.get(userId) : undefined;

          if (!user) {
            callback({ success: false, error: 'User not found' });
            return;
          }

          if (!data.name || data.name.trim().length === 0) {
            callback({ success: false, error: 'Group name is required' });
            return;
          }

          const existingGroup = Array.from(this.groups.values())
            .find(g => g.name.toLowerCase() === data.name.toLowerCase());

          if (existingGroup) {
            callback({ success: false, error: 'Group already exists' });
            return;
          }

          const group: Group = {
            id: uuidv4(),
            name: data.name.trim(),
            description: data.description?.trim(),
            creator: userId!,
            members: [userId!],
            createdAt: new Date()
          };

          this.groups.set(group.id, group);
          if (!user.groups.includes(group.id)) {
            user.groups.push(group.id);
          }

          this.io.emit('group:created', group);
          callback({ success: true, group });
          console.log(`👥 Group created: ${group.name} by ${user.username}`);
        } catch (error) {
          console.error('Error in group:create:', error);
          callback({ success: false, error: 'Internal server error' });
        }
      });

      socket.on('group:join', (groupId: string, callback: (response: any) => void) => {
        try {
          const userId = customSocket.data.userId;
          const user = userId ? this.users.get(userId) : undefined;
          const group = this.groups.get(groupId);

          if (!user || !group) {
            callback({ success: false, error: 'User or group not found' });
            return;
          }

          if (group.members.includes(userId!)) {
            callback({ success: false, error: 'Already in group' });
            return;
          }

          group.members.push(userId!);
          if (!user.groups.includes(groupId)) {
            user.groups.push(groupId);
          }

          const systemMessage: Message = {
            id: uuidv4(),
            type: 'system',
            sender: 'system',
            recipient: groupId,
            content: `${user.username} joined the group`,
            timestamp: new Date(),
            delivered: true,
            read: false
          };

          if (!this.messages.has(groupId)) {
            this.messages.set(groupId, []);
          }
          this.messages.get(groupId)?.push(systemMessage);

          group.members.forEach((memberId: string) => {
            if (memberId !== userId) {
              const member = this.users.get(memberId);
              if (member && member.isOnline) {
                const memberSocketId = this.userSocketMap.get(memberId);
                if (memberSocketId) {
                  this.io.to(memberSocketId).emit('group:memberJoined', {
                    groupId,
                    user: { id: user.id, username: user.username }
                  });

                  this.io.to(memberSocketId).emit('message:received', {
                    ...systemMessage,
                    senderName: 'System',
                    groupName: group.name
                  });
                }
              }
            }
          });

          socket.emit('message:received', {
            ...systemMessage,
            senderName: 'System',
            groupName: group.name
          });

          this.io.emit('group:updated', group);
          socket.emit('group:joined', group);
          callback({ success: true, group });
          console.log(`👤 ${user.username} joined group: ${group.name}`);
        } catch (error) {
          console.error('Error in group:join:', error);
          callback({ success: false, error: 'Internal server error' });
        }
      });

      socket.on('group:leave', (groupId: string, callback: (response: any) => void) => {
        try {
          const userId = customSocket.data.userId;
          const user = userId ? this.users.get(userId) : undefined;
          const group = this.groups.get(groupId);

          if (!user || !group) {
            callback({ success: false, error: 'User or group not found' });
            return;
          }

          if (!group.members.includes(userId!)) {
            callback({ success: false, error: 'Not in group' });
            return;
          }

          const systemMessage: Message = {
            id: uuidv4(),
            type: 'system',
            sender: 'system',
            recipient: groupId,
            content: `${user.username} left the group`,
            timestamp: new Date(),
            delivered: true,
            read: false
          };

          if (!this.messages.has(groupId)) {
            this.messages.set(groupId, []);
          }
          this.messages.get(groupId)?.push(systemMessage);

          group.members = group.members.filter((id: string) => id !== userId);
          user.groups = user.groups.filter((id: string) => id !== groupId);

          group.members.forEach((memberId: string) => {
            const member = this.users.get(memberId);
            if (member && member.isOnline) {
              const memberSocketId = this.userSocketMap.get(memberId);
              if (memberSocketId) {
                this.io.to(memberSocketId).emit('group:memberLeft', {
                  groupId,
                  user: { id: user.id, username: user.username }
                });

                this.io.to(memberSocketId).emit('message:received', {
                  ...systemMessage,
                  senderName: 'System',
                  groupName: group.name
                });
              }
            }
          });

          socket.emit('message:received', {
            ...systemMessage,
            senderName: 'System',
            groupName: group.name
          });

          this.io.emit('group:updated', group);
          socket.emit('group:left', groupId);
          callback({ success: true, group });

          if (group.members.length === 0) {
            this.groups.delete(groupId);
            this.messages.delete(groupId);
            this.io.emit('group:deleted', groupId);
            console.log(`🗑️ Group deleted (empty): ${group.name}`);
          }

          console.log(`👤 ${user.username} left group: ${group.name}`);
        } catch (error) {
          console.error('Error in group:leave:', error);
          callback({ success: false, error: 'Internal server error' });
        }
      });

      socket.on('group:delete', (groupId: string, callback: (response: any) => void) => {
        try {
          const userId = customSocket.data.userId;
          const user = userId ? this.users.get(userId) : undefined;
          const group = this.groups.get(groupId);

          if (!user || !group) {
            callback({ success: false, error: 'User or group not found' });
            return;
          }

          if (group.creator !== userId) {
            callback({ success: false, error: 'Only the group creator can delete the group' });
            return;
          }

          group.members.forEach((memberId: string) => {
            const member = this.users.get(memberId);
            if (member && member.isOnline) {
              const memberSocketId = this.userSocketMap.get(memberId);
              if (memberSocketId) {
                this.io.to(memberSocketId).emit('group:deleted', groupId);
              }
            }

            if (member) {
              member.groups = member.groups.filter((id: string) => id !== groupId);
            }
          });

          this.groups.delete(groupId);
          this.messages.delete(groupId);

          this.io.emit('group:deleted', groupId);
          callback({ success: true });
          console.log(`🗑️ Group deleted by ${user.username}: ${group.name}`);
        } catch (error) {
          console.error('Error in group:delete:', error);
          callback({ success: false, error: 'Internal server error' });
        }
      });

      socket.on('groups:get', (callback: (groups: Group[]) => void) => {
        try {
          callback(Array.from(this.groups.values()));
        } catch (error) {
          console.error('Error in groups:get:', error);
          callback([]);
        }
      });

      socket.on('message:group', (data: { groupId: string; content: string; attachments?: string[]; replyTo?: string; repliedMessage?: any }, callback?: (response: any) => void) => {
        try {
          const userId = customSocket.data.userId;
          const user = userId ? this.users.get(userId) : undefined;
          const group = this.groups.get(data.groupId);

          if (!user || !group) {
            callback?.({ success: false, error: 'User or group not found' });
            return;
          }

          if (!group.members.includes(userId!)) {
            callback?.({ success: false, error: 'Not a member of this group' });
            return;
          }

          if (!data.content || data.content.trim().length === 0) {
            callback?.({ success: false, error: 'Message cannot be empty' });
            return;
          }

          const message: Message = {
            id: uuidv4(),
            type: 'group',
            sender: userId!,
            recipient: data.groupId,
            content: data.content.trim(),
            attachments: data.attachments,
            timestamp: new Date(),
            delivered: true,
            read: false,
            replyTo: data.replyTo || undefined,
            repliedMessage: data.repliedMessage || undefined
          };

          if (!this.messages.has(data.groupId)) {
            this.messages.set(data.groupId, []);
          }
          this.messages.get(data.groupId)?.push(message);

          const deliveredTo: string[] = [];
          group.members.forEach((memberId: string) => {
            const member = this.users.get(memberId);
            if (member && member.isOnline && member.serverId === this.serverId) {
              const memberSocketId = this.userSocketMap.get(memberId);
              if (memberSocketId) {
                this.io.to(memberSocketId).emit('message:received', {
                  ...message,
                  senderName: user.username,
                  groupName: group.name
                });
                deliveredTo.push(memberId);

                if (memberId !== userId) {
                  socket.emit('message:delivered', {
                    messageId: message.id,
                    recipientId: memberId
                  });
                }
              }
            }
          });

          callback?.({
            success: true,
            message,
            deliveredTo,
            deliveredCount: deliveredTo.length
          });

          console.log(`📨 Group message from ${user.username} to ${group.name}: ${data.content.substring(0, 50)}...`);
        } catch (error) {
          console.error('Error in message:group:', error);
          callback?.({ success: false, error: 'Internal server error' });
        }
      });

      socket.on('message:private', (data: { recipientId: string; content: string; attachments?: string[]; replyTo?: string; repliedMessage?: any }, callback?: (response: any) => void) => {
        try {
          const senderId = customSocket.data.userId;
          const sender = senderId ? this.users.get(senderId) : undefined;
          const recipient = this.users.get(data.recipientId);

          if (!sender || !recipient) {
            callback?.({ success: false, error: 'User not found' });
            return;
          }

          if (sender.serverId !== recipient.serverId) {
            callback?.({ success: false, error: 'Cannot message users from different servers' });
            return;
          }

          if (!data.content || data.content.trim().length === 0) {
            callback?.({ success: false, error: 'Message cannot be empty' });
            return;
          }

          const message: Message = {
            id: uuidv4(),
            type: 'private',
            sender: senderId!,
            recipient: data.recipientId,
            content: data.content.trim(),
            attachments: data.attachments,
            timestamp: new Date(),
            delivered: recipient.isOnline,
            read: false,
            replyTo: data.replyTo || undefined,
            repliedMessage: data.repliedMessage || undefined
          };

          const conversationKey = [senderId, data.recipientId].sort().join('_');
          if (!this.messages.has(conversationKey)) {
            this.messages.set(conversationKey, []);
          }
          this.messages.get(conversationKey)?.push(message);

          let delivered = false;

          if (recipient.isOnline && recipient.serverId === this.serverId) {
            const recipientSocketId = this.userSocketMap.get(data.recipientId);
            if (recipientSocketId) {
              this.io.to(recipientSocketId).emit('message:received', {
                ...message,
                senderName: sender.username,
                isPrivate: true
              });
              delivered = true;

              socket.emit('message:delivered', {
                messageId: message.id,
                recipientId: data.recipientId
              });
            }
          }

          socket.emit('message:received', {
            ...message,
            senderName: sender.username,
            isPrivate: true,
            isOwnMessage: true
          });

          callback?.({
            success: true,
            message,
            delivered,
            recipientOnline: recipient.isOnline
          });

          console.log(`📩 Private message from ${sender.username} to ${recipient.username}: ${data.content.substring(0, 50)}...`);
        } catch (error) {
          console.error('Error in message:private:', error);
          callback?.({ success: false, error: 'Internal server error' });
        }
      });

      socket.on('message:edit', (data: {
        messageId: string;
        chatId: string;
        isPrivate: boolean;
        newContent: string
      }, callback: (response: any) => void) => {
        try {
          const userId = customSocket.data.userId;
          if (!userId) {
            callback({ success: false, error: 'User not found' });
            return;
          }

          let messageKey: string;
          if (data.isPrivate) {
            messageKey = [userId, data.chatId].sort().join('_');
          } else {
            messageKey = data.chatId;
          }

          const messages = this.messages.get(messageKey);
          if (!messages) {
            callback({ success: false, error: 'Messages not found' });
            return;
          }

          const messageIndex = messages.findIndex(msg => msg.id === data.messageId);
          if (messageIndex === -1) {
            callback({ success: false, error: 'Message not found' });
            return;
          }

          const message = messages[messageIndex];

          if (message.sender !== userId) {
            callback({ success: false, error: 'Only the message sender can edit the message' });
            return;
          }

          if (!data.newContent || data.newContent.trim().length === 0) {
            callback({ success: false, error: 'Message cannot be empty' });
            return;
          }

          messages[messageIndex] = {
            ...message,
            content: data.newContent.trim(),
            edited: true,
            editedAt: new Date()
          };

          const updatedMessage = messages[messageIndex];

          if (data.isPrivate) {
            const otherUserId = data.chatId;
            const otherUserSocketId = this.userSocketMap.get(otherUserId);
            if (otherUserSocketId) {
              this.io.to(otherUserSocketId).emit('message:edited', {
                messageId: data.messageId,
                chatId: userId,
                isPrivate: true,
                newContent: data.newContent,
                editedAt: new Date()
              });
            }

            socket.emit('message:edited', {
              messageId: data.messageId,
              chatId: otherUserId,
              isPrivate: true,
              newContent: data.newContent,
              editedAt: new Date()
            });
          } else {
            const group = this.groups.get(data.chatId);
            if (group) {
              group.members.forEach((memberId: string) => {
                if (memberId !== userId) {
                  const memberSocketId = this.userSocketMap.get(memberId);
                  if (memberSocketId) {
                    this.io.to(memberSocketId).emit('message:edited', {
                      messageId: data.messageId,
                      chatId: data.chatId,
                      isPrivate: false,
                      newContent: data.newContent,
                      editedAt: new Date()
                    });
                  }
                }
              });
            }

            socket.emit('message:edited', {
              messageId: data.messageId,
              chatId: data.chatId,
              isPrivate: false,
              newContent: data.newContent,
              editedAt: new Date()
            });
          }

          callback({ success: true });
          console.log(`✏️ Message edited by ${userId}: ${data.messageId}`);
        } catch (error) {
          console.error('Error in message:edit:', error);
          callback({ success: false, error: 'Internal server error' });
        }
      });

      socket.on('messages:get', (data: { chatId: string; isPrivate: boolean; limit?: number }, callback: (messages: Message[]) => void) => {
        try {
          let messages: Message[] = [];

          if (data.isPrivate) {
            const userId = customSocket.data.userId;
            const conversationKey = userId ? [userId, data.chatId].sort().join('_') : '';
            messages = conversationKey ? this.messages.get(conversationKey) || [] : [];
          } else {
            messages = this.messages.get(data.chatId) || [];
          }

          if (data.limit && !isNaN(data.limit)) {
            messages = messages.slice(-data.limit);
          }

          callback(messages);
        } catch (error) {
          console.error('Error in messages:get:', error);
          callback([]);
        }
      });

      socket.on('messages:more', (data: { chatId: string; isPrivate: boolean; before: Date; limit?: number }, callback: (messages: Message[]) => void) => {
        try {
          let messages: Message[] = [];

          if (data.isPrivate) {
            const userId = customSocket.data.userId;
            const conversationKey = userId ? [userId, data.chatId].sort().join('_') : '';
            messages = conversationKey ? this.messages.get(conversationKey) || [] : [];
          } else {
            messages = this.messages.get(data.chatId) || [];
          }

          messages = messages.filter(msg => msg.timestamp < data.before);

          const limit = data.limit || 20;
          messages = messages.slice(-limit);

          callback(messages);
        } catch (error) {
          console.error('Error in messages:more:', error);
          callback([]);
        }
      });

      socket.on('message:read', (data: { chatId: string; isPrivate: boolean }) => {
        try {
          const userId = customSocket.data.userId;
          if (!userId) return;

          let messageKey: string;
          if (data.isPrivate) {
            messageKey = [userId, data.chatId].sort().join('_');
          } else {
            messageKey = data.chatId;
          }

          const messages = this.messages.get(messageKey);
          if (messages) {
            messages.forEach(msg => {
              if ((data.isPrivate && msg.sender === data.chatId && msg.recipient === userId) ||
                  (!data.isPrivate && msg.recipient === data.chatId && msg.sender !== userId)) {
                msg.read = true;

                if (msg.sender !== userId) {
                  const senderSocketId = this.userSocketMap.get(msg.sender);
                  if (senderSocketId) {
                    this.io.to(senderSocketId).emit('message:read', {
                      messageId: msg.id,
                      readerId: userId
                    });
                  }
                }
              }
            });
          }
        } catch (error) {
          console.error('Error in message:read:', error);
        }
      });

      socket.on('message:delete', (data: {
        messageId: string;
        chatId: string;
        isPrivate: boolean;
        deleteForEveryone: boolean;
        deletedBy: string
      }, callback?: (response: any) => void) => {
        try {
          const userId = customSocket.data.userId;
          if (!userId) {
            callback?.({ success: false, error: 'User not found' });
            return;
          }

          if (data.isPrivate) {
            const otherUserId = data.chatId;
            const conversationKey = [userId, otherUserId].sort().join('_');
            const messages = this.messages.get(conversationKey);

            if (!messages) {
              callback?.({ success: false, error: 'Messages not found' });
              return;
            }

            const messageIndex = messages.findIndex(msg => msg.id === data.messageId);
            if (messageIndex === -1) {
              callback?.({ success: false, error: 'Message not found' });
              return;
            }

            const message = messages[messageIndex];

            if (data.deleteForEveryone) {
              if (message.sender !== userId) {
                callback?.({ success: false, error: 'Only the message sender can delete for everyone' });
                return;
              }

              messages[messageIndex] = {
                ...message,
                content: "This message was deleted",
                attachments: [],
                deletedForEveryone: true,
                deletedBy: userId
              };

              const otherUserSocketId = this.userSocketMap.get(otherUserId);
              if (otherUserSocketId) {
                this.io.to(otherUserSocketId).emit('message:deleted', {
                  messageId: data.messageId,
                  chatId: userId,
                  isPrivate: true,
                  deleteForEveryone: true,
                  deletedBy: userId
                });
              }

              socket.emit('message:deleted', {
                messageId: data.messageId,
                chatId: otherUserId,
                isPrivate: true,
                deleteForEveryone: true,
                deletedBy: userId
              });
            } else {
              if (message.sender !== userId) {
                callback?.({ success: false, error: 'You can only delete your own messages for yourself' });
                return;
              }

              messages[messageIndex] = {
                ...message,
                content: "This message was deleted",
                attachments: [],
                deletedForMe: true,
                deletedBy: userId
              };

              socket.emit('message:deleted', {
                messageId: data.messageId,
                chatId: otherUserId,
                isPrivate: true,
                deleteForEveryone: false,
                deletedBy: userId
              });
            }
          } else {
            const messages = this.messages.get(data.chatId);
            if (!messages) {
              callback?.({ success: false, error: 'Messages not found' });
              return;
            }

            const messageIndex = messages.findIndex(msg => msg.id === data.messageId);
            if (messageIndex === -1) {
              callback?.({ success: false, error: 'Message not found' });
              return;
            }

            const message = messages[messageIndex];

            if (data.deleteForEveryone) {
              if (message.sender !== userId) {
                callback?.({ success: false, error: 'Only the message sender can delete for everyone' });
                return;
              }

              messages[messageIndex] = {
                ...message,
                content: "This message was deleted",
                attachments: [],
                deletedForEveryone: true,
                deletedBy: userId
              };

              const group = this.groups.get(data.chatId);
              if (group) {
                group.members.forEach((memberId: string) => {
                  if (memberId !== userId) {
                    const memberSocketId = this.userSocketMap.get(memberId);
                    if (memberSocketId) {
                      this.io.to(memberSocketId).emit('message:deleted', {
                        messageId: data.messageId,
                        chatId: data.chatId,
                        isPrivate: false,
                        deleteForEveryone: true,
                        deletedBy: userId
                      });
                    }
                  }
                });
              }

              socket.emit('message:deleted', {
                messageId: data.messageId,
                chatId: data.chatId,
                isPrivate: false,
                deleteForEveryone: true,
                deletedBy: userId
              });
            } else {
              messages[messageIndex] = {
                ...message,
                content: "This message was deleted",
                attachments: [],
                deletedForMe: true,
                deletedBy: userId
              };

              socket.emit('message:deleted', {
                messageId: data.messageId,
                chatId: data.chatId,
                isPrivate: false,
                deleteForEveryone: false,
                deletedBy: userId
              });
            }
          }

          callback?.({ success: true });
          console.log(`🗑️ Message deleted by ${userId}: ${data.messageId} (forEveryone: ${data.deleteForEveryone})`);
        } catch (error) {
          console.error('Error in message:delete:', error);
          callback?.({ success: false, error: 'Internal server error' });
        }
      });

      socket.on('chat:delete', (data: { chatId: string; isPrivate: boolean }, callback?: (response: any) => void) => {
        try {
          const userId = customSocket.data.userId;
          if (!userId) {
            callback?.({ success: false, error: 'User not found' });
            return;
          }

          if (data.isPrivate) {
            const conversationKey = [userId, data.chatId].sort().join('_');
            this.messages.delete(conversationKey);
            console.log(`🗑️ Private chat deleted by ${userId} with ${data.chatId}`);
          } else {
            const group = this.groups.get(data.chatId);
            if (group && group.creator === userId) {
              this.messages.delete(data.chatId);
              console.log(`🗑️ Group chat deleted by creator ${userId}: ${data.chatId}`);
            } else {
              callback?.({ success: false, error: 'Only group creator can delete group chat' });
              return;
            }
          }

          socket.emit('chat:deleted', {
            chatId: data.chatId,
            isPrivate: data.isPrivate
          });

          callback?.({ success: true });
        } catch (error) {
          console.error('Error in chat:delete:', error);
          callback?.({ success: false, error: 'Internal server error' });
        }
      });

      socket.on('typing:start', (data: { chatId: string; isPrivate: boolean }) => {
        try {
          const userId = customSocket.data.userId;
          if (!userId) return;

          this.typingStatus.set(userId, {
            chatId: data.chatId,
            isPrivate: data.isPrivate,
            timestamp: new Date()
          });

          if (data.isPrivate) {
            const recipientSocketId = this.userSocketMap.get(data.chatId);
            if (recipientSocketId) {
              this.io.to(recipientSocketId).emit('user:typing', {
                userId,
                isTyping: true,
                chatId: data.chatId
              });
            }
          } else {
            const group = this.groups.get(data.chatId);
            if (group) {
              group.members.forEach((memberId: string) => {
                if (memberId !== userId) {
                  const memberSocketId = this.userSocketMap.get(memberId);
                  if (memberSocketId) {
                    this.io.to(memberSocketId).emit('user:typing', {
                      userId,
                      isTyping: true,
                      chatId: data.chatId
                    });
                  }
                }
              });
            }
          }

          setTimeout(() => {
            const currentStatus = this.typingStatus.get(userId);
            if (currentStatus && currentStatus.chatId === data.chatId) {
              this.typingStatus.delete(userId);

              if (data.isPrivate) {
                const recipientSocketId = this.userSocketMap.get(data.chatId);
                if (recipientSocketId) {
                  this.io.to(recipientSocketId).emit('user:typing', {
                    userId,
                    isTyping: false,
                    chatId: data.chatId
                  });
                }
              } else {
                const group = this.groups.get(data.chatId);
                if (group) {
                  group.members.forEach((memberId: string) => {
                    if (memberId !== userId) {
                      const memberSocketId = this.userSocketMap.get(memberId);
                      if (memberSocketId) {
                        this.io.to(memberSocketId).emit('user:typing', {
                          userId,
                          isTyping: false,
                          chatId: data.chatId
                        });
                      }
                    }
                  });
                }
              }
            }
          }, 3000);
        } catch (error) {
          console.error('Error in typing:start:', error);
        }
      });

      socket.on('typing:stop', (data: { chatId: string; isPrivate: boolean }) => {
        try {
          const userId = customSocket.data.userId;
          if (!userId) return;

          this.typingStatus.delete(userId);

          if (data.isPrivate) {
            const recipientSocketId = this.userSocketMap.get(data.chatId);
            if (recipientSocketId) {
              this.io.to(recipientSocketId).emit('user:typing', {
                userId,
                isTyping: false,
                chatId: data.chatId
              });
            }
          } else {
            const group = this.groups.get(data.chatId);
            if (group) {
              group.members.forEach((memberId: string) => {
                if (memberId !== userId) {
                  const memberSocketId = this.userSocketMap.get(memberId);
                  if (memberSocketId) {
                    this.io.to(memberSocketId).emit('user:typing', {
                      userId,
                      isTyping: false,
                      chatId: data.chatId
                    });
                  }
                }
              });
            }
          }
        } catch (error) {
          console.error('Error in typing:stop:', error);
        }
      });

      socket.on('user:update', (data: { userId: string; newUsername: string }, callback: (response: any) => void) => {
        try {
          const user = this.users.get(data.userId);
          if (!user) {
            callback({ success: false, error: 'User not found' });
            return;
          }

          const usernameExists = Array.from(this.users.values())
            .some(u => u.username === data.newUsername && u.id !== data.userId);

          if (usernameExists) {
            callback({ success: false, error: 'Username already taken' });
            return;
          }

          const oldUsername = user.username;
          user.username = data.newUsername;

          this.io.emit('user:updated', user);
          callback({ success: true, user });
          console.log(`👤 Username updated: ${oldUsername} -> ${data.newUsername}`);
        } catch (error) {
          console.error('Error in user:update:', error);
          callback({ success: false, error: 'Internal server error' });
        }
      });

      socket.on('disconnect', () => {
        this.handleUserDisconnect(customSocket);
      });

      socket.on('error', (error: any) => {
        console.error(`❌ Socket error from ${socket.id}:`, error);
      });
    });
  }

  private handleUserDisconnect(socket: CustomSocket): void {
    const userId = socket.data.userId;
    if (userId) {
      const user = this.users.get(userId);
      if (user) {
        user.isOnline = false;
        user.lastSeen = new Date();
        user.socketId = '';
        this.userSocketMap.delete(userId);
        this.typingStatus.delete(userId);

        this.io.emit('user:left', {
          id: user.id,
          username: user.username,
          serverId: user.serverId
        });

        console.log(`👋 User disconnected: ${user.username} from ${this.serverId}`);
      }
    }
  }

  public start(): void {
    this.server.listen(this.port, '0.0.0.0', () => {
      console.log(`🚀 Server ${this.serverId} running on http://localhost:${this.port}`);
      console.log(`📡 Health check: http://localhost:${this.port}/health`);
      console.log(`👥 Users API: http://localhost:${this.port}/users`);
      console.log(`👥 Groups API: http://localhost:${this.port}/groups`);
      console.log(`💬 Messages API: http://localhost:${this.port}/messages/:chatId`);
      console.log(`🔗 WebSocket: ws://localhost:${this.port}`);
      console.log(`🌐 CORS enabled for: http://localhost:3000`);
      console.log(`========================================`);
    });

    setInterval(() => {
      const now = new Date();
      const timeout = 10000;

      this.typingStatus.forEach((status, userId) => {
        if (now.getTime() - status.timestamp.getTime() > timeout) {
          this.typingStatus.delete(userId);
        }
      });
    }, 60000);
  }
}