const features = [
  {
    icon: "📄",
    title: "Smart Documents",
    description: "Keep RC, insurance, PUC and other vehicle documents together.",
  },
  {
    icon: "🤖",
    title: "Mira AI",
    description: "Ask questions, scan documents and receive intelligent reminders.",
  },
  {
    icon: "🔧",
    title: "Service History",
    description: "Track servicing, repairs, bills and upcoming maintenance.",
  },
  {
    icon: "⛽",
    title: "Fuel & Expenses",
    description: "Understand fuel usage and the total cost of vehicle ownership.",
  },
  {
    icon: "🚨",
    title: "Emergency SOS",
    description: "Quickly share your location and find nearby roadside support.",
  },
  {
    icon: "🚗",
    title: "My Garage",
    description: "Manage your cars, bikes and other vehicles from one dashboard.",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-white text-slate-950">
      {/* Navbar */}
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/90 backdrop-blur">
        <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <a href="#" className="text-2xl font-bold text-blue-600">
            🚗 My Vehicle
          </a>

          <div className="hidden items-center gap-8 text-sm font-medium md:flex">
            <a href="#features" className="hover:text-blue-600">
              Features
            </a>
            <a href="#mira" className="hover:text-blue-600">
              Mira AI
            </a>
            <a href="#about" className="hover:text-blue-600">
              About
            </a>
            <a href="#contact" className="hover:text-blue-600">
              Contact
            </a>
          </div>

          <button className="rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700">
            Download App
          </button>
        </nav>
      </header>

      {/* Hero */}
      <section className="bg-gradient-to-b from-blue-50 via-white to-white">
        <div className="mx-auto grid min-h-[85vh] max-w-7xl items-center gap-12 px-6 py-20 lg:grid-cols-2">
          <div>
            <div className="inline-flex rounded-full bg-blue-100 px-4 py-2 text-sm font-semibold text-blue-700">
              Powered by Mira AI
            </div>

            <h1 className="mt-7 text-5xl font-extrabold leading-tight tracking-tight md:text-7xl">
              Your vehicle.
              <span className="block text-blue-600">One smart platform.</span>
            </h1>

            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
              Manage documents, services, fuel expenses, reminders and
              roadside assistance for every vehicle you own.
            </p>

            <div className="mt-9 flex flex-wrap gap-4">
              <button className="rounded-xl bg-blue-600 px-7 py-4 font-semibold text-white shadow-lg shadow-blue-200 hover:bg-blue-700">
                Get Started
              </button>

              <a
                href="#features"
                className="rounded-xl border border-slate-300 bg-white px-7 py-4 font-semibold hover:bg-slate-50"
              >
                Explore Features
              </a>
            </div>

            <div className="mt-10 flex flex-wrap gap-6 text-sm text-slate-600">
              <span>✓ All vehicles</span>
              <span>✓ Smart reminders</span>
              <span>✓ Emergency support</span>
            </div>
          </div>

          {/* Dashboard Preview */}
          <div className="rounded-[32px] border border-blue-100 bg-white p-5 shadow-2xl shadow-blue-100">
            <div className="rounded-[24px] bg-slate-950 p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">Good morning</p>
                  <h2 className="mt-1 text-2xl font-bold">My Garage</h2>
                </div>
                <div className="rounded-full bg-blue-600 px-4 py-2 text-sm">
                  Mira AI
                </div>
              </div>

              <div className="mt-8 rounded-2xl bg-white p-5 text-slate-950">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-500">Primary Vehicle</p>
                    <h3 className="mt-1 text-xl font-bold">Honda City</h3>
                  </div>
                  <span className="text-4xl">🚘</span>
                </div>

                <div className="mt-6">
                  <div className="flex justify-between text-sm">
                    <span>Vehicle health</span>
                    <span className="font-bold text-emerald-600">92%</span>
                  </div>

                  <div className="mt-2 h-2 rounded-full bg-slate-200">
                    <div className="h-2 w-[92%] rounded-full bg-emerald-500" />
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-blue-50 p-4">
                    <p className="text-xs text-slate-500">Insurance</p>
                    <p className="mt-1 font-semibold">Valid</p>
                  </div>

                  <div className="rounded-xl bg-amber-50 p-4">
                    <p className="text-xs text-slate-500">Next service</p>
                    <p className="mt-1 font-semibold">540 km</p>
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-2xl bg-blue-600 p-5">
                <p className="text-sm text-blue-100">Mira says</p>
                <p className="mt-2 font-medium">
                  Your insurance is safe. Service is due in approximately
                  three weeks.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-7xl px-6 py-24">
        <div className="mx-auto max-w-3xl text-center">
          <p className="font-semibold text-blue-600">Everything in one place</p>
          <h2 className="mt-3 text-4xl font-bold tracking-tight md:text-5xl">
            Smarter vehicle ownership
          </h2>
          <p className="mt-5 text-lg text-slate-600">
            Simple tools that help you manage, protect and understand your
            vehicles.
          </p>
        </div>

        <div className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <article
              key={feature.title}
              className="rounded-3xl border border-slate-200 p-7 transition hover:-translate-y-1 hover:shadow-xl"
            >
              <div className="text-4xl">{feature.icon}</div>
              <h3 className="mt-5 text-xl font-bold">{feature.title}</h3>
              <p className="mt-3 leading-7 text-slate-600">
                {feature.description}
              </p>
            </article>
          ))}
        </div>
      </section>

      {/* Mira */}
      <section id="mira" className="bg-slate-950 py-24 text-white">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-6 lg:grid-cols-2">
          <div>
            <p className="font-semibold text-blue-400">Meet Mira</p>
            <h2 className="mt-3 text-4xl font-bold md:text-5xl">
              Your proactive AI vehicle manager
            </h2>
            <p className="mt-6 text-lg leading-8 text-slate-300">
              Mira helps you scan documents, remember renewals, understand
              expenses and receive guidance when your vehicle needs attention.
            </p>

            <button className="mt-8 rounded-xl bg-blue-600 px-7 py-4 font-semibold hover:bg-blue-700">
              Ask Mira
            </button>
          </div>

          <div className="rounded-3xl border border-slate-700 bg-slate-900 p-6">
            <div className="rounded-2xl bg-slate-800 p-5">
              <p className="text-sm text-slate-400">You</p>
              <p className="mt-2">Mira, what requires my attention?</p>
            </div>

            <div className="mt-4 rounded-2xl bg-blue-600 p-5">
              <p className="text-sm text-blue-100">Mira</p>
              <p className="mt-2 leading-7">
                Your bike insurance expires in 12 days. Your car service is
                due in 540 km. I can create reminders for both.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* About */}
      <section id="about" className="mx-auto max-w-7xl px-6 py-24 text-center">
        <h2 className="text-4xl font-bold">Built for every vehicle owner</h2>
        <p className="mx-auto mt-5 max-w-3xl text-lg leading-8 text-slate-600">
          Whether you own a bike, car or multiple family vehicles, My Vehicle
          gives you one secure and intelligent place to manage them.
        </p>
      </section>

      {/* CTA */}
      <section id="contact" className="px-6 pb-24">
        <div className="mx-auto max-w-6xl rounded-[32px] bg-blue-600 px-8 py-16 text-center text-white">
          <h2 className="text-4xl font-bold">Ready for smarter ownership?</h2>
          <p className="mt-4 text-lg text-blue-100">
            Join My Vehicle and keep everything about your vehicle in one
            intelligent platform.
          </p>
          <button className="mt-8 rounded-xl bg-white px-7 py-4 font-semibold text-blue-600 hover:bg-blue-50">
            Download App
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-8 text-sm text-slate-500 md:flex-row md:items-center md:justify-between">
          <p className="font-semibold text-slate-900">🚗 My Vehicle</p>
          <p>© 2026 My Vehicle Technologies. All rights reserved.</p>
        </div>
      </footer>
    </main>
  );
}