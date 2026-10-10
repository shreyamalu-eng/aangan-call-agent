import { SkelPage, SkelKpi, SkelCard } from "@/components/Skeleton";

export default function Loading() {
  return (
    <SkelPage title="Overview">
      <section className="grid ov-top">
        <div className="kpis"><SkelKpi /><SkelKpi /><SkelKpi /><SkelKpi /></div>
        <SkelCard chart />
      </section>
      <section className="grid ov-mid"><SkelCard chart /><SkelCard lines={5} /></section>
    </SkelPage>
  );
}
