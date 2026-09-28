"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import type { Prisma } from "@/generated/prisma/client";
import { ensureProfileForAuthUser } from "@/modules/identity/application/ensure-profile";
import { requireAdminUser } from "@/modules/identity/application/require-admin-user";
import { checkAccountAction, type AccountActionRefusal } from "@/modules/identity/domain/account-admin-policy";
import {
  AuthAdminUnavailableError,
  inviteAuthUser,
  loadAuthUsers,
  sendPasswordRecovery,
  setAuthUserBlocked,
} from "@/modules/identity/infrastructure/auth-user-directory";
import { getPrismaClient } from "@/shared/infrastructure/database/prisma";

const refusalMessages: Readonly<Record<AccountActionRefusal, string>> = {
  SELF_REVOKE: "Você não pode remover o seu próprio acesso de administrador.",
  SELF_BLOCK: "Você não pode bloquear a sua própria conta.",
  LAST_ADMIN: "A plataforma precisa manter pelo menos um administrador ativo.",
  ALREADY_ADMIN: "Esta conta já é administradora.",
  NOT_ADMIN: "Esta conta não é administradora.",
};

const inviteSchema = z.object({
  email: z.email("Informe um e-mail válido.").trim().toLowerCase().max(254),
  displayName: z.string().trim().min(2, "Informe o nome (mínimo de 2 letras).").max(120),
  makeAdmin: z.boolean(),
});

const accountSchema = z.object({
  profileId: z.uuid(),
  action: z.enum(["GRANT_ADMIN", "REVOKE_ADMIN", "BLOCK", "UNBLOCK", "PASSWORD_RESET"]),
});

function back(query: string): never {
  redirect(`/admin/usuarios?${query}`);
}

function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}

/** Invited and recovering users land here to choose their password. */
function passwordPageUrl(): string {
  return `${siteUrl()}/definir-senha`;
}

async function audit(entry: Prisma.AdminAuditLogUncheckedCreateInput): Promise<void> {
  await getPrismaClient().adminAuditLog.create({ data: entry });
}

/** Invites a new account by e-mail (the person sets their own password). */
export async function inviteUserAction(formData: FormData): Promise<void> {
  const admin = await requireAdminUser();

  const parsed = inviteSchema.safeParse({
    email: formData.get("email") ?? "",
    displayName: formData.get("displayName") ?? "",
    makeAdmin: formData.get("makeAdmin") === "on",
  });

  if (!parsed.success) {
    back(`error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Dados inválidos.")}`);
  }

  let result: Awaited<ReturnType<typeof inviteAuthUser>>;

  try {
    result = await inviteAuthUser({ email: parsed.data.email, displayName: parsed.data.displayName, redirectTo: passwordPageUrl() });
  } catch (error) {
    back(`error=${encodeURIComponent(error instanceof AuthAdminUnavailableError ? "Autenticação do Supabase não configurada no servidor." : "Convite não enviado.")}`);
  }

  if (!result.ok) {
    back(
      `error=${encodeURIComponent(
        result.reason === "EXISTS"
          ? "Já existe uma conta com este e-mail."
          : "O Supabase não enviou o convite (limite de e-mails por hora ou SMTP não configurado). Tente mais tarde.",
      )}`,
    );
  }

  const profile = await ensureProfileForAuthUser({ authUserId: result.authUserId, displayName: parsed.data.displayName });
  const prisma = getPrismaClient();

  if (parsed.data.makeAdmin) {
    await prisma.userRole.upsert({
      where: { profileId_role: { profileId: profile.id, role: "ADMIN" } },
      update: {},
      create: { profileId: profile.id, role: "ADMIN" },
    });
  }

  await audit({
    actorProfileId: admin.profileId,
    action: "INVITE",
    targetProfileId: profile.id,
    targetAuthUserId: result.authUserId,
    details: { email: parsed.data.email, admin: parsed.data.makeAdmin },
  });

  revalidatePath("/admin/usuarios");
  back(`ok=INVITE`);
}

/** Role change, block/unblock or password reset for one account. */
export async function accountAction(formData: FormData): Promise<void> {
  const admin = await requireAdminUser();

  const parsed = accountSchema.safeParse({
    profileId: formData.get("profileId") ?? "",
    action: formData.get("action") ?? "",
  });

  if (!parsed.success) {
    back(`error=${encodeURIComponent("Ação inválida.")}`);
  }

  const { profileId, action } = parsed.data;
  const prisma = getPrismaClient();
  const [target, admins] = await Promise.all([
    prisma.profile.findUnique({
      where: { id: profileId },
      select: { id: true, authUserId: true, roles: { select: { role: true } } },
    }),
    prisma.userRole.findMany({ where: { role: "ADMIN" }, select: { profile: { select: { authUserId: true } } } }),
  ]);

  if (!target) {
    back(`error=${encodeURIComponent("Conta não encontrada.")}`);
  }

  const adminAccounts = await loadAuthUsers(admins.map((row) => row.profile.authUserId));
  const activeAdminCount = admins.filter((row) => !adminAccounts.get(row.profile.authUserId)?.blocked).length;

  const refusal = checkAccountAction({
    action,
    actorProfileId: admin.profileId,
    targetProfileId: target.id,
    targetIsAdmin: target.roles.some((row) => row.role === "ADMIN"),
    activeAdminCount,
  });

  if (refusal) {
    back(`error=${encodeURIComponent(refusalMessages[refusal])}`);
  }

  let details: Prisma.InputJsonObject = {};

  try {
    switch (action) {
      case "GRANT_ADMIN":
        await prisma.userRole.create({ data: { profileId: target.id, role: "ADMIN" } });
        break;
      case "REVOKE_ADMIN":
        await prisma.userRole.delete({ where: { profileId_role: { profileId: target.id, role: "ADMIN" } } });
        break;
      case "BLOCK":
      case "UNBLOCK":
        await setAuthUserBlocked(target.authUserId, action === "BLOCK");
        break;
      case "PASSWORD_RESET":
        details = { email: await sendPasswordRecovery(target.authUserId, passwordPageUrl()) };
        break;
    }
  } catch (error) {
    back(
      `error=${encodeURIComponent(
        error instanceof AuthAdminUnavailableError
          ? "Autenticação do Supabase não configurada no servidor."
          : "Não foi possível concluir a ação. Tente de novo.",
      )}`,
    );
  }

  await audit({ actorProfileId: admin.profileId, action, targetProfileId: target.id, targetAuthUserId: target.authUserId, details });

  revalidatePath("/admin/usuarios");
  back(`ok=${action}`);
}

const premiumSchema = z.object({
  profileId: z.uuid(),
  operation: z.enum(["grant", "revoke"]),
  /** 0 = no end date. */
  days: z.coerce.number().refine((value) => [0, 30, 90, 180, 365].includes(value)),
});

/** Grants (courtesy, support) or revokes premium question-bank access. */
export async function premiumAction(formData: FormData): Promise<void> {
  const admin = await requireAdminUser();

  const parsed = premiumSchema.safeParse({
    profileId: formData.get("profileId") ?? "",
    operation: formData.get("operation") ?? "",
    days: formData.get("days") ?? "0",
  });

  if (!parsed.success) {
    back(`error=${encodeURIComponent("Ação inválida.")}`);
  }

  const prisma = getPrismaClient();
  const target = await prisma.profile.findUnique({ where: { id: parsed.data.profileId }, select: { id: true, authUserId: true } });

  if (!target) {
    back(`error=${encodeURIComponent("Conta não encontrada.")}`);
  }

  const now = new Date();

  if (parsed.data.operation === "grant") {
    await prisma.entitlement.create({
      data: {
        profileId: target.id,
        kind: "QUESTION_BANK",
        startsAt: now,
        endsAt: parsed.data.days === 0 ? null : new Date(now.getTime() + parsed.data.days * 86_400_000),
        source: "ADMIN",
        grantedByProfileId: admin.profileId,
        note: "Concedido pelo painel",
      },
    });
  } else {
    // Only admin grants are revoked here; paid access is handled by its order/subscription.
    await prisma.entitlement.updateMany({
      where: { profileId: target.id, kind: "QUESTION_BANK", source: "ADMIN", revokedAt: null },
      data: { revokedAt: now },
    });
  }

  await audit({
    actorProfileId: admin.profileId,
    action: parsed.data.operation === "grant" ? "GRANT_PREMIUM" : "REVOKE_PREMIUM",
    targetProfileId: target.id,
    targetAuthUserId: target.authUserId,
    details: { days: parsed.data.days },
  });

  revalidatePath("/admin/usuarios");
  back(`ok=${parsed.data.operation === "grant" ? "GRANT_PREMIUM" : "REVOKE_PREMIUM"}`);
}
