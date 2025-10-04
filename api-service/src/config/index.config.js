import dotenv from "dotenv";

dotenv.config({ path: `.env.${process.env.NODE_ENV || "development"}` });

export const config = {
    port: process.env.PORT || 4000,
    nodeEnv: process.env.NODE_ENV || 'development',
    redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
    mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017/streamlet',
    prismaDbUrl: process.env.DATABASE_URL || 'postgresql://user:password@localhost:5432/streamlet',
};