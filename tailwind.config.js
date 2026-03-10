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
                // Slate remapped to a more neutral gray scale for dark mode
                slate: {
                    50: '#fafafa',
                    100: '#f4f4f5',
                    200: '#e4e4e7',
                    300: '#d4d4d8',
                    400: '#a1a1aa',
                    500: '#71717a',
                    600: '#52525b',
                    700: '#3f3f46',
                    800: '#27272a',
                    900: '#18181b',
                    950: '#09090b',
                },
                // Semantic colors (backward compatibility)
                fiori: {
                    // Primary Actions
                    blue: '#0ea5e9',        // Primary Action (Light Mode)
                    blueDark: '#38bdf8',    // Primary Action (Dark Mode)
                    darkBlue: '#0c4a6e',    // Deep state
                    link: '#0ea5e9',        // Light mode links
                    linkDark: '#7dd3fc',    // Dark mode links

                    // Light Theme Backgrounds (Glassmorphism)
                    bgLight: '#f0f9ff',     // Primary-50 based
                    cardLight: '#ffffff',

                    // Dark Theme Backgrounds (Granite)
                    bgDark: '#0d0e10',      // Shell background
                    cardDark: '#17181b',    // Card/surface

                    // Semantic Text
                    textPrimary: '#0f172a',
                    textSecondary: '#334155',
                    textPrimaryDark: '#e2e8f0',
                    textSecondaryDark: '#a1a1aa',
                }
            }
        }
    },
    plugins: [],
}
