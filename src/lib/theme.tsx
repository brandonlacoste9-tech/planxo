"use client";
import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

export type ThemeName = "default" | "cognac" | "ocean" | "forest" | "midnight" | "sunset" | "lavender";

interface ThemeColors {
  bg: string;
  bgSecondary: string;
  text: string;
  textMuted: string;
  accent: string;
  accentHover: string;
  accentText: string;
  border: string;
  cardBg: string;
  navBg: string;
  ctaBg: string;
  ctaText: string;
  name: string;
}

export const themes: Record<ThemeName, ThemeColors> = {
  default: {
    name: "Classique",
    bg: "#ffffff", bgSecondary: "#f9fafb",
    text: "#242424", textMuted: "#898989",
    accent: "#242424", accentHover: "#1a1a1a", accentText: "#ffffff",
    border: "rgba(0,0,0,0.08)", cardBg: "#ffffff",
    navBg: "rgba(255,255,255,0.92)", ctaBg: "#242424", ctaText: "#ffffff",
  },
  cognac: {
    name: "Cognac",
    bg: "#1a1008", bgSecondary: "#241810",
    text: "#e8d5c4", textMuted: "#a0896e",
    accent: "#c47f3a", accentHover: "#d4944e", accentText: "#ffffff",
    border: "rgba(196,127,58,0.15)", cardBg: "#241810",
    navBg: "rgba(26,16,8,0.95)", ctaBg: "#c47f3a", ctaText: "#1a1008",
  },
  ocean: {
    name: "Océan",
    bg: "#0a1628", bgSecondary: "#0f1f3a",
    text: "#c8ddf0", textMuted: "#6088a8",
    accent: "#2d8cf0", accentHover: "#4da3ff", accentText: "#ffffff",
    border: "rgba(45,140,240,0.12)", cardBg: "#0f1f3a",
    navBg: "rgba(10,22,40,0.95)", ctaBg: "#2d8cf0", ctaText: "#ffffff",
  },
  forest: {
    name: "Forêt",
    bg: "#0a1a0f", bgSecondary: "#102418",
    text: "#c8e6c9", textMuted: "#5a8a5c",
    accent: "#2e7d32", accentHover: "#388e3c", accentText: "#ffffff",
    border: "rgba(46,125,50,0.15)", cardBg: "#102418",
    navBg: "rgba(10,26,15,0.95)", ctaBg: "#2e7d32", ctaText: "#ffffff",
  },
  midnight: {
    name: "Minuit",
    bg: "#0a0a14", bgSecondary: "#121224",
    text: "#c8c8e0", textMuted: "#6868a0",
    accent: "#6c5ce7", accentHover: "#7d6ff0", accentText: "#ffffff",
    border: "rgba(108,92,231,0.15)", cardBg: "#121224",
    navBg: "rgba(10,10,20,0.95)", ctaBg: "#6c5ce7", ctaText: "#ffffff",
  },
  sunset: {
    name: "Crépuscule",
    bg: "#1a0a0a", bgSecondary: "#241212",
    text: "#f0c8c8", textMuted: "#a86868",
    accent: "#e74c3c", accentHover: "#f06050", accentText: "#ffffff",
    border: "rgba(231,76,60,0.15)", cardBg: "#241212",
    navBg: "rgba(26,10,10,0.95)", ctaBg: "#e74c3c", ctaText: "#ffffff",
  },
  lavender: {
    name: "Lavande",
    bg: "#120a1a", bgSecondary: "#1a1024",
    text: "#e0c8f0", textMuted: "#9068a8",
    accent: "#8b5cf6", accentHover: "#9d74f8", accentText: "#ffffff",
    border: "rgba(139,92,246,0.15)", cardBg: "#1a1024",
    navBg: "rgba(18,10,26,0.95)", ctaBg: "#8b5cf6", ctaText: "#ffffff",
  },
};

interface ThemeContextType {
  theme: ThemeName;
  colors: ThemeColors;
  setTheme: (t: ThemeName) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "default",
  colors: themes.default,
  setTheme: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeName>("cognac");

  useEffect(() => {
    const saved = localStorage.getItem("planxo-theme") as ThemeName;
    if (saved && themes[saved]) setThemeState(saved);
  }, []);

  const setTheme = (t: ThemeName) => {
    setThemeState(t);
    localStorage.setItem("planxo-theme", t);
  };

  return (
    <ThemeContext.Provider value={{ theme, colors: themes[theme], setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
