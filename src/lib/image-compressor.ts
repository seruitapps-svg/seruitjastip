import { supabase } from "@/integrations/supabase/client";

export async function compressImage(file: File, maxWidth = 1024, quality = 0.75): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => reject(new Error("Gagal membaca file gambar."));
    reader.onload = (event) => {
      const image = new Image();
      image.onerror = () => reject(new Error("File yang dipilih bukan gambar yang valid."));
      image.onload = () => {
        const canvas = document.createElement("canvas");
        let { width, height } = image;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext("2d");
        if (!context) {
          reject(new Error("Browser tidak dapat memproses gambar."));
          return;
        }

        context.drawImage(image, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob);
            else reject(new Error("Kompresi gambar gagal."));
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

export async function uploadDriverPhoto(userId: string, type: string, file: File): Promise<string> {
  const compressedBlob = await compressImage(file);
  const filePath = `${userId}/${type}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.webp`;

  const { error } = await supabase.storage.from("driver-documents").upload(filePath, compressedBlob, {
    contentType: "image/webp",
    upsert: false,
  });

  if (error) throw error;

  const { data } = supabase.storage.from("driver-documents").getPublicUrl(filePath);
  return data.publicUrl;
}
