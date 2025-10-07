import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config({ path: `.env.${process.env.NODE_ENV || "development"}` });

const ConnectMongoose = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("✅ MongoDB Connected [mongoose]");
    } catch (e) {
        console.log("❌ MongoDB [mongoose] Connection Error:", e);
    }
}

export default ConnectMongoose;