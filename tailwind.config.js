/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./*.{html,js}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter Tight', 'SF Pro Text', 'Avenir Next', 'Segoe UI Variable', 'Segoe UI', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 8px 22px -16px rgb(15 23 42 / 0.5)',
        card: '0 10px 18px -14px rgb(15 23 42 / 0.45)',
      },
    },
  },
  plugins: [],
};
