import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "../../../components/ui/Button";
import { Card, CardContent } from "../../../components/ui/Card";
import { Input } from "../../../components/ui/Input";
import { SectionGrid } from "../../../components/ui/SectionGrid";
import { Select } from "../../../components/ui/Select";
import { SideSheet } from "../../../components/ui/SideSheet";
import type { Employee, SalaryStructure } from "../../../types/payroll";
import { salaryStructureFormSchema, type SalaryStructureFormValues } from "../payrollSchemas";
import {
  buildSalaryStructureDefaults,
  calculateStructureTotals,
  mapStructureFormToPayload,
} from "../payrollUtils";

export const SalaryStructureDrawer = ({
  open,
  employee,
  structure,
  submitting,
  onClose,
  onSubmit,
}: {
  open: boolean;
  employee: Employee | null;
  structure?: SalaryStructure | null;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (payload: ReturnType<typeof mapStructureFormToPayload>) => Promise<void> | void;
}) => {
  const form = useForm<z.input<typeof salaryStructureFormSchema>, undefined, SalaryStructureFormValues>({
    resolver: zodResolver(salaryStructureFormSchema),
    defaultValues: buildSalaryStructureDefaults(structure),
  });

  useEffect(() => {
    form.reset(buildSalaryStructureDefaults(structure));
  }, [form, open, structure]);

  const watched = form.watch();
  const totals = calculateStructureTotals({
    basicSalary: Number(watched.basicSalary ?? 0),
    hra: Number(watched.hra ?? 0),
    conveyanceAllowance: Number(watched.conveyanceAllowance ?? 0),
    medicalAllowance: Number(watched.medicalAllowance ?? 0),
    otherAllowance: Number(watched.otherAllowance ?? 0),
    pfDeduction: Number(watched.pfDeduction ?? 0),
    esicDeduction: Number(watched.esicDeduction ?? 0),
    professionalTax: Number(watched.professionalTax ?? 0),
    tdsDeduction: Number(watched.tdsDeduction ?? 0),
    otherDeduction: Number(watched.otherDeduction ?? 0),
  });

  return (
    <SideSheet
      open={open}
      onClose={onClose}
      title={structure ? `Edit Salary Structure${employee ? ` · ${employee.fullName}` : ""}` : `Add Salary Structure${employee ? ` · ${employee.fullName}` : ""}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={submitting} onClick={form.handleSubmit(async (values) => onSubmit(mapStructureFormToPayload(values)))}>
            Save Structure
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Card>
          <CardContent className="grid gap-3 md:grid-cols-3">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-slate-500">Gross</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">{totals.gross.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-slate-500">Deductions</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">{totals.deductions.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-slate-500">Net Salary</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">{totals.net.toFixed(2)}</p>
            </div>
          </CardContent>
        </Card>

        <SectionGrid>
          <Input type="number" step="0.01" label="Basic" {...form.register("basicSalary")} error={form.formState.errors.basicSalary?.message} />
          <Input type="number" step="0.01" label="HRA" {...form.register("hra")} error={form.formState.errors.hra?.message} />
          <Input
            type="number"
            step="0.01"
            label="Conveyance"
            {...form.register("conveyanceAllowance")}
            error={form.formState.errors.conveyanceAllowance?.message}
          />
          <Input
            type="number"
            step="0.01"
            label="Medical"
            {...form.register("medicalAllowance")}
            error={form.formState.errors.medicalAllowance?.message}
          />
          <Input
            type="number"
            step="0.01"
            label="Other Allowance"
            {...form.register("otherAllowance")}
            error={form.formState.errors.otherAllowance?.message}
          />
          <Input type="number" step="0.01" label="PF" {...form.register("pfDeduction")} error={form.formState.errors.pfDeduction?.message} />
          <Input type="number" step="0.01" label="ESIC" {...form.register("esicDeduction")} error={form.formState.errors.esicDeduction?.message} />
          <Input
            type="number"
            step="0.01"
            label="Professional Tax"
            {...form.register("professionalTax")}
            error={form.formState.errors.professionalTax?.message}
          />
          <Input type="number" step="0.01" label="TDS" {...form.register("tdsDeduction")} error={form.formState.errors.tdsDeduction?.message} />
          <Input
            type="number"
            step="0.01"
            label="Other Deduction"
            {...form.register("otherDeduction")}
            error={form.formState.errors.otherDeduction?.message}
          />
          <Input
            type="date"
            label="Effective From"
            {...form.register("effectiveFrom")}
            error={form.formState.errors.effectiveFrom?.message}
          />
          <Input type="date" label="Effective To" {...form.register("effectiveTo")} error={form.formState.errors.effectiveTo?.message} />
          <Select
            label="Status"
            value={String(form.watch("isActive"))}
            onChange={(event) => form.setValue("isActive", event.target.value === "true")}
            error={form.formState.errors.isActive?.message}
          >
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </Select>
        </SectionGrid>
      </div>
    </SideSheet>
  );
};
