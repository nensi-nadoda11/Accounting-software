import { AmountText } from "./AmountText";
import { ReportTable } from "./ReportTable";

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
      { key: "bucket0To30", label: "0-30", render: (item) => <AmountText value={item.bucket0To30} /> },
      { key: "bucket31To60", label: "31-60", render: (item) => <AmountText value={item.bucket31To60} /> },
      { key: "bucket61To90", label: "61-90", render: (item) => <AmountText value={item.bucket61To90} /> },
      { key: "bucketAbove90", label: "90+", render: (item) => <AmountText value={item.bucketAbove90} /> },
      { key: "totalOutstanding", label: "Total", render: (item) => <AmountText value={item.totalOutstanding} /> },
    ]}
  />
);
