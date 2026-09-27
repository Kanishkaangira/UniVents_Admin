/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#1B1F3B',
        mute: '#6B7194',
        primary: '#4F46E5',
        primary2: '#8B7CF8',
        accent: '#FF7A59',
        success: '#12B981',
        danger: '#E5533A',
        line: '#E8EAF3',
        soft: '#EEF0FF',
        bg: '#F4F5FC',
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 4px 16px rgba(60,50,150,0.08)',
      },
    },
  },
  plugins: [],
};
