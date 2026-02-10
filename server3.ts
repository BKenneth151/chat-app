import { DistributedChatServer } from '../ChatServer';

const PORT = 3003;
const server = new DistributedChatServer(PORT, 'server3');

console.log(`🚀 Starting Server 3 on port ${PORT}...`);
server.start();