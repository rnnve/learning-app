/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#5B5BD6",
          dark: "#8B8BFF",
        },
        secondary: {
          DEFAULT: "#FF7A59",
          dark: "#FF9A80",
        },
        tertiary: {
          DEFAULT: "#2DBE8D",
          dark: "#5CE6B8",
        },
        rating: {
          again: "#EF4444",
          hard: "#F97316",
          good: "#10B981",
          easy: "#3B82F6",
        },
      },
      borderRadius: {
        xl: "20px",
        "2xl": "24px",
        "3xl": "28px",
      },
    },
  },
  plugins: [],
};
