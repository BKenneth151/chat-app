import { DistributedChatServer } from '../ChatServer';

const PORT = 3002;
const server = new DistributedChatServer(PORT, 'server2');

console.log(`🚀 Starting Server 2 on port ${PORT}...`);
server.start();