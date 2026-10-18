import { supabase } from "@/integrations/supabase/client";

export interface CompressOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
}

/**
 * Mengompres gambar di browser dan mengubahnya menjadi WebP.
 */
export async function compressImage(
  file: File,
  options: CompressOptions = {},
): Promise<Blob> {
  const { maxWidth = 1024, maxHeight = 1024, quality = 0.75 } = options;

  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("File yang dipilih bukan gambar yang valid."));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Gagal membaca file gambar."));
    reader.onload = (event) => {
      const image = new Image();
      image.onerror = () => reject(new Error("Gagal memuat elemen gambar."));
      image.onload = () => {
        let { width, height } = image;

        if (width > maxWidth || height > maxHeight) {
          if (width / height > maxWidth / maxHeight) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Browser tidak mendukung pengolahan gambar Canvas."));
          return;
        }

        ctx.drawImage(image, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob);
            else reject(new Error("Gagal mengekspor hasil kompresi gambar."));
          },
          "image/webp",
          quality,
        );
      };
      image.src = String(event.target?.result ?? "");
    };

    reader.readAsDataURL(file);
  });
}

/**
 * Mengompres dan mengunggah gambar ke Supabase Storage.
 */
export async function uploadCompressedMedia(
  bucket: "driver-documents" | "merchant-assets" | "payment-proofs",
  folder: string,
  prefix: string,
  file: File,
  options?: CompressOptions,
): Promise<string> {
  const compressedBlob = await compressImage(file, options);
  const cleanPrefix = prefix.replace(/[^a-zA-Z0-9_-]/g, "_").toLowerCase();
  const filePath = `${folder}/${cleanPrefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.webp`;

  const { error } = await supabase.storage.from(bucket).upload(filePath, compressedBlob, {
    contentType: "image/webp",
    upsert: false,
  });

  if (error) throw error;

  const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);
  return data.publicUrl;
}

/**
 * Kompatibilitas dengan pemanggilan upload foto driver yang sudah ada.
 */
export async function uploadDriverPhoto(userId: string, type: string, file: File): Promise<string> {
  return uploadCompressedMedia("driver-documents", userId, type, file, {
    maxWidth: 1024,
    maxHeight: 1024,
    quality: 0.75,
  });
}
