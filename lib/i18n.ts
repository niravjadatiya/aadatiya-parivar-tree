import type { Lang } from "@/config/site";
const en = {
  members: "members", generations: "generations", expandAll: "Expand all", collapseAll: "Collapse all", expand: "Expand", collapse: "Collapse", fit: "Fit",
  born: "Born", died: "Died", spouse: "Spouse", parents: "Parents", children: "Children", none: "None",
  addChild: "Add child", addSpouse: "Add spouse", addParent: "Add parent", addSibling: "Add sibling",
  addParentsOf: "Add parents of", edit: "Edit", delete: "Delete", confirmDelete: "Delete this person?",
  save: "Save", cancel: "Cancel", nameEn: "Name (English)", nameGu: "Name (Gujarati)", optional: "optional",
  gender: "Gender", male: "Male", female: "Female", birth: "Birth date", death: "Date of death",
  dateHint: "YYYY, YYYY-MM or YYYY-MM-DD", adminMode: "ADMIN · EDIT MODE", signOut: "Sign out",
  addTitle: "Add", editTitle: "Edit person", relationTo: "to", close: "Close", generation: "Generation",
  phone: "Phone", businesses: "Business", addBusiness: "Add business", businessName: "Business name", about: "What they do", email: "Email", website: "Website", city: "City",
  showPublic: "Show on public page", privateTag: "Private", remove: "Remove", call: "Call",
  search: "Search a name", noResults: "No match", signIn: "Sign in", username: "Username", password: "Password", adminSignIn: "Admin sign in", wrong: "Wrong username or password",
};
const gu: typeof en = {
  members: "સભ્યો", generations: "પેઢીઓ", expandAll: "બધા ખોલો", collapseAll: "બધા બંધ કરો", expand: "ખોલો", collapse: "બંધ કરો", fit: "ફિટ",
  born: "જન્મ", died: "અવસાન", spouse: "જીવનસાથી", parents: "માતા-પિતા", children: "સંતાન", none: "કોઈ નહીં",
  addChild: "સંતાન ઉમેરો", addSpouse: "જીવનસાથી ઉમેરો", addParent: "માતા-પિતા ઉમેરો", addSibling: "ભાઈ-બહેન ઉમેરો",
  addParentsOf: "માતા-પિતા ઉમેરો:", edit: "ફેરફાર", delete: "કાઢી નાખો", confirmDelete: "આ વ્યક્તિને કાઢી નાખવી?",
  save: "સાચવો", cancel: "રદ કરો", nameEn: "નામ (અંગ્રેજી)", nameGu: "નામ (ગુજરાતી)", optional: "વૈકલ્પિક",
  gender: "જાતિ", male: "પુરુષ", female: "સ્ત્રી", birth: "જન્મ તારીખ", death: "અવસાન તારીખ",
  dateHint: "YYYY, YYYY-MM અથવા YYYY-MM-DD", adminMode: "એડમિન · ફેરફાર મોડ", signOut: "બહાર નીકળો",
  addTitle: "ઉમેરો", editTitle: "વ્યક્તિ બદલો", relationTo: "માટે", close: "બંધ કરો", generation: "પેઢી",
  phone: "ફોન", businesses: "વ્યવસાય", addBusiness: "વ્યવસાય ઉમેરો", businessName: "વ્યવસાયનું નામ", about: "શું કરે છે", email: "ઈમેઇલ", website: "વેબસાઇટ", city: "શહેર",
  showPublic: "જાહેર પેજ પર બતાવો", privateTag: "ખાનગી", remove: "કાઢો", call: "કૉલ",
  search: "નામ શોધો", noResults: "કોઈ મળ્યું નહીં", signIn: "સાઇન ઇન", username: "યુઝરનેમ", password: "પાસવર્ડ", adminSignIn: "એડમિન સાઇન ઇન", wrong: "ખોટું યુઝરનેમ અથવા પાસવર્ડ",
};
export const dict = { en, gu };
export type T = typeof en;
export const getT = (l: Lang): T => dict[l];
