/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#EEF2FF', 100: '#E0E7FF', 200: '#C7D7FE',
          300: '#A4BCFD', 400: '#818CF8', 500: '#6366F1',
          600: '#4F46E5', 700: '#4338CA', 800: '#3730A3', 900: '#312E81',
        },
        canvas:  '#F4F6F8',
        surface: '#FFFFFF',
        sidebar: { DEFAULT: '#18181B', text: '#A1A1AA', active: '#818CF8' },
      },
      fontFamily: {
        sans:    ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['Inter', 'system-ui', 'sans-serif'],
        mono:    ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      fontSize: {
        '2xs': ['10px', '14px'],
        'xs':  ['12px', '16px'],
        'sm':  ['13.5px', '20px'],
        'base':['14px', '22px'],
        'md':  ['15px', '22px'],
        'lg':  ['16px', '24px'],
        'xl':  ['18px', '26px'],
        '2xl': ['20px', '28px'],
        '3xl': ['24px', '32px'],
        '4xl': ['30px', '38px'],
      },
      borderRadius: {
        'sm':  '4px',  'DEFAULT': '8px', 'md':  '8px',
        'lg':  '12px', 'xl':  '16px',   '2xl': '20px',
        '3xl': '24px',
      },
      boxShadow: {
        'xs':  '0 1px 2px rgba(0,0,0,0.05)',
        'sm':  '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)',
        'md':  '0 4px 6px rgba(0,0,0,0.07), 0 2px 4px rgba(0,0,0,0.04)',
        'lg':  '0 10px 15px rgba(0,0,0,0.08), 0 4px 6px rgba(0,0,0,0.04)',
        'xl':  '0 20px 25px rgba(0,0,0,0.1), 0 8px 10px rgba(0,0,0,0.04)',
        '2xl': '0 25px 50px rgba(0,0,0,0.18)',
        'modal': '0 32px 64px rgba(0,0,0,0.2)',
        'card':  '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)',
        'inner': 'inset 0 1px 2px rgba(0,0,0,0.05)',
        'brand': '0 2px 8px rgba(79,70,229,0.35)',
        'none':  'none',
      },
      spacing: {
        '4.5': '18px', '5.5': '22px', '13': '52px', '15': '60px',
        '18': '72px',  '22': '88px',  '58': '232px',
      },
      zIndex: {
        'sidebar': '40', 'header': '30', 'dropdown': '50',
        'modal': '60', 'toast': '70', 'tooltip': '80',
      },
    },
  },
  plugins: [],
}
