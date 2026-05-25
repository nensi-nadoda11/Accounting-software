import { AmountText } from "./AmountText";
import { ReportTable } from "./ReportTable";

const AGING_BUCKETS = [
  { bucketId: "range_0_30", rangeLabel: "0-30", minDays: 0, maxDays: 30, valueKey: "bucket0To30" },
  { bucketId: "range_31_60", rangeLabel: "31-60", minDays: 31, maxDays: 60, valueKey: "bucket31To60" },
  { bucketId: "range_61_90", rangeLabel: "61-90", minDays: 61, maxDays: 90, valueKey: "bucket61To90" },
  { bucketId: "range_90_plus", rangeLabel: "90+", minDays: 91, maxDays: null, valueKey: "bucketAbove90" },
] as const;

export const AgingBucketTable = <TItem extends {
  bucket0To30: string;
  bucket31To60: string;
  bucket61To90: string;
  bucketAbove90: string;
  totalOutstanding: string;
}>({
  items,
  nameKey,
  codeKey,
}: {
  items: TItem[];
  nameKey: keyof TItem;
  codeKey: keyof TItem;
}) => (
  <ReportTable
    items={items}
    columns={[
      { key: String(codeKey), label: "Code", render: (item) => String(item[codeKey] ?? "-") },
      { key: String(nameKey), label: "Name", render: (item) => String(item[nameKey] ?? "-") },
      ...AGING_BUCKETS.map((bucket) => ({
        key: bucket.bucketId,
        label: bucket.rangeLabel,
        render: (item: TItem) => <AmountText value={item[bucket.valueKey]} />,
      })),
      { key: "totalOutstanding", label: "Total", render: (item) => <AmountText value={item.totalOutstanding} /> },
    ]}
  />
);
