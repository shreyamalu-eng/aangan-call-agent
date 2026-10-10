import { SkelPage, SkelCard } from "@/components/Skeleton";

export default function Loading() {
  return (
    <SkelPage title="Call">
      <section className="grid two"><SkelCard lines={5} /><SkelCard lines={6} /></section>
      <SkelCard lines={8} />
    </SkelPage>
  );
}
