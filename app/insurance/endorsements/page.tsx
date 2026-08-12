import Link from "next/link";

export const metadata = {
  title: "Policy Endorsements | My Vehicle",
  description: "Manage all insurance policy endorsements.",
};

const endorsements = [
  {
    title: "Add / Remove Driver",
    description: "Update driver information linked to the policy.",
    href: "/insurance/endorsements/driver",
  },
  {
    title: "Vehicle Modification",
    description: "Declare accessories or vehicle modifications.",
    href: "/insurance/endorsements/modification",
  },
  {
    title: "Address Change",
    description: "Update customer communication address.",
    href: "/insurance/endorsements/address",
  },
  {
    title: "Nominee Change",
    description: "Change or update nominee information.",
    href: "/insurance/endorsements/nominee",
  },
  {
    title: "Coverage Change",
    description: "Add or remove optional covers and add-ons.",
    href: "/insurance/endorsements/coverage",
  },
  {
    title: "Endorsement History",
    description: "View complete endorsement history.",
    href: "/insurance/endorsements/history",
  },
];

export default function EndorsementsPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-white p-8">
      <div className="max-w-7xl mx-auto">

        <h1 className="text-4xl font-bold">
          Policy Endorsements
        </h1>

        <p className="mt-3 text-slate-400">
          Manage every endorsement request from one dashboard.
        </p>

        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6 mt-8">
          {endorsements.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-xl border border-slate-700 bg-slate-900 p-6 hover:border-cyan-500 transition"
            >
              <h2 className="text-xl font-semibold">
                {item.title}
              </h2>

              <p className="mt-3 text-slate-400">
                {item.description}
              </p>
            </Link>
          ))}
        </div>

      </div>
    </main>
  );
}