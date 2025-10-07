import express from "express";
import streamRouter from "./routes/stream.routes.js";
import cors from 'cors';

const PORT = 5000;
const app = express();


app.use(cors());
app.use("/watch", streamRouter);

app.get("", (req, res) => {
    res.json(200).json({ message: "service is running" })
})
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
