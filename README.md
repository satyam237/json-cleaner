# 🎯 **AIjsonformatter** - AI-Powered JSON Formatter & Cleaner

**Live at: [aijsonformatter.site](https://aijsonformatter.site)**

A beautiful, intelligent web application that makes working with JSON data effortless. Whether you're a developer debugging API responses, a data analyst cleaning datasets, or anyone dealing with JSON structures, AIjsonformatter provides the tools you need to format, validate, and fix your data instantly.

---

## ✨ **Key Features**

### 🔧 **JSON Processing**
- **Instant Formatting**: Beautiful JSON with proper indentation and syntax highlighting
- **Smart Validation**: Real-time error detection with helpful suggestions
- **Python Output**: Convert JSON to Python dictionary/list syntax
- **File Support**: Upload JSON files directly or download results

### 🤖 **AI-Powered Cleaning**
- **Basic Clean**: Fixes common JSON issues (quotes, trailing commas, Python literals)
- **AI Clean**: Advanced error correction using Google Gemini AI
- **Smart Error Recovery**: Handles malformed data with intelligent suggestions
- **Multi-format Support**: Works with both JSON and Python-like structures

### 📊 **Advanced Features**
- **Real-time Statistics**: Character count, lines, file size, and compression ratio
- **Collapsible Sections**: Expand/collapse JSON objects and arrays with arrow controls
- **Google Analytics**: Usage tracking and performance monitoring

### 🎨 **User Experience**
- **Dark Theme**: Professional dark interface optimized for JSON viewing
- **Responsive Design**: Works perfectly on desktop and mobile
- **Line Numbers**: IDE-like experience with synchronized scrolling
- **Syntax Highlighting**: Clear visual distinction for different JSON elements
- **Copy & Download**: One-click copy to clipboard or download as file

---

## 🚀 **How to Use**

1. **Input**: Paste your JSON data into the left panel or upload a file
2. **Collapse/Expand**: Click the arrow icons next to line numbers to fold JSON sections
3. **Format**: Choose JSON or Python output format
4. **Clean**: Use "Basic Clean" for simple fixes or "AI Clean" for complex issues
5. **Export**: Copy to clipboard or download the formatted result



---

## 🔗 Access AIjsonformatter

**Visit**: [aijsonformatter.site](https://aijsonformatter.site)

Perfect for developers, data scientists, and anyone working with JSON data who needs reliable formatting and validation tools.

---

## 🛠 **Development & Deployment**

Built with modern web technologies:
- **React 18** with TypeScript
- **Tailwind CSS** for styling  
- **Google Gemini AI** for intelligent error correction
- **Vite** for fast development and building
- **Vercel** for deployment and serverless functions

### Local Development
```bash
# Install dependencies
npm install

# For local development (frontend only, AI features won't work)
npm run dev

# For local development with AI features (requires API key)
vercel dev --listen 3000
```

### Environment Setup
Create a `.env.local` file in the root directory:
```bash
# Google Gemini AI API Key (required for AI Clean functionality)
# Get your API key from: https://ai.google.dev/
GEMINI_API_KEY=your_gemini_api_key_here
```

### Production Deployment on Vercel

1. **Push to GitHub:**
   ```bash
   git add .
   git commit -m "Production ready build"
   git push origin main
   ```

2. **Deploy to Vercel:**
   - Connect your GitHub repository to Vercel
   - Add your `GEMINI_API_KEY` in Vercel Dashboard → Settings → Environment Variables
   - Deploy automatically or manually trigger deployment

3. **Environment Variables in Vercel:**
   ```
   GEMINI_API_KEY = your_actual_gemini_api_key
   ```

### Build for Production
```bash
npm run build
```

### Features Working Without AI Key
- JSON formatting and validation
- Basic error cleaning (Python literals, quotes, trailing commas)
- Compact/minify JSON
- File upload/download
- Export to multiple formats (YAML, CSV, TOML, Markdown)
- Search and highlighting
- Keyboard shortcuts
- Theme switching

---

## 📝 **License**

MIT License - feel free to use this project for your own needs.

---

**Made with ❤️ for the developer community**
