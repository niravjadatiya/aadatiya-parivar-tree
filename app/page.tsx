import { site } from "@/config/site";
import { readData } from "@/lib/store";
import { isAdmin } from "@/lib/auth";
import FamilyApp from "@/components/FamilyApp";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [data, admin] = await Promise.all([readData(), isAdmin()]);
  return <FamilyApp people={data.people} isAdmin={admin} familyName={site.familyName} defaultLang={site.defaultLang} languages={site.languages} contact={site.contact} credit={site.credit} />;
}
