import express from "express";
import prisma from "../utils/prisma.js";
import bcrypt from "bcryptjs";
import { getUploadUrl, scheduleVideoJob } from '../controllers/video.controller.js';
import { generateUsername } from "../utils/username.js";
import { generateTokens } from "../utils/jwt.js";

const router = express.Router();
router.post("/signup", async (req, res) => {
    // Handle user signup
    const body = req.body;
    console.log("Signup request body:", body);

    const existingUser = await prisma.user.findUnique({
        where: { email: body.email }
    });

    if (existingUser) {
        return res.status(400).send({ error: "Email already in use" });
    }

    const hashedPassword = await bcrypt.hash(body.password, 10);
    const userData = {
        email: body.email,
        username: generateUsername(body.email),
        passwordHash: hashedPassword
    };
    const response = await prisma.user.create({
        data: userData
    });
    console.log("User created:", response);
    res.status(201).send({ message: "User signed up successfully", user: response });
});
router.post("/login", async (req, res) => {
    // Handle user login
    const body = req.body;
    const user = await prisma.user.findUnique({
        where: { email: body.email }
    });
    console.log("Login request body:", body);
    if (!user) {
        return res.status(401).send({ error: "Invalid email or password" });
    }
    const isValidPassword = await bcrypt.compare(body.password, user.passwordHash);
    if (!isValidPassword) {
        return res.status(401).send({ error: "Invalid email or password" });
    }
    const tokens = generateTokens(user);
    res.status(200).send({ message: "User logged in successfully", user, tokens });
});

router.route('/get-upload-url').post(getUploadUrl);
router.route('/schedule-job').post(scheduleVideoJob);
export default router;