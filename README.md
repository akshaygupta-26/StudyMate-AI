# StudyMate AI

StudyMate AI is a student-focused study assistant designed to make learning and study planning easier through a simple, modern web interface.

## Features

- **Notes Summarizer:** Extracts key points, generates concise summaries, and creates definitions glossaries from study notes across multiple modes (Key Takeaways, Executive Overview, Feynman Simplification, Exam Cram Sheet).
- **Quiz Generator:** Creates interactive practice quizzes with per-question timers, instant feedback, explanation cards, and score grading.
- **Flashcards Hub:** Spaced repetition system with interactive 3D card flips, preloaded decks (Tech, Biology, History), and custom card creation.
- **Focus Pomodoro:** 25-minute deep work intervals with custom break modes, session logs, and synthesized ambient study soundscapes (Rain, White Noise, Binaural Drone).
- **Study Planner:** Add, categorize, prioritize, and manage daily study tasks with persistent browser local storage.
- **AI Study Buddy:** Interactive academic tutor supporting concept breakdowns, memory mnemonics, and study schedules.
- **Progress Dashboard:** Track daily streaks, focus minutes, mastered quizzes, and task completion rates.
- **Responsive Design & Dual Theme:** Seamlessly adapts to desktop and mobile screens with dark and light theme toggles.

## Technologies Used

- **HTML5:** Semantic structure, accessible ARIA labels, and responsive layout.
- **CSS3:** Modern design system utilizing CSS custom properties, glassmorphism, responsive grids, and 3D card transforms.
- **JavaScript (Vanilla):** Local storage persistence, Web Audio API sound synthesis, HTML5 Canvas confetti particles, and client-side NLP algorithms.

## Getting Started

1. Download or clone this repository.
2. Ensure `index.html`, `style.css`, `script.js`, and `hero_illustration.jpg` are in the same folder.
3. Open `index.html` directly in any modern web browser.

Alternatively, serve it locally using Python:
```bash
python3 -m http.server 8080
```
Then visit `http://localhost:8080` in your browser.

No build tools or package installations are required.

## AI Engine & Modes

StudyMate AI supports two operational modes:

1. **Built-in Smart Engine (Offline):** Uses browser-based text analysis, TF-IDF sentence importance scoring, and built-in subject knowledge bases. It operates 100% offline with zero setup and no API keys required.
2. **Google Gemini AI (Live API - Optional):** For dynamic generative AI completions, users can enter a Google Gemini API key via the **Settings ⚙** modal. The key is stored securely and privately in the browser's `localStorage`.

## Deployment

You can deploy this static application using GitHub Pages:

1. Push the project files to a GitHub repository.
2. In your repository, navigate to **Settings → Pages**.
3. Under **Branch**, select `main` (or `master`) and folder as `/ (root)`.
4. Click **Save** and visit your published live site URL.

## Future Improvements

- Sync tasks and study decks across multiple devices via cloud storage.
- Audio speech synthesis (read aloud notes and summaries).
- Subject-wise long-term analytics and mastery heatmaps.
- Export summaries and flashcard decks to Anki format.

## License

This project is available under the MIT License. Add a `LICENSE` file containing the MIT license text before distributing it under that license.
