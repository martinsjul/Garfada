import type { Metadata } from "next";
import AppHeader from "@/components/AppHeader";
import MenuImporter from "@/components/restaurant/MenuImporter";

export const metadata: Metadata = {
  title: "Copiloto do restaurante · Garfada",
  description: "Transforme a foto do cardápio em um cardápio digital com IA.",
};

export default function RestaurantePage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader />
      <MenuImporter />
    </div>
  );
}
