const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

const app = express();

app.use(cors());
app.use(express.json());

// Serve frontend files
app.use(express.static(__dirname));

app.post("/analyze", async (req, res) => {
    try {
        const { news } = req.body;

        if (!news) {
            return res.status(400).json({
                error: "News text is required"
            });
        }

        const prompt = `Perform a forensic news analysis on: "${news}"

Return JSON only — no markdown, no extra text:

{
  "verdict": "Likely Authentic" | "Highly Suspicious" | "Confirmed Fabricated",
  "score": 0-100,
  "metrics": {
    "Source Credibility": 0-100,
    "Logic Flow": 0-100,
    "Sensationalism": 0-100,
    "Attribution": 0-100
  },
  "summary": "3-sentence expert forensic breakdown.",
  "search_queries": [
    "specific fact-check query 1",
    "specific fact-check query 2"
  ]
}`;

        const response = await fetch(
            "https://api.groq.com/openai/v1/chat/completions",
            {
                method: "POST",

                headers: {
                    "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({
                    model: "openai/gpt-oss-120b",

                    messages: [
                        {
                            role: "system",
                            content:
                                "You are a forensic news analysis AI. Return only valid JSON."
                        },
                        {
                            role: "user",
                            content: prompt
                        }
                    ],

                    response_format: {
                        type: "json_object"
                    },

                    temperature: 0.3
                })
            }
        );

        const data = await response.json();

        if (!response.ok) {
            console.error("Groq API Error:", data);

            return res.status(response.status).json({
                error: data.error?.message || "Groq API request failed"
            });
        }

        const result = JSON.parse(
            data.choices[0].message.content
        );

        res.json(result);

    } catch (error) {
        console.error("Server Error:", error);

        res.status(500).json({
            error: "Analysis failed"
        });
    }
});

app.use(express.static(__dirname));
// Open the website
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
});

// Render provides the PORT
const PORT = process.env.PORT || 3001;

app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
});