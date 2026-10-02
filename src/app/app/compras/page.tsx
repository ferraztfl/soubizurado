import { redirect } from "next/navigation";

/** "Minhas compras" and "Minha assinatura" were two pages for one thing: they are now /app/assinatura. */
export default function PurchasesPage(): never {
  redirect("/app/assinatura");
}
