const crypto = require('crypto');
const dbClient = require('../utils/db');

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
      const userExists = await dbClient.db().collection('users').findOne({ email });
      if (userExists) {
        return res.status(400).json({ error: 'Already exists' });
      }

      const hashedPassword = crypto.createHash('sha1').update(password).digest('hex');

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
}

module.exports = UsersController;
