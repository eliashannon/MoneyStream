import Image from "next/image";
import logoSymbol from "@/public/moneystream-symbol.png";
import logoWordmark from "@/public/moneystream-wordmark.png";

export function BrandLogo() {
  return <><Image className="finance-logo-symbol" src={logoSymbol} alt="" unoptimized /><Image className="finance-logo-wordmark" src={logoWordmark} alt="MoneyStream" unoptimized /></>;
}
