import cluster from 'cluster';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import './sqlite'

if (cluster.isPrimary) {

  // Take advantage of multiple CPUs
  const cpus = os.cpus().length;

  for (let i = 0; i < Math.max(cpus, 4); i++) {
    cluster.fork(process.env);
  }

  cluster.on("exit", (worker, code) => {
    if (code !== 0 && !worker.exitedAfterDisconnect) {
      const nw = cluster.fork();
    }
  });
} else {
  require(path.join(__dirname, "cluster"));
}
