import { PrismaClient } from "../models/generated/prisma/client.js";
const prisma = new PrismaClient();
prisma.$on('connect', () => {
    console.log('Prisma connected to the database');
});

prisma.$on('error', (e) => {
    console.error('Prisma connection error:', e);
});
export default prisma;