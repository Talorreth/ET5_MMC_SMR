/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}", // <--- Vérifie bien cette ligne
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}