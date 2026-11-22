export type Person = {
  id: string;
  name: { en: string; gu?: string };
  gender: "male" | "female";
  birth?: string; // YYYY | YYYY-MM | YYYY-MM-DD
  death?: string;
  parentId?: string; // one blood parent; the other parent is that person's spouse
  spouseId?: string;
  photo?: string; // URL, placeholder shown when missing
};
export type FamilyData = { people: Person[] };
export type Relation = "child" | "spouse" | "parent" | "sibling";
export type PersonInput = {
  nameEn: string;
  nameGu?: string;
  gender: "male" | "female";
  birth?: string;
  death?: string;
};
