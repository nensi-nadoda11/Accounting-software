import { Input } from "../../../components/ui/Input";
import { Select } from "../../../components/ui/Select";
import type { NotificationListQuery, NotificationType } from "../../../types/notification";
import {
  notificationChannelOptions,
  notificationPriorityOptions,
} from "../notificationMeta";

export const NotificationFilters = ({
  filters,
  typeOptions,
  onChange,
  hideReadFilter = false,
}: {
  filters: NotificationListQuery;
  typeOptions: Array<{ value: NotificationType; label: string }>;
  onChange: (patch: Partial<NotificationListQuery>) => void;
  hideReadFilter?: boolean;
}) => (
  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
    <Select
      value={filters.type ?? ""}
      onChange={(event) => onChange({ type: event.target.value as NotificationType | "", page: 1 })}
      label="Type"
    >
      <option value="">All</option>
      {typeOptions.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </Select>
    <Select
      value={filters.priority ?? ""}
      onChange={(event) => onChange({ priority: event.target.value as NotificationListQuery["priority"], page: 1 })}
      label="Priority"
    >
      <option value="">All</option>
      {notificationPriorityOptions.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </Select>
    <Select
      value={filters.channel ?? ""}
      onChange={(event) => onChange({ channel: event.target.value as NotificationListQuery["channel"], page: 1 })}
      label="Channel"
    >
      <option value="">All</option>
      {notificationChannelOptions.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </Select>
    {!hideReadFilter ? (
      <Select
        value={filters.unread === undefined ? "" : filters.unread ? "unread" : "read"}
        onChange={(event) =>
          onChange({
            unread: event.target.value === "" ? undefined : event.target.value === "unread",
            page: 1,
          })
        }
        label="Read Status"
      >
        <option value="">All</option>
        <option value="unread">Unread</option>
        <option value="read">Read</option>
      </Select>
    ) : null}
    <Input
      type="date"
      label="From"
      value={filters.dateFrom ?? ""}
      onChange={(event) => onChange({ dateFrom: event.target.value, page: 1 })}
    />
    <Input
      type="date"
      label="To"
      value={filters.dateTo ?? ""}
      onChange={(event) => onChange({ dateTo: event.target.value, page: 1 })}
    />
  </div>
);
