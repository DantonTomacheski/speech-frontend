export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          dark: '#0A0A0F',
          DEFAULT: '#151A30',
        },
        accent: {
          red: '#FF3B42',
          turquoise: '#00E2C3',
          blue: '#4B6EFF',
        },
        text: {
          primary: '#FFFFFF',
          secondary: 'rgba(255, 255, 255, 0.7)',
        }
      },
      fontFamily: {
        sans: ['Montserrat', 'sans-serif'],
      },
      backgroundImage: {
        'gradient-primary': 'linear-gradient(135deg, #0A0A0F, #151A30)',
        'gradient-accent': 'linear-gradient(130deg, #00E2C3, #4B6EFF, #FF3B42)',
      },
      animation: {
        'pulse-glow': 'pulse-glow 2s infinite',
        'pulse-recording': 'pulse-recording 1.5s infinite',
        'gradient-flow': 'gradient-border-animation 4s ease infinite',
        'fade-in-scale': 'fade-in-scale 0.5s ease-out forwards',
      },
      backdropBlur: {
        xs: '2px',
      },
      boxShadow: {
        'glow-turquoise': '0 0 15px rgba(0, 226, 195, 0.5)',
        'glow-red': '0 0 15px rgba(255, 59, 66, 0.5)',
        'glow-blue': '0 0 15px rgba(75, 110, 255, 0.5)',
      }
    },
  },
  plugins: [],
}