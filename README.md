This project implements a lightweight FNOL (First Notice of Loss) extraction and routing agent using Node.js.
The goal is to parse raw FNOL text, extract key insurance fields, detect missing information, and recommend the correct routing decision.

Approach Summary

1.Text Input
The API accepts plain text FNOL content through a single POST endpoint:
POST /api/extract.
2. Field Extraction (Regex-Based)
No AI API is used. All extraction is done with carefully tuned regex patterns.
The extractor returns:

Policy details

Incident date, time, location

Claimant details

Description

Damage estimate

Claim type

Attachments

3. Missing Field Detection
After extraction, the system checks if any mandatory fields are missing:

incidentTime

incidentLocation

description

claimant

attachments

initialEstimate

4. Routing Logic
Simple business rules are applied:

If estimatedDamage < 25000 → Fast-Track

If any mandatory field missing → Manual Review

If description includes suspicious keywords → Investigation

If claim type = injury → Specialist Queue

5. Clean JSON Output
The API responds with:

extractedFields

missingFields

recommendedRoute

reasoning explanation

Why Regex?

Regex allows a fast, lightweight approach without relying on paid APIs.
It’s reliable for structured or semi-structured FNOL documents.

How Samples Are Used

The samples/ folder contains dummy FNOL text files.
They are not read automatically.
They are provided only for testing — copy the content into Postman and send it to /api/extract.
