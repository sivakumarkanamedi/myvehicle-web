import Link from "next/link";

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-white sm:px-6">
      <div className="mx-auto max-w-4xl">
        <Link href="/signup" className="text-sm font-bold text-blue-400 hover:text-blue-300">
          ← Back to Sign Up
        </Link>

        <section className="mt-5 rounded-3xl border border-white/10 bg-slate-900/70 p-6 sm:p-8">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-400">
            My Vehicle
          </p>
          <h1 className="mt-2 text-3xl font-black">Privacy Notice</h1>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            This MVP notice describes the categories of data used by My Vehicle. It should be
            reviewed and finalized for applicable privacy law before a commercial public launch.
          </p>

          <div className="mt-8 space-y-7 text-sm leading-7 text-slate-300">
            <section>
              <h2 className="text-lg font-black text-white">1. Information you provide</h2>
              <p className="mt-2">
                This can include account details, vehicle information, uploaded vehicle
                documents, service records, emergency contacts and information you submit to Mira.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-black text-white">2. Location information</h2>
              <p className="mt-2">
                Location may be requested for navigation, nearby assistance and SOS features.
                Permission is controlled through your device or browser where applicable.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-black text-white">3. How information is used</h2>
              <p className="mt-2">
                Information is used to provide requested app functions, secure accounts,
                personalize vehicle experiences, operate reminders and support connected services.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-black text-white">4. Sharing</h2>
              <p className="mt-2">
                Data should be shared with service providers or partners only when required to
                provide a feature you use, when you request sharing, or when legally required.
                Production integrations should disclose their specific data handling.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-black text-white">5. Security and retention</h2>
              <p className="mt-2">
                My Vehicle uses account controls and backend security rules, but no system can
                guarantee absolute security. Production retention and deletion periods should be
                formally documented before launch.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-black text-white">6. Your choices</h2>
              <p className="mt-2">
                You can control browser permissions such as location and should be provided with
                appropriate account, access, correction and deletion controls as the product moves
                to production.
              </p>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}
