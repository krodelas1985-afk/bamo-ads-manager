import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: '#1A2E5A',
          light: '#E8EBF3',
          50: '#f0f3fa',
          100: '#d5dff0',
          900: '#1A2E5A',
        },
        orange: {
          DEFAULT: '#E8660A',
          light: '#FDE8D8',
          50: '#fef3e8',
          500: '#E8660A',
          600: '#cc5a08',
        },
        bamo: {
          bg: '#F4F5F7',
          border: 'rgba(0,0,0,0.1)',
        }
      },
      fontFamily: {
        sans: ['DM Sans', 'sans-serif'],
      },
      fontSize: {
        '2xs': '10px',
        xs: '11px',
        sm: '12px',
        base: '13px',
        md: '14px',
        lg: '15px',
        xl: '18px',
        '2xl': '20px',
        '3xl': '24px',
      },
      borderRadius: {
        card: '10px',
        btn: '8px',
        pill: '20px',
      },
      boxShadow: {
        card: '0 1px 3px rgba(0,0,0,0.06)',
      }
    },
  },
  plugins: [],
}

export default config
