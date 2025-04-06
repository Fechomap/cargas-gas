// config/db.config.js
import { env } from './environment.js';

export const dbConfig = {
  uri: env.MONGODB_URI,
  options: {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    dbName: env.MONGODB_DB_NAME
  }
};