import { DistributedChatServer } from '../ChatServer';
import * as net from 'net';

const PORT = 3001;
const SERVER_ID = 'server1';

async function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();

    server.once('error', (err: any) => {
      if (err.code === 'EADDRINUSE') {
        console.log(`❌ Port ${port} is already in use by another process`);
        resolve(false);
      } else {
        resolve(false);
      }
    });

    server.once('listening', () => {
      server.close();
      resolve(true);
    });

    server.listen(port);
  });
}

async function killProcessOnPort(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const { exec } = require('child_process');

      if (process.platform === 'win32') {
        // Windows - find and kill process using the port
        exec(`netstat -ano | findstr :${port}`, (error: any, stdout: string) => {
          if (stdout) {
            const lines = stdout.trim().split('\n');
            const pids = new Set<number>();

            lines.forEach(line => {
              const parts = line.trim().split(/\s+/);
              if (parts.length >= 5) {
                const pid = parseInt(parts[parts.length - 1]);
                if (!isNaN(pid) && pid > 0) {
                  pids.add(pid);
                }
              }
            });

            if (pids.size > 0) {
              console.log(`🔍 Found processes on port ${port}: ${Array.from(pids).join(', ')}`);

              // Kill each process
              let killed = 0;
              const total = pids.size;

              pids.forEach(pid => {
                exec(`taskkill /PID ${pid} /F`, (killError: any) => {
                  if (!killError) {
                    killed++;
                    console.log(`✅ Killed process ${pid}`);
                  }

                  if (killed === total) {
                    resolve(killed > 0);
                  }
                });
              });
            } else {
              resolve(false);
            }
          } else {
            resolve(false);
          }
        });
      } else {
        // Mac/Linux
        exec(`lsof -ti:${port}`, (error: any, stdout: string) => {
          if (stdout) {
            const pids = stdout.trim().split('\n').filter(pid => pid.length > 0);
            console.log(`🔍 Found processes on port ${port}: ${pids.join(', ')}`);

            pids.forEach(pid => {
              exec(`kill -9 ${pid}`, (killError: any) => {
                if (!killError) {
                  console.log(`✅ Killed process ${pid}`);
                }
              });
            });
            resolve(pids.length > 0);
          } else {
            resolve(false);
          }
        });
      }
    } catch (error) {
      console.log('⚠️ Could not check/kill processes:', error);
      resolve(false);
    }
  });
}

async function startServerWithRetry(port: number, maxAttempts: number = 3, delay: number = 2000): Promise<void> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    console.log(`\n🚀 Attempt ${attempt}/${maxAttempts} to start Server 1 on port ${port}...`);

    const portAvailable = await isPortAvailable(port);

    if (!portAvailable) {
      console.log(`⚠️ Port ${port} is in use. Trying to free it...`);
      const killed = await killProcessOnPort(port);

      if (killed) {
        console.log(`⏳ Waiting ${delay}ms for processes to terminate...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
    }

    // Try to start the server
    try {
      const server = new DistributedChatServer(port, SERVER_ID);

      // Override the start method to handle errors gracefully
      const originalStart = server.start;
      server.start = function() {
        try {
          return originalStart.call(this);
        } catch (error: any) {
          if (error.code === 'EADDRINUSE') {
            console.log(`❌ Port ${port} became unavailable. Retrying...`);
            return null;
          }
          throw error;
        }
      };

      server.start();
      console.log(`✅ Server 1 started successfully on port ${port}!`);
      return;

    } catch (error: any) {
      if (error.code === 'EADDRINUSE') {
        console.log(`❌ Port ${port} is still in use.`);

        if (attempt < maxAttempts) {
          console.log(`⏳ Waiting ${delay}ms before retry ${attempt + 1}...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          console.log(`\n💡 All attempts failed. Trying alternative port 3004...`);
          await startServerWithRetry(3004, 1, 0);
        }
      } else {
        console.error(`❌ Unexpected error:`, error);
        break;
      }
    }
  }
}

// Alternative: Try a different port if 3001 fails
async function startServer() {
  try {
    await startServerWithRetry(PORT, 3, 2000);
  } catch (error) {
    console.error('Failed to start server:', error);

    // Final fallback: Try port 3004
    console.log('\n🔀 Trying fallback port 3004...');
    const fallbackServer = new DistributedChatServer(3004, `${SERVER_ID}_fallback`);
    fallbackServer.start();
  }
}


startServer();


process.on('SIGINT', () => {
  console.log('\n👋 Shutting down Server 1 gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n👋 Server 1 terminated...');
  process.exit(0);
});