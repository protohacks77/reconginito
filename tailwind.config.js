/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        background: '#1A1A1A', // A very dark grey, almost black
        surface: '#2C2C2C',    // A lighter dark grey for cards and surfaces
        primary: '#8A63D2',    // A vibrant purple for accents
        'on-surface': '#E0E0E0', // Light grey for text
        'on-surface-variant': '#BDBDBD', // A slightly dimmer grey for secondary text
        outline: '#424242',      // A medium grey for borders and lines
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
};