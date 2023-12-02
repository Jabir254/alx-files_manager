const redisclient = require('../utils/redis');
const dbClient = require('../utils/db');

class AppController {
  static async getStatus(req, res) {
    const redisStatus = redisclient.isAlive();
    const dbStatus = dbClient.isAlive();

    res.status(200).json({
      redis: redisStatus,
      db: dbStatus,
    });
  }

  static async getStats(req, res) {
    try {
      const usersCount = await dbClient.nbUsers();
      const filesCount = await dbClient.nbFiles();

      res.status(200).json({
        user: usersCount,
        files: filesCount,
      });
    } catch (error) {
      console.log(`Error fetching stats: ${error}`);
      res.status(500).json({ error: 'Internal server Error' });
    }
  }
}
module.exports = AppController;
