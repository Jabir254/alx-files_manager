// controllers/FilesController.js
const { v4: uuidv4 } = require('uuid');
const mime = require('mime-types');
const fs = require('fs').promises;
const path = require('path');
const { ObjectId } = require('mongodb');
const redisClient = require('../utils/redis');
const dbClient = require('../utils/db');

class FilesController {
  static async postUpload(req, res) {
    const { token } = req.headers;
    const {
      name, type, parentId = 0, isPublic = false, data,
    } = req.body;

    try {
      // Retrieve user based on the token
      const userId = await redisClient.get(`auth_${token}`);
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Check if name is provided
      if (!name) {
        return res.status(400).json({ error: 'Missing name' });
      }

      // Check if type is provided and is valid
      const validTypes = ['folder', 'file', 'image'];
      if (!type || !validTypes.includes(type)) {
        return res.status(400).json({ error: 'Missing type' });
      }

      // Check if data is provided for file and image types
      if ((type === 'file' || type === 'image') && !data) {
        return res.status(400).json({ error: 'Missing data' });
      }

      // If parentId is provided, validate it
      if (parentId !== 0) {
        const parentFile = await dbClient
          .db()
          .collection('files')
          .findOne({
            _id: ObjectId(parentId),
          });

        if (!parentFile) {
          return res.status(400).json({ error: 'Parent not found' });
        }

        if (parentFile.type !== 'folder') {
          return res.status(400).json({ error: 'Parent is not a folder' });
        }
      }

      // Prepare file data
      const fileData = {
        userId: ObjectId(userId),
        name,
        type,
        parentId: ObjectId(parentId),
        isPublic,
      };

      // If type is folder, add the new file document in the DB and return the new file
      if (type === 'folder') {
        const result = await dbClient
          .db()
          .collection('files')
          .insertOne(fileData);
        return res.status(201).json(result.ops[0]);
      }

      // For file and image types, store the file locally
      const folderPath = process.env.FOLDER_PATH || '/tmp/files_manager';
      const localPath = path.join(folderPath, uuidv4());

      // Decode Base64 data and write to the local file
      const decodedData = Buffer.from(data, 'base64');
      await fs.writeFile(localPath, decodedData);

      // Add local path to file data and add the new file document in the DB
      fileData.localPath = localPath;
      const result = await dbClient
        .db()
        .collection('files')
        .insertOne(fileData);

      return res.status(201).json(result.ops[0]);
    } catch (error) {
      console.error(`Error uploading file: ${error}`);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  static async getShow(req, res) {
    const { token } = req.headers;
    const { id } = req.params;

    try {
      // Retrieve user based on the token
      const userId = await redisClient.get(`auth_${token}`);
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Retrieve file document based on user ID and file ID
      const file = await dbClient.db().collection('files').findOne({
        _id: ObjectId(id),
        userId: ObjectId(userId),
      });

      if (!file) {
        return res.status(404).json({ error: 'Not found' });
      }

      return res.status(200).json(file);
    } catch (error) {
      console.error(`Error retrieving file: ${error}`);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  static async getIndex(req, res) {
    const { token } = req.headers;
    const { parentId = '0', page = '0' } = req.query;

    try {
      // Retrieve user based on the token
      const userId = await redisClient.get(`auth_${token}`);
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Define pagination parameters
      const pageSize = 20;
      // eslint-disable-next-line radix
      const skip = parseInt(page) * pageSize;

      // Retrieve file documents based on user ID, parentId, and pagination
      const files = await dbClient
        .db()
        .collection('files')
        .find({
          userId: ObjectId(userId),
          parentId: ObjectId(parentId),
        })
        .skip(skip)
        .limit(pageSize)
        .toArray();

      return res.status(200).json(files);
    } catch (error) {
      console.error(`Error retrieving files: ${error}`);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  static async putPublish(res, req) {
    const { token } = req.headers;
    const { id } = req.params;

    try {
      const userId = await redisClient.get(`auth_${token}`);
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      const filter = { _id: ObjectId(id), userId: ObjectId(userId) };
      const update = { $set: { isPublic: true } };
      const option = { returnDocument: 'after' };

      const updatefile = await dbClient.db().collection('files').findOneAndUpdate(filter, update, option);

      if (!updatefile.value) {
        return res.status(404).json({ error: 'Not Found' });
      }
      return res.status(200).json(updatefile.value);
    } catch (error) {
      console.error(`Error publishing file: ${error}`);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  static async putUnpublish(req, res) {
    const { token } = req.headers;
    const { id } = req.params;

    try {
      // Retrieve user based on the token
      const userId = await redisClient.get(`auth_${token}`);
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Retrieve and update file document based on user ID and file ID
      const filter = { _id: ObjectId(id), userId: ObjectId(userId) };
      const update = { $set: { isPublic: false } };
      const options = { returnDocument: 'after' };

      const updatedFile = await dbClient
        .db()
        .collection('files')
        .findOneAndUpdate(filter, update, options);

      if (!updatedFile.value) {
        return res.status(404).json({ error: 'Not found' });
      }

      return res.status(200).json(updatedFile.value);
    } catch (error) {
      console.error(`Error unpublishing file: ${error}`);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  static async getFile(res, req) {
    const { token } = req.headers;
    const { id } = req.params;

    try {
      // Retrieve user based on the token
      const userId = await redisClient.get(`auth_${token}`);
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Retrieve file document based on user ID and file ID
      const file = await dbClient.db().collection('files').findOne({
        _id: ObjectId(id),
      });

      if (!file) {
        return res.status(404).json({ error: 'Not found' });
      }

      // Check if the file is public or the user is the owner
      if (!file.isPublic && file.userId.toString() !== userId) {
        return res.status(404).json({ error: 'Not found' });
      }

      // Check if the file is a folder
      if (file.type === 'folder') {
        return res.status(400).json({ error: 'A folder doesn\'t have content' });
      }

      // Check if the file is locally present
      if (!file.localPath) {
        return res.status(404).json({ error: 'Not found' });
      }

      // Get the MIME-type based on the name of the file
      const mimeType = mime.lookup(file.name);

      // Read the content of the file and return it with the correct MIME-type
      const content = await fs.readFile(file.localPath);
      res.setHeader('Content-Type', mimeType);
      return res.status(200).send(content);
    } catch (error) {
      console.error(`Error retrieving file content: ${error}`);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }
}

module.exports = FilesController;
