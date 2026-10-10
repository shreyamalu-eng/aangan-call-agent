import { SkelPage, SkelCard, SkelTable } from "@/components/Skeleton";

export default function Loading() {
  return (
    <SkelPage title="Pipeline">
      <section className="grid split"><SkelCard chart /><SkelCard lines={5} /></section>
      <SkelTable rows={4} />
    </SkelPage>
  );
}
