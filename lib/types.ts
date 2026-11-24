export type Business = {
  name: string; about?: string; phone?: string; email?: string; website?: string; city?: string;
  public?: boolean; // shown on the public page only when true
};
export type Person = {
  id: string;
  name: { en: string; gu?: string };
  gender: "male" | "female";
  birth?: string; // YYYY | YYYY-MM | YYYY-MM-DD
  death?: string;
  parentId?: string; // one blood parent; the other parent is that person's spouse
  spouseId?: string;
  photo?: string; // URL, placeholder shown when missing
  city?: string;
  phone?: string;
  phonePublic?: boolean; // phone shown on the public page only when true
  businesses?: Business[];
};
export type FamilyData = { people: Person[] };
export type Relation = "child" | "spouse" | "parent" | "sibling";
export type PersonInput = {
  city?: string;
  phone?: string;
  phonePublic?: boolean;
  businesses?: Business[];
  nameEn: string;
  nameGu?: string;
  gender: "male" | "female";
  birth?: string;
  death?: string;
};
