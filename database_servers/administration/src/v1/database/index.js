const mongoose = require('mongoose');

function buildMongoConnectionConfig() {
  const username = process.env.MONGO_DB_USERNAME;
  const password = process.env.MONGO_DB_PASSWORD;
  const host = process.env.MONGO_DB_HOST || 'mongodb';
  const port = process.env.MONGO_DB_PORT || '27017';
  const database = process.env.MONGO_DB_DATABASE || 'admin';

  if (username && password) {
    return {
      uri: `mongodb://${host}:${port}/${database}`,
      options: {
        user: username,
        pass: password,
        authSource: 'admin'
      }
    };
  }

  return {
    uri: process.env.MONGO_URI,
    options: {}
  };
}

class DatabaseConnection {
  static instance = null;
  
  constructor() {
    if (DatabaseConnection.instance) {
      return DatabaseConnection.instance;
    }
    
    this.connection = null;
    DatabaseConnection.instance = this;
  }
  
  async connect(uri) {
    if (this.connection && this.connection.readyState === 1) {
      return this.connection;
    }
    
    try {
      const connectionConfig = buildMongoConnectionConfig();
      this.connection = await mongoose.connect(uri || connectionConfig.uri, connectionConfig.options);
      console.log('Database connected successfully');
      return this.connection;
    } catch (error) {
      console.error('Database connection error:', error);
      throw error;
    }
  }
  
  async disconnect() {
    if (this.connection) {
      await mongoose.disconnect();
      this.connection = null;
      console.log('Database disconnected');
    }
  }
  
  getConnection() {
    return this.connection;
  }
  
  isConnected() {
    return this.connection && this.connection.readyState === 1;
  }
}

module.exports = new DatabaseConnection();
