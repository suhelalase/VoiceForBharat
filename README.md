# Voice Agent for Bharat Edition

This workspace contains a simple Day 1 voice agent starter.

## What it does
- Serves a small web app that listens to your microphone.
- Turns your speech into a simple reply.
- Uses browser speech synthesis by default.
- Can be wired to Murf Falcon TTS when a Murf API key is provided.

## Setup
1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy the environment example:
   ```bash
   cp .env.example .env  
   
   ```
3. Add your Murf API key and preferred voice ID to `.env`.
4. Start the app:
   ```bash
   npm start
   ```
5. Open http://localhost:3000.

## Day 1 notes
- Pick a track and keep the same one for all 10 days.
- Use an Indian voice in your prompts and recordings.
- Record a short video and post it to LinkedIn with the required hashtags.
