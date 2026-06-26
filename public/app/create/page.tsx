"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { Field } from "@/components/Field";
import { Button } from "@/components/Button";
import { createProduct } from "@/lib/storage";
import type { ProductDraft } from "@/lib/types";

const empty: ProductDraft = {
  productName: "",
  pricePi: 0,
  description: "",
  imageUrl: "",
  sellerContact: "",
  deliveryNote: "",
};

export default function CreateProductPage() {
  const router = useRouter();
  const [form, setForm] = useState<ProductDraft>(empty);
  const [priceText, setPriceText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function update<K extends keyof ProductDraft>(key: K, value: ProductDraft[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  // Allow only a non-negative decimal: digits with at most one dot. This blocks
  // "-", "e", "+" and other characters so the price can never become negative.
  function updatePrice(value: string) {
    if (value === "" || /^\d*\.?\d*$/.test(value)) setPriceText(value);
  }

  function handleSubmit() {
    setError(null);

    const price = Number(priceText);
    if (!form.productName.trim()) return setError("Add a product name.");
    if (!priceText.trim() || !Number.isFinite(price) || price <= 0)
      return setError("Enter a price in Pi greater than 0.");
    if (!form.imageUrl.trim()) return setError("Add an image URL.");
    if (!form.sellerContact.trim())
      return setError("Add a seller contact so buyers can reach you.");

    setSaving(true);
    const product = createProduct({
      ...form,
      productName: form.productName.trim(),
      pricePi: price,
      imageUrl: form.imageUrl.trim(),
      sellerContact: form.sellerContact.trim(),
    });
    // Generated product detail link -> go straight to it.
    router.push(`/product/${product.id}`);
  }

  return (
    <>
      <PageHeader title="Create product" back />

      <main className="flex flex-1 flex-col gap-4 px-5 pt-5">
        <Field
          label="Product name"
          placeholder="Handmade ceramic mug"
          value={form.productName}
          onChange={(e) => update("productName", e.target.value)}
          maxLength={80}
        />

        <Field
          label="Price (Pi)"
          inputMode="decimal"
          placeholder="3.5"
          value={priceText}
          onChange={(e) => updatePrice(e.target.value)}
          hint="Amount in Pi the buyer will pay."
        />

        <Field
          label="Description"
          textarea
          placeholder="What is it? Size, materials, what's included…"
          value={form.description}
          onChange={(e) => update("description", e.target.value)}
          maxLength={600}
        />

        <Field
          label="Image URL"
          inputMode="url"
          placeholder="https://…"
          value={form.imageUrl}
          onChange={(e) => update("imageUrl", e.target.value)}
          hint="Paste a link to a photo of your product."
        />

        <Field
          label="Seller contact"
          placeholder="@your_handle or email"
          value={form.sellerContact}
          onChange={(e) => update("sellerContact", e.target.value)}
          hint="How buyers reach you after paying."
        />

        <Field
          label="Delivery / service note"
          textarea
          placeholder="Ships in 3 days. Worldwide shipping included."
          value={form.deliveryNote}
          onChange={(e) => update("deliveryNote", e.target.value)}
          maxLength={300}
        />

        {error ? (
          <p className="rounded-2xl bg-danger/10 px-4 py-3 text-[14px] text-danger">
            {error}
          </p>
        ) : null}

        <div className="h-2" />
      </main>

      <div className="sticky bottom-0 z-20 mt-auto border-t border-hairline bg-canvas/90 px-5 pt-3 pb-safe backdrop-blur-md">
        <Button onClick={handleSubmit} disabled={saving}>
          {saving ? "Creating…" : "Create product page"}
        </Button>
      </div>
    </>
  );
}
