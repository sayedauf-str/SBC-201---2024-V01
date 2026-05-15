# SBC-201:2024 Compliance AI Assistant

A full-stack application for Saudi Diyar Consultants (SDC) to verify building code compliance.

## Deployment to GitHub & Vercel

### 1. Push to GitHub
Create a new repository on GitHub and push this codebase.

### 2. Connect to Vercel
1. Go to [Vercel](https://vercel.com/) and import your GitHub repository.
2. **Environment Variables**: In the Vercel project settings, add the following environment variable:
   - `GEMINI_API_KEY`: Your Google AI Studio API Key.
3. **Build Settings**: Vercel should automatically detect the settings, but ensure they match:
   - Framework Preset: `Vite`
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Install Command: `npm install`

### 3. Usage
The application uses a secure backend proxy to communicate with the Gemini API, keeping your API key protected from the client-side code.

## Development
To run locally:
1. `npm install`
2. Create a `.env` file with your `GEMINI_API_KEY`.
3. `npm run dev`
