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
          50: '#f0f3fa',
          100: '#d5dff0',
          900: '#1A2E5A',
        },
        orange: {
          DEFAULT: '#E8660A',
          50: '#fef3e8',
          100: '#fde0c0',
          500: '#E8660A',
          600: '#cc5a08',
        },
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

export default config
