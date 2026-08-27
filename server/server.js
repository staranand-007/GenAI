import express from "express";
import { GoogleGenAI } from "@google/genai";
import path from "node:path";
import { fileURLToPath } from "node:url";
import "dotenv/config";

const app = express();
const PORT = 3000;
const MODEL = "gemini-3.6-flash";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, "..");

// Initialize Gemini
const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY
});

const MAX_FILE_SIZE = 5 * 1024 * 1024;

const ALLOWED_FILE_TYPES = new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif"
]);

// Middleware
app.use(express.json({ limit: "10mb" }));

// Server frontend
app.use(express.static(projectRoot));

// Health check
app.get("/api/health", (req, res) => {
    res.json({ status: "Server is running" });
});

// Chat endpoint
app.post("/api/chat", async (req, res) => {
    const { message, file, history  = [] } = req.body;

    if (!Array.isArray(history)) {
        return res.status(400).json({
            error: "Invalid conversation history."
        });
    }

    if (!message?.trim() && !file?.data) {
        return res.status(400).json({
            error: "Message or image is required."
        });
    }

    if (file?.data) {
        if (!ALLOWED_FILE_TYPES.has(file.mime_type)) {
            return res.status(400).json({
                error: "Unsupported image type."
            });
        }
        const fileSize = Buffer.byteLength(file.data, "base64");
        if (fileSize > MAX_FILE_SIZE) {
            return res.status(400).json({
                error: "Image is too large. Maximum size is 5 MB."
            });
        }
    }

    try {
        const parts = [];

    if (message?.trim()) {
        parts.push({
        text: message.trim()
        });
    }

    if (file?.data) {
        parts.push({
            inlineData: {
            mimeType: file.mime_type,
            data: file.data
            }
        });
    }

    const contents = [
        ...history,
        {
            role: "user",
            parts
        }
    ];

const response = await ai.models.generateContent({
    model: MODEL,
    contents
});

        if (!response.text) {
            throw new Error("Gemini returned an empty response.");
        }

        res.json({
            response: response.text
        });
    } catch (error) {
        console.error("Gemini API Error:", error);

        res.status(500).json({
            error: "Failed to generate a response."
        });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});