import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";

import { getErrorMessage } from "../../lib/errors";
import { usersApi } from "../../services/usersApi";
import type { InviteRecord } from "../../types/api";
import { useToast } from "../../providers/useToast";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/EmptyState";
import { Input } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { PageHeader } from "../../components/ui/PageHeader";
import { Select } from "../../components/ui/Select";
import { Table, TableWrapper } from "../../components/ui/Table";
import { inviteSchema } from "./settingsSchemas";
import { PermissionCheckboxGrid } from "./components/PermissionCheckboxGrid";

type InviteValues = z.infer<typeof inviteSchema>;

const inviteTone: Record<InviteRecord["status"], "warning" | "success" | "neutral" | "danger"> = {
  pending: "warning",
  accepted: "success",
  expired: "neutral",
  revoked: "danger",
};

export const InvitesPage = () => {
  const toast = useToast();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [invites, setInvites] = useState<InviteRecord[]>([]);
  const [loadingInvites, setLoadingInvites] = useState(true);
  const [activeInviteActionId, setActiveInviteActionId] = useState<string | null>(null);
  const form = useForm<InviteValues>({
    resolver: zodResolver(inviteSchema),
    defaultValues: {
      fullName: "",
      email: "",
      mobileNumber: "",
      role: "accountant",
      permissions: [],
    },
  });

  const loadInvites = async () => {
    try {
      setLoadingInvites(true);
      const response = await usersApi.listInvites();
      setInvites(response.data);
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to load invites"));
    } finally {
      setLoadingInvites(false);
    }
  };

  useEffect(() => {
    void loadInvites();
  }, []);

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await usersApi.invite({
        ...values,
        email: values.email.toLowerCase(),
      });
      await loadInvites();
      setIsModalOpen(false);
      form.reset();
      toast.success("Invite sent successfully");
    } catch (error) {
      toast.error(getErrorMessage(error, "Invite failed"));
    }
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Invites"
        actions={
          <Button onClick={() => setIsModalOpen(true)}>
            Invite User
          </Button>
        }
      />

      {!loadingInvites && !invites.length ? (
        <EmptyState title="No invites found" action={<Button onClick={() => setIsModalOpen(true)}>Create Invite</Button>} />
      ) : (
        <Card>
          <TableWrapper className="border-none">
            <Table>
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  {["Name", "Email", "Role", "Status", "Expires", "Actions"].map((head) => (
                    <th key={head} className="px-5 py-3 font-semibold">
                      {head}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                {loadingInvites ? (
                  <tr>
                    <td className="px-5 py-6 text-center text-slate-500" colSpan={6}>
                      Loading invites...
                    </td>
                  </tr>
                ) : null}
                {invites.map((invite) => (
                  <tr key={invite.id}>
                    <td className="px-5 py-4 font-medium text-slate-900">{invite.fullName}</td>
                    <td className="px-5 py-4">{invite.email}</td>
                    <td className="px-5 py-4 capitalize">{invite.role}</td>
                    <td className="px-5 py-4">
                      <Badge tone={inviteTone[invite.status]}>{invite.status}</Badge>
                    </td>
                    <td className="px-5 py-4">{new Date(invite.expiresAt).toLocaleString()}</td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="secondary"
                          disabled={invite.status !== "pending" || activeInviteActionId === invite.id}
                          onClick={async () => {
                            try {
                              setActiveInviteActionId(invite.id);
                              await usersApi.resendInvite(invite.id);
                              await loadInvites();
                              toast.success("Invite resent");
                            } catch (error) {
                              toast.error(getErrorMessage(error, "Resend failed"));
                            } finally {
                              setActiveInviteActionId(null);
                            }
                          }}
                        >
                          Resend
                        </Button>
                        <Button
                          variant="danger"
                          disabled={invite.status !== "pending" || activeInviteActionId === invite.id}
                          onClick={async () => {
                            try {
                              setActiveInviteActionId(invite.id);
                              await usersApi.revokeInvite(invite.id);
                              await loadInvites();
                              toast.success("Invite revoked");
                            } catch (error) {
                              toast.error(getErrorMessage(error, "Revoke failed"));
                            } finally {
                              setActiveInviteActionId(null);
                            }
                          }}
                        >
                          Revoke
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableWrapper>
        </Card>
      )}

      <Modal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Invite User"
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button form="invite-user-form" type="submit" loading={form.formState.isSubmitting}>
              Send Invite
            </Button>
          </>
        }
      >
        <form id="invite-user-form" className="space-y-4" onSubmit={onSubmit}>
          <Input label="Full Name" {...form.register("fullName")} error={form.formState.errors.fullName?.message} />
          <Input label="Email" type="email" {...form.register("email")} error={form.formState.errors.email?.message} />
          <Input
            label="Mobile Number"
            inputMode="numeric"
            {...form.register("mobileNumber")}
            error={form.formState.errors.mobileNumber?.message}
          />
          <Select label="Role" {...form.register("role")} error={form.formState.errors.role?.message}>
            <option value="accountant">Accountant</option>
            <option value="staff">Staff</option>
            <option value="auditor">Auditor</option>
          </Select>
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-800">Custom Permissions</h3>
            <PermissionCheckboxGrid
              selected={form.watch("permissions")}
              onChange={(next) => form.setValue("permissions", next, { shouldValidate: true })}
            />
          </div>
        </form>
      </Modal>
    </div>
  );
};
