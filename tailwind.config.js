/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./*.{js,ts,jsx,tsx}",
        "./components/**/*.{js,ts,jsx,tsx}",
        "./contexts/**/*.{js,ts,jsx,tsx}",
        "./services/**/*.{js,ts,jsx,tsx}",
    ],
    darkMode: 'class',
    theme: {
        extend: {
            fontFamily: {
                sans: ['Inter', 'sans-serif'],
            },
            colors: {
                // Primary Sky Blue Palette (50-900)
                primary: {
                    50: '#f0f9ff',
                    100: '#e0f2fe',
                    200: '#bae6fd',
                    300: '#7dd3fc',
                    400: '#38bdf8',
                    500: '#0ea5e9',  // Cor principal
                    600: '#0284c7',
                    700: '#0369a1',
                    800: '#075985',
                    900: '#0c4a6e',
                },
                // Slate (SAP Quartz Dark inspired warm palette)
                slate: {
                    50:  '#f8f9fa',
                    100: '#eceef1',
                    200: '#d1d8de',
                    300: '#a9b4be',
                    400: '#8696a7',
                    500: '#6a7d8e',
                    600: '#475e75',
                    700: '#354a5f',
                    800: '#29313a',
                    900: '#1d2228',
                    950: '#12171c',
                },
                // Semantic colors (backward compatibility)
                fiori: {
                    // Primary Actions
                    blue: '#0ea5e9',        // Primary Action (Light Mode)
                    blueDark: '#6cb4ee',    // Primary Action (Dark Mode) - softer, SAP-like
                    darkBlue: '#0c4a6e',    // Deep state
                    link: '#0ea5e9',        // Light mode links
                    linkDark: '#91c8f6',    // Dark mode links - warm muted blue

                    // Light Theme Backgrounds (Glassmorphism)
                    bgLight: '#f0f9ff',     // Primary-50 based
                    cardLight: '#ffffff',

                    // Dark Theme Backgrounds (SAP Quartz Dark)
                    bgDark: '#1d2228',      // Shell background
                    cardDark: '#29313a',    // Card/surface

                    // Semantic Text
                    textPrimary: '#0c4a6e',   // Primary-900 for light mode
                    textSecondary: '#075985', // Primary-800 for light mode
                    textPrimaryDark: '#f5f6f7',  // SAP Quartz Dark text
                    textSecondaryDark: '#a9b4be', // Warm muted secondary
                }
            }
        }
    },
    plugins: [],
}
