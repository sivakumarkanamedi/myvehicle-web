import { redirect } from "next/navigation";

export const metadata = {
  title: "My Vehicle Insurance",
  description: "Insurance command center powered by Mira AI.",
};

export default function InsuranceHomePage() {
  redirect("/insurance/dashboard");
}