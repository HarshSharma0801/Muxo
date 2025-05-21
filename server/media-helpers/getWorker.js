async function getWorker(workers) {
  return new Promise(async (resolve, reject) => {
    try {
      if (!workers || workers.length === 0) {
        reject(new Error("No workers available"));
        return;
      }

      const workersLoad = workers.map(worker => {
        return new Promise(async (resolve, reject) => {
          try {
            const stats = await worker.getResourceUsage();
            const cpuUsage = stats.ru_utime + stats.ru_stime; 
            resolve({ worker, cpuUsage });
          } catch (error) {
            reject(error);
          }
        });
      });

      const workersLoadCalc = await Promise.all(workersLoad);
      
      let leastLoadedWorker = workersLoadCalc[0].worker;
      let leastWorkerLoad = workersLoadCalc[0].cpuUsage;

      for (let i = 1; i < workersLoadCalc.length; i++) {
        if (workersLoadCalc[i].cpuUsage < leastWorkerLoad) {
          leastWorkerLoad = workersLoadCalc[i].cpuUsage;
          leastLoadedWorker = workersLoadCalc[i].worker;
        }
      }

      resolve(leastLoadedWorker);
    } catch (error) {
      reject(error);
    }
  });
}

module.exports = getWorker;