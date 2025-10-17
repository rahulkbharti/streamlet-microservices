import express from "express";
import streamRouter from "./routes/stream.routes.js";
import cors from 'cors';
import dotenv from "dotenv";
dotenv.config({ path: `./${process.env.ENV_FILE}` });

const PORT = process.env.PORT || 5000;
const app = express();

app.use(cors());
app.use("/watch", streamRouter);

app.get("/", (req, res) => {
    res.status(200).json({ message: "service is running" })
})
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
