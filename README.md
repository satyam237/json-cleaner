# JSON Buddy: Formatter & Cleaner

A beautiful, modern web app for formatting, validating, and cleaning JSON data. Paste your JSON (or Python-like data), see it beautified, and get help fixing errors—optionally with AI assistance. Supports file upload/download, multiple output formats, and both local and AI-powered cleaning.

---

## Features

- **Instant JSON Formatting & Validation**: Paste or upload your JSON and see it formatted and validated in real time.
- **Python-style Support**: Accepts Python dict/list syntax (True/False/None, single quotes, etc.) and converts to valid JSON or Python.
- **Basic Clean**: Local, offline fixes for common syntax issues (e.g., Python booleans/nulls, missing quotes, trailing commas).
- **AI Clean**: Advanced AI-powered correction for complex errors and direct conversion to your selected output format (JSON or Python). Powered by Google Gemini API (requires API key on backend).
- **Multiple Output Formats**: View and download your data as JSON, Python, XML, or plain text.
- **File Upload/Download**: Upload .json, .txt, .py, or .md files; download output in your chosen format.
- **Copy to Clipboard**: One-click copy of formatted output.
- **Responsive & Accessible**: Works great on desktop and mobile, with accessible UI components.

---

## Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher recommended)

### Local Development

1. **Install dependencies:**
   ```sh
   npm install
   ```
2. **Set your Gemini API key:**
   - Create a `.env.local` file in the project root.
   - Add your Gemini API key:
     ```env
     GEMINI_API_KEY=your_google_gemini_api_key_here
     ```
3. **Run the app:**
   ```sh
   npm run dev
   ```
   - Open `index.html` in a live server for frontend development.
   - For serverless API (AI Clean), use Vercel or similar platform.

---

## Deployment
- Designed for easy deployment on [Vercel](https://vercel.com/) (API routes in `/api`).
- Set the `GEMINI_API_KEY` environment variable in your deployment settings.

---

## Project Structure
- `App.tsx` — Main UI and logic
- `hooks/useJsonProcessor.ts` — Core JSON/Python processing logic
- `api/gemini-proxy.ts` — Serverless function for AI-powered cleaning
- `components/` — UI components (input, output, buttons, alerts, etc.)

---

## Contributing
Pull requests and suggestions are welcome! Feel free to open an issue or submit a PR.

---

## Author
**Satyam Jadhav**  
[GitHub Profile](https://www.github.com/satyam237/)  
Email: satyam2373@gmail.com

---

## License
MIT License
