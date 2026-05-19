import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { SectionGrid } from "../../../components/ui/SectionGrid";
import { Select } from "../../../components/ui/Select";
import { SideSheet } from "../../../components/ui/SideSheet";
import type { Employee } from "../../../types/payroll";
import {
  EMPLOYEE_STATUS_OPTIONS,
  EMPLOYMENT_TYPE_OPTIONS,
  SALARY_TYPE_OPTIONS,
} from "../payrollOptions";
import { employeeFormSchema, type EmployeeFormValues } from "../payrollSchemas";
import { buildEmployeeDefaults, mapEmployeeFormToPayload } from "../payrollUtils";

type DrawerMode = "create" | "edit" | "view";

export const EmployeeDrawer = ({
  open,
  employee,
  mode,
  submitting,
  onClose,
  onSubmit,
}: {
  open: boolean;
  employee?: Employee | null;
  mode: DrawerMode;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (payload: ReturnType<typeof mapEmployeeFormToPayload>) => Promise<void> | void;
}) => {
  const form = useForm<z.input<typeof employeeFormSchema>, undefined, EmployeeFormValues>({
    resolver: zodResolver(employeeFormSchema),
    defaultValues: buildEmployeeDefaults(employee),
  });

  useEffect(() => {
    form.reset(buildEmployeeDefaults(employee));
  }, [employee, form, open]);

  const readOnly = mode === "view";
  const title = mode === "create" ? "Add Employee" : mode === "edit" ? "Edit Employee" : "Employee Details";

  return (
    <SideSheet
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {readOnly ? "Close" : "Cancel"}
          </Button>
          {!readOnly ? (
            <Button loading={submitting} onClick={form.handleSubmit(async (values) => onSubmit(mapEmployeeFormToPayload(values)))}>
              Save Employee
            </Button>
          ) : null}
        </>
      }
    >
      <form className="space-y-6">
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-900">Personal Details</h3>
          <SectionGrid>
            <Input label="Name" disabled={readOnly} {...form.register("fullName")} error={form.formState.errors.fullName?.message} />
            <Input label="Mobile" disabled={readOnly} {...form.register("mobile")} error={form.formState.errors.mobile?.message} />
            <Input label="Email" disabled={readOnly} {...form.register("email")} error={form.formState.errors.email?.message} />
            <Input label="PAN" disabled={readOnly} {...form.register("panNumber")} error={form.formState.errors.panNumber?.message} />
            <Input
              label="Aadhaar Last 4"
              disabled={readOnly}
              {...form.register("aadhaarLast4")}
              error={form.formState.errors.aadhaarLast4?.message}
            />
            <Input
              label="Joining Date"
              type="date"
              disabled={readOnly}
              {...form.register("joiningDate")}
              error={form.formState.errors.joiningDate?.message}
            />
          </SectionGrid>
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-900">Employment Details</h3>
          <SectionGrid>
            <Input label="Department" disabled={readOnly} {...form.register("department")} error={form.formState.errors.department?.message} />
            <Input label="Designation" disabled={readOnly} {...form.register("designation")} error={form.formState.errors.designation?.message} />
            <Select
              label="Employment Type"
              disabled={readOnly}
              {...form.register("employmentType")}
              error={form.formState.errors.employmentType?.message}
            >
              {EMPLOYMENT_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
            <Select
              label="Salary Type"
              disabled={readOnly}
              {...form.register("salaryType")}
              error={form.formState.errors.salaryType?.message}
            >
              {SALARY_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
            <Select label="Status" disabled={readOnly} {...form.register("status")} error={form.formState.errors.status?.message}>
              {EMPLOYEE_STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </SectionGrid>
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-900">Address</h3>
          <SectionGrid>
            <Input label="Address Line 1" disabled={readOnly} {...form.register("addressLine1")} error={form.formState.errors.addressLine1?.message} />
            <Input label="Address Line 2" disabled={readOnly} {...form.register("addressLine2")} error={form.formState.errors.addressLine2?.message} />
            <Input label="City" disabled={readOnly} {...form.register("city")} error={form.formState.errors.city?.message} />
            <Input label="State" disabled={readOnly} {...form.register("state")} error={form.formState.errors.state?.message} />
            <Input label="Pincode" disabled={readOnly} {...form.register("pincode")} error={form.formState.errors.pincode?.message} />
          </SectionGrid>
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-900">Emergency Contact</h3>
          <SectionGrid className="xl:grid-cols-2">
            <Input
              label="Contact Name"
              disabled={readOnly}
              {...form.register("emergencyContactName")}
              error={form.formState.errors.emergencyContactName?.message}
            />
            <Input
              label="Contact Mobile"
              disabled={readOnly}
              {...form.register("emergencyContactMobile")}
              error={form.formState.errors.emergencyContactMobile?.message}
            />
          </SectionGrid>
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-900">Bank Details</h3>
          <SectionGrid>
            <Input label="Bank Name" disabled={readOnly} {...form.register("bankName")} error={form.formState.errors.bankName?.message} />
            <Input
              label="Account Holder"
              disabled={readOnly}
              {...form.register("accountHolderName")}
              error={form.formState.errors.accountHolderName?.message}
            />
            <Input
              label="Account Number"
              disabled={readOnly}
              {...form.register("accountNumber")}
              error={form.formState.errors.accountNumber?.message}
            />
            <Input label="IFSC" disabled={readOnly} {...form.register("ifscCode")} error={form.formState.errors.ifscCode?.message} />
            <Input label="UPI ID" disabled={readOnly} {...form.register("upiId")} error={form.formState.errors.upiId?.message} />
          </SectionGrid>
        </section>
      </form>
    </SideSheet>
  );
};
