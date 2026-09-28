"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { Prisma } from "@/generated/prisma/client";
import { planPost, type PostError } from "@/modules/blog/domain/blog";
import { requireAdminUser } from "@/modules/identity/application/require-admin-user";
import {
  InvalidImageError,
  isFilledFile,
  prepareUploadedImage,
  uploadPreparedImage,
} from "@/modules/question-bank/infrastructure/uploaded-question-image";
import { getPrismaClient } from "@/shared/infrastructure/database/prisma";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_IMAGES_PER_SAVE = 10;

const errors: Readonly<Record<PostError | "SLUG_TAKEN", string>> = {
  TITLE_REQUIRED: "Informe o título (5 a 200 caracteres).",
  SLUG_INVALID: "O endereço (slug) aceita só letras minúsculas, números e hífens.",
  BODY_REQUIRED: "Escreva o texto do post.",
  TEXT_TOO_LONG: "Resumo (até 320) ou texto longos demais.",
  DATE_INVALID: "Data de publicação inválida.",
  CATEGORY_INVALID: "Categoria inválida.",
  SLUG_TAKEN: "Já existe outro post com esse endereço (slug).",
};

function readString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function readId(formData: FormData, key: string): string | null {
  const value = readString(formData, key);
  return UUID.test(value) ? value : null;
}

function fail(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

async function storeImage(transaction: Prisma.TransactionClient, file: File, alt: string): Promise<string> {
  const prepared = await prepareUploadedImage(file);
  const upload = await uploadPreparedImage(prepared);
  const asset = await transaction.mediaAsset.upsert({
    where: { checksum: prepared.checksum },
    update: {},
    create: {
      checksum: prepared.checksum,
      storageProvider: upload.provider,
      bucket: upload.bucket,
      storageKey: upload.storageKey,
      mimeType: prepared.mimeType,
      sizeBytes: BigInt(prepared.bytes.byteLength),
      width: prepared.width,
      height: prepared.height,
      altText: alt.slice(0, 500),
      sourceUrl: "admin-blog-upload",
    },
    select: { id: true },
  });
  return asset.id;
}

/** Creates or updates a post (draft, scheduled or published). */
export async function savePostAction(formData: FormData): Promise<void> {
  const admin = await requireAdminUser();

  const postId = readId(formData, "postId");
  const back = postId ? `/admin/blog/${postId}` : "/admin/blog/novo";

  const result = planPost(
    {
      title: readString(formData, "title"),
      slug: readString(formData, "slug"),
      excerpt: readString(formData, "excerpt"),
      body: readString(formData, "body"),
      status: readString(formData, "status"),
      publishAt: readString(formData, "publishAt"),
      categoryName: readString(formData, "category"),
      format: readString(formData, "format"),
      stateCode: readString(formData, "stateCode"),
      isFeatured: formData.get("isFeatured") === "on",
    },
    new Date(),
  );

  if (!result.ok) fail(back, errors[result.error]);

  const { post } = result;
  const prisma = getPrismaClient();
  const taken = await prisma.blogPost.findUnique({ where: { slug: post.slug }, select: { id: true } });
  if (taken && taken.id !== postId) fail(back, errors.SLUG_TAKEN);

  const offerId = readId(formData, "relatedOfferId");
  const boardId = readId(formData, "relatedBoardId");
  const cover = formData.get("cover");
  const images = formData.getAll("images").filter(isFilledFile).slice(0, MAX_IMAGES_PER_SAVE);

  let savedId: string;

  try {
    savedId = await prisma.$transaction(
      async (transaction) => {
        const category = post.category
          ? await transaction.blogCategory.upsert({
              where: { slug: post.category.slug },
              update: {},
              create: { slug: post.category.slug, name: post.category.name },
              select: { id: true },
            })
          : null;

        const data = {
          title: post.title,
          slug: post.slug,
          excerpt: post.excerpt,
          body: post.body,
          status: post.status,
          publishedAt: post.publishedAt,
          categoryId: category?.id ?? null,
          relatedOfferId: offerId,
          relatedBoardId: boardId,
          format: post.format,
          stateCode: post.stateCode,
          isFeatured: post.isFeatured,
          ...(isFilledFile(cover) ? { coverAssetId: await storeImage(transaction, cover, `Capa: ${post.title}`) } : {}),
          ...(formData.get("removeCover") === "on" && !isFilledFile(cover) ? { coverAssetId: null } : {}),
        };

        const row = postId
          ? await transaction.blogPost.update({ where: { id: postId }, data, select: { id: true } })
          : await transaction.blogPost.create({ data: { ...data, authorProfileId: admin.profileId }, select: { id: true } });

        if (images.length > 0) {
          const last = await transaction.blogPostImage.aggregate({ where: { postId: row.id }, _max: { position: true } });
          let position = last._max.position ?? 0;

          for (const file of images) {
            position += 1;
            const assetId = await storeImage(transaction, file, `${post.title} — imagem ${position}`);
            await transaction.blogPostImage.create({ data: { postId: row.id, mediaAssetId: assetId, position } });
          }
        }

        return row.id;
      },
      { timeout: 60_000 },
    );
  } catch (error) {
    if (error instanceof InvalidImageError) fail(back, error.message);
    throw error;
  }

  revalidatePath("/admin/blog");
  revalidatePath("/blog", "layout");
  redirect(`/admin/blog/${savedId}?ok=1`);
}

export async function deletePostAction(formData: FormData): Promise<void> {
  await requireAdminUser();

  const postId = readId(formData, "postId");
  if (!postId) fail("/admin/blog", "Post inválido.");
  if (formData.get("confirm") !== "on") fail(`/admin/blog/${postId}`, "Marque a confirmação para excluir o post.");

  await getPrismaClient().blogPost.delete({ where: { id: postId } });

  revalidatePath("/admin/blog");
  revalidatePath("/blog", "layout");
  redirect("/admin/blog?ok=excluido");
}
