// White-label config: change this file (and data/family.json) to brand the app for another family.
export const site = {
  familyName: { en: "Adatiya Parivar", gu: "આડતીયા પરિવાર" },
  accent: "#B5472B",
  defaultLang: "en" as "en" | "gu",
  languages: ["en", "gu"] as ("en" | "gu")[],
  // Path to the data file (override with FAMILY_DATA_FILE env var).
  dataFile: process.env.FAMILY_DATA_FILE || "data/family.json",
};
export type Lang = "en" | "gu";
