import type { Product } from "./types";
import { shortId } from "./id";

// Sample products shown on first run so the app demonstrates the full flow
// before a seller has created anything. These are written to localStorage once,
// then become normal editable data.
export function seedProducts(): Product[] {
  const now = Date.now();
  const at = (minsAgo: number) => new Date(now - minsAgo * 60_000).toISOString();

  return [
    {
      id: shortId(8),
      productName: "Handmade Ceramic Mug",
      pricePi: 3.5,
      description:
        "Small-batch stoneware mug, glazed in matte violet. Holds 350ml. Microwave and dishwasher safe.",
      imageUrl:
        "https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?w=800&q=80",
      sellerContact: "@ceramics_pioneer on Pi Chat",
      deliveryNote: "Ships within 3 days. Worldwide shipping included in price.",
      createdAt: at(120),
    },
    {
      id: shortId(8),
      productName: "Logo Design (1 concept)",
      pricePi: 12,
      description:
        "One custom logo concept delivered as PNG + SVG. Two rounds of revisions included. Great for new Pi shops.",
      imageUrl:
        "https://images.unsplash.com/photo-1626785774573-4b799315345d?w=800&q=80",
      sellerContact: "design.pioneer@email.example",
      deliveryNote: "Digital delivery within 48 hours after payment.",
      createdAt: at(45),
    },
  ];
}
