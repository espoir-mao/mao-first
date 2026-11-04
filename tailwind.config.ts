import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        lime: {
          accent: "#9AE22F",
        },
        moss: {
          DEFAULT: "#7a9a5a",
          dark: "#5f7a45",
          light: "#a8c284",
        },
        sage: {
          50: "#f8fbf2",
          100: "#f4f8ee",
          200: "#eef5e2",
          300: "#e8f2dc",
        },
        /**
         * Brighter "spring green" panel/accent token, distinct from the
         * `moss` button color and the older, much paler `sage` wash. Used
         * for the wizard illustration panel and light selected-state tints.
         */
        spring: {
          50: "#f2f9ea",
          100: "#e6f3d4",
          200: "#d8ecc2",
          300: "#c9e6ab",
          400: "#b7db8f",
        },
        ink: "#0d0f0c",
      },
      borderRadius: {
        "3xl": "1.75rem",
      },
    },
  },
  plugins: [],
};

export default config;
