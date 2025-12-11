const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");

const { extractFieldsFromText } = require("./extractor");
const { decideRoute } = require("./routing");

const upload = multer({ dest: "uploads/" });
const app = express();
app.use(express.json());


app.get("/", (req, res) => res.send("FNOL Agent (Offline) running"));


app.post("/api/extract", async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: "Text is required" });

    const extractedFields = extractFieldsFromText(String(text));

    const mandatory = [
      "policyNumber",
      "policyholderName",
      "incidentDate",
      "incidentTime",
      "incidentLocation",
      "description",
      "claimant",
      "claimType",
      "initialEstimate",
      "attachments"
    ];
    const missingFields = mandatory.filter((f) => {
      const v = extractedFields[f];
      return v === null || v === undefined || (typeof v === "string" && v.trim() === "");
    });

    const { recommendedRoute, reasoning } = decideRoute(extractedFields, missingFields);

    return res.json({ extractedFields, missingFields, recommendedRoute, reasoning });
  } catch (err) {
    console.error("API /api/extract error:", err);
    res.status(500).json({ error: "Internal server error", details: err.message });
  }
});


app.post("/process", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded (field name: file)" });

    const ext = path.extname(req.file.originalname).toLowerCase();
    let text = "";

    if (ext === ".pdf") {
      const pdfParse = require("pdf-parse");
      const dataBuffer = fs.readFileSync(req.file.path);
      const data = await pdfParse(dataBuffer);
      text = data.text || "";
    } else {
      text = fs.readFileSync(req.file.path, "utf8");
    }

    
    fs.unlinkSync(req.file.path);

    const extractedFields = extractFieldsFromText(String(text));

    const mandatory = [
      "policyNumber",
      "policyholderName",
      "incidentDate",
      "incidentTime",
      "incidentLocation",
      "description",
      "claimant",
      "claimType",
      "initialEstimate",
      "attachments"
    ];
    const missingFields = mandatory.filter((f) => {
      const v = extractedFields[f];
      return v === null || v === undefined || (typeof v === "string" && v.trim() === "");
    });

    const { recommendedRoute, reasoning } = decideRoute(extractedFields, missingFields);

    return res.json({ extractedFields, missingFields, recommendedRoute, reasoning });
  } catch (err) {
    console.error("API /process error:", err);
    res.status(500).json({ error: "Internal error", details: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`FNOL Agent listening on port ${PORT}`));
