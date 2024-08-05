import * as os from 'os';
import cluster from 'cluster';
import path from 'path';

// CgasApi.get().upload([
//   {
//     filename: "test.png",
//     data: fs.createReadStream(
//       "C:\\Users\\Taree\\Downloads\\198c0679dccbf125254f1ba73a54a592.jpg"
//     ),
//   },
//   {
//     filename: "test2.png",
//     data: fs.createReadStream(
//       "C:\\Users\\Taree\\Downloads\\cad56cfd8b52cecba024d1e420fa06dd.png"
//     ),
//   },
// ]).then(console.log);

if (cluster.isPrimary) {
	// Take advantage of multiple CPUs
	const cpus = os.cpus().length;

	if (process.argv.includes('--no-cluster')) {
		cluster.fork(process.env);
	} else {
		for (let i = 0; i < Math.max(cpus, 4); i++) {
			cluster.fork(process.env);
		}
	}

	cluster.on('exit', (worker, code) => {
		if (code !== 0 && !worker.exitedAfterDisconnect) {
			cluster.fork();
		}
	});
} else {
	require(path.join(__dirname, 'server'));
}
