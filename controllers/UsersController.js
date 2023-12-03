const crypto = require('crypto');
const dbClient = require('../utils/db');
const redisClient = require('../utils/redis');

class UsersController {
  static async postNew(req, res) {
    const { email, password } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Missing email' });
    }
    if (!password) {
      return res.status(400).json({ error: 'Missing password' });
    }

    try {
      const userExists = await dbClient
        .db()
        .collection('users')
        .findOne({ email });
      if (userExists) {
        return res.status(400).json({ error: 'Already exists' });
      }

      const hashedPassword = crypto
        .createHash('sha1')
        .update(password)
        .digest('hex');

      const newUser = {
        email,
        password: hashedPassword,
      };

      const result = await dbClient.db().collection('users').insertOne(newUser);

      const createdUser = {
        email: result.ops[0].email,
        id: result.ops[0]._id,
      };
      return res.status(201).json(createdUser);
    } catch (error) {
      console.log(`Error creating user: ${error}`);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  static async getMe(req, res) {
    const token = req.headers['x-token'];

    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      // Retrieve user based on the token from Redis
      const userId = await redisClient.get(`auth_${token}`);

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Retrieve user from the database based on user ID
      const user = await dbClient.db().collection('users').findOne({ _id: userId });

      if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Return user object with email and id only
      const userObject = {
        email: user.email,
        id: user._id,
      };

      return res.status(200).json(userObject);
    } catch (error) {
      console.error(`Error fetching user: ${error}`);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }
}

module.exports = UsersController;
