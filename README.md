# Streamlet: Microservices-Based Video Streaming Platform

Streamlet is a modern, scalable video streaming platform built from the ground up using a microservices architecture. It efficiently handles the entire video lifecycle—from upload and multi-resolution transcoding to on-demand, high-performance streaming.

## ![Architecture Diagram](./Streamlet.jpg)

### Frontend (Nextjs and tailwind CSS) : https://github.com/rahulkbharti/streamlet-frontend.git

## Architecture Overview

Streamlet consists of three core, decoupled microservices that communicate via a job queue. This design ensures each part of the system can be scaled, updated, and maintained independently.

**Workflow:**

1. **Upload:** Client requests an upload URL from the API Service.
2. **Storage:** Video is uploaded directly to cloud object storage (e.g., B2 Cold Storage).
3. **Processing Job:** API Service adds a new transcoding job to the BULLMQ queue.
4. **Transcoding:** Transcoder Service picks up the job, downloads the video, transcodes it into multiple formats (1080p, 720p, 480p), and uploads processed chunks back to storage.
5. **Streaming:** Content Service delivers the appropriate video chunks to the client for smooth playback.

---

## Core Components

### 1. API Service

- **Role:** Central gateway to the platform.
- **Responsibilities:**
  - Manages client interactions
  - User authentication
  - Handles video metadata (PostgreSQL & MongoDB)
  - Orchestrates upload process
  - Adds jobs to transcoding queue
- **Technologies:** Node.js, Express, PostgreSQL, MongoDB, Socket.io

### 2. Transcoder Service

- **Role:** Dedicated background worker for video processing.
- **Responsibilities:**
  - Listens for new jobs from BULLMQ
  - Downloads source video
  - Transcodes using FFmpeg
  - Uploads processed chunks to storage
- **Technologies:** Node.js, BULLMQ, FFmpeg, Redis

### 3. Content Service

- **Role:** High-performance delivery engine.
- **Responsibilities:**
  - Delivers video chunks (HLS/DASH) and images to clients
- **Technologies:** Node.js, NGINX (optional for caching/proxying. Also can be contected with CDN)

---

## Technology Stack

- **Backend:** Node.js
- **Databases:** PostgreSQL (relational), MongoDB (document)
- **Job Queue:** BULLMQ with Redis
- **Real-time Communication:** Socket.io
- **Object Storage:** Backblaze B2 (or any S3-compatible service)
- **Containerization:** Docker (recommended)

---

## Key Features

- **Microservices Architecture:** Scalability, fault tolerance, maintainability
- **Asynchronous Video Processing:** Non-blocking transcoding
- **Multi-Resolution Streaming:** Adaptive Bitrate Streaming
- **Real-time Upload Progress:** Live updates via Socket.io
- **Decoupled Components:** Independent development and deployment

---

## Getting Started

Follow these steps to set up the project locally:

```bash
git clone https://github.com/rahukbharti/streamlet-microservices.git
cd streamlet-microservices
# Make Sure that You have create the environment files for each service
docker-compose up -d # Or Run each service individually
```

1. Set up environment variables (add `.env.development` and `.env.production` files in each service folder)
2. Start each service (API, Transcoder, Content) as described in their respective folders
