import { site } from "@/config/site";
import { readData } from "@/lib/store";
import { isAdmin } from "@/lib/auth";
import type { Person } from "@/lib/types";
import FamilyApp from "@/components/FamilyApp";

export const dynamic = "force-dynamic";

// Private contact details never leave the server for public visitors.
function forPublic(p: Person): Person {
  const { phone, phonePublic, businesses, ...rest } = p;
  const pub = (businesses ?? []).filter((b) => b.public).map(({ public: _pub, ...b }) => b);
  return { ...rest, ...(phone && phonePublic ? { phone } : {}), ...(pub.length ? { businesses: pub } : {}) };
}

export default async function Home() {
  const [data, admin] = await Promise.all([readData(), isAdmin()]);
  return <FamilyApp people={admin ? data.people : data.people.map(forPublic)} isAdmin={admin} familyName={site.familyName} defaultLang={site.defaultLang} languages={site.languages} contact={site.contact} credit={site.credit} />;
}
