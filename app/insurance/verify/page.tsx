import PolicyVerification from "@/app/insurance/components/PolicyVerification";

export const metadata = {
  title: "Verify Insurance Policy | My Vehicle",
  description:
    "Verify a My Vehicle insurance policy using the policy number and QR verification code.",
};

export default function VerifyPolicyPage() {
  return <PolicyVerification />;
}