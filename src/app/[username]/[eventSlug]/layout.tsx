export async function generateMetadata({ params }: { params: Promise<{ username: string; eventSlug: string }> }) {
  const { username } = await params;
  return {
    title: `Réserver avec ${username} — Planxo`,
    description: `Prenez rendez-vous avec ${username} via Planxo.`,
    openGraph: {
      title: `Réserver avec ${username} — Planxo`,
      description: `Prenez rendez-vous avec ${username} via Planxo.`,
      type: "website",
    },
  };
}

export default function EventSlugLayout({ children }: { children: React.ReactNode }) {
  return children;
}
