import * as net from 'net';

/**
 * Check if a given port is available on localhost.
 * @param port The port to check.
 * @returns Promise<boolean> True if the port is available, false otherwise.
 */
function checkPortAvailability(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.unref(); // Allow the process to exit even if the server is still open.
    server.on('error', () => resolve(false)); // Port is in use
    server.listen(port, 'localhost', () => resolve(true)); // Port is available
  });
}

/**
 * Find an available port by starting from the given port and incrementing if needed.
 * @param startPort The starting port to check.
 * @returns Promise<number> The first available port.
 */
export async function findAvailablePort(startPort: number): Promise<number> {
  let port = startPort;
  
  while (!(await checkPortAvailability(port))) {
    console.log(`Port ${port} is in use. Trying port ${port + 1}...`);
    port++; // Increment port by 1
  }
  
  return port; // Found an available port
}

// Example Usage:
// async function main() {
//   const startingPort = 3000;
//   const availablePort = await findAvailablePort(startingPort);
//   console.log(`First available port is: ${availablePort}`);
// }

// main();
