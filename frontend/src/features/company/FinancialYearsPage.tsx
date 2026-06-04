import { useEffect, useState } from "react";
import { CircleCheckBig, Lock, Pencil, Plus } from "lucide-react";
import type { z } from "zod";

import { getErrorMessage } from "../../lib/errors";
import { financialYearApi } from "../../services/financialYearApi";
import { useToast } from "../../providers/useToast";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { EmptyState } from "../../components/ui/EmptyState";
import { LoadingState } from "../../components/ui/LoadingState";
import { PageHeader } from "../../components/ui/PageHeader";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { Table, TableWrapper } from "../../components/ui/Table";
import { TableActionIcons } from "../../components/ui/TableActionIcons";
import type { CompanyFinancialYear } from "../../types/company";
import { FinancialYearModal } from "./components/FinancialYearModal";
import { financialYearSchema } from "./companySchemas";
import { formatDateCell } from "./companyUtils";

type FinancialYearValues = z.infer<typeof financialYearSchema>;

export const FinancialYearsPage = () => {
  const toast = useToast();
  const [items, setItems] = useState<CompanyFinancialYear[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<CompanyFinancialYear | null>(null);
  const [saving, setSaving] = useState(false);
  const [lockTarget, setLockTarget] = useState<CompanyFinancialYear | null>(null);
  const [locking, setLocking] = useState(false);
  const [activatingId, setActivatingId] = useState<string | null>(null);

  const loadFinancialYears = async () => {
    try {
      setLoading(true);
      const response = await financialYearApi.list();
      setItems(response.data.items);
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to load financial years"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadFinancialYears();
  }, []);

  if (loading) {
    return <LoadingState label="Loading financial years..." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Financial Year"
        actions={
          <Button
            onClick={() => {
              setSelectedItem(null);
              setModalOpen(true);
            }}
          >
            <Plus className="mr-2 size-4" />
            Add Financial Year
          </Button>
        }
      />

      {!items.length ? (
        <EmptyState
          title="No financial years found"
          action={
            <Button
              onClick={() => {
                setSelectedItem(null);
                setModalOpen(true);
              }}
            >
              <Plus className="mr-2 size-4" />
              Add Financial Year
            </Button>
          }
        />
      ) : (
        <Card>
          <TableWrapper className="border-none">
            <Table>
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  {["FY Name", "Start Date", "End Date", "Active", "Locked", "Actions"].map((head) => (
                    <th key={head} className="px-5 py-3 font-semibold">
                      {head}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white text-sm text-slate-700">
                {items.map((item) => (
                  <tr key={item.id} className={item.isActive ? "bg-emerald-50/40" : undefined}>
                    <td className="px-5 py-4 font-medium text-slate-900">{item.name}</td>
                    <td className="px-5 py-4">{formatDateCell(item.startDate)}</td>
                    <td className="px-5 py-4">{formatDateCell(item.endDate)}</td>
                    <td className="px-5 py-4">
                      <StatusBadge status={item.isActive ? "active" : "inactive"} label={item.isActive ? "Active" : "Inactive"} />
                    </td>
                    <td className="px-5 py-4">
                      <StatusBadge status={item.isLocked ? "locked" : "inactive"} label={item.isLocked ? "Locked" : "Open"} />
                    </td>
                    <td className="px-5 py-4">
                      <TableActionIcons
                        actions={[
                          {
                            label: "Edit financial year",
                            icon: <Pencil className="size-4" />,
                            disabled: item.isLocked,
                            onClick: () => {
                              setSelectedItem(item);
                              setModalOpen(true);
                            },
                          },
                          {
                            label: item.isActive ? "Active financial year" : "Activate financial year",
                            icon: <CircleCheckBig className="size-4" />,
                            disabled: item.isActive || item.isLocked || activatingId === item.id,
                            onClick: async () => {
                              try {
                                setActivatingId(item.id);
                                await financialYearApi.activate(item.id);
                                toast.success("Financial year activated");
                                await loadFinancialYears();
                              } catch (error) {
                                toast.error(getErrorMessage(error, "Failed to activate financial year"));
                              } finally {
                                setActivatingId(null);
                              }
                            },
                          },
                          {
                            label: item.isLocked ? "Financial year locked" : "Lock financial year",
                            icon: <Lock className="size-4" />,
                            disabled: item.isLocked,
                            onClick: () => setLockTarget(item),
                          },
                        ]}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableWrapper>
        </Card>
      )}

      <FinancialYearModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setSelectedItem(null);
        }}
        initialValue={selectedItem}
        submitting={saving}
        onSubmit={async (values: FinancialYearValues) => {
          try {
            setSaving(true);
            if (selectedItem) {
              await financialYearApi.update(selectedItem.id, {
                name: values.name.trim(),
                startDate: values.startDate,
                endDate: values.endDate,
              });
              toast.success("Financial year updated");
            } else {
              await financialYearApi.create({
                name: values.name.trim(),
                startDate: values.startDate,
                endDate: values.endDate,
                isActive: values.isActive,
              });
              toast.success("Financial year created");
            }
            setModalOpen(false);
            setSelectedItem(null);
            await loadFinancialYears();
          } catch (error) {
            toast.error(getErrorMessage(error, "Failed to save financial year"));
          } finally {
            setSaving(false);
          }
        }}
      />

      <ConfirmDialog
        open={Boolean(lockTarget)}
        onClose={() => setLockTarget(null)}
        loading={locking}
        title="Lock Financial Year"
        description={
          lockTarget
            ? `Lock ${lockTarget.name}? Locked financial years cannot be edited.`
            : "Lock this financial year?"
        }
        onConfirm={async () => {
          if (!lockTarget) {
            return;
          }

          try {
            setLocking(true);
            await financialYearApi.lock(lockTarget.id);
            toast.success("Financial year locked");
            setLockTarget(null);
            await loadFinancialYears();
          } catch (error) {
            toast.error(getErrorMessage(error, "Failed to lock financial year"));
          } finally {
            setLocking(false);
          }
        }}
      />
    </div>
  );
};

